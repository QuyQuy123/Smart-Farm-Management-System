package com.farmshift.backendFarmShift;
import com.farmshift.backendFarmShift.repository.CustomerContactRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
@TestPropertySource(properties={"sales.invoice.seller.name=Test Farm", "sales.invoice.seller.tax-code=SELLER123", "sales.invoice.seller.address=Seller address", "sales.invoice.seller.phone=0912345678", "sales.invoice.seller.fax=02412345678", "sales.invoice.seller.bank-account=123456789"})
class SalesInvoiceIntegrationTest {
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper mapper;
 @Autowired CustomerContactRepository customers;
 @Test @WithMockUser(authorities="ROLE_FARM_OWNER") void persistsCustomerFieldsAndUsesSystemCreationDateAndPublicSellerConfig() throws Exception {
  String id=UUID.randomUUID().toString();
  var body=new java.util.HashMap<String,Object>(Map.of("id",id,"date","2020-01-02","customer","Invoice Buyer","phone","0981234567","address","Buyer address","flock","Area A - Barn A - Cycle A","quantity",10,"totalWeight",20,"unitPrice",50000,"status","DEBT"));
  body.put("status","PARTIAL"); body.put("paidAmount",250000);
  body.put("taxCode","BUYER123"); body.put("paymentMethod","Chuyển khoản");
  mvc.perform(post("/api/sales/orders").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data.createdAt").exists());
  var buyer=customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc("0981234567","Invoice Buyer").orElseThrow();
  assertEquals("BUYER123",buyer.getTaxCode()); assertEquals("Chuyển khoản",buyer.getPaymentMethod());
  mvc.perform(get("/api/sales/orders/"+id+"/invoice")).andExpect(status().isOk())
   .andExpect(jsonPath("$.data.createdDate").value(LocalDate.now(ZoneId.of("Asia/Bangkok")).toString()))
   .andExpect(jsonPath("$.data.seller.name").value("Test Farm"))
   .andExpect(jsonPath("$.data.seller.taxCode").value("SELLER123"))
   .andExpect(jsonPath("$.data.seller.bankAccount").value("123456789"))
   .andExpect(jsonPath("$.data.buyer.name").value("Invoice Buyer"))
   .andExpect(jsonPath("$.data.buyer.taxCode").value("BUYER123"))
   .andExpect(jsonPath("$.data.buyer.paymentMethod").value("Chuyển khoản"))
   .andExpect(jsonPath("$.data.order.quantity").value(10))
   .andExpect(jsonPath("$.data.order.totalWeight").value(20))
   .andExpect(jsonPath("$.data.order.unitPrice").value(50000))
   .andExpect(jsonPath("$.data.order.totalAmount").value(1000000))
   .andExpect(jsonPath("$.data.order.paidAmount").value(250000))
   .andExpect(jsonPath("$.data.order.debtAmount").value(750000));
  buyer.setAddress("Updated database address"); customers.saveAndFlush(buyer);
  mvc.perform(get("/api/sales/orders/"+id+"/invoice")).andExpect(jsonPath("$.data.buyer.address").value("Updated database address"));
 }
 @Test void requiresAuthentication() throws Exception { mvc.perform(get("/api/sales/orders/unknown/invoice")).andExpect(status().is4xxClientError()); }
 @Test @WithMockUser void missingOrderIsNotFound() throws Exception { mvc.perform(get("/api/sales/orders/unknown/invoice")).andExpect(status().isNotFound()); }
}
