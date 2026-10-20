package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceItemRequest;
import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceRequest;
import com.farmshift.backendFarmShift.dto.request.PurchasePaymentRequest;
import com.farmshift.backendFarmShift.dto.request.PurchaseTagRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.ocr.VisionClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = {"ROLE_FARM_OWNER", "ROLE_ACCOUNTANT"})
class PurchaseIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired ObjectMapper mapper;
    @Autowired PurchaseTagRepository tagRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired ProductTypeRepository productTypeRepository;
    @Autowired ProductCategoryRepository productCategoryRepository;
    @Autowired WarehouseCategoryRepository warehouseCategoryRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @MockitoBean VisionClient geminiClient;

    private Long supplierId;
    private Long tagId;

    @BeforeEach
    void setUp() {
        invoiceRepository.deleteAll();
        inventoryRepository.deleteAll();
        supplierRepository.deleteAll();
        tagRepository.deleteAll();

        ProductType type = new ProductType();
        type.setName("Thức ăn chăn nuôi");
        type.setNameKey("thức ăn chăn nuôi");
        type = productTypeRepository.saveAndFlush(type);

        PurchaseTag tag = new PurchaseTag("Cám thịt", "cám thịt", "#019788", "Cám nuôi thịt");
        tag = tagRepository.saveAndFlush(tag);
        tagId = tag.getId();

        Supplier supplier = new Supplier();
        supplier.setName("Công ty CP Chăn nuôi C.P. Việt Nam");
        supplier.setNameKey("công ty cp chăn nuôi c.p. việt nam");
        supplier.setRepresentative("Trần Văn Đại");
        supplier.setPhone("02438220000");
        supplier.setProductType(type);
        supplier.setAddress("KCN Biên Hòa II, Đồng Nai");
        supplier.getTags().add(tag);
        supplier = supplierRepository.saveAndFlush(supplier);
        supplierId = supplier.getId();
    }

    @Test
    void testPurchaseTagCrudAndUsageCount() throws Exception {
        // List tags
        mvc.perform(get("/api/purchase-tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].usageCount").value(1)); // used by supplier

        // Create tag
        var newTagReq = new PurchaseTagRequest("Vắc-xin phòng", "#0288d1", "Vắc-xin định kỳ");
        var postRes = mvc.perform(post("/api/purchase-tags")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(newTagReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Vắc-xin phòng"))
                .andReturn();

        long createdTagId = mapper.readTree(postRes.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Update tag
        var updateTagReq = new PurchaseTagRequest("Vắc-xin cập nhật", "#0288d1", "Mô tả mới");
        mvc.perform(put("/api/purchase-tags/" + createdTagId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(updateTagReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Vắc-xin cập nhật"));

        // Delete tag
        mvc.perform(delete("/api/purchase-tags/" + createdTagId))
                .andExpect(status().isOk());
    }

    @Test
    void testCreatePurchaseInvoiceAutoCodeAndInventoryIncrease() throws Exception {
        var items = List.of(
                new PurchaseInvoiceItemRequest(null, "Cám Gà thịt Higro 02", 50.0, "Bao (25kg)", 335000L, 0.0)
        );
        var req = new PurchaseInvoiceRequest(
                supplierId,
                null,
                LocalDate.now(),
                items,
                0L,
                0L,
                16750000L,
                "Thanh toán hoàn tất",
                "Đã nhập kho",
                "HD001",
                "Nhập cám vỗ béo",
                null,
                List.of(tagId)
        );

        var result = mvc.perform(post("/api/purchases")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code").value("NH000000"))
                .andExpect(jsonPath("$.data.totalAmount").value(16750000))
                .andExpect(jsonPath("$.data.paidAmount").value(16750000))
                .andExpect(jsonPath("$.data.paymentStatus").value("Thanh toán hoàn tất"))
                .andExpect(jsonPath("$.data.stockStatus").value("Đã nhập kho"))
                .andExpect(jsonPath("$.data.importedDate").value(LocalDate.now(java.time.ZoneId.of("Asia/Bangkok")).toString()))
                .andReturn();

        long invId = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Verify inventory increased
        var stockItem = inventoryRepository.findByProduct_NameContainingIgnoreCase("Higro 02");
        assertFalse(stockItem.isEmpty());
        assertEquals(50.0, stockItem.get(0).getStock().doubleValue());
        assertEquals(335000L, stockItem.get(0).getPrice().longValue());

        // Get by ID
        mvc.perform(get("/api/purchases/" + invId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.supplier").value("Công ty CP Chăn nuôi C.P. Việt Nam"));
    }

    @Test
    void recordsActualImportDateAndPreservesInvoiceDate() throws Exception {
        var request = new PurchaseInvoiceRequest(supplierId, null, LocalDate.of(2020, 1, 2),
                List.of(new PurchaseInvoiceItemRequest(null, "Date test product", 2.0, "Kg", 1000L, 0.0)),
                0L, 0L, 0L, "Trả sau", "Chưa nhập kho", null, null, null, null);
        var result = mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.importedDate").isEmpty()).andReturn();
        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        String today = LocalDate.now(java.time.ZoneId.of("Asia/Bangkok")).toString();
        mvc.perform(post("/api/purchases/" + id + "/import-stock")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.importedDate").value(today))
                .andExpect(jsonPath("$.data.date").value("2020-01-02"));
        entityManager.flush();
        entityManager.clear();
        mvc.perform(get("/api/purchases/" + id)).andExpect(jsonPath("$.data.importedDate").value(today));
        mvc.perform(get("/api/purchases")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].importedDate").value(today));
        mvc.perform(post("/api/purchases/" + id + "/import-stock"))
                .andExpect(jsonPath("$.data.importedDate").value(today));
    }

    @Test
    void editsMetadataWithoutChangingStockAndDeletesOnlyUnpostedInvoices() throws Exception {
        var request = new PurchaseInvoiceRequest(supplierId, null, LocalDate.now(),
                List.of(new PurchaseInvoiceItemRequest(null, "Menu action product", 3.0, "Kg", 1000L, 0.0)),
                0L, 0L, 0L, "Trả sau", "Chưa nhập kho", null, null, null, null);
        var result = mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn();
        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        var edit = new com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceEditRequest(supplierId, LocalDate.of(2026, 1, 2), "REF-EDIT", "Updated note", List.of(tagId), List.of(new PurchaseInvoiceItemRequest(null, "Updated item", 5.0, "Kg", 1000L, 0.0)), 500L, 100L);
        mvc.perform(put("/api/purchases/"+id).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(edit)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.note").value("Updated note"))
                .andExpect(jsonPath("$.data.totalAmount").value(4600)).andExpect(jsonPath("$.data.stockStatus").value("Chưa nhập kho"));
        var wrongSupplier = new com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceEditRequest(supplierId + 99999, edit.date(), edit.referenceCode(), edit.note(), edit.tagIds(), edit.items(), 0L, 0L);
        mvc.perform(put("/api/purchases/"+id).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(wrongSupplier)))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/purchases/"+id)).andExpect(status().isOk());
        mvc.perform(get("/api/purchases/"+id)).andExpect(status().isNotFound());
        result = mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request))).andReturn();
        id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        mvc.perform(post("/api/purchases/"+id+"/pay").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(new PurchasePaymentRequest(100L, "Partial payment"))))
                .andExpect(status().isOk());
        mvc.perform(put("/api/purchases/"+id).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(edit))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/purchases/"+id+"/import-stock")).andExpect(status().isOk());
        mvc.perform(delete("/api/purchases/"+id)).andExpect(status().isBadRequest());
        mvc.perform(put("/api/purchases/"+id).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(edit)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void selectedProductUsesDatabaseNameAndCorrectWarehouse() throws Exception {
        var warehouse = new WarehouseCategory(); warehouse.setName("Selected warehouse"); warehouse.setNameKey("selected warehouse"); warehouse = warehouseCategoryRepository.saveAndFlush(warehouse);
        var product = new ProductCategory(); product.setName("Selected feed"); product.setNameKey("selected feed"); product.setWarehouse(warehouse); product = productCategoryRepository.saveAndFlush(product);
        var request = new PurchaseInvoiceRequest(supplierId, null, LocalDate.now(),
                List.of(new PurchaseInvoiceItemRequest(product.getId(), "Untrusted supplied name", 4.0, "Kg", 1000L, 0.0)),
                0L, 0L, 0L, "Trả sau", "Đã nhập kho", null, null, null, null);
        mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.items[0].name").value("Selected feed"));
        var stock = inventoryRepository.findByWarehouse_IdAndProduct_Id(warehouse.getId(), product.getId()).orElseThrow();
        assertEquals(4, stock.getStock().intValue());
        var bad = new PurchaseInvoiceRequest(supplierId, null, LocalDate.now(),
                List.of(new PurchaseInvoiceItemRequest(999999L, "Unknown", 1.0, "Kg", 1000L, 0.0)),
                0L, 0L, 0L, "Trả sau", "Chưa nhập kho", null, null, null, null);
        mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(bad))).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidNumericAndTextInputs() throws Exception {
        var request = new PurchaseInvoiceRequest(supplierId, null, LocalDate.now(),
                List.of(new PurchaseInvoiceItemRequest(null, "Validation feed", 2.0, "Kg", 1000L, 0.0)),
                0L, 0L, 0L, "Trả sau", "Chưa nhập kho", "HD-CP-0915", "Nhập 2 kg", null, null);
        for (String field : List.of("discountAmount", "otherCost", "paidAmount")) {
            var json = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.valueToTree(request);
            json.put(field, -1);
            mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(json.toString())).andExpect(status().isBadRequest());
        }
        for (int price : List.of(0, -10)) {
            var json = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.valueToTree(request);
            ((com.fasterxml.jackson.databind.node.ObjectNode) json.path("items").get(0)).put("price", price);
            mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(json.toString())).andExpect(status().isBadRequest());
        }
        var json = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.valueToTree(request);
        json.put("note", "12345");
        mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(json.toString())).andExpect(status().isBadRequest());
        mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request))).andExpect(status().isCreated());
    }

    @Test
    void testDeferredPaymentAndPayEndpoint() throws Exception {
        var items = List.of(
                new PurchaseInvoiceItemRequest(null, "Cám Gà úm Higro 01", 100.0, "Bao (25kg)", 345000L, 0.0)
        );
        var req = new PurchaseInvoiceRequest(
                supplierId,
                null,
                LocalDate.now(),
                items,
                0L,
                0L,
                0L, // 0 paid
                "Trả sau",
                "Đã nhập kho",
                null,
                "Đơn trả sau",
                null,
                null
        );

        var result = mvc.perform(post("/api/purchases")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.totalAmount").value(34500000))
                .andExpect(jsonPath("$.data.paidAmount").value(0))
                .andExpect(jsonPath("$.data.paymentStatus").value("Trả sau"))
                .andReturn();

        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Make partial payment
        var payReq = new PurchasePaymentRequest(15000000L, "Thanh toán đợt 1");
        mvc.perform(post("/api/purchases/" + id + "/pay")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(payReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paidAmount").value(15000000))
                .andExpect(jsonPath("$.data.paymentStatus").value("Thanh toán một phần"));

        // Make remaining payment
        var payReq2 = new PurchasePaymentRequest(19500000L, "Thanh toán tất toán");
        mvc.perform(post("/api/purchases/" + id + "/pay")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(payReq2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paidAmount").value(34500000))
                .andExpect(jsonPath("$.data.paymentStatus").value("Thanh toán hoàn tất"));
    }

    @Test
    void testCancelProtectionOnFinalizedOrImportedInvoice() throws Exception {
        // 1. Create an invoice marked as IMPORTED
        var items = List.of(
                new PurchaseInvoiceItemRequest(null, "Kháng sinh", 10.0, "Gói", 200000L, 0.0)
        );
        var reqImported = new PurchaseInvoiceRequest(
                supplierId, null, LocalDate.now(), items, 0L, 0L, 0L,
                "Chưa thanh toán", "Đã nhập kho", null, null, null, null
        );
        var res1 = mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(reqImported))).andReturn();
        long id1 = mapper.readTree(res1.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Cancelling already imported invoice must fail with 400 and MSG39
        mvc.perform(post("/api/purchases/" + id1 + "/cancel"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Bản ghi đã quyết toán không thể bị xóa. Vui lòng sử dụng điều chỉnh hoặc đính chính được cấp quyền."));

        // 2. Create an invoice that is NOT imported and NOT paid
        var reqPending = new PurchaseInvoiceRequest(
                supplierId, null, LocalDate.now(), items, 0L, 0L, 0L,
                "Chưa thanh toán", "Chưa nhập kho", null, null, null, null
        );
        var res2 = mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(reqPending))).andReturn();
        long id2 = mapper.readTree(res2.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Cancelling pending invoice must succeed
        mvc.perform(post("/api/purchases/" + id2 + "/cancel"))
                .andExpect(status().isOk());

        var cancelled = invoiceRepository.findById(id2).orElseThrow();
        assertEquals("Đã hủy", cancelled.getStockStatus());
    }

    @Test
    void testOcrEndpointReturnsSampleData() throws Exception {
        mvc.perform(post("/api/purchases/ocr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.supplierName").value("Công ty CP Chăn nuôi C.P. Việt Nam"))
                .andExpect(jsonPath("$.data.supplierId").value(supplierId))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.messageCode").value("MSG30"));
    }

    @Test
    void testOcrExtractsUploadedInvoiceWithGemini() throws Exception {
        String aiJson = """
                {
                  "isInvoice": true,
                  "supplierName": "CÔNG TY CỔ PHẦN CHĂN NUÔI C.P. VIỆT NAM",
                  "supplierTaxCode": "3600224423",
                  "invoiceDate": "2026-10-15",
                  "referenceCode": "1C26TAA-00001234",
                  "items": [
                    {"name": "Cám gà thịt 552F", "qty": 20, "unit": "Bao (25kg)", "unitPrice": 300000, "amount": 6000000, "vatRate": 5},
                    {"name": "Vắc-xin Gumboro", "qty": 4, "unit": "Lọ", "unitPrice": null, "amount": 1000000, "vatRate": 5}
                  ],
                  "discountAmount": 200000,
                  "vatAmount": 350000,
                  "otherCost": 100000,
                  "totalAmount": 7250000,
                  "confidence": 0.92,
                  "warnings": ["Chữ ký bị mờ"]
                }
                """;
        when(geminiClient.extractJson(anyString(), any(byte[].class), eq("image/jpeg"), anyMap()))
                .thenReturn(mapper.readTree(aiJson));

        var file = new MockMultipartFile("file", "hoa-don.jpg", "image/jpeg", new byte[]{1, 2, 3});
        mvc.perform(multipart("/api/purchases/ocr").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.supplierId").value(supplierId))
                .andExpect(jsonPath("$.data.supplierName").value("Công ty CP Chăn nuôi C.P. Việt Nam"))
                .andExpect(jsonPath("$.data.invoiceDate").value("2026-10-15"))
                .andExpect(jsonPath("$.data.referenceCode").value("1C26TAA-00001234"))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[0].price").value(300000))
                .andExpect(jsonPath("$.data.items[1].price").value(250000))
                .andExpect(jsonPath("$.data.discountAmount").value(200000))
                .andExpect(jsonPath("$.data.otherCost").value(450000))
                .andExpect(jsonPath("$.data.totalAmount").value(7250000))
                .andExpect(jsonPath("$.data.confidence").value(92.0))
                .andExpect(jsonPath("$.data.warnings[0]").value("Chữ ký bị mờ"))
                .andExpect(jsonPath("$.data.messageCode").value("MSG30"));
    }

    @Test
    void testOcrRejectsUnsupportedFileType() throws Exception {
        var file = new MockMultipartFile("file", "notes.txt", "text/plain", "hello".getBytes());
        mvc.perform(multipart("/api/purchases/ocr").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("OCR_UNSUPPORTED_FILE"));
        verify(geminiClient, never()).extractJson(anyString(), any(), anyString(), anyMap());
    }

    @Test
    void testOcrRejectsNonInvoiceDocument() throws Exception {
        when(geminiClient.extractJson(anyString(), any(byte[].class), eq("application/pdf"), anyMap()))
                .thenReturn(mapper.readTree("{\"isInvoice\": false, \"items\": [], \"confidence\": 10}"));

        var file = new MockMultipartFile("file", "cv.pdf", "application/pdf", new byte[]{1});
        mvc.perform(multipart("/api/purchases/ocr").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("OCR_NOT_INVOICE"));
    }
}
