package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.BarnResponsibilities;
import com.farmshift.backendFarmShift.dto.request.AreaWorkerAssignmentsRequest;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/** Resolves the same inherited responsibilities for settings, daily work and authorization. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BarnResponsibilityService {
    private final BarnRepository barns;
    private final FarmAreaRepository areas;
    private final BarnWorkerRepository links;
    private final AccountRepository accounts;
    private final WorkTaskRepository tasks;

    public BarnResponsibilities settings() {
        Map<Long, List<BarnWorker>> direct = directLinks();
        Map<Long, List<Barn>> byArea = barns.findAllByOrderByCreatedAtAscIdAsc().stream()
                .collect(Collectors.groupingBy(barn -> barn.getArea().getId()));
        return new BarnResponsibilities(activeWorkers().stream().map(BarnResponsibilityService::ref).toList(),
                areas.findAll(Sort.by("createdAt", "id")).stream().map(area -> new BarnResponsibilities.Area(
                        area.getId(), area.getName(), area.getWorkers().stream().map(BarnResponsibilityService::ref).toList(),
                        byArea.getOrDefault(area.getId(), List.of()).stream().map(barn -> {
                            List<BarnWorker> own = direct.getOrDefault(barn.getId(), List.of());
                            return new BarnResponsibilities.Barn(barn.getId(), barn.getName(), inherits(barn, own),
                                    effective(barn, own).stream().map(BarnResponsibilityService::ref).toList());
                        }).toList())).toList());
    }

    public Map<Long, List<Account>> effectiveByBarn() {
        Map<Long, List<BarnWorker>> direct = directLinks();
        Map<Long, List<Account>> result = new LinkedHashMap<>();
        for (Barn barn : barns.findAllByOrderByCreatedAtAscIdAsc()) {
            result.put(barn.getId(), effective(barn, direct.getOrDefault(barn.getId(), List.of())));
        }
        return result;
    }

    public Set<Long> assignedBarnIdsOf(String email) {
        if (email == null || email.isBlank()) return Collections.emptySet();
        return effectiveByBarn().entrySet().stream()
                .filter(entry -> entry.getValue().stream().anyMatch(worker -> worker.getEmail().equalsIgnoreCase(email)))
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
    }

    public boolean isWorkerOfBarn(String email, Long barnId) {
        if (email == null || barnId == null) return false;
        return workersOf(barnId).stream().anyMatch(w -> w.getEmail().equalsIgnoreCase(email));
    }

    public List<Account> workersOf(Long barnId) {
        Barn barn = barn(barnId);
        return effective(barn, links.findAllByBarnIdOrderByIdAsc(barnId));
    }

    @Transactional
    public List<WorkBoard.WorkerRef> setBarn(Long barnId, List<Long> ids, String assignedBy) {
        Barn barn = barn(barnId);
        List<Account> chosen = validate(ids);
        guardRemoval(barn, workersOf(barnId), chosen);
        List<BarnWorker> current = links.findAllByBarnIdOrderByIdAsc(barnId);
        Set<Long> wanted = chosen.stream().map(Account::getId).collect(Collectors.toSet());
        Set<Long> existing = current.stream().map(link -> link.getWorker().getId()).collect(Collectors.toSet());
        current.stream().filter(link -> !wanted.contains(link.getWorker().getId())).forEach(links::delete);
        for (Account worker : chosen) {
            if (existing.contains(worker.getId())) continue;
            BarnWorker link = new BarnWorker();
            link.setBarn(barn);
            link.setWorker(worker);
            link.setAssignedBy(assignedBy);
            links.save(link);
        }
        barn.setWorkersOverride(true);
        barns.save(barn);
        links.flush();
        return chosen.stream().map(BarnResponsibilityService::ref).toList();
    }

    @Transactional
    public void inherit(Long barnId) {
        Barn barn = barn(barnId);
        guardRemoval(barn, workersOf(barnId), barn.getArea().getWorkers());
        links.deleteAllByBarnId(barnId);
        barn.setWorkersOverride(false);
        barns.save(barn);
    }

    @Transactional
    public void setArea(Long areaId, List<Long> ids) {
        FarmArea area = areas.findById(areaId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khu nuôi."));
        List<Account> chosen = validate(ids);
        Map<Long, List<BarnWorker>> direct = directLinks();
        // Validate every affected barn before writing anything; the transaction is all-or-nothing.
        for (Barn barn : barns.findAllByAreaIdOrderByCreatedAtAscIdAsc(areaId)) {
            List<BarnWorker> own = direct.getOrDefault(barn.getId(), List.of());
            if (inherits(barn, own)) guardRemoval(barn, area.getWorkers(), chosen);
        }
        area.getWorkers().clear();
        area.getWorkers().addAll(chosen);
        areas.save(area);
    }

    private List<Account> validate(List<Long> ids) {
        Map<Long, Account> available = activeWorkers().stream().collect(Collectors.toMap(Account::getId, worker -> worker));
        List<Account> result = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(ids)) {
            if (!available.containsKey(id)) throw new BadRequestException("Chỉ phân công được tài khoản công nhân đang hoạt động.", "WORKER_NOT_AVAILABLE");
            result.add(available.get(id));
        }
        return result;
    }

    @Transactional
    public void assignArea(Long areaId, AreaWorkerAssignmentsRequest request, String assignedBy) {
        FarmArea area = areas.findById(areaId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khu nuôi."));
        List<Account> chosen = validate(request.workerIds());
        List<Barn> children = barns.findAllByAreaIdOrderByCreatedAtAscIdAsc(areaId);
        Map<Long, List<Long>> selections = new LinkedHashMap<>();
        for (var selection : request.barns()) {
            if (selections.putIfAbsent(selection.barnId(), selection.workerIds()) != null) {
                throw new BadRequestException("Danh sách chuồng bị trùng.", "BARN_ASSIGNMENT_INVALID");
            }
        }
        Set<Long> childIds = children.stream().map(Barn::getId).collect(Collectors.toSet());
        if ((!request.applyToAll() && !selections.keySet().equals(childIds))
                || !childIds.containsAll(selections.keySet())) {
            throw new BadRequestException("Danh sách chuồng đã thay đổi hoặc không thuộc khu nuôi. Vui lòng tải lại và phân công lại.", "BARN_ASSIGNMENT_INVALID");
        }
        // Check every final list against current permissions before changing the area's defaults.
        for (Barn child : children) {
            List<Account> next = request.applyToAll() ? chosen : validate(selections.get(child.getId()));
            guardRemoval(child, workersOf(child.getId()), next);
        }
        // Apply explicit barn lists first so the existing task guard sees the old area defaults.
        for (Barn child : children) {
            if (!request.applyToAll()) setBarn(child.getId(), selections.get(child.getId()), assignedBy);
            else {
                links.deleteAllByBarnId(child.getId());
                child.setWorkersOverride(false);
                barns.save(child);
            }
        }
        area.getWorkers().clear();
        area.getWorkers().addAll(chosen);
        areas.save(area);
    }

    private void guardRemoval(Barn barn, List<Account> current, List<Account> chosen) {
        Set<Long> wanted = chosen.stream().map(Account::getId).collect(Collectors.toSet());
        for (Account worker : current) {
            if (!wanted.contains(worker.getId()) && tasks.existsByBarnIdAndAssigneeIdAndEndDateGreaterThanEqual(barn.getId(), worker.getId(), LocalDate.now())) {
                throw new ConflictException("Công nhân " + worker.getFullName() + " còn việc được giao ở chuồng " + barn.getName()
                        + ". Hãy giao lại hoặc xóa các việc đó trước khi bỏ phân công.", "WORKER_HAS_TASKS", null);
            }
        }
    }

    private Map<Long, List<BarnWorker>> directLinks() {
        return links.findAllByOrderByIdAsc().stream().collect(Collectors.groupingBy(link -> link.getBarn().getId()));
    }

    private boolean inherits(Barn barn, List<BarnWorker> own) {
        return barn.getWorkersOverride() == null ? own.isEmpty() : !barn.getWorkersOverride();
    }

    private List<Account> effective(Barn barn, List<BarnWorker> own) {
        List<Account> workers = inherits(barn, own) ? barn.getArea().getWorkers() : own.stream().map(BarnWorker::getWorker).toList();
        return workers.stream().filter(worker -> Boolean.TRUE.equals(worker.getIsActive()) && worker.getRole() != null
                && RoleNames.FARM_WORKER.equals(worker.getRole().getName())).toList();
    }

    private Barn barn(Long id) {
        return barns.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuồng."));
    }

    private List<Account> activeWorkers() {
        return accounts.findAllByRole_NameAndIsActiveTrueOrderByFullNameAsc(RoleNames.FARM_WORKER);
    }

    public static WorkBoard.WorkerRef ref(Account worker) {
        return new WorkBoard.WorkerRef(worker.getId(), worker.getFullName() == null || worker.getFullName().isBlank()
                ? worker.getEmail() : worker.getFullName(), worker.getEmail());
    }
}
