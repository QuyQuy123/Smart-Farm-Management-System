package com.farmshift.backendFarmShift.service.ocr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

/**
 * Multimodal Vision Client powered by OpenAI (defaulting to gpt-5.6-sol).
 * Includes intelligent automatic fallback to offline RapidOCR (PaddleOCR) if the
 * API key is unset or external network calls encounter issues.
 */
@Slf4j
@Primary
@Component
public class OpenAiVisionClient implements VisionClient {

    private final PaddleVisionClient fallbackClient;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final int timeoutSeconds;
    private final String provider;

    public OpenAiVisionClient(
            PaddleVisionClient fallbackClient,
            ObjectMapper objectMapper,
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.model:gpt-5.6-sol}") String model,
            @Value("${openai.api-url:https://api.openai.com/v1/chat/completions}") String apiUrl,
            @Value("${openai.timeout-seconds:60}") int timeoutSeconds,
            @Value("${ocr.provider:openai}") String provider
    ) {
        this.fallbackClient = fallbackClient;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey != null ? apiKey.strip() : "";
        this.model = model != null && !model.isBlank() ? model.strip() : "gpt-5.6-sol";
        this.apiUrl = apiUrl != null && !apiUrl.isBlank() ? apiUrl.strip() : "https://api.openai.com/v1/chat/completions";
        this.timeoutSeconds = timeoutSeconds > 0 ? timeoutSeconds : 60;
        this.provider = provider != null ? provider.strip() : "openai";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isBlank() && !apiKey.startsWith("YOUR_");
    }

    @Override
    public JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema) {
        if ("rapidocr".equalsIgnoreCase(provider) || !isConfigured()) {
            log.info("Using RapidOCR engine (provider={}, isConfigured={})", provider, isConfigured());
            JsonNode result = fallbackClient.extractJson(prompt, document, mimeType, responseSchema);
            if (result instanceof ObjectNode obj && !obj.has("engine")) {
                obj.put("engine", "RapidOCR");
            }
            return result;
        }

        byte[] imageBytes = document;
        String effectiveMimeType = mimeType;
        if ("application/pdf".equalsIgnoreCase(mimeType)) {
            try (PDDocument doc = Loader.loadPDF(document)) {
                PDFRenderer renderer = new PDFRenderer(doc);
                BufferedImage bim = renderer.renderImageWithDPI(0, 200);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(bim, "png", baos);
                imageBytes = baos.toByteArray();
                effectiveMimeType = "image/png";
            } catch (Exception ex) {
                log.warn("Failed to render PDF to image for OpenAI Vision, falling back to RapidOCR: {}", ex.getMessage());
                return fallbackClient.extractJson(prompt, document, mimeType, responseSchema);
            }
        }

        try {
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("model", model);

            ArrayNode messages = rootNode.putArray("messages");

            ObjectNode sysMsg = messages.addObject();
            sysMsg.put("role", "system");
            sysMsg.put("content", """
                    Bạn là hệ thống trích xuất thông tin hóa đơn / phiếu xuất kho / chứng từ mua hàng cho phần mềm quản lý nông trại FarmShift.
                    Nhiệm vụ: Phân tích hình ảnh chứng từ và trích xuất thông tin theo định dạng JSON chuẩn.
                    Quy tắc:
                    1. Nhận diện chính xác tên Nhà Cung Cấp (supplierName), Mã số thuế nếu có (supplierTaxCode), Ngày hóa đơn định dạng YYYY-MM-DD (invoiceDate), và Ký hiệu/Số hóa đơn (referenceCode).
                    2. Trích xuất danh sách mặt hàng (items): tên hàng hóa (name), số lượng (qty, dạng số thực/số nguyên), đơn vị tính (unit, ví dụ: Bao, Bao (25kg), Chai, Kg, Lọ, Gói,...), đơn giá (unitPrice, số nguyên VNĐ), thành tiền (amount = qty * unitPrice), thuế suất nếu có (vatRate).
                    3. Trích xuất chiết khấu (discountAmount), tiền thuế VAT (vatAmount), chi phí khác/vận chuyển (otherCost), tổng tiền hàng của riêng hóa đơn này (totalAmount). Chú ý: nếu chứng từ bán hàng có dòng "Nợ cũ" và "Còn nợ", totalAmount CHỈ là tổng tiền hàng phát sinh trong hóa đơn này, không cộng dồn nợ cũ.
                    4. Trích xuất tình trạng thanh toán:
                       - paidAmount: Số tiền đã thanh toán cho riêng hóa đơn này (số nguyên VNĐ).
                       - paymentStatus: Trạng thái thanh toán của hóa đơn, chỉ chọn 1 trong 3 giá trị: "Thanh toán hoàn tất", "Thanh toán một phần", hoặc "Trả sau".
                       - Quy tắc phân loại paymentStatus:
                         + Nếu hóa đơn ghi "Đã thanh toán: 0" hoặc để trống ô Đã thanh toán, hoặc còn nợ toàn bộ tiền hàng, hoặc ghi hình thức "Trả sau" / "Chưa thanh toán": paidAmount = 0, paymentStatus = "Trả sau".
                         + Nếu có thanh toán trước một phần tiền (0 < paidAmount < totalAmount): paymentStatus = "Thanh toán một phần".
                         + Nếu hóa đơn đã được thanh toán toàn bộ (phiếu thu, đã chuyển khoản thanh toán đủ, hoặc hóa đơn VAT đã thanh toán): paidAmount = totalAmount, paymentStatus = "Thanh toán hoàn tất".
                    5. isInvoice: true nếu là hóa đơn/phiếu nhập/chứng từ, false nếu ảnh chụp phong cảnh/tài liệu không liên quan.
                    6. confidence: độ tin cậy ước tính từ 0.85 đến 1.0 (ví dụ 0.98).
                    7. warnings: mảng các chuỗi cảnh báo nếu có điểm nghi vấn hoặc chữ mờ.
                    8. BẮT BUỘC chỉ trả về 1 JSON object thuần túy, không bao quanh bằng markdown ```json ```.
                    """);

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            ArrayNode userContent = userMsg.putArray("content");

            ObjectNode textPart = userContent.addObject();
            textPart.put("type", "text");
            textPart.put("text", "Trích xuất chi tiết dữ liệu hóa đơn từ hình ảnh chứng từ này sang JSON.");

            ObjectNode imagePart = userContent.addObject();
            imagePart.put("type", "image_url");
            ObjectNode imageUrl = imagePart.putObject("image_url");
            imageUrl.put("url", "data:" + effectiveMimeType + ";base64," + base64Image);

            ObjectNode respFormat = rootNode.putObject("response_format");
            respFormat.put("type", "json_object");

            String requestBody = objectMapper.writeValueAsString(rootNode);

            log.info("Sending document ({} bytes, mime={}) to OpenAI Vision model {}...", document.length, effectiveMimeType, model);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode respJson = objectMapper.readTree(response.body());
                String content = respJson.path("choices").path(0).path("message").path("content").asText();
                if (content == null || content.isBlank()) {
                    throw new IOException("OpenAI returned empty message content");
                }
                content = content.strip();
                if (content.startsWith("```json")) {
                    content = content.substring(7);
                } else if (content.startsWith("```")) {
                    content = content.substring(3);
                }
                if (content.endsWith("```")) {
                    content = content.substring(0, content.length() - 3);
                }
                JsonNode parsed = objectMapper.readTree(content.strip());
                if (parsed instanceof ObjectNode obj) {
                    obj.put("engine", "OpenAI " + model);
                }
                log.info("Successfully extracted invoice via OpenAI {}", model);
                return parsed;
            } else {
                log.warn("OpenAI API returned HTTP {}: {}", response.statusCode(), response.body());
                throw new IOException("OpenAI HTTP error " + response.statusCode() + ": " + response.body());
            }
        } catch (Exception ex) {
            log.error("OpenAI Vision extraction failed: {}. Falling back to RapidOCR...", ex.getMessage());
            JsonNode fallback = fallbackClient.extractJson(prompt, document, mimeType, responseSchema);
            if (fallback instanceof ObjectNode obj) {
                obj.put("engine", "RapidOCR (Dự phòng)");
                ArrayNode warnings;
                if (obj.has("warnings") && obj.get("warnings").isArray()) {
                    warnings = (ArrayNode) obj.get("warnings");
                } else {
                    warnings = obj.putArray("warnings");
                }
                warnings.add("OpenAI Vision không phản hồi (" + ex.getMessage() + "). Đã tự động kích hoạt RapidOCR dự phòng.");
            }
            return fallback;
        }
    }
}
