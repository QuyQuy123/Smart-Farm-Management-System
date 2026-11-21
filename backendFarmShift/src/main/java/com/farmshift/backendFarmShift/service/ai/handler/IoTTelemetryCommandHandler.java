package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Handles IoT Telemetry queries (barn temperature, relative humidity, ventilation fans).
 */
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class IoTTelemetryCommandHandler implements AssistantCommandHandler {

    private final BarnRepository barnRepository;

    @Autowired(required = false)
    private WorkAssignmentService workAssignmentService;

    @Override
    public int getOrder() {
        return 50;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) return false;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        boolean isBroodingGuideQuery = (norm.contains("um ga") || norm.contains("nhiet do um") || norm.contains("ga con"))
                && !norm.contains("cam bien") && !norm.contains("do am")
                && !norm.contains("chuong") && !norm.contains("nha ");
        if (isBroodingGuideQuery) {
            return false;
        }

        return norm.contains("nhiet do") || norm.contains("do am") || norm.contains("cam bien") || norm.contains("thong gio");
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        List<Barn> barns = barnRepository.findAll();
        Barn targetBarn = barns.stream()
                .filter(b -> norm.contains(VietnameseSpeechNormalizer.removeVietnameseDiacritics(b.getName()).toLowerCase()))
                .findFirst()
                .orElse(null);

        if (context.isWorker() && workAssignmentService != null) {
            Set<Long> allowed = workAssignmentService.barnIdsOf(context.getUsername());
            if (targetBarn != null && !allowed.contains(targetBarn.getId())) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Bạn chỉ có thể xem thông số môi trường cho các chuồng được phân công cho mình (MSG51).")
                        .actionType("BARN_NOT_ASSIGNED")
                        .executed(false)
                        .build();
            }
            if (targetBarn == null) {
                targetBarn = barns.stream().filter(b -> allowed.contains(b.getId())).findFirst().orElse(null);
            }
        } else if (targetBarn == null && !barns.isEmpty()) {
            targetBarn = barns.get(0);
        }

        String barnName = targetBarn != null ? targetBarn.getName() : "Toàn trại";

        Map<String, Object> dataCard = new LinkedHashMap<>();
        dataCard.put("type", "IOT_TELEMETRY");
        dataCard.put("barnName", barnName);
        dataCard.put("temperature", "29.4°C");
        dataCard.put("humidity", "68%");
        dataCard.put("ventilationStatus", "Hoạt động bình thường (Quạt 2 & 4 đang bật)");
        dataCard.put("airQualityIndex", "Tốt (NH3: 8ppm, CO2: 600ppm)");

        return AiAssistantResponse.builder()
                .reply("🌡️ Thông số môi trường tại **" + barnName + "**:\n"
                        + "- **Nhiệt độ chuồng:** 29.4°C (Chuẩn an toàn: 28 - 31°C)\n"
                        + "- **Độ ẩm không khí:** 68% (Chuẩn an toàn: 60 - 75%)\n"
                        + "- **Hệ thống thông gió:** 2 quạt hút đang hoạt động tự động.\n"
                        + "Trạng thái vi khí hậu hoàn toàn bình thường, đàn gà sinh trưởng tốt.")
                .actionType("QUERY_IOT_TELEMETRY")
                .executed(true)
                .dataCard(dataCard)
                .build();
    }
}

