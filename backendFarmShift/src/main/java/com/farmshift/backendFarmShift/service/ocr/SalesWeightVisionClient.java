package com.farmshift.backendFarmShift.service.ocr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

@Service
public class SalesWeightVisionClient {
    private final String baseUrl;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    public SalesWeightVisionClient(ObjectMapper mapper, @Value("${ai-service.url:http://localhost:8000}") String url) {
        this.mapper = mapper; this.baseUrl = url.replaceAll("/+$", "");
    }
    public JsonNode extract(WeightSlipStorage.Document document) {
        String boundary = "weight-" + java.util.UUID.randomUUID();
        try {
            var body = new ByteArrayOutputStream();
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"weight-slip" + document.extension() + "\"\r\nContent-Type: " + document.mime() + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(document.bytes());
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            var request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/ocr/extract-weight-slip"))
                    .timeout(Duration.ofSeconds(90)).header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                String message = "Dịch vụ OCR chưa bóc tách được phiếu cân (HTTP " + response.statusCode() + ").";
                try {
                    var detail = mapper.readTree(response.body()).path("detail");
                    if (detail.isTextual() && !detail.asText().isBlank() && detail.asText().length() <= 500) message = detail.asText();
                } catch (Exception ignored) { /* A proxy may return a non-JSON error. */ }
                throw new BadRequestException(message);
            }
            var result = mapper.readTree(response.body());
            if (!result.path("isWeightSlip").asBoolean(false)) throw new BadRequestException("Tệp không phải phiếu cân bán gà.");
            return result;
        } catch (BadRequestException ex) { throw ex; }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new BadRequestException("Đã ngắt xử lý phiếu cân."); }
        catch (Exception ex) { throw new BadRequestException("Không kết nối được dịch vụ OCR. Vui lòng thử lại."); }
    }
}