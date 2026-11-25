package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.CycleStatus;
import com.farmshift.backendFarmShift.entity.FarmingCycle;
import com.farmshift.backendFarmShift.entity.FarmingProgramStep;
import com.farmshift.backendFarmShift.entity.Flock;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.FarmingCycleRepository;
import com.farmshift.backendFarmShift.repository.FarmingProgramStepRepository;
import com.farmshift.backendFarmShift.repository.FlockRepository;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import com.farmshift.backendFarmShift.service.iot.IotTelemetryRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Handles IoT Telemetry queries (barn temperature, relative humidity, relay/ventilation status)
 * using real ESP32 MQTT telemetry snapshots synced via {@link IotTelemetryRegistry}.
 * Never fabricates static sensor values when no hardware telemetry has been received.
 */
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class IoTTelemetryCommandHandler implements AssistantCommandHandler {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy");

    private final BarnRepository barnRepository;

    @Autowired(required = false)
    private WorkAssignmentService workAssignmentService;

    @Autowired(required = false)
    private IotTelemetryRegistry telemetryRegistry;

    @Autowired(required = false)
    private FarmingCycleRepository cycleRepository;

    @Autowired(required = false)
    private FlockRepository flockRepository;

    @Autowired(required = false)
    private FarmingProgramStepRepository programStepRepository;

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

        List<Barn> barns = new ArrayList<>(barnRepository.findAll());
        barns.sort((b1, b2) -> Integer.compare(b2.getName().length(), b1.getName().length()));
        Barn targetBarn = barns.stream()
                .filter(b -> {
                    String bNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(b.getName()).toLowerCase(Locale.ROOT).trim();
                    if (bNorm.isEmpty()) return false;
                    return norm.matches(".*(?<![a-z0-9])" + java.util.regex.Pattern.quote(bNorm) + "(?![a-z0-9]).*");
                })
                .findFirst()
                .orElse(null);

        boolean explicitMissingBarnRef = targetBarn == null && (
                norm.matches(".*\\b(?:nha|chuong)\\s+(?:[a-z]+\\s*\\d+|\\d+|[a-z](?![a-z]))\\b.*")
                        || norm.matches(".*\\b[a-z]\\d+\\b.*")
        );
        if (explicitMissingBarnRef) {
            List<Barn> visibleBarns = barns;
            if (context.isWorker() && workAssignmentService != null) {
                Set<Long> allowed = workAssignmentService.barnIdsOf(context.getUsername());
                visibleBarns = barns.stream().filter(b -> allowed.contains(b.getId())).toList();
            }
            String avail = visibleBarns.isEmpty()
                    ? "Chưa có chuồng nào khả dụng."
                    : visibleBarns.stream().map(Barn::getName).sorted().collect(java.util.stream.Collectors.joining(", "));
            Map<String, Object> notFoundCard = new LinkedHashMap<>();
            notFoundCard.put("type", "IOT_TELEMETRY");
            notFoundCard.put("status", "BARN_NOT_FOUND");
            return AiAssistantResponse.builder()
                    .reply("⚠️ Không tìm thấy chuồng được nhắc đến trong phạm vi trang trại. Các chuồng khả dụng: **" + avail + "**.")
                    .actionType("QUERY_IOT_TELEMETRY")
                    .executed(false)
                    .navigateTo(context.isOwner() ? "/iot" : null)
                    .dataCard(notFoundCard)
                    .build();
        }

        boolean asksAllBarns = targetBarn == null && (norm.contains("cac chuong") || norm.contains("toan trai") || norm.contains("tat ca"));
        if (asksAllBarns) {
            List<Barn> scopedBarns = new ArrayList<>(barns);
            if (context.isWorker() && workAssignmentService != null) {
                Set<Long> allowed = workAssignmentService.barnIdsOf(context.getUsername());
                scopedBarns = scopedBarns.stream().filter(b -> allowed.contains(b.getId())).toList();
            } else {
                scopedBarns.sort(Comparator.comparing(Barn::getName, String.CASE_INSENSITIVE_ORDER));
            }
            if (scopedBarns.size() > 1) {
                return buildMultiBarnSummaryResponse(scopedBarns, context.isOwner());
            }
        }

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
            if (targetBarn == null) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Bạn chưa được phân công chuồng nuôi nào nên không thể xem thông số cảm biến IoT (MSG51).")
                        .actionType("BARN_NOT_ASSIGNED")
                        .executed(false)
                        .build();
            }
        } else if (targetBarn == null && !barns.isEmpty()) {
            targetBarn = barns.get(0);
        }

        String barnName = targetBarn != null ? targetBarn.getName() : "Toàn trại";
        String navTarget = context.isOwner()
                ? (targetBarn != null ? "/iot?barn=" + targetBarn.getId() : "/iot")
                : null;

        TargetTempBand tempTarget = targetBarn != null ? resolveProgramTempTarget(targetBarn.getId()) : null;
        Optional<IotTelemetryRegistry.BarnTelemetrySnapshot> snapOpt =
                (targetBarn != null && telemetryRegistry != null)
                        ? telemetryRegistry.get(targetBarn.getId())
                        : Optional.empty();

        if (snapOpt.isEmpty() || (snapOpt.get().avgTemperature() == null && snapOpt.get().avgHumidity() == null)) {
            Map<String, Object> dataCard = new LinkedHashMap<>();
            dataCard.put("type", "IOT_TELEMETRY");
            dataCard.put("status", "NO_LIVE_TELEMETRY");
            dataCard.put("barnName", barnName);
            dataCard.put("connected", false);
            if (tempTarget != null) {
                dataCard.put("recommendedTempRange", tempTarget.label());
            }

            StringBuilder reply = new StringBuilder();
            reply.append("📡 **Trạng thái cảm biến IoT tại ").append(barnName).append(":**\n");
            reply.append("- Hiện **chưa nhận được dữ liệu trực tuyến** từ cảm biến ESP32 của chuồng này (thiết bị chưa kết nối hoặc màn hình Thiết bị IoT chưa đồng bộ).\n");
            if (tempTarget != null) {
                reply.append("- **Ngưỡng nhiệt chuẩn theo quy trình nuôi** (ngày tuổi ").append(tempTarget.ageDays()).append("): **")
                        .append(tempTarget.label()).append("**.\n");
            }
            if (context.isOwner()) {
                reply.append("Vui lòng mở màn hình **Thiết bị IoT** của chuồng để kết nối phần cứng MQTT và đồng bộ số đo thực tế.");
            } else {
                reply.append("Vui lòng kiểm tra thiết bị cảm biến tại chuồng hoặc báo Chủ trại kiểm tra kết nối ESP32.");
            }

            return AiAssistantResponse.builder()
                    .reply(reply.toString())
                    .actionType("QUERY_IOT_TELEMETRY")
                    .executed(true)
                    .navigateTo(navTarget)
                    .dataCard(dataCard)
                    .build();
        }

        IotTelemetryRegistry.BarnTelemetrySnapshot snap = snapOpt.get();
        LocalDateTime now = LocalDateTime.now(CycleService.VN_ZONE);
        boolean fresh = snap.isFresh(now);
        boolean live = snap.connected() && fresh;
        String statusCode = live ? "LIVE" : (fresh ? "DISCONNECTED" : "STALE");

        String tempText = snap.avgTemperature() != null ? snap.avgTemperature().toPlainString() + "°C" : "Chưa có số đo";
        String humiText = snap.avgHumidity() != null ? snap.avgHumidity().toPlainString() + "%" : "Chưa có số đo";
        String relaySummary = formatRelaySummary(snap);
        String updatedText = snap.updatedAt() != null ? snap.updatedAt().format(TIME_FMT) : "Không rõ";

        Map<String, Object> dataCard = new LinkedHashMap<>();
        dataCard.put("type", "IOT_TELEMETRY");
        dataCard.put("status", statusCode);
        dataCard.put("connected", snap.connected());
        dataCard.put("fresh", fresh);
        dataCard.put("barnName", barnName);
        dataCard.put("temperature", tempText);
        dataCard.put("humidity", humiText);
        dataCard.put("ventilationStatus", relaySummary);
        dataCard.put("source", snap.source());
        dataCard.put("updatedAt", updatedText);
        if (tempTarget != null) {
            dataCard.put("recommendedTempRange", tempTarget.label());
        }

        StringBuilder reply = new StringBuilder();
        reply.append(live ? "🌡️ **Thông số cảm biến thực tế tại " : "⚠️ **Thông số cảm biến gần nhất tại ")
                .append(barnName).append(":**\n");
        reply.append("- **Nhiệt độ trung bình:** ").append(tempText);
        if (snap.temp1() != null || snap.temp3() != null) {
            reply.append(" (CB1: ").append(snap.temp1() != null ? snap.temp1() + "°C" : "—")
                    .append(", CB3: ").append(snap.temp3() != null ? snap.temp3() + "°C" : "—").append(")");
        }
        if (tempTarget != null) {
            reply.append(" — *Chuẩn ngày tuổi ").append(tempTarget.ageDays()).append(": ").append(tempTarget.label()).append("*");
        }
        reply.append("\n");
        reply.append("- **Độ ẩm trung bình:** ").append(humiText);
        if (snap.humi1() != null || snap.humi3() != null) {
            reply.append(" (CB1: ").append(snap.humi1() != null ? snap.humi1() + "%" : "—")
                    .append(", CB3: ").append(snap.humi3() != null ? snap.humi3() + "%" : "—").append(")");
        }
        reply.append("\n");
        reply.append("- **Trạng thái thiết bị / Relay:** ").append(relaySummary).append("\n");
        reply.append("- **Cập nhật lúc:** ").append(updatedText)
                .append(live ? " *(Đang kết nối trực tiếp)*" : " *(Dữ liệu cũ — cảm biến hiện ngắt kết nối)*");

        if (tempTarget != null && snap.avgTemperature() != null) {
            if (snap.avgTemperature().compareTo(tempTarget.max()) > 0) {
                reply.append("\n🚨 **Cảnh báo:** Nhiệt độ hiện tại vượt ngưỡng chuẩn (").append(tempTarget.label())
                        .append("). Cần kiểm tra quạt thông gió / giàn mát ngay.");
            } else if (snap.avgTemperature().compareTo(tempTarget.min()) < 0) {
                reply.append("\n⚠️ **Lưu ý:** Nhiệt độ thấp hơn ngưỡng chuẩn (").append(tempTarget.label())
                        .append("). Kiểm tra che chắn gió hoặc đèn sưởi.");
            }
        }

        return AiAssistantResponse.builder()
                .reply(reply.toString())
                .actionType("QUERY_IOT_TELEMETRY")
                .executed(true)
                .navigateTo(navTarget)
                .dataCard(dataCard)
                .build();
    }

    private AiAssistantResponse buildMultiBarnSummaryResponse(List<Barn> scopedBarns, boolean isOwner) {
        LocalDateTime now = LocalDateTime.now(CycleService.VN_ZONE);
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);
        Map<Long, TargetTempBand> tempTargetByBarnId = resolveProgramTempTargetsBatch(scopedBarns, today);
        StringBuilder reply = new StringBuilder("📡 **Tổng hợp thông số cảm biến IoT các chuồng:**\n");
        List<Map<String, Object>> barnCards = new ArrayList<>();
        int liveCount = 0;

        for (Barn b : scopedBarns) {
            Optional<IotTelemetryRegistry.BarnTelemetrySnapshot> snapOpt =
                    telemetryRegistry != null ? telemetryRegistry.get(b.getId()) : Optional.empty();
            TargetTempBand band = tempTargetByBarnId.get(b.getId());
            if (snapOpt.isEmpty() || (snapOpt.get().avgTemperature() == null && snapOpt.get().avgHumidity() == null)) {
                reply.append("- **").append(b.getName()).append(":** Chưa có dữ liệu trực tuyến từ ESP32");
                if (band != null) {
                    reply.append(" *(Chuẩn ngày tuổi ").append(band.ageDays()).append(": ").append(band.label()).append(")*");
                }
                reply.append("\n");
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("barnId", b.getId());
                item.put("barnName", b.getName());
                item.put("status", "NO_LIVE_TELEMETRY");
                barnCards.add(item);
                continue;
            }
            IotTelemetryRegistry.BarnTelemetrySnapshot snap = snapOpt.get();
            boolean fresh = snap.isFresh(now);
            boolean live = snap.connected() && fresh;
            if (live) liveCount++;
            String status = live ? "LIVE" : (fresh ? "DISCONNECTED" : "STALE");
            String tempStr = snap.avgTemperature() != null ? snap.avgTemperature().toPlainString() + "°C" : "—";
            String humiStr = snap.avgHumidity() != null ? snap.avgHumidity().toPlainString() + "%" : "—";
            reply.append("- **").append(b.getName()).append(":** **").append(tempStr).append("** · Độ ẩm **").append(humiStr)
                    .append("** (").append(live ? "Trực tuyến" : "Dữ liệu cũ / ngắt kết nối").append(")\n");

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("barnId", b.getId());
            item.put("barnName", b.getName());
            item.put("status", status);
            item.put("temperature", tempStr);
            item.put("humidity", humiStr);
            barnCards.add(item);
        }

        if (liveCount == 0 && isOwner) {
            reply.append("\nVui lòng mở màn hình **Thiết bị IoT** từng chuồng để kết nối phần cứng ESP32 MQTT.");
        }

        Map<String, Object> dataCard = new LinkedHashMap<>();
        dataCard.put("type", "IOT_TELEMETRY_MULTI");
        dataCard.put("liveCount", liveCount);
        dataCard.put("totalBarns", scopedBarns.size());
        dataCard.put("barns", barnCards);

        return AiAssistantResponse.builder()
                .reply(reply.toString().trim())
                .actionType("QUERY_IOT_TELEMETRY")
                .executed(true)
                .navigateTo(isOwner ? "/iot" : null)
                .dataCard(dataCard)
                .build();
    }

    private static String formatRelaySummary(IotTelemetryRegistry.BarnTelemetrySnapshot snap) {
        if (snap.activeDeviceLabels() != null && !snap.activeDeviceLabels().isEmpty()) {
            return String.join(", ", snap.activeDeviceLabels());
        }
        if (snap.relayStates() == null || snap.relayStates().isEmpty()) {
            return "Chưa ghi nhận trạng thái relay";
        }
        List<String> onRelays = new ArrayList<>();
        snap.relayStates().entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> {
                    if (Boolean.TRUE.equals(e.getValue())) {
                        onRelays.add("Relay " + e.getKey() + " ĐANG BẬT");
                    }
                });
        return onRelays.isEmpty() ? "Tất cả relay đang tắt" : String.join(", ", onRelays);
    }

    private record TargetTempBand(int ageDays, BigDecimal min, BigDecimal max, String label) {}

    private Map<Long, TargetTempBand> resolveProgramTempTargetsBatch(List<Barn> scopedBarns, LocalDate today) {
        Map<Long, TargetTempBand> result = new HashMap<>();
        if (cycleRepository == null || flockRepository == null || scopedBarns == null || scopedBarns.isEmpty()) {
            return result;
        }
        try {
            Set<Long> barnIds = scopedBarns.stream().map(Barn::getId).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
            Map<Long, FarmingCycle> activeCycleByBarnId = new HashMap<>();
            for (FarmingCycle c : cycleRepository.findAllWithBarnAndAreaByStatus(CycleStatus.ACTIVE)) {
                if (c.getBarn() != null && barnIds.contains(c.getBarn().getId())) {
                    activeCycleByBarnId.putIfAbsent(c.getBarn().getId(), c);
                }
            }
            if (activeCycleByBarnId.isEmpty()) {
                return result;
            }
            List<Long> cycleIds = activeCycleByBarnId.values().stream().map(FarmingCycle::getId).toList();
            Map<Long, List<Flock>> flocksByCycleId = new HashMap<>();
            for (Flock f : flockRepository.findByCycleIdInOrderByImportDateAscIdAsc(cycleIds)) {
                if (f.getCycle() != null && f.getCycle().getId() != null) {
                    flocksByCycleId.computeIfAbsent(f.getCycle().getId(), k -> new ArrayList<>()).add(f);
                }
            }
            Map<Long, List<FarmingProgramStep>> stepsByProgramId = new HashMap<>();
            if (programStepRepository != null) {
                for (FarmingProgramStep step : programStepRepository.findAllByOrderByProgramIdAscDayFromAscIdAsc()) {
                    if (step.getProgram() != null && step.getProgram().getId() != null
                            && step.getCategory() == ProgramStepCategory.TEMPERATURE) {
                        stepsByProgramId.computeIfAbsent(step.getProgram().getId(), k -> new ArrayList<>()).add(step);
                    }
                }
            }
            for (Map.Entry<Long, FarmingCycle> entry : activeCycleByBarnId.entrySet()) {
                Long barnId = entry.getKey();
                FarmingCycle cycle = entry.getValue();
                LocalDate ref = cycle.getHatchDate() != null ? cycle.getHatchDate() : cycle.getStartDate();
                if (ref == null) continue;
                int ageDays = Math.max(1, (int) ChronoUnit.DAYS.between(ref, today) + 1
                        + (cycle.getHatchDate() == null ? cycle.getCarriedDays() : 0));
                List<Flock> flocks = flocksByCycleId.getOrDefault(cycle.getId(), List.of());
                for (Flock flock : flocks) {
                    if (flock.getProgram() == null) continue;
                    List<FarmingProgramStep> steps = programStepRepository != null
                            ? stepsByProgramId.getOrDefault(flock.getProgram().getId(), List.of())
                            : (flock.getProgram().getSteps() != null ? flock.getProgram().getSteps() : List.of());
                    TargetTempBand matched = findTempBandForAge(steps, ageDays);
                    if (matched != null) {
                        result.put(barnId, matched);
                        break;
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("Could not batch-resolve target temp bands: {}", ex.getMessage());
        }
        return result;
    }

    private static TargetTempBand findTempBandForAge(List<FarmingProgramStep> steps, int ageDays) {
        for (FarmingProgramStep step : steps) {
            if (step.getCategory() == ProgramStepCategory.TEMPERATURE
                    && ageDays >= step.getDayFrom()
                    && ageDays <= step.getDayTo()
                    && step.getTempMin() != null
                    && step.getTempMax() != null) {
                return new TargetTempBand(
                        ageDays,
                        step.getTempMin(),
                        step.getTempMax(),
                        step.getTempMin() + " – " + step.getTempMax() + "°C"
                );
            }
        }
        return null;
    }

    private TargetTempBand resolveProgramTempTarget(Long barnId) {
        if (cycleRepository == null || flockRepository == null || barnId == null) {
            return null;
        }
        try {
            Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE);
            if (cycleOpt.isEmpty()) {
                return null;
            }
            FarmingCycle cycle = cycleOpt.get();
            LocalDate today = LocalDate.now(CycleService.VN_ZONE);
            LocalDate ref = cycle.getHatchDate() != null ? cycle.getHatchDate() : cycle.getStartDate();
            if (ref == null) {
                return null;
            }
            int ageDays = Math.max(1, (int) ChronoUnit.DAYS.between(ref, today) + 1
                    + (cycle.getHatchDate() == null ? cycle.getCarriedDays() : 0));

            List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId());
            for (Flock flock : flocks) {
                if (flock.getProgram() == null || flock.getProgram().getSteps() == null) {
                    continue;
                }
                for (FarmingProgramStep step : flock.getProgram().getSteps()) {
                    if (step.getCategory() == ProgramStepCategory.TEMPERATURE
                            && ageDays >= step.getDayFrom()
                            && ageDays <= step.getDayTo()
                            && step.getTempMin() != null
                            && step.getTempMax() != null) {
                        return new TargetTempBand(
                                ageDays,
                                step.getTempMin(),
                                step.getTempMax(),
                                step.getTempMin() + " – " + step.getTempMax() + "°C"
                        );
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("Could not resolve target temp band for barn {}: {}", barnId, ex.getMessage());
        }
        return null;
    }
}
