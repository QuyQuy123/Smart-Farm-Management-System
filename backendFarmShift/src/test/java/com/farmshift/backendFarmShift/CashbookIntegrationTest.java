package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.*;
import com.farmshift.backendFarmShift.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CashbookIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired CashFundRepository fundRepository;
    @Autowired CashTransactionRepository txRepository;
    @Autowired CashFundTransferRepository transferRepository;
    @Autowired CycleCostAllocationRepository costAllocationRepository;
    @Autowired FarmAssetRepository assetRepository;
    @Autowired PayrollRecordRepository payrollRepository;
    @Autowired CashTransactionCategoryRepository categoryRepository;

    @BeforeEach
    void cleanSlate() {
        transferRepository.deleteAll();
        txRepository.deleteAll();
        fundRepository.deleteAll();
        costAllocationRepository.deleteAll();
        assetRepository.deleteAll();
        payrollRepository.deleteAll();
        categoryRepository.deleteAll();
    }

    @Test
    @WithMockUser(username = "ketoan@smartfarm.com", authorities = "ROLE_ACCOUNTANT")
    void accountantManagesFundsAndUpdatesVoucherWithAtomicBalanceReversal() throws Exception {
        // 1. FIN-07: Create two funds
        var fundARes = mvc.perform(post("/api/cashbook/funds")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Tiền Mặt Test", "—", "Thủ quỹ", "CASH", 10_000_000L, "Ghi chú"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.balance").value(10_000_000))
                .andReturn();
        long fundAId = mapper.readTree(fundARes.getResponse().getContentAsString()).path("data").path("id").asLong();

        var fundBRes = mvc.perform(post("/api/cashbook/funds")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashFundRequest("TK Ngân Hàng Test", "123456", "MB Bank", "BANK", 50_000_000L, ""))))
                .andExpect(status().isCreated())
                .andReturn();
        long fundBId = mapper.readTree(fundBRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Update fund metadata
        mvc.perform(put("/api/cashbook/funds/" + fundAId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Tiền Mặt Đã Sửa", "—", "Thủ quỹ", "CASH", 10_000_000L, "Cập nhật"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Quỹ Tiền Mặt Đã Sửa"));

        // 2. FIN-08: Create Chi voucher on Fund A (10M - 2M = 8M)
        var txRes = mvc.perform(post("/api/cashbook/transactions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashTransactionRequest(
                        LocalDate.of(2026, 10, 15), "Chi", "Tiền điện & nước", 2_000_000L,
                        "Đối tượng khác", "Điện lực", fundAId, "Hóa đơn tháng 10"
                ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code").exists())
                .andReturn();
        long txId = mapper.readTree(txRes.getResponse().getContentAsString()).path("data").path("id").asLong();
        assertEquals(8_000_000L, fundRepository.findById(fundAId).orElseThrow().getBalance());

        // Cannot delete fund that already has transactions -> 409 CASH_FUND_IN_USE
        mvc.perform(delete("/api/cashbook/funds/" + fundAId))
                .andExpect(status().isConflict());

        // 3. FIN-08: Edit voucher -> move to Fund B & change to Thu 3,000,000
        // Fund A must revert back to 10,000,000; Fund B becomes 53,000,000
        mvc.perform(put("/api/cashbook/transactions/" + txId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashTransactionRequest(
                        LocalDate.of(2026, 10, 16), "Thu", "Đơn bán gà", 3_000_000L,
                        "Khách hàng", "Thương lái Minh", fundBId, "Đã sửa sang phiếu thu"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("Thu"))
                .andExpect(jsonPath("$.data.amount").value(3_000_000))
                .andExpect(jsonPath("$.data.fundId").value(fundBId));

        assertEquals(10_000_000L, fundRepository.findById(fundAId).orElseThrow().getBalance());
        assertEquals(53_000_000L, fundRepository.findById(fundBId).orElseThrow().getBalance());

        // 4. Internal Fund Transfer: transfer 5,000,000 + fee 10,000 from Fund B to Fund A
        mvc.perform(post("/api/cashbook/transfers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashFundTransferRequest(
                        LocalDate.of(2026, 10, 17), fundBId, fundAId, 5_000_000L, 10_000L, "Rút quỹ chi tiêu"
                ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.amount").value(5_000_000));

        assertEquals(15_000_000L, fundRepository.findById(fundAId).orElseThrow().getBalance());
        assertEquals(47_990_000L, fundRepository.findById(fundBId).orElseThrow().getBalance());

        // 5. Summary reflects filtered totals
        mvc.perform(get("/api/cashbook/summary").param("type", "Thu").param("search", "Minh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRevenue").value(3_000_000))
                .andExpect(jsonPath("$.data.transactions.length()").value(1))
                .andExpect(jsonPath("$.data.transfers.length()").value(1));

        // 6. Delete voucher reverses Fund B delta cleanly
        mvc.perform(delete("/api/cashbook/transactions/" + txId))
                .andExpect(status().isOk());
        assertEquals(44_990_000L, fundRepository.findById(fundBId).orElseThrow().getBalance());
    }

    @Test
    @WithMockUser(username = "ketoan@smartfarm.com", authorities = "ROLE_ACCOUNTANT")
    void crudCostAllocationsAssetsCategoriesAndInsufficientBalanceGuard() throws Exception {
        var fundRes = mvc.perform(post("/api/cashbook/funds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Tiền Mặt", "—", "Thủ quỹ", "CASH", 5_000_000L, ""))))
                .andExpect(status().isCreated())
                .andReturn();
        long fundId = mapper.readTree(fundRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Insufficient fund balance guard on Chi
        mvc.perform(post("/api/cashbook/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionRequest(
                                LocalDate.of(2026, 10, 20), "Chi", "Chi phí khác", 6_000_000L,
                                "Đối tượng khác", "Nhà cung cấp", fundId, "Vượt số dư"
                        ))))
                .andExpect(status().isBadRequest());

        // Cost allocation CRUD
        var allocRes = mvc.perform(post("/api/cashbook/cost-allocations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CycleCostAllocationRequest(
                                null, "Nhà A1", "LUA-01", "Điện năng", 1_500_000L, "PC0001", LocalDate.of(2026, 10, 20), "Ghi chú"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.house").value("Nhà A1"))
                .andReturn();
        long allocId = mapper.readTree(allocRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        mvc.perform(put("/api/cashbook/cost-allocations/" + allocId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CycleCostAllocationRequest(
                                null, "Nhà A2", "LUA-01", "Điện năng", 2_000_000L, "PC0001", LocalDate.of(2026, 10, 20), "Cập nhật"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amount").value(2_000_000));

        mvc.perform(delete("/api/cashbook/cost-allocations/" + allocId))
                .andExpect(status().isOk());

        // Farm asset CRUD
        var assetRes = mvc.perform(post("/api/cashbook/assets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new FarmAssetRequest(
                                "Máy phát điện 20kVA", 36_000_000L, 24, "Toàn trang trại", LocalDate.of(2026, 10, 1), "Đang trích khấu hao", ""
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.monthlyDep").value(1_500_000))
                .andReturn();
        long assetId = mapper.readTree(assetRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        mvc.perform(delete("/api/cashbook/assets/" + assetId))
                .andExpect(status().isOk());

        // Cash transaction category CRUD + duplicate & in-use checks
        var catRes = mvc.perform(post("/api/cashbook/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionCategoryRequest(
                                "Tiền trấu độn chuồng", "Chi", "Chi phí biến đổi", "Mua trấu"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        long catId = mapper.readTree(catRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        mvc.perform(post("/api/cashbook/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionCategoryRequest(
                                "Tiền trấu độn chuồng", "Chi", "Chi phí biến đổi", ""
                        ))))
                .andExpect(status().isConflict());

        var usedTxRes = mvc.perform(post("/api/cashbook/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionRequest(
                                LocalDate.of(2026, 10, 21), "Chi", "Tiền trấu độn chuồng", 1_000_000L,
                                "Nhà cung cấp", "Hộ dân A", fundId, ""
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        long usedTxId = mapper.readTree(usedTxRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        mvc.perform(delete("/api/cashbook/categories/" + catId))
                .andExpect(status().isConflict());

        mvc.perform(delete("/api/cashbook/transactions/" + usedTxId)).andExpect(status().isOk());
        mvc.perform(delete("/api/cashbook/categories/" + catId)).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "ketoan@smartfarm.com", authorities = "ROLE_ACCOUNTANT")
    void payrollCrudAndAtomicDisbursementToCashFund() throws Exception {
        var fundRes = mvc.perform(post("/api/cashbook/funds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Trả Lương", "—", "Thủ quỹ", "CASH", 10_000_000L, ""))))
                .andExpect(status().isCreated())
                .andReturn();
        long fundId = mapper.readTree(fundRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        var payrollRes = mvc.perform(post("/api/cashbook/payrolls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new PayrollRequest(
                                null, "Lê Văn Công", "2026-10", 20, 400_000L, 500_000L, 1_000_000L, "Công chăm sóc"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.total").value(8_500_000))
                .andExpect(jsonPath("$.data.remain").value(7_500_000))
                .andExpect(jsonPath("$.data.status").value("Còn nợ lương"))
                .andReturn();
        long payrollId = mapper.readTree(payrollRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Exceeding remaining amount fails 400
        mvc.perform(post("/api/cashbook/payrolls/" + payrollId + "/pay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new PayrollPayRequest(8_000_000L, fundId, LocalDate.of(2026, 10, 25), "Vượt mức"))))
                .andExpect(status().isBadRequest());

        // Atomic pay creates PC voucher and reduces fund balance cleanly
        mvc.perform(post("/api/cashbook/payrolls/" + payrollId + "/pay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new PayrollPayRequest(7_500_000L, fundId, LocalDate.of(2026, 10, 25), "Chi lương tháng 10"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paid").value(7_500_000))
                .andExpect(jsonPath("$.data.remain").value(0))
                .andExpect(jsonPath("$.data.status").value("Đã thanh toán"));

        assertEquals(2_500_000L, fundRepository.findById(fundId).orElseThrow().getBalance());
        assertTrue(txRepository.findAll().stream().anyMatch(tx ->
                "Chi".equals(tx.getType()) && "Tiền lương công nhân".equals(tx.getCategory()) && tx.getAmount() == 7_500_000L));

        // Cannot delete paid payroll -> 409 PAYROLL_IN_USE
        mvc.perform(delete("/api/cashbook/payrolls/" + payrollId))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(username = "ketoan@smartfarm.com", authorities = "ROLE_ACCOUNTANT")
    void ledgerStaysReconciledForFundEditsTransferFeesLinkedVouchersAndNetEdits() throws Exception {
        var fundARes = mvc.perform(post("/api/cashbook/funds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Đối Soát A", "—", "Thủ quỹ", "CASH", 0L, ""))))
                .andExpect(status().isCreated())
                .andReturn();
        long fundAId = mapper.readTree(fundARes.getResponse().getContentAsString()).path("data").path("id").asLong();
        var fundBRes = mvc.perform(post("/api/cashbook/funds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Đối Soát B", "999", "MB Bank", "BANK", 0L, ""))))
                .andExpect(status().isCreated())
                .andReturn();
        long fundBId = mapper.readTree(fundBRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Per-prefix voucher numbering: first Chi then first Thu -> PC000001 / PT000001
        var thuRes = mvc.perform(post("/api/cashbook/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionRequest(
                                LocalDate.of(2026, 11, 1), "Thu", "Thu khác", 10_000_000L,
                                "Đối tượng khác", "Chủ trại", fundAId, "Góp vốn"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code").value("PT000001"))
                .andReturn();
        long thuId = mapper.readTree(thuRes.getResponse().getContentAsString()).path("data").path("id").asLong();
        mvc.perform(post("/api/cashbook/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionRequest(
                                LocalDate.of(2026, 11, 2), "Chi", "Chi phí khác", 8_000_000L,
                                "Đối tượng khác", "Vật tư", fundAId, "Mua vật tư"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code").value("PC000001"));
        assertEquals(2_000_000L, fundRepository.findById(fundAId).orElseThrow().getBalance());

        // Editing a receipt whose money was already spent applies only the net difference (10M -> 12M)
        mvc.perform(put("/api/cashbook/transactions/" + thuId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionRequest(
                                LocalDate.of(2026, 11, 1), "Thu", "Thu khác", 12_000_000L,
                                "Đối tượng khác", "Chủ trại", fundAId, "Góp vốn (sửa)"))))
                .andExpect(status().isOk());
        assertEquals(4_000_000L, fundRepository.findById(fundAId).orElseThrow().getBalance());

        // Updating fund metadata never overwrites the ledger-derived balance
        mvc.perform(put("/api/cashbook/funds/" + fundAId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Đối Soát A (sửa)", "—", "Thủ quỹ", "CASH", 99_000_000L, ""))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.balance").value(4_000_000));

        // Transfer fee is booked as a linked Chi voucher so Thu - Chi == total balances
        mvc.perform(post("/api/cashbook/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundTransferRequest(
                                LocalDate.of(2026, 11, 3), fundAId, fundBId, 3_000_000L, 20_000L, "Nộp ngân hàng"))))
                .andExpect(status().isCreated());
        assertEquals(980_000L, fundRepository.findById(fundAId).orElseThrow().getBalance());
        assertEquals(3_000_000L, fundRepository.findById(fundBId).orElseThrow().getBalance());

        var feeTx = txRepository.findAll().stream()
                .filter(t -> "Chi".equals(t.getType()) && t.getAmount() == 20_000L)
                .findFirst().orElseThrow();
        assertNotNull(feeTx.getReferenceInvoiceCode());
        assertTrue(feeTx.getReferenceInvoiceCode().startsWith("CQ"));

        var summary = mapper.readTree(mvc.perform(get("/api/cashbook/summary"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        long revenue = summary.path("totalRevenue").asLong();
        long expense = summary.path("totalExpense").asLong();
        long balances = summary.path("totalFundsBalance").asLong();
        assertEquals(12_000_000L, revenue);
        assertEquals(8_020_000L, expense);
        assertEquals(revenue - expense, balances);

        // Auto-generated (linked) vouchers cannot be edited or deleted directly
        mvc.perform(put("/api/cashbook/transactions/" + feeTx.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashTransactionRequest(
                                LocalDate.of(2026, 11, 3), "Chi", "Chi phí khác", 1L,
                                "Đối tượng khác", "Ngân hàng", fundAId, ""))))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/cashbook/transactions/" + feeTx.getId()))
                .andExpect(status().isConflict());

        // Funds that still hold money cannot be deleted
        var emptyRes = mvc.perform(post("/api/cashbook/funds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Có Số Dư", "—", "Thủ quỹ", "CASH", 1_000_000L, ""))))
                .andExpect(status().isCreated())
                .andReturn();
        long withBalanceId = mapper.readTree(emptyRes.getResponse().getContentAsString()).path("data").path("id").asLong();
        mvc.perform(delete("/api/cashbook/funds/" + withBalanceId))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerIsForbiddenFromCashbookEndpoints() throws Exception {
        mvc.perform(get("/api/cashbook/summary")).andExpect(status().isForbidden());
        mvc.perform(post("/api/cashbook/funds")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Worker", "", "Bank", "CASH", 0L, ""))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/cashbook/assets")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new FarmAssetRequest("Tài sản Worker", 1_000_000L, 12, "Nhà A1", LocalDate.now(), "Đang trích khấu hao", ""))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/cashbook/payrolls")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new PayrollRequest(null, "Worker", "2026-10", 10, 300_000L, 0L, 0L, ""))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/cashbook/cost-allocations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CycleCostAllocationRequest(null, "Nhà A1", "L01", "Điện", 100_000L, "", LocalDate.now(), ""))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/cashbook/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashTransactionCategoryRequest("Mục mới", "Chi", "Khác", ""))))
                .andExpect(status().isForbidden());
    }
}

