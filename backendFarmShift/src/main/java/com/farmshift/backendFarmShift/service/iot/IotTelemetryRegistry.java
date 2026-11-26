package com.farmshift.backendFarmShift.service.iot;

import com.farmshift.backendFarmShift.service.CycleService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory registry holding live ESP32 MQTT telemetry snapshots reported per barn.
 * Separated from PostgreSQL accounting tables per docs/database.md Section 10.
 */
@Component
public class IotTelemetryRegistry {

    public static final long FRESHNESS_TTL_SECONDS = 300L;

    public record BarnTelemetrySnapshot(
            Long barnId,
            String barnName,
            boolean connected,
            BigDecimal temp1,
            BigDecimal humi1,
            BigDecimal temp3,
            BigDecimal humi3,
            BigDecimal avgTemperature,
            BigDecimal avgHumidity,
            Map<Integer, Boolean> relayStates,
            List<String> activeDeviceLabels,
            String source,
            LocalDateTime updatedAt
    ) {
        public boolean isFresh(LocalDateTime now) {
            if (updatedAt == null || now == null) {
                return false;
            }
            long ageSeconds = Math.abs(Duration.between(updatedAt, now).getSeconds());
            return ageSeconds <= FRESHNESS_TTL_SECONDS;
        }
    }

    private final ConcurrentHashMap<Long, BarnTelemetrySnapshot> snapshots = new ConcurrentHashMap<>();

    public BarnTelemetrySnapshot record(
            Long barnId,
            String barnName,
            boolean connected,
            BigDecimal temp1,
            BigDecimal humi1,
            BigDecimal temp3,
            BigDecimal humi3,
            Map<Integer, Boolean> relayStates,
            List<String> activeDeviceLabels,
            String source
    ) {
        if (barnId == null) {
            throw new IllegalArgumentException("barnId is required");
        }
        BarnTelemetrySnapshot prev = snapshots.get(barnId);
        boolean noIncomingSensors = temp1 == null && humi1 == null && temp3 == null && humi3 == null;
        if (!connected && noIncomingSensors && prev != null) {
            Map<Integer, Boolean> safeRelays = (relayStates != null && !relayStates.isEmpty())
                    ? Collections.unmodifiableMap(new LinkedHashMap<>(relayStates))
                    : prev.relayStates();
            List<String> safeLabels = (activeDeviceLabels != null && !activeDeviceLabels.isEmpty())
                    ? List.copyOf(activeDeviceLabels)
                    : prev.activeDeviceLabels();
            BarnTelemetrySnapshot disconnectedSnap = new BarnTelemetrySnapshot(
                    barnId,
                    barnName != null && !barnName.isBlank() ? barnName : prev.barnName(),
                    false,
                    prev.temp1(),
                    prev.humi1(),
                    prev.temp3(),
                    prev.humi3(),
                    prev.avgTemperature(),
                    prev.avgHumidity(),
                    safeRelays,
                    safeLabels,
                    source != null && !source.isBlank() ? source.trim() : prev.source(),
                    LocalDateTime.now(CycleService.VN_ZONE)
            );
            snapshots.put(barnId, disconnectedSnap);
            return disconnectedSnap;
        }
        BigDecimal avgTemp = averageScale(temp1, temp3, 1);
        BigDecimal avgHumi = averageScale(humi1, humi3, 0);
        Map<Integer, Boolean> safeRelays = relayStates != null
                ? Collections.unmodifiableMap(new LinkedHashMap<>(relayStates))
                : Map.of();
        List<String> safeLabels = activeDeviceLabels != null
                ? List.copyOf(activeDeviceLabels)
                : List.of();
        BarnTelemetrySnapshot snap = new BarnTelemetrySnapshot(
                barnId,
                barnName,
                connected,
                scaleOrNull(temp1, 1),
                scaleOrNull(humi1, 0),
                scaleOrNull(temp3, 1),
                scaleOrNull(humi3, 0),
                avgTemp,
                avgHumi,
                safeRelays,
                safeLabels,
                source != null && !source.isBlank() ? source.trim() : "ESP32_MQTT",
                LocalDateTime.now(CycleService.VN_ZONE)
        );
        snapshots.put(barnId, snap);
        return snap;
    }

    public Optional<BarnTelemetrySnapshot> get(Long barnId) {
        if (barnId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(snapshots.get(barnId));
    }

    public void clear() {
        snapshots.clear();
    }

    private static BigDecimal scaleOrNull(BigDecimal value, int scale) {
        return value == null ? null : value.setScale(scale, RoundingMode.HALF_UP);
    }

    private static BigDecimal averageScale(BigDecimal a, BigDecimal b, int scale) {
        if (a != null && b != null) {
            return a.add(b).divide(BigDecimal.valueOf(2), scale, RoundingMode.HALF_UP);
        }
        if (a != null) {
            return a.setScale(scale, RoundingMode.HALF_UP);
        }
        if (b != null) {
            return b.setScale(scale, RoundingMode.HALF_UP);
        }
        return null;
    }
}
