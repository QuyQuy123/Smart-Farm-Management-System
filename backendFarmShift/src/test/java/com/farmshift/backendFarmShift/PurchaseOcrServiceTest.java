package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.ocr.PurchaseOcrService;
import com.farmshift.backendFarmShift.service.ocr.VisionClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PurchaseOcrServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void extract_usesSpecificWarningMessageWhenDocumentIsNotPurchaseInvoice() throws Exception {
        VisionClient visionClient = mock(VisionClient.class);
        SupplierRepository supplierRepository = mock(SupplierRepository.class);
        ProductCategoryRepository productCategoryRepository = mock(ProductCategoryRepository.class);

        String specificWarning = "Chứng từ này là phiếu cân / chứng từ xuất bán gà, không phải hóa đơn nhập hàng. Vui lòng quét ở mục Quản lý bán hàng.";
        when(visionClient.extractJson(anyString(), any(), anyString(), any()))
                .thenReturn(objectMapper.readTree(
                        "{\"isInvoice\":false,\"items\":[],\"warnings\":[\"" + specificWarning + "\"]}"
                ));

        PurchaseOcrService service = new PurchaseOcrService(visionClient, supplierRepository, productCategoryRepository);
        MockMultipartFile file = new MockMultipartFile("file", "slip.png", "image/png", new byte[]{1, 2, 3});

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.extract(file));
        assertEquals("OCR_NOT_INVOICE", ex.getErrorCode());
        assertEquals(specificWarning, ex.getMessage());
    }

    @Test
    void extract_fallsBackToDefaultMessageWhenWarningsAreEmpty() throws Exception {
        VisionClient visionClient = mock(VisionClient.class);
        SupplierRepository supplierRepository = mock(SupplierRepository.class);
        ProductCategoryRepository productCategoryRepository = mock(ProductCategoryRepository.class);

        when(visionClient.extractJson(anyString(), any(), anyString(), any()))
                .thenReturn(objectMapper.readTree("{\"isInvoice\":false,\"items\":[],\"warnings\":[\"   \"]}"));

        PurchaseOcrService service = new PurchaseOcrService(visionClient, supplierRepository, productCategoryRepository);
        MockMultipartFile file = new MockMultipartFile("file", "other.png", "image/png", new byte[]{1, 2, 3});

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.extract(file));
        assertEquals("OCR_NOT_INVOICE", ex.getErrorCode());
        assertEquals(
                "Không nhận diện được hóa đơn / phiếu nhập hàng trong tệp đã tải lên. Vui lòng chọn đúng chứng từ.",
                ex.getMessage()
        );
    }

    @Test
    void extract_rescuesDroppedThousandsUnitPriceAndFlagsMismatchedLineItem() throws Exception {
        VisionClient visionClient = mock(VisionClient.class);
        SupplierRepository supplierRepository = mock(SupplierRepository.class);
        ProductCategoryRepository productCategoryRepository = mock(ProductCategoryRepository.class);

        String payload = """
                {
                  "isInvoice": true,
                  "supplierName": "C.P. Việt Nam",
                  "items": [
                    { "name": "Cám Higro 01", "qty": 50, "unit": "Bao", "unitPrice": 345, "amount": 17250000 },
                    { "name": "Thuốc B", "qty": 10, "unit": "Chai", "unitPrice": 100000, "amount": 1800000 }
                  ],
                  "discountAmount": 0,
                  "vatAmount": 0,
                  "otherCost": 0,
                  "totalAmount": 18250000,
                  "confidence": 94.5,
                  "warnings": []
                }
                """;
        when(visionClient.extractJson(anyString(), any(), anyString(), any()))
                .thenReturn(objectMapper.readTree(payload));

        PurchaseOcrService service = new PurchaseOcrService(visionClient, supplierRepository, productCategoryRepository);
        MockMultipartFile file = new MockMultipartFile("file", "inv.png", "image/png", new byte[]{1, 2, 3});

        var result = service.extract(file);
        assertEquals(2, result.items().size());
        assertEquals(345000L, result.items().get(0).price());
        assertEquals(18250000L, result.totalAmount());
        assertTrue(result.warnings().stream().anyMatch(w -> w.contains("Thuốc B") && w.contains("chưa khớp")));
    }

    @Test
    void extract_deduplicatesLineAndTotalWarningsAlreadyProvidedByAiService() throws Exception {
        VisionClient visionClient = mock(VisionClient.class);
        SupplierRepository supplierRepository = mock(SupplierRepository.class);
        ProductCategoryRepository productCategoryRepository = mock(ProductCategoryRepository.class);

        String payload = """
                {
                  "isInvoice": true,
                  "supplierName": "C.P. Việt Nam",
                  "items": [
                    { "name": "Thuốc B", "qty": 10, "unit": "Chai", "unitPrice": 100000, "amount": 1800000 }
                  ],
                  "discountAmount": 0,
                  "vatAmount": 0,
                  "otherCost": 0,
                  "totalAmount": 1800000,
                  "confidence": 91.0,
                  "warnings": [
                    "Dòng hàng #1 (Thuốc B): thành tiền (1.800.000 đ) chưa khớp số lượng × đơn giá (1.000.000 đ).",
                    "Tổng tiền trên hóa đơn (1.800.000 đ) chưa khớp với tổng tính lại (1.000.000 đ). Vui lòng đối chiếu lại."
                  ]
                }
                """;
        when(visionClient.extractJson(anyString(), any(), anyString(), any()))
                .thenReturn(objectMapper.readTree(payload));

        PurchaseOcrService service = new PurchaseOcrService(visionClient, supplierRepository, productCategoryRepository);
        MockMultipartFile file = new MockMultipartFile("file", "inv.png", "image/png", new byte[]{1, 2, 3});

        var result = service.extract(file);
        long lineWarnings = result.warnings().stream().filter(w -> w.contains("Thuốc B") && w.contains("chưa khớp")).count();
        long totalWarnings = result.warnings().stream().filter(w -> w.startsWith("Tổng tiền") && w.contains("chưa khớp")).count();
        assertEquals(1L, lineWarnings, "Line mismatch warning must not be duplicated: " + result.warnings());
        assertEquals(1L, totalWarnings, "Total mismatch warning must not be duplicated: " + result.warnings());
    }
}
