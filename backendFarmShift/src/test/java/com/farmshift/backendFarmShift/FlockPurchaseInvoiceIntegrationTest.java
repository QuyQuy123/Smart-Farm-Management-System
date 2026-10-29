package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.ProductType;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Nhập đàn mua ngoài: chọn nhà cung cấp và tự tạo hóa đơn nhập con giống liên kết về đàn / lứa. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class FlockPurchaseInvoiceIntegrationTest {
    private static final LocalDate START = LocalDate.now().minusDays(5);
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProductTypeRepository types;
    @Autowired com.farmshift.backendFarmShift.repository.InventoryItemRepository inventory;
    @Autowired com.farmshift.backendFarmShift.repository.AccountRepository accounts;
    @Autowired com.farmshift.backendFarmShift.repository.RoleRepository roles;
    long barnId;
    long cycleId;
    long programId;
    long supplierId;

    @BeforeEach
    void setUp() throws Exception {
        long areaId = id(send("/api/farm-areas", Map.of("name", "Khu J Thịt")));
        barnId = id(send("/api/barns", Map.of("areaId", areaId, "name", "Nhà B1", "capacity", 5000, "areaM2", 600)));
        cycleId = id(send("/api/barns/" + barnId + "/cycles", Map.of("startDate", START.toString())));
        programId = id(send("/api/farming-programs", Map.of("name", "Gà J-Dabaco thương phẩm", "breed", "Gà J-Dabaco", "durationDays", 75,
                "steps", List.of(Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 75, "quantity", 50, "mealsPerDay", 4)))));
        var type = new ProductType();
        type.setName("Con giống");
        type.setNameKey("con giống");
        long typeId = types.saveAndFlush(type).getId();
        supplierId = id(send("/api/suppliers", Map.of("name", "Công ty Giống Dabaco", "representative", "Trần Văn Giống",
                "phone", "0912345678", "productTypeId", typeId)));
    }

    private ResultActions send(String url, Object body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions result) throws Exception {
        return data(result.andExpect(status().isCreated())).path("id").asLong();
    }

    private JsonNode data(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    private Map<String, Object> flock(Long supplier, int quantity, long unitPrice) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "J-DABACO TRỐNG");
        body.put("programId", programId);
        body.put("gender", "MALE");
        body.put("importDate", START.toString());
        body.put("ageAtImport", 1);
        body.put("quantity", quantity);
        body.put("avgWeight", 0.04);
        body.put("unitPrice", unitPrice);
        body.put("supplierId", supplier);
        return body;
    }

    @Test
    void importWithSupplierCreatesLinkedChickInvoiceWithoutTouchingStock() throws Exception {
        long stockRows = inventory.count();
        JsonNode created = data(send("/api/cycles/" + cycleId + "/flocks", flock(supplierId, 3000, 11500)).andExpect(status().isCreated()));
        long flockId = created.path("id").asLong();
        assertEquals(supplierId, created.path("supplierId").asLong());
        assertEquals("Công ty Giống Dabaco", created.path("supplierName").asText());
        assertEquals("Công ty Giống Dabaco", created.path("sourceNote").asText());
        long invoiceId = created.path("purchaseInvoiceId").asLong();
        assertTrue(created.path("purchaseInvoiceCode").asText().startsWith("NH"));

        JsonNode invoice = data(mvc.perform(get("/api/purchases/" + invoiceId)).andExpect(status().isOk()));
        assertEquals(supplierId, invoice.path("supplierId").asLong());
        assertEquals(START.toString(), invoice.path("date").asText());
        assertEquals(34_500_000L, invoice.path("totalAmount").asLong());
        assertEquals(0, invoice.path("paidAmount").asLong());
        assertEquals("Trả sau", invoice.path("paymentStatus").asText());
        assertEquals("Đã nhập chuồng", invoice.path("stockStatus").asText());
        assertEquals(1, invoice.path("items").size());
        JsonNode item = invoice.path("items").get(0);
        assertEquals(3000, item.path("qty").asDouble(), 0.001);
        assertEquals("Con", item.path("unit").asText());
        assertEquals(11500, item.path("price").asLong());
        assertTrue(item.path("name").asText().contains("Gà J-Dabaco"));
        assertEquals(flockId, invoice.path("flockId").asLong());
        assertEquals(cycleId, invoice.path("cycleId").asLong());
        assertEquals(barnId, invoice.path("barnId").asLong());
        assertEquals("Nhà B1", invoice.path("barnName").asText());

        // Gà vào thẳng chuồng: không tạo tồn kho, và số lượng / giá chỉ sửa ở đàn.
        assertEquals(stockRows, inventory.count());
        mvc.perform(post("/api/purchases/" + invoiceId + "/import-stock"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("PURCHASE_FLOCK_LINKED"));
        mvc.perform(post("/api/purchases/" + invoiceId + "/cancel"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("PURCHASE_FLOCK_LINKED"));
        mvc.perform(delete("/api/purchases/" + invoiceId))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("PURCHASE_FLOCK_LINKED"));
        // Thanh toán công nợ con giống vẫn làm ở Nhập hàng.
        send("/api/purchases/" + invoiceId + "/pay", Map.of("amount", 34_500_000L)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("Thanh toán hoàn tất"));

        // Chi tiết lứa: chủ trại / kế toán thấy hóa đơn, nhà cung cấp hiện với mọi vai trò.
        mvc.perform(get("/api/cycles/" + cycleId))
                .andExpect(jsonPath("$.data.flocks[0].supplierName").value("Công ty Giống Dabaco"))
                .andExpect(jsonPath("$.data.flocks[0].purchaseInvoiceId").value(invoiceId));
        mvc.perform(get("/api/cycles/" + cycleId).with(user("ketoan@farm.test").authorities(() -> "ROLE_ACCOUNTANT")))
                .andExpect(jsonPath("$.data.flocks[0].purchaseInvoiceCode").value(created.path("purchaseInvoiceCode").asText()));

        // Nhà cung cấp đã gắn với đàn thì không xóa được.
        mvc.perform(delete("/api/suppliers/" + supplierId))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("SUPPLIER_HAS_FLOCKS"));
    }

    @Test
    void workerSeesSupplierButNotTheInvoice() throws Exception {
        send("/api/cycles/" + cycleId + "/flocks", flock(supplierId, 1000, 12000)).andExpect(status().isCreated());
        var role = roles.findByName("ROLE_FARM_WORKER").orElseGet(() -> roles.save(new com.farmshift.backendFarmShift.entity.Role(null, "ROLE_FARM_WORKER", "Công nhân")));
        var account = new com.farmshift.backendFarmShift.entity.Account();
        account.setEmail("worker@farm.test");
        account.setPassword("x");
        account.setFullName("Công nhân");
        account.setRole(role);
        account.setIsActive(true);
        long workerId = accounts.save(account).getId();
        mvc.perform(put("/api/barns/" + barnId + "/workers").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("workerIds", List.of(workerId))))).andExpect(status().isOk());

        mvc.perform(get("/api/cycles/" + cycleId).with(user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.flocks[0].supplierName").value("Công ty Giống Dabaco"))
                .andExpect(jsonPath("$.data.flocks[0].unitPrice").doesNotExist())
                .andExpect(jsonPath("$.data.flocks[0].purchaseInvoiceId").doesNotExist())
                .andExpect(jsonPath("$.data.flocks[0].purchaseInvoiceCode").doesNotExist());
    }

    @Test
    void paidOnDeliveryAndLegacyImportsWithoutInvoice() throws Exception {
        Map<String, Object> paid = flock(supplierId, 1000, 12000);
        paid.put("paymentStatus", "Thanh toán hoàn tất");
        long invoiceId = data(send("/api/cycles/" + cycleId + "/flocks", paid).andExpect(status().isCreated())).path("purchaseInvoiceId").asLong();
        mvc.perform(get("/api/purchases/" + invoiceId)).andExpect(jsonPath("$.data.paidAmount").value(12_000_000))
                .andExpect(jsonPath("$.data.debtAmount").value(0));

        // Kiểu cũ: chỉ ghi nguồn nhập bằng chữ → không có nhà cung cấp, không có hóa đơn.
        Map<String, Object> legacy = flock(null, 500, 12000);
        legacy.put("name", "J-DABACO MÁI");
        legacy.put("sourceNote", "Trại giống Hòa Bình");
        JsonNode flock = data(send("/api/cycles/" + cycleId + "/flocks", legacy).andExpect(status().isCreated()));
        assertEquals("Trại giống Hòa Bình", flock.path("sourceNote").asText());
        assertTrue(flock.path("supplierId").isNull());
        assertTrue(flock.path("purchaseInvoiceId").isNull());

        // Con giống cho không (giá 0) thì không lập hóa đơn.
        Map<String, Object> free = flock(supplierId, 100, 0);
        free.put("name", "J-DABACO XÔ");
        assertTrue(data(send("/api/cycles/" + cycleId + "/flocks", free).andExpect(status().isCreated())).path("purchaseInvoiceId").isNull());

        Map<String, Object> wrongSupplier = flock(9_999_999L, 100, 12000);
        send("/api/cycles/" + cycleId + "/flocks", wrongSupplier).andExpect(status().isNotFound());
        Map<String, Object> wrongStatus = flock(supplierId, 100, 12000);
        wrongStatus.put("paymentStatus", "Ghi sổ");
        send("/api/cycles/" + cycleId + "/flocks", wrongStatus).andExpect(status().isBadRequest());
        assertEquals(1600, data(mvc.perform(get("/api/cycles/" + cycleId))).path("metrics").path("currentQuantity").asInt());
    }
}
