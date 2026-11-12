package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.CashFundRequest;
import com.farmshift.backendFarmShift.dto.request.CashFundTransferRequest;
import com.farmshift.backendFarmShift.dto.request.CashTransactionRequest;
import com.farmshift.backendFarmShift.repository.CashFundRepository;
import com.farmshift.backendFarmShift.repository.CashFundTransferRepository;
import com.farmshift.backendFarmShift.repository.CashTransactionRepository;
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

    @BeforeEach
    void cleanSlate() {
        transferRepository.deleteAll();
        txRepository.deleteAll();
        fundRepository.deleteAll();
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
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerIsForbiddenFromCashbookEndpoints() throws Exception {
        mvc.perform(get("/api/cashbook/summary")).andExpect(status().isForbidden());
        mvc.perform(post("/api/cashbook/funds")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new CashFundRequest("Quỹ Worker", "", "Bank", "CASH", 0L, ""))))
                .andExpect(status().isForbidden());
    }
}

