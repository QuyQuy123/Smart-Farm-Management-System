package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.response.PurchaseOcrResponse;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.ocr.PaddleInvoiceParser;
import com.farmshift.backendFarmShift.service.ocr.PaddleOcrEngine;
import com.farmshift.backendFarmShift.service.ocr.PaddleVisionClient;
import com.farmshift.backendFarmShift.service.ocr.PurchaseOcrService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class PaddleOcrSmokeTest {

    @Test
    void testPaddleOcrPipelineEndToEnd() throws Exception {
        PaddleOcrEngine engine = new PaddleOcrEngine();
        PaddleInvoiceParser parser = new PaddleInvoiceParser(new ObjectMapper());
        PaddleVisionClient client = new PaddleVisionClient(engine, parser);

        assertTrue(client.isConfigured());

        // Create a test invoice image with multiple lines
        byte[] imageBytes = createTestInvoiceImage();

        JsonNode json = client.extractJson("", imageBytes, "image/png", Map.of());
        assertNotNull(json);
        assertTrue(json.path("isInvoice").asBoolean());
        assertNotNull(json.path("supplierName").asText(null));
        assertTrue(json.path("supplierName").asText().contains("C.P."));
        assertEquals("3600224423", json.path("supplierTaxCode").asText());
        assertEquals("1C26TAA-00001234", json.path("referenceCode").asText());
        assertEquals("2026-10-15", json.path("invoiceDate").asText());
        assertTrue(json.path("items").size() >= 2);
        assertEquals(17950000L, json.path("totalAmount").asLong());
        assertTrue(json.path("confidence").asDouble() > 70);
    }

    @Test
    void testSampleInvoicesFileCp() throws Exception {
        java.io.File file = new java.io.File("../sample_invoices/hoa_don_mau_cp.png");
        if (!file.exists()) {
            file = new java.io.File("sample_invoices/hoa_don_mau_cp.png");
        }
        assertTrue(file.exists(), "File hoa_don_mau_cp.png must exist");
        byte[] bytes = java.nio.file.Files.readAllBytes(file.toPath());

        PaddleOcrEngine engine = new PaddleOcrEngine();
        PaddleOcrEngine.OcrDocumentResult ocrResult = engine.recognize(bytes, "image/png");
        System.out.println("=== FULL TEXT FROM OCR ===");
        System.out.println(ocrResult.fullText());
        System.out.println("=== BLOCKS COUNT: " + ocrResult.blocks().size() + " ===");
        for (var b : ocrResult.blocks()) {
            System.out.println("BLOCK: " + b.text() + " [y=" + b.y() + ", x=" + b.x() + ", h=" + b.height() + "]");
        }

        PaddleInvoiceParser parser = new PaddleInvoiceParser(new ObjectMapper());
        JsonNode json = parser.parse(ocrResult);
        System.out.println("=== PARSED JSON ===");
        System.out.println(json.toPrettyString());

        assertTrue(json.path("isInvoice").asBoolean());
        assertTrue(json.path("supplierName").asText().contains("C.P."));
        assertEquals("3600224423", json.path("supplierTaxCode").asText());
        assertEquals("2026-10-19", json.path("invoiceDate").asText());
        assertEquals("01GTKT0/001-HD-CP-2026-9921", json.path("referenceCode").asText());
        assertEquals(2, json.path("items").size());
        assertEquals("Cam Ga um Higro 01", json.path("items").get(0).path("name").asText());
        assertEquals(50.0, json.path("items").get(0).path("qty").asDouble());
        assertEquals(345000.0, json.path("items").get(0).path("unitPrice").asDouble());
        assertEquals(17250000.0, json.path("items").get(0).path("amount").asDouble());
        assertEquals(20000000L, json.path("discountAmount").asLong());
        assertEquals(2000000L, json.path("otherCost").asLong());
        assertEquals(19350000L, json.path("totalAmount").asLong());
        assertEquals(0, json.path("warnings").size());
    }

    @Test
    void testSampleInvoicesFileVet() throws Exception {
        java.io.File file = new java.io.File("../sample_invoices/hoa_don_mau_thuoc_thu_y.png");
        if (!file.exists()) {
            file = new java.io.File("sample_invoices/hoa_don_mau_thuoc_thu_y.png");
        }
        assertTrue(file.exists(), "File hoa_don_mau_thuoc_thu_y.png must exist");
        byte[] bytes = java.nio.file.Files.readAllBytes(file.toPath());

        PaddleOcrEngine engine = new PaddleOcrEngine();
        PaddleOcrEngine.OcrDocumentResult ocrResult = engine.recognize(bytes, "image/png");
        PaddleInvoiceParser parser = new PaddleInvoiceParser(new ObjectMapper());
        JsonNode json = parser.parse(ocrResult);

        assertTrue(json.path("isInvoice").asBoolean());
        assertTrue(json.path("supplierName").asText().contains("NAVETCO"));
        assertEquals("0300456789", json.path("supplierTaxCode").asText());
        assertEquals("2026-10-18", json.path("invoiceDate").asText());
        assertTrue(json.path("items").size() >= 2);
        assertEquals(5600000L, json.path("totalAmount").asLong());
    }

    @Test
    void testPurchaseOcrServiceWithRealPaddleOcr() throws Exception {
        PaddleOcrEngine engine = new PaddleOcrEngine();
        PaddleInvoiceParser parser = new PaddleInvoiceParser(new ObjectMapper());
        PaddleVisionClient client = new PaddleVisionClient(engine, parser);

        SupplierRepository supplierRepo = Mockito.mock(SupplierRepository.class);
        ProductCategoryRepository categoryRepo = Mockito.mock(ProductCategoryRepository.class);
        Supplier cpSupplier = new Supplier();
        cpSupplier.setId(10L);
        cpSupplier.setName("Công ty CP Chăn nuôi C.P. Việt Nam");
        cpSupplier.setTaxCode("3600224423");
        Mockito.when(supplierRepo.findAll()).thenReturn(List.of(cpSupplier));

        PurchaseOcrService ocrService = new PurchaseOcrService(client, supplierRepo, categoryRepo);
        byte[] imageBytes = createTestInvoiceImage();
        MockMultipartFile file = new MockMultipartFile("file", "invoice.png", "image/png", imageBytes);

        PurchaseOcrResponse response = ocrService.extract(file);
        assertNotNull(response);
        assertEquals(10L, response.supplierId());
        assertEquals("Công ty CP Chăn nuôi C.P. Việt Nam", response.supplierName());
        assertEquals("3600224423", response.supplierTaxCode());
        assertEquals("1C26TAA-00001234", response.referenceCode());
        assertEquals(LocalDate.of(2026, 10, 15), response.invoiceDate());
        System.out.println("RESPONSE ITEMS: " + response.items());
        assertEquals(2, response.items().size());
        assertEquals(17950000L, response.totalAmount());
        assertNotNull(response.note());
        assertEquals("MSG30", response.messageCode());
    }

    private byte[] createTestInvoiceImage() throws Exception {
        BufferedImage img = new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = img.createGraphics();
        g2d.setColor(Color.WHITE);
        g2d.fillRect(0, 0, 800, 600);
        g2d.setColor(Color.BLACK);
        g2d.setFont(new Font("Arial", Font.BOLD, 22));
        g2d.drawString("HOA DON BAN HANG", 280, 50);

        g2d.setFont(new Font("Arial", Font.PLAIN, 18));
        g2d.drawString("Don vi ban hang: Cong ty CP Chan nuoi C.P. Viet Nam", 50, 100);
        g2d.drawString("Ma so thue: 3600224423", 50, 135);
        g2d.drawString("Ky hieu: 1C26TAA   So: 00001234", 50, 170);
        g2d.drawString("Ngay: 15/10/2026", 50, 205);

        g2d.drawString("1. Cam Ga thit Higro 02   50 Bao (25kg)   335.000   16.750.000", 50, 270);
        g2d.drawString("2. Vac-xin Gumboro   10 Lo   120.000   1.200.000", 50, 310);

        g2d.drawString("Tong cong tien thanh toan: 17.950.000 d", 50, 400);
        g2d.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }
}
