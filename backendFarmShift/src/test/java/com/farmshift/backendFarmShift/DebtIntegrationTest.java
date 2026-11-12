package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceItemRequest;
import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceRequest;
import com.farmshift.backendFarmShift.dto.request.PurchasePaymentRequest;
import com.farmshift.backendFarmShift.entity.CashFund;
import com.farmshift.backendFarmShift.entity.CustomerContact;
import com.farmshift.backendFarmShift.entity.ProductType;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.repository.CashFundRepository;
import com.farmshift.backendFarmShift.repository.CashFundTransferRepository;
import com.farmshift.backendFarmShift.repository.CashTransactionRepository;
import com.farmshift.backendFarmShift.repository.CustomerContactRepository;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import com.farmshift.backendFarmShift.repository.PurchasePaymentRepository;
import com.farmshift.backendFarmShift.repository.SalesOrderRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DebtIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProductTypeRepository productTypeRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired PurchasePaymentRepository paymentRepository;
    @Autowired CustomerContactRepository customerRepository;
    @Autowired SalesOrderRepository salesOrderRepository;
    @Autowired CashFundRepository cashFundRepository;
    @Autowired CashFundTransferRepository cashFundTransferRepository;
    @Autowired CashTransactionRepository cashTxRepository;

    Long supplierId;
    Long fundId;

    @BeforeEach
    void setUp() throws Exception {
        paymentRepository.deleteAll();
        invoiceRepository.deleteAll();
        salesOrderRepository.deleteAll();
        customerRepository.deleteAll();
        supplierRepository.deleteAll();
        cashFundTransferRepository.deleteAll();
        cashTxRepository.deleteAll();
        cashFundRepository.deleteAll();

        ProductType type = new ProductType();
        type.setName("Thức ăn công nợ test");
        type.setNameKey("thức ăn công nợ test");
        type = productTypeRepository.saveAndFlush(type);

        Supplier supplier = new Supplier();
        supplier.setName("NCC Công Nợ Test");
        supplier.setNameKey("ncc công nợ test");
        supplier.setRepresentative("Ông A");
        supplier.setPhone("0912345678");
        supplier.setProductType(type);
        supplier.setOpeningDebt(1_000_000L);
        supplier.setPaymentPolicy("Gối đầu 30 ngày");
        supplier = supplierRepository.saveAndFlush(supplier);
        supplierId = supplier.getId();

        CashFund fund = new CashFund();
        fund.setName("Quỹ Trả Nợ NCC");
        fund.setAccountNo("999");
        fund.setBank("VCB");
        fund.setFundType("BANK");
        fund.setBalance(20_000_000L);
        fund.setNote("");
        fund.setActive(true);
        fundId = cashFundRepository.saveAndFlush(fund).getId();

        CustomerContact customer = new CustomerContact();
        customer.setName("Thương lái Thu Mua");
        customer.setPhone("0988777666");
        customer.setAddress("Bình Dương");
        customer = customerRepository.saveAndFlush(customer);

        SalesOrder order = new SalesOrder();
        order.setId(UUID.randomUUID().toString());
        order.setCode("BH999001");
        order.setDate(LocalDate.of(2026, 10, 12));
        order.setCustomer(customer.getName());
        order.setPhone(customer.getPhone());
        order.setBuyer(customer);
        order.setQuantity(500);
        order.setTotalWeight(new BigDecimal("1000.00"));
        order.setUnitPrice(new BigDecimal("60000.00"));
        order.setTotalAmount(new BigDecimal("60000000"));
        order.setPaidAmount(new BigDecimal("40000000"));
        order.setStatus("Thanh toán 1 phần");
        salesOrderRepository.saveAndFlush(order);
    }

    @Test
    @WithMockUser(username = "ketoan@smartfarm.com", authorities = "ROLE_ACCOUNTANT")
    void unifiedDebtSummarySupplierLedgerWithPaymentAndCashbookIntegration() throws Exception {
        LocalDate exp = LocalDate.of(2027, 3, 1);
        // Create PO with partial payment (total 10M, paid 2M) + attachmentUrl + lotNumber/expiryDate
        var poReq = new PurchaseInvoiceRequest(
                supplierId,
                null,
                LocalDate.of(2026, 10, 10),
                List.of(new PurchaseInvoiceItemRequest(null, "Cám Công Nợ Lot", 10.0, "Bao", 1_000_000L, 0.0, null, "LOT-DEBT-01", exp)),
                0L, 0L, 2_000_000L,
                "Thanh toán một phần",
                "Chưa nhập kho",
                "HD-CN-01",
                "Nhập đợt 1",
                "/img/purchases/sample-invoice.png",
                List.of()
        );
        var createdPo = mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(poReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.attachmentUrl").value("/img/purchases/sample-invoice.png"))
                .andExpect(jsonPath("$.data.items[0].lotNumber").value("LOT-DEBT-01"))
                .andReturn();
        long invoiceId = mapper.readTree(createdPo.getResponse().getContentAsString()).path("data").path("id").asLong();
        String invoiceCode = mapper.readTree(createdPo.getResponse().getContentAsString()).path("data").path("code").asText();

        // Pay additional 3,000,000 linked with CashFund
        mvc.perform(post("/api/purchases/" + invoiceId + "/pay")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new PurchasePaymentRequest(3_000_000L, "Trả đợt 2 qua VCB", fundId, "Chuyển khoản", LocalDate.of(2026, 10, 11)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paidAmount").value(5_000_000))
                .andExpect(jsonPath("$.data.debtAmount").value(5_000_000));

        // Verify CashFund balance deducted & disbursement voucher recorded
        assertEquals(17_000_000L, cashFundRepository.findById(fundId).orElseThrow().getBalance());
        assertTrue(cashTxRepository.findAll().stream()
                .anyMatch(t -> "Chi".equals(t.getType()) && invoiceCode.equals(t.getReferenceInvoiceCode()) && t.getAmount() == 3_000_000L));

        // Verify FIN-17 Unified Debt Summary:
        // Supplier Payable = opening 1,000,000 + (10,000,000 - 5,000,000) = 6,000,000
        // Customer Receivable = 60,000,000 - 40,000,000 = 20,000,000
        // Net Position = 20,000,000 - 6,000,000 = 14,000,000
        mvc.perform(get("/api/debts/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalSupplierPayable").value(6_000_000))
                .andExpect(jsonPath("$.data.totalCustomerReceivable").value(20_000_000))
                .andExpect(jsonPath("$.data.netDebtPosition").value(14_000_000))
                .andExpect(jsonPath("$.data.supplierPayables[0].supplierName").value("NCC Công Nợ Test"))
                .andExpect(jsonPath("$.data.customerReceivables[0].customerName").value("Thương lái Thu Mua"));

        // Verify FIN-18 Chronological Supplier Debt Ledger (returned newest-first):
        // ledger[3]: OPENING_DEBT (+1,000,000 -> running 1,000,000)
        // ledger[2]: PURCHASE_INVOICE (+10,000,000 -> running 11,000,000)
        // ledger[1]: PAYMENT (-2,000,000 -> running 9,000,000)
        // ledger[0]: PAYMENT (-3,000,000 -> running 6,000,000)
        mvc.perform(get("/api/debts/suppliers/" + supplierId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.openingDebt").value(1_000_000))
                .andExpect(jsonPath("$.data.totalPurchased").value(10_000_000))
                .andExpect(jsonPath("$.data.totalPaid").value(5_000_000))
                .andExpect(jsonPath("$.data.currentDebt").value(6_000_000))
                .andExpect(jsonPath("$.data.payments.length()").value(2))
                .andExpect(jsonPath("$.data.ledger.length()").value(4))
                .andExpect(jsonPath("$.data.ledger[3].entryType").value("OPENING_DEBT"))
                .andExpect(jsonPath("$.data.ledger[3].runningBalance").value(1_000_000))
                .andExpect(jsonPath("$.data.ledger[0].entryType").value("PAYMENT"))
                .andExpect(jsonPath("$.data.ledger[0].runningBalance").value(6_000_000));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerIsForbiddenFromDebtEndpoints() throws Exception {
        mvc.perform(get("/api/debts/summary")).andExpect(status().isForbidden());
        mvc.perform(get("/api/debts/suppliers/" + supplierId)).andExpect(status().isForbidden());
    }
}
