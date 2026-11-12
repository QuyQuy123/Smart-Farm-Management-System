package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.config.CashbookSchemaUpgrade;
import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceItemRequest;
import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner-sync@smartfarm.com", authorities = "ROLE_FARM_OWNER")
class CashbookCrossModuleSyncIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired CashFundRepository fundRepository;
    @Autowired CashTransactionRepository txRepository;
    @Autowired CashFundTransferRepository transferRepository;
    @Autowired PayrollRecordRepository payrollRepository;
    @Autowired CycleCostAllocationRepository costAllocationRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired PurchasePaymentRepository paymentRepository;
    @Autowired ProductTypeRepository productTypeRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired SalesOrderRepository salesOrderRepository;
    @Autowired CustomerContactRepository customerRepository;
    @Autowired CashbookSchemaUpgrade schemaUpgrade;

    Long bankFundId;
    Long cashFundId;
    Long supplierId;
    Long feedTypeId;

    @BeforeEach
    void setUp() {
        transferRepository.deleteAllInBatch();
        txRepository.deleteAllInBatch();
        fundRepository.deleteAllInBatch();
        costAllocationRepository.deleteAllInBatch();
        payrollRepository.deleteAllInBatch();
        paymentRepository.deleteAll();
        salesOrderRepository.deleteAll();
        invoiceRepository.deleteAll();
        customerRepository.deleteAll();
        supplierRepository.deleteAll();
        fundRepository.flush();
        supplierRepository.flush();

        CashFund bank = new CashFund();
        bank.setName("Tài khoản MB Bank (TK Chính)");
        bank.setAccountNo("0987654321");
        bank.setBank("Ngân hàng Quân Đội");
        bank.setFundType("BANK");
        bank.setBalance(100_000_000L);
        bank.setActive(true);
        bankFundId = fundRepository.saveAndFlush(bank).getId();

        CashFund cash = new CashFund();
        cash.setName("Tiền mặt tại quỹ trại");
        cash.setAccountNo("—");
        cash.setBank("Quỹ thủ quỹ");
        cash.setFundType("CASH");
        cash.setBalance(20_000_000L);
        cash.setActive(true);
        cashFundId = fundRepository.saveAndFlush(cash).getId();

        ProductType feedType = productTypeRepository.findAll().stream()
                .filter(p -> "thức ăn sync test".equals(p.getNameKey()))
                .findFirst()
                .orElseGet(() -> {
                    ProductType pt = new ProductType();
                    pt.setName("Thức ăn sync test");
                    pt.setNameKey("thức ăn sync test");
                    return productTypeRepository.saveAndFlush(pt);
                });
        feedTypeId = feedType.getId();

        Supplier supplier = new Supplier();
        supplier.setName("C.P. Sync Test");
        supplier.setNameKey("c.p. sync test");
        supplier.setRepresentative("Nguyễn A");
        supplier.setPhone("0912345000");
        supplier.setProductType(feedType);
        supplier.setOpeningDebt(0L);
        supplier.setPaymentPolicy("Trả theo đơn");
        supplierId = supplierRepository.saveAndFlush(supplier).getId();
    }

    @Test
    void purchaseCreationWithCashFundDeductsBalanceCreatesVoucherAndRollsBackWhenInsufficient() throws Exception {
        PurchaseInvoiceRequest req = new PurchaseInvoiceRequest(
                supplierId, null, LocalDate.of(2026, 10, 15),
                List.of(new PurchaseInvoiceItemRequest(null, "Cám Gà Higro Test", 20.0, "Bao", 300_000L, 0.0, null)),
                0L, 0L, 6_000_000L, "Thanh toán hoàn tất", "Chưa nhập kho",
                "HD-SYNC-01", "Mua cám trả ngay", null, List.of(), bankFundId
        );

        var res = mvc.perform(post("/api/purchases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode po = mapper.readTree(res.getResponse().getContentAsString()).path("data");
        long invoiceId = po.path("id").asLong();
        String poCode = po.path("code").asText();

        assertEquals(94_000_000L, fundRepository.findById(bankFundId).orElseThrow().getBalance());
        CashTransaction voucher = txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc(poCode).orElseThrow();
        assertEquals("Chi", voucher.getType());
        assertEquals("Tiền thức ăn (Cám)", voucher.getCategory());
        assertEquals(6_000_000L, voucher.getAmount());
        assertEquals(bankFundId, voucher.getFund().getId());

        List<PurchasePayment> payments = paymentRepository.findByInvoice_IdOrderByPaymentDateDescIdDesc(invoiceId);
        assertEquals(1, payments.size());
        assertEquals(bankFundId, payments.get(0).getCashFundId());
        assertEquals("Chuyển khoản", payments.get(0).getPaymentMethod());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void purchaseCreationWithInsufficientFundBalanceThrowsBadRequestAndRollsBackInvoice() throws Exception {
        long poCountBefore = invoiceRepository.count();
        PurchaseInvoiceRequest overReq = new PurchaseInvoiceRequest(
                supplierId, null, LocalDate.of(2026, 10, 16),
                List.of(new PurchaseInvoiceItemRequest(null, "Cám Quá Hạn Mức", 100.0, "Bao", 300_000L, 0.0, null)),
                0L, 0L, 30_000_000L, "Thanh toán hoàn tất", "Chưa nhập kho",
                "HD-SYNC-02", "Vượt quỹ", null, List.of(), cashFundId
        );
        try {
            mvc.perform(post("/api/purchases")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.writeValueAsString(overReq)))
                    .andExpect(status().isBadRequest());
            assertEquals(poCountBefore, invoiceRepository.count());
            assertEquals(20_000_000L, fundRepository.findById(cashFundId).orElseThrow().getBalance());
        } finally {
            paymentRepository.deleteAll();
            invoiceRepository.deleteAll();
            supplierRepository.deleteAll();
            fundRepository.deleteAllInBatch();
            if (feedTypeId != null) {
                productTypeRepository.deleteById(feedTypeId);
            }
        }
    }

    @Test
    void flockImportPaidWithCashFundCreatesChickVoucherAndDeductsFund() throws Exception {
        long areaId = mapper.readTree(mvc.perform(post("/api/farm-areas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("name", "Khu Sync Giống"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();
        long barnId = mapper.readTree(mvc.perform(post("/api/barns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("areaId", areaId, "name", "Nhà Sync 1", "capacity", 5000, "areaM2", 400))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();
        LocalDate start = LocalDate.now().minusDays(3);
        long cycleId = mapper.readTree(mvc.perform(post("/api/barns/" + barnId + "/cycles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("startDate", start.toString()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();
        long programId = mapper.readTree(mvc.perform(post("/api/farming-programs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "name", "Gà Mía Sync", "breed", "Gà Mía", "durationDays", 90,
                                "steps", List.of(Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 90, "quantity", 40, "mealsPerDay", 3))
                        ))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();

        Map<String, Object> body = new HashMap<>();
        body.put("name", "MÍA SYNC");
        body.put("programId", programId);
        body.put("gender", "MIXED");
        body.put("importDate", start.toString());
        body.put("ageAtImport", 1);
        body.put("quantity", 1000);
        body.put("avgWeight", 0.04);
        body.put("unitPrice", 11_000);
        body.put("supplierId", supplierId);
        body.put("paymentStatus", "Thanh toán hoàn tất");
        body.put("cashFundId", bankFundId);

        JsonNode created = mapper.readTree(mvc.perform(post("/api/cycles/" + cycleId + "/flocks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data");

        String invoiceCode = created.path("purchaseInvoiceCode").asText();
        assertEquals(89_000_000L, fundRepository.findById(bankFundId).orElseThrow().getBalance());
        CashTransaction tx = txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc(invoiceCode).orElseThrow();
        assertEquals("Chi", tx.getType());
        assertEquals("Tiền con giống", tx.getCategory());
        assertEquals(11_000_000L, tx.getAmount());
    }

    @Test
    void salesOrderCreateUpdateAndSwitchToDebtSynchronizesCashbookAtomically() throws Exception {
        String orderId = UUID.randomUUID().toString();
        Map<String, Object> createBody = new HashMap<>();
        createBody.put("id", orderId);
        createBody.put("date", "2026-11-10");
        createBody.put("customer", "Thương lái Sync");
        createBody.put("phone", "0988111222");
        createBody.put("address", "Hà Nội");
        createBody.put("flock", "Khu A - Nhà A1 - L000001");
        createBody.put("quantity", 500);
        createBody.put("totalWeight", 1000);
        createBody.put("unitPrice", 80_000);
        createBody.put("status", "PARTIAL");
        createBody.put("paidAmount", 30_000_000);
        createBody.put("paymentMethod", "Tiền mặt");
        createBody.put("cashFundId", cashFundId);
        createBody.put("note", "Đơn test sync");

        JsonNode created = mapper.readTree(mvc.perform(post("/api/sales/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(createBody)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        String orderCode = created.path("code").asText();

        // Cash fund: 20M + 30M = 50M
        assertEquals(50_000_000L, fundRepository.findById(cashFundId).orElseThrow().getBalance());
        CashTransaction pt = txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc(orderCode).orElseThrow();
        assertEquals("Thu", pt.getType());
        assertEquals("Đơn bán gà", pt.getCategory());
        assertEquals(30_000_000L, pt.getAmount());
        assertEquals(cashFundId, pt.getFund().getId());

        // Update order to PAID (80M) and move receipt to MB Bank -> Cash back to 20M, MB = 180M
        Map<String, Object> updateToPaid = new HashMap<>(createBody);
        updateToPaid.put("status", "PAID");
        updateToPaid.put("paidAmount", 80_000_000);
        updateToPaid.put("paymentMethod", "Chuyển khoản");
        updateToPaid.put("cashFundId", bankFundId);

        mvc.perform(put("/api/sales/orders/" + orderId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(updateToPaid)))
                .andExpect(status().isOk());

        assertEquals(20_000_000L, fundRepository.findById(cashFundId).orElseThrow().getBalance());
        assertEquals(180_000_000L, fundRepository.findById(bankFundId).orElseThrow().getBalance());
        CashTransaction updatedPt = txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc(orderCode).orElseThrow();
        assertEquals(80_000_000L, updatedPt.getAmount());
        assertEquals(bankFundId, updatedPt.getFund().getId());

        // Update order to DEBT -> MB reverts back to 100M and voucher is removed
        Map<String, Object> updateToDebt = new HashMap<>(updateToPaid);
        updateToDebt.put("status", "DEBT");
        updateToDebt.put("paidAmount", 0);
        updateToDebt.remove("cashFundId");

        mvc.perform(put("/api/sales/orders/" + orderId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(updateToDebt)))
                .andExpect(status().isOk());

        assertEquals(100_000_000L, fundRepository.findById(bankFundId).orElseThrow().getBalance());
        assertTrue(txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc(orderCode).isEmpty());
    }

    @Test
    void schemaUpgradeReplacesUntouchedLegacyMockWithBalancedSingleFarmFundAndPreservesCustomLedger() throws Exception {
        CashFund vcb = new CashFund();
        vcb.setName("Tài khoản Vietcombank dự phòng");
        vcb.setAccountNo("1023456789");
        vcb.setBank("Vietcombank");
        vcb.setFundType("BANK");
        vcb.setBalance(0L);
        vcb.setActive(true);
        vcb = fundRepository.saveAndFlush(vcb);

        CashFund mb = fundRepository.findById(bankFundId).orElseThrow();
        CashFund cash = fundRepository.findById(cashFundId).orElseThrow();

        // Populate exact 5 legacy mock vouchers + a test payroll payment (Trần Văn Bình) & 2 legacy transfers + fake payrolls/costs
        for (String[] row : new String[][]{
                {"PT000020", "Thu", "Đơn bán gà", "191880000", null, "Mock"},
                {"PT000021", "Thu", "Đơn bán gà", "100000000", null, "Mock"},
                {"PC000033", "Chi", "Tiền thức ăn (Cám)", "18000000", null, "Mock"},
                {"PC000034", "Chi", "Thuốc thú y & vắc-xin", "8560000", null, "Mock"},
                {"PC000035", "Chi", "Tiền điện & nước trang trại", "8200000", null, "Mock"},
                {"PC000006", "Chi", "Tiền lương công nhân", "3050000", "CC0002", "Trần Văn Bình"}
        }) {
            CashTransaction tx = new CashTransaction();
            tx.setCode(row[0]);
            tx.setTxDate(LocalDate.of(2026, 10, 1));
            tx.setType(row[1]);
            tx.setCategory(row[2]);
            tx.setAmount(Long.parseLong(row[3]));
            tx.setContact("Khác");
            tx.setPersonName(row[5]);
            tx.setReferenceInvoiceCode(row[4]);
            tx.setFund(mb);
            txRepository.save(tx);
        }
        for (String code : List.of("CQ000004", "CQ000005")) {
            CashFundTransfer tr = new CashFundTransfer();
            tr.setCode(code);
            tr.setTransferDate(LocalDate.of(2026, 10, 1));
            tr.setFromFund(mb);
            tr.setToFund(cash);
            tr.setAmount(10_000_000L);
            tr.setFee(0L);
            transferRepository.save(tr);
        }
        int idx = 1;
        for (String name : List.of("Nguyễn Văn An", "Trần Văn Bình", "Nguyễn Văn Hải", "Nguyễn Thị Mai")) {
            PayrollRecord pr = new PayrollRecord();
            pr.setCode("CC000" + idx++);
            pr.setEmployeeName(name);
            pr.setPayPeriod("2026-10");
            pr.setWorkDays(26);
            pr.setDailyRate(300_000L);
            pr.setTotalAmount(7_800_000L);
            pr.setPaidAmount(0L);
            pr.setRemainingAmount(7_800_000L);
            pr.setStatus("Còn nợ lương");
            payrollRepository.save(pr);
        }
        for (int i = 1; i <= 4; i++) {
            CycleCostAllocation ca = new CycleCostAllocation();
            ca.setCode("PB000" + i);
            ca.setBarnName("Nhà A1");
            ca.setCycleCode("LUA-2026-MIA01");
            ca.setCostType("Chi phí mẫu");
            ca.setAmount(1_000_000L);
            ca.setAllocationDate(LocalDate.of(2026, 10, 1));
            costAllocationRepository.save(ca);
        }
        txRepository.flush();
        transferRepository.flush();
        payrollRepository.flush();
        costAllocationRepository.flush();

        // Run upgrade -> legacy mock records replaced, consolidated into 1 fund "Quỹ trang trại", balances equal Thu - Chi
        schemaUpgrade.run(null);

        assertTrue(txRepository.findByCode("PT000020").isEmpty());
        assertTrue(txRepository.findByCode("PC000035").isEmpty());
        assertTrue(txRepository.findByCode("PC000006").isEmpty());
        assertEquals(1, fundRepository.count());
        CashFund singleFarmFund = fundRepository.findAll().get(0);
        assertEquals("Quỹ trang trại", singleFarmFund.getName());
        assertEquals(0, transferRepository.count());
        assertEquals(26, payrollRepository.findAll().get(0).getWorkDays());
        assertTrue(payrollRepository.findAll().stream().anyMatch(p -> "Nguyễn Văn Ba".equals(p.getEmployeeName())));
        assertFalse(costAllocationRepository.findAll().stream().anyMatch(c -> "LUA-2026-MIA01".equals(c.getCycleCode())));

        long thu = txRepository.findAll().stream().filter(t -> "Thu".equals(t.getType())).mapToLong(CashTransaction::getAmount).sum();
        long chi = txRepository.findAll().stream().filter(t -> "Chi".equals(t.getType())).mapToLong(CashTransaction::getAmount).sum();
        assertEquals(thu - chi, singleFarmFund.getBalance());

        // Add a custom user transaction -> next run MUST preserve everything
        CashTransaction custom = new CashTransaction();
        custom.setCode("PT999999");
        custom.setTxDate(LocalDate.of(2026, 11, 12));
        custom.setType("Thu");
        custom.setCategory("Thu khác");
        custom.setAmount(1_234_567L);
        custom.setContact("Khác");
        custom.setPersonName("Custom User");
        custom.setFund(singleFarmFund);
        txRepository.saveAndFlush(custom);
        long countAfterCustom = txRepository.count();

        schemaUpgrade.run(null);
        assertEquals(countAfterCustom, txRepository.count());
        assertTrue(txRepository.findByCode("PT999999").isPresent());
    }

    @Test
    void schemaUpgradeConsolidatesLegacyThreeFundsIntoSingleFarmFund() throws Exception {
        CashFund vcb = new CashFund();
        vcb.setName("Tài khoản Vietcombank dự phòng");
        vcb.setAccountNo("1023456789");
        vcb.setBank("Vietcombank");
        vcb.setFundType("BANK");
        vcb.setBalance(50_000_000L);
        vcb.setActive(true);
        vcb = fundRepository.saveAndFlush(vcb);

        CashFund mb = fundRepository.findById(bankFundId).orElseThrow();
        CashFund cash = fundRepository.findById(cashFundId).orElseThrow();

        CashTransaction pt1 = new CashTransaction();
        pt1.setCode("PT000001");
        pt1.setTxDate(LocalDate.of(2026, 9, 1));
        pt1.setType("Thu");
        pt1.setCategory("Thu khác");
        pt1.setAmount(1_700_000_000L);
        pt1.setContact("Đối tượng khác");
        pt1.setPersonName("Chủ trang trại");
        pt1.setFund(mb);
        txRepository.save(pt1);

        CashTransaction pt2 = new CashTransaction();
        pt2.setCode("PT000002");
        pt2.setTxDate(LocalDate.of(2026, 9, 1));
        pt2.setType("Thu");
        pt2.setCategory("Thu khác");
        pt2.setAmount(50_000_000L);
        pt2.setContact("Đối tượng khác");
        pt2.setPersonName("Chủ trang trại");
        pt2.setFund(vcb);
        txRepository.save(pt2);

        CashTransaction pt3 = new CashTransaction();
        pt3.setCode("PT000003");
        pt3.setTxDate(LocalDate.of(2026, 11, 8));
        pt3.setType("Thu");
        pt3.setCategory("Đơn bán gà");
        pt3.setAmount(200_000_000L);
        pt3.setContact("Khách hàng");
        pt3.setPersonName("Thương lái");
        pt3.setReferenceInvoiceCode("BH00001");
        pt3.setFund(mb);
        txRepository.save(pt3);

        CashFundTransfer tr = new CashFundTransfer();
        tr.setCode("CQ000001");
        tr.setTransferDate(LocalDate.of(2026, 9, 1));
        tr.setFromFund(mb);
        tr.setToFund(cash);
        tr.setAmount(50_000_000L);
        tr.setFee(0L);
        transferRepository.save(tr);
        txRepository.flush();
        transferRepository.flush();

        schemaUpgrade.run(null);

        assertEquals(1, fundRepository.count());
        CashFund single = fundRepository.findAll().get(0);
        assertEquals("Quỹ trang trại", single.getName());
        assertEquals(0, transferRepository.count());
        assertEquals(1_950_000_000L, single.getBalance());
        assertEquals(1_750_000_000L, txRepository.findByCode("PT000001").orElseThrow().getAmount());
        assertTrue(txRepository.findByCode("PT000002").isEmpty());
        CashTransaction bh = txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc("BH00001").orElseThrow();
        assertEquals(single.getId(), bh.getFund().getId());
    }

    @Test
    void cycleExpenseCreationAndDeletionSynchronizesCashbookAtomically() throws Exception {
        long areaId = mapper.readTree(mvc.perform(post("/api/farm-areas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("name", "Khu Sync Chi phí"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();
        long barnId = mapper.readTree(mvc.perform(post("/api/barns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("areaId", areaId, "name", "Nhà Expense 1", "capacity", 5000, "areaM2", 400))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();
        LocalDate start = LocalDate.now().minusDays(2);
        long cycleId = mapper.readTree(mvc.perform(post("/api/barns/" + barnId + "/cycles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("startDate", start.toString()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();

        long expenseId = mapper.readTree(mvc.perform(post("/api/cycles/" + cycleId + "/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "expenseDate", LocalDate.now().toString(),
                                "category", "MEDICINE",
                                "amount", 850_000,
                                "note", "Mua thuốc bổ tổng hợp"
                        ))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("data").asLong();

        assertEquals(99_150_000L, fundRepository.findById(bankFundId).orElseThrow().getBalance());
        CashTransaction tx = txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc("CE-" + expenseId).orElseThrow();
        assertEquals("Chi", tx.getType());
        assertEquals("Thuốc thú y & vắc-xin", tx.getCategory());
        assertEquals(850_000L, tx.getAmount());

        mvc.perform(delete("/api/cycles/" + cycleId + "/expenses/" + expenseId))
                .andExpect(status().isOk());

        assertEquals(100_000_000L, fundRepository.findById(bankFundId).orElseThrow().getBalance());
        assertTrue(txRepository.findFirstByReferenceInvoiceCodeOrderByIdDesc("CE-" + expenseId).isEmpty());
    }
}
