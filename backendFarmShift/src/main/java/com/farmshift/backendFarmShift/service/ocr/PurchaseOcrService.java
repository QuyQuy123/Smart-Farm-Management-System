package com.farmshift.backendFarmShift.service.ocr;

import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceItemRequest;
import com.farmshift.backendFarmShift.dto.response.PurchaseOcrResponse;
import com.farmshift.backendFarmShift.entity.ProductCategory;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Extracts a draft purchase invoice from an uploaded invoice image / PDF using RapidOCR (PaddleOCR),
 * then matches the result against existing suppliers and product categories.
 * The output is only a draft (MSG30) – the user must review it before saving.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PurchaseOcrService {

    public static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

    private static final Map<String, String> MIME_BY_EXTENSION = Map.of(
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "png", "image/png",
            "webp", "image/webp",
            "heic", "image/heic",
            "heif", "image/heif",
            "pdf", "application/pdf"
    );

    private final VisionClient visionClient;
    private final SupplierRepository supplierRepository;
    private final ProductCategoryRepository productCategoryRepository;

    public PurchaseOcrResponse extract(MultipartFile file) {
        String mimeType = resolveMimeType(file);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new BadRequestException("Không đọc được tệp chứng từ đã tải lên.", "OCR_FILE_UNREADABLE");
        }

        JsonNode json = visionClient.extractJson("", bytes, mimeType, responseSchema());

        if (!json.path("isInvoice").asBoolean(true)) {
            throw new BadRequestException(
                    "Không nhận diện được hóa đơn / phiếu nhập hàng trong tệp đã tải lên. Vui lòng chọn đúng chứng từ.",
                    "OCR_NOT_INVOICE"
            );
        }

        List<ProductCategory> categories = productCategoryRepository.findAll();
        List<PurchaseInvoiceItemRequest> items = new ArrayList<>();
        for (JsonNode node : json.path("items")) {
            PurchaseInvoiceItemRequest item = toItem(node, categories);
            if (item != null) items.add(item);
        }
        if (items.isEmpty()) {
            throw new BadRequestException(
                    "Không tìm thấy dòng hàng hóa nào trên chứng từ. Vui lòng thử lại với ảnh rõ nét, đủ sáng.",
                    "OCR_NO_ITEMS"
            );
        }

        String supplierName = text(json, "supplierName");
        String taxCode = text(json, "supplierTaxCode");
        Supplier matched = matchSupplier(supplierName, taxCode);

        long discount = money(json, "discountAmount");
        long vat = money(json, "vatAmount");
        long otherCost = money(json, "otherCost") + vat;
        long itemsTotal = items.stream().mapToLong(it -> Math.round(it.qty() * it.price())).sum();
        long computedTotal = Math.max(0L, itemsTotal - discount + otherCost);

        List<String> warnings = new ArrayList<>();
        for (JsonNode w : json.path("warnings")) {
            if (!w.asText("").isBlank()) warnings.add(w.asText().strip());
        }
        long invoiceTotal = money(json, "totalAmount");
        if (invoiceTotal > 0 && Math.abs(invoiceTotal - computedTotal) > 1000) {
            warnings.add(String.format(Locale.ROOT,
                    "Tổng tiền trên chứng từ (%,d đ) chưa khớp với tổng tính lại (%,d đ). Vui lòng kiểm tra lại.",
                    invoiceTotal, computedTotal).replace(',', '.'));
        }
        if (supplierName != null && matched == null) {
            warnings.add("Nhà cung cấp \"" + supplierName + "\" chưa có trong danh mục – sẽ được tạo mới khi lưu.");
        }

        String engine = json.hasNonNull("engine") 
                ? json.path("engine").asText() 
                : (visionClient instanceof PaddleVisionClient ? "RapidOCR" : "OpenAI gpt-5.6-sol");
        StringBuilder note = new StringBuilder();
        if (vat > 0) {
            note.append(String.format(Locale.ROOT, "Đã gồm thuế GTGT %,d đ trong chi phí khác", vat).replace(',', '.'));
        }

        String rawPaymentStatus = text(json, "paymentStatus");
        long paidAmount = money(json, "paidAmount");
        String paymentStatus;
        if ("Thanh toán một phần".equalsIgnoreCase(rawPaymentStatus) || (paidAmount > 0 && paidAmount < computedTotal)) {
            paymentStatus = "Thanh toán một phần";
        } else if ("Thanh toán hoàn tất".equalsIgnoreCase(rawPaymentStatus) || (paidAmount > 0 && paidAmount >= computedTotal)) {
            paymentStatus = "Thanh toán hoàn tất";
            paidAmount = computedTotal;
        } else {
            paymentStatus = "Trả sau";
            paidAmount = 0L;
        }

        return new PurchaseOcrResponse(
                matched != null ? matched.getId() : null,
                matched != null ? matched.getName() : supplierName,
                taxCode,
                parseDate(text(json, "invoiceDate")),
                text(json, "referenceCode"),
                items,
                discount,
                otherCost,
                computedTotal,
                paymentStatus,
                paidAmount,
                clampConfidence(json.path("confidence").asDouble(0)),
                note.toString(),
                warnings,
                "MSG30"
        );
    }

    /** Demo data used by the "Thử bóc tách hóa đơn mẫu" button (no file uploaded). */
    public PurchaseOcrResponse sample() {
        String name = "Công ty CP Chăn nuôi C.P. Việt Nam";
        Supplier matched = matchSupplier(name, "0300645678");
        return new PurchaseOcrResponse(
                matched != null ? matched.getId() : null,
                matched != null ? matched.getName() : name,
                "0300645678",
                LocalDate.now(),
                "HD-CP-2026-9921",
                List.of(
                        new PurchaseInvoiceItemRequest(null, "Cám Gà úm Higro 01", 50.0, "Bao (25kg)", 345000L, 0.0),
                        new PurchaseInvoiceItemRequest(null, "Cám Gà thịt Higro 02", 60.0, "Bao (25kg)", 335000L, 0.0)
                ),
                0L,
                0L,
                37350000L,
                "Thanh toán hoàn tất",
                37350000L,
                96.8,
                "Trích xuất tự động OpenAI gpt-5.6-sol từ hóa đơn mẫu C.P. Việt Nam",
                List.of(),
                "MSG30"
        );
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */

    private String resolveMimeType(MultipartFile file) {
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("Tệp chứng từ vượt quá dung lượng cho phép (tối đa 10MB).", "OCR_FILE_TOO_LARGE");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (MIME_BY_EXTENSION.containsValue(contentType)) {
            return contentType;
        }
        if ("image/jpg".equals(contentType) || "image/pjpeg".equals(contentType)) {
            return "image/jpeg";
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        int dot = filename.lastIndexOf('.');
        if (dot >= 0) {
            String mime = MIME_BY_EXTENSION.get(filename.substring(dot + 1));
            if (mime != null) return mime;
        }
        throw new BadRequestException(
                "Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WEBP, HEIC hoặc tệp PDF.",
                "OCR_UNSUPPORTED_FILE"
        );
    }

    private PurchaseInvoiceItemRequest toItem(JsonNode node, List<ProductCategory> categories) {
        String name = text(node, "name");
        if (name == null) return null;

        double qty = node.path("qty").asDouble(0);
        double amount = node.path("amount").asDouble(0);
        double unitPrice = node.path("unitPrice").asDouble(0);
        if (qty <= 0) qty = 1;
        if (unitPrice <= 0 && amount > 0) unitPrice = amount / qty;

        String unit = text(node, "unit");
        Double vatRate = node.hasNonNull("vatRate") ? node.get("vatRate").asDouble() : null;

        Long categoryId = matchCategory(name, categories);
        return new PurchaseInvoiceItemRequest(
                categoryId,
                name,
                qty,
                unit != null ? unit : "Cái",
                Math.max(0L, Math.round(unitPrice)),
                vatRate
        );
    }

    private Long matchCategory(String itemName, List<ProductCategory> categories) {
        String key = normalize(itemName);
        for (ProductCategory c : categories) {
            if (c.getName() != null && normalize(c.getName()).equals(key)) {
                return c.getId();
            }
        }
        return null;
    }

    private Supplier matchSupplier(String name, String taxCode) {
        List<Supplier> suppliers = supplierRepository.findAll();
        String taxDigits = taxCode == null ? "" : taxCode.replaceAll("[^0-9]", "");
        if (taxDigits.length() >= 10) {
            for (Supplier s : suppliers) {
                String sTax = s.getTaxCode() == null ? "" : s.getTaxCode().replaceAll("[^0-9]", "");
                if (sTax.equals(taxDigits)) return s;
            }
        }
        if (name == null) return null;
        String key = normalize(name);
        for (Supplier s : suppliers) {
            if (s.getName() != null && normalize(s.getName()).equals(key)) return s;
        }
        String core = stripCompanyWords(key);
        if (core.length() < 4) return null;
        for (Supplier s : suppliers) {
            if (s.getName() == null) continue;
            String sCore = stripCompanyWords(normalize(s.getName()));
            if (sCore.length() >= 4 && (sCore.contains(core) || core.contains(sCore))) return s;
        }
        return null;
    }

    static String normalize(String value) {
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return noAccent.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .strip();
    }

    private static String stripCompanyWords(String normalized) {
        String pattern = " (cong ty|cty|co phan|trach nhiem huu han|tnhh|mtv|mot thanh vien|cp|jsc|ltd|chi nhanh|viet nam|vn) ";
        String current = " " + normalized + " ";
        String previous;
        do {
            previous = current;
            current = current.replaceAll(pattern, " ");
        } while (!current.equals(previous));
        return current.replaceAll("\\s+", " ").strip();
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return null;
        String s = v.asText("").strip();
        return s.isEmpty() || "null".equalsIgnoreCase(s) ? null : s;
    }

    private static long money(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return 0L;
        return Math.max(0L, Math.round(v.asDouble(0)));
    }

    private static LocalDate parseDate(String value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static double clampConfidence(double value) {
        double pct = value <= 1 && value > 0 ? value * 100 : value;
        return Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10.0;
    }

    private static Map<String, Object> responseSchema() {
        Map<String, Object> str = Map.of("type", "STRING", "nullable", true);
        Map<String, Object> num = Map.of("type", "NUMBER", "nullable", true);

        Map<String, Object> item = Map.of(
                "type", "OBJECT",
                "properties", Map.of(
                        "name", Map.of("type", "STRING"),
                        "qty", Map.of("type", "NUMBER"),
                        "unit", str,
                        "unitPrice", num,
                        "amount", num,
                        "vatRate", num
                ),
                "required", List.of("name", "qty")
        );

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("isInvoice", Map.of("type", "BOOLEAN"));
        props.put("supplierName", str);
        props.put("supplierTaxCode", str);
        props.put("invoiceDate", str);
        props.put("referenceCode", str);
        props.put("items", Map.of("type", "ARRAY", "items", item));
        props.put("discountAmount", num);
        props.put("vatAmount", num);
        props.put("otherCost", num);
        props.put("totalAmount", num);
        props.put("confidence", Map.of("type", "NUMBER"));
        props.put("warnings", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")));

        return Map.of(
                "type", "OBJECT",
                "properties", props,
                "required", List.of("isInvoice", "items", "confidence"),
                "propertyOrdering", new ArrayList<>(props.keySet())
        );
    }
}
