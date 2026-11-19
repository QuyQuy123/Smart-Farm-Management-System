package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.FarmArea;
import com.farmshift.backendFarmShift.entity.FarmingProgram;
import com.farmshift.backendFarmShift.entity.InventoryItem;
import com.farmshift.backendFarmShift.entity.ProductCategory;
import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import com.farmshift.backendFarmShift.repository.FarmingProgramRepository;
import com.farmshift.backendFarmShift.repository.InventoryItemRepository;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository;
import com.farmshift.backendFarmShift.service.AreaWarehouseService;
import com.farmshift.backendFarmShift.service.BarnResponsibilityService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Builds RBAC-scoped dynamic Whisper STT vocabulary prompts and structured entity dictionaries.
 * - ROLE_FARM_WORKER only receives assigned barns and linked FEED/MEDICINE area warehouses (MSG51),
 *   never unassigned barns, supplier debts, or financial terms.
 * - Prompt length is strictly capped <= 650 chars (within Whisper 224-token budget).
 * - Cached per scope (OWNER_ALL vs WORKER_{accountId}) for 60s with explicit cache eviction hooks.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VoiceContextPromptBuilder {

    public static final int MAX_PROMPT_CHARS = 650;
    public static final long CACHE_TTL_MILLIS = 60_000L;

    private static final String PROMPT_PREFIX = "Thuật ngữ trang trại gà FarmShift: ";
    private static final String PROMPT_SUFFIX = ". Đơn vị: bao, kg, con, lọ, liều, cân mẫu, hao hụt, FCR.";

    private final BarnRepository barnRepository;
    private final FarmAreaRepository farmAreaRepository;
    private final WarehouseCategoryRepository warehouseRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final InventoryItemRepository inventoryRepository;
    private final FarmingProgramRepository farmingProgramRepository;
    private final AccountRepository accountRepository;
    private final BarnResponsibilityService barnResponsibilityService;
    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<String, CachedVoiceContext> cache = new ConcurrentHashMap<>();

    public record VoiceContextPayload(
            String contextPrompt,
            String entitiesJson,
            Map<String, List<String>> entities
    ) {
    }

    private record CachedVoiceContext(long cachedAt, VoiceContextPayload payload) {
    }

    @Transactional(readOnly = true)
    public VoiceContextPayload buildForUser(String username, boolean isWorker) {
        String scopeKey = resolveScopeKey(username, isWorker);
        long now = System.currentTimeMillis();
        CachedVoiceContext cached = cache.get(scopeKey);
        if (cached != null && (now - cached.cachedAt()) <= CACHE_TTL_MILLIS) {
            return cached.payload();
        }

        VoiceContextPayload built = computePayload(username, isWorker);
        cache.put(scopeKey, new CachedVoiceContext(now, built));
        return built;
    }

    public void evictLexiconCache() {
        cache.clear();
    }

    private String resolveScopeKey(String username, boolean isWorker) {
        if (!isWorker) {
            return "OWNER_ALL";
        }
        if (username == null || username.isBlank()) {
            return "WORKER_ANONYMOUS";
        }
        String trimmed = username.trim();
        Account account = accountRepository.findByEmail(trimmed.toLowerCase(Locale.ROOT))
                .or(() -> accountRepository.findByEmail(trimmed))
                .orElse(null);
        if (account != null && account.getId() != null) {
            return "WORKER_" + account.getId();
        }
        return "WORKER_" + trimmed.toLowerCase(Locale.ROOT);
    }

    private VoiceContextPayload computePayload(String username, boolean isWorker) {
        Set<String> barnNames = new LinkedHashSet<>();
        Set<String> areaNames = new LinkedHashSet<>();
        Set<String> warehouseNames = new LinkedHashSet<>();
        Set<String> productNames = new LinkedHashSet<>();
        Set<String> breedNames = new LinkedHashSet<>();

        List<Barn> allBarns = barnRepository.findAllByOrderByCreatedAtAscIdAsc();
        Set<Long> allowedBarnIds = isWorker ? barnResponsibilityService.assignedBarnIdsOf(username) : null;
        Set<Long> allowedAreaIds = new LinkedHashSet<>();

        for (Barn barn : allBarns) {
            if (isWorker && (allowedBarnIds == null || !allowedBarnIds.contains(barn.getId()))) {
                continue;
            }
            if (barn.getName() != null && !barn.getName().isBlank()) {
                barnNames.add(barn.getName().trim());
            }
            if (barn.getArea() != null) {
                if (barn.getArea().getId() != null) {
                    allowedAreaIds.add(barn.getArea().getId());
                }
                if (barn.getArea().getName() != null && !barn.getArea().getName().isBlank()) {
                    areaNames.add(barn.getArea().getName().trim());
                }
            }
        }

        if (!isWorker) {
            for (FarmArea area : farmAreaRepository.findAll()) {
                if (area.getName() != null && !area.getName().isBlank()) {
                    areaNames.add(area.getName().trim());
                }
            }
        }

        List<WarehouseCategory> allWarehouses = warehouseRepository.findAllWithAreasForReport();
        Set<Long> allowedWarehouseIds = new LinkedHashSet<>();
        for (WarehouseCategory wh : allWarehouses) {
            if (wh.getId() == null) {
                continue;
            }
            boolean linkedToAllowedArea = !isWorker || isWarehouseLinkedToAnyArea(wh, allowedAreaIds);
            if (!linkedToAllowedArea) {
                continue;
            }
            if (isWorker && !isAllowedWorkerWarehouseKind(wh.getKind())) {
                continue;
            }
            allowedWarehouseIds.add(wh.getId());
            if (wh.getName() != null && !wh.getName().isBlank()) {
                warehouseNames.add(wh.getName().trim());
            }
        }

        // Map join rows directly if areas collection was only mapped in join table
        if (isWorker && !allowedAreaIds.isEmpty()) {
            Map<Long, WarehouseCategory> warehouseById = new LinkedHashMap<>();
            for (WarehouseCategory wh : allWarehouses) {
                if (wh.getId() != null) {
                    warehouseById.put(wh.getId(), wh);
                }
            }
            for (Object[] pair : farmAreaRepository.findAreaWarehousePairs()) {
                if (pair != null && pair.length >= 2 && pair[0] instanceof Long areaId && pair[1] instanceof Long whId) {
                    if (allowedAreaIds.contains(areaId)) {
                        WarehouseCategory wh = warehouseById.get(whId);
                        if (wh != null && isAllowedWorkerWarehouseKind(wh.getKind())) {
                            allowedWarehouseIds.add(whId);
                            if (wh.getName() != null && !wh.getName().isBlank()) {
                                warehouseNames.add(wh.getName().trim());
                            }
                        }
                    }
                }
            }
        }

        for (InventoryItem item : inventoryRepository.findAllForReport()) {
            if (item.getProduct() == null || item.getProduct().getName() == null || item.getProduct().getName().isBlank()) {
                continue;
            }
            if (isWorker) {
                Long whId = item.getWarehouse() != null ? item.getWarehouse().getId() : null;
                if (whId == null || !allowedWarehouseIds.contains(whId)) {
                    continue;
                }
            }
            productNames.add(item.getProduct().getName().trim());
        }

        for (ProductCategory prod : productCategoryRepository.findAllWithWarehouseBy()) {
            if (prod.getName() == null || prod.getName().isBlank()) {
                continue;
            }
            if (isWorker) {
                Long whId = prod.getWarehouse() != null ? prod.getWarehouse().getId() : null;
                if (whId == null || !allowedWarehouseIds.contains(whId)) {
                    continue;
                }
            }
            productNames.add(prod.getName().trim());
        }

        for (FarmingProgram prog : farmingProgramRepository.findAll()) {
            if (prog.getBreed() != null && !prog.getBreed().isBlank()) {
                breedNames.add(prog.getBreed().trim());
            }
        }

        Map<String, List<String>> entities = new LinkedHashMap<>();
        entities.put("barns", List.copyOf(barnNames));
        entities.put("areas", List.copyOf(areaNames));
        entities.put("warehouses", List.copyOf(warehouseNames));
        entities.put("products", List.copyOf(productNames));
        entities.put("breeds", List.copyOf(breedNames));

        String prompt = buildCompactPrompt(barnNames, areaNames, warehouseNames, productNames, breedNames);
        String entitiesJson = serializeEntities(entities);

        return new VoiceContextPayload(prompt, entitiesJson, entities);
    }

    private boolean isWarehouseLinkedToAnyArea(WarehouseCategory wh, Set<Long> allowedAreaIds) {
        if (allowedAreaIds.isEmpty()) {
            return false;
        }
        if (wh.getArea() != null && allowedAreaIds.contains(wh.getArea().getId())) {
            return true;
        }
        if (wh.getAreas() != null) {
            for (FarmArea a : wh.getAreas()) {
                if (a != null && Objects.nonNull(a.getId()) && allowedAreaIds.contains(a.getId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isAllowedWorkerWarehouseKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return true;
        }
        return AreaWarehouseService.FEED.equalsIgnoreCase(kind)
                || AreaWarehouseService.MEDICINE.equalsIgnoreCase(kind);
    }

    private String buildCompactPrompt(
            Set<String> barns,
            Set<String> areas,
            Set<String> warehouses,
            Set<String> products,
            Set<String> breeds
    ) {
        List<String> orderedTerms = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (String s : barns) if (seen.add(s)) orderedTerms.add(s);
        for (String s : areas) if (seen.add(s)) orderedTerms.add(s);
        for (String s : warehouses) if (seen.add(s)) orderedTerms.add(s);
        for (String s : products) if (seen.add(s)) orderedTerms.add(s);
        for (String s : breeds) if (seen.add(s)) orderedTerms.add(s);

        if (orderedTerms.isEmpty()) {
            String base = PROMPT_PREFIX + "Nhà A1, Khu Gà Mía" + PROMPT_SUFFIX;
            return base.length() <= MAX_PROMPT_CHARS ? base : base.substring(0, MAX_PROMPT_CHARS);
        }

        StringBuilder sb = new StringBuilder(PROMPT_PREFIX);
        boolean appendedAny = false;
        int maxContentLen = MAX_PROMPT_CHARS - PROMPT_SUFFIX.length();

        for (String term : orderedTerms) {
            String sep = appendedAny ? ", " : "";
            if (sb.length() + sep.length() + term.length() > maxContentLen) {
                continue;
            }
            sb.append(sep).append(term);
            appendedAny = true;
        }

        sb.append(PROMPT_SUFFIX);
        if (sb.length() > MAX_PROMPT_CHARS) {
            return sb.substring(0, MAX_PROMPT_CHARS);
        }
        return sb.toString();
    }

    private String serializeEntities(Map<String, List<String>> entities) {
        try {
            return objectMapper.writeValueAsString(entities);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize voice entities_json: {}", ex.getMessage());
            return "{}";
        }
    }
}
