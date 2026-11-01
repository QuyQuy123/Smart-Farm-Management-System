package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.dto.request.WorkTaskCheckRequest;
import com.farmshift.backendFarmShift.dto.request.WorkTaskRequest;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.farmshift.backendFarmShift.service.CycleService.*;

/**
 * Phân công công việc theo chuồng: chủ trại chọn công nhân phụ trách từng chuồng và giao thêm việc hằng ngày cho họ.
 * Công nhân chỉ thấy và xác nhận việc của chuồng mình phụ trách.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkAssignmentService {
    /** Một việc lặp tối đa nửa năm, tránh nhập nhầm năm. */
    static final int MAX_TASK_DAYS = 183;

    private final BarnRepository barnRepository;
    private final BarnService barnService;
    private final AccountRepository accountRepository;
    private final FarmingCycleRepository cycleRepository;
    private final BarnResponsibilityService responsibilities;
    private final WorkTaskRepository taskRepository;
    private final WorkTaskCheckRepository checkRepository;

    // ---------------------------------------------------------------- board (chủ trại)

    public WorkBoard board(LocalDate date) {
        LocalDate day = date == null ? today() : date;
        List<Account> workers = activeWorkers();
        Map<Long, List<Account>> workersByBarn = responsibilities.effectiveByBarn();
        List<WorkTask> tasks = taskRepository.findActiveOn(day);
        Map<Long, WorkTaskCheck> checks = checksFor(tasks, day);
        Map<Long, List<WorkTask>> tasksByBarn = tasks.stream()
                .collect(Collectors.groupingBy(task -> task.getBarn().getId(), LinkedHashMap::new, Collectors.toList()));
        Map<Long, Long> activeCycles = cycleRepository.findAllByStatus(CycleStatus.ACTIVE).stream()
                .collect(Collectors.toMap(cycle -> cycle.getBarn().getId(), FarmingCycle::getId, (a, b) -> a));

        List<WorkBoard.BarnAssignment> barns = barnRepository.findAllByOrderByCreatedAtAscIdAsc().stream()
                .sorted(Comparator.comparing((Barn barn) -> barn.getArea().getName()).thenComparing(Barn::getName))
                .map(barn -> new WorkBoard.BarnAssignment(barn.getId(), barn.getName(), barn.getArea().getId(), barn.getArea().getName(),
                        activeCycles.get(barn.getId()), barn.getCurrentQuantity(),
                        workersByBarn.getOrDefault(barn.getId(), List.of()).stream().map(WorkAssignmentService::ref).toList(),
                        tasksByBarn.getOrDefault(barn.getId(), List.of()).stream().map(task -> response(task, checks.get(task.getId()))).toList()))
                .toList();

        List<WorkBoard.WorkerSummary> summaries = workers.stream().map(worker -> {
            int barnCount = (int) workersByBarn.values().stream().flatMap(List::stream).filter(assigned -> assigned.getId().equals(worker.getId())).count();
            List<WorkTask> own = tasks.stream().filter(task -> task.getAssignee().getId().equals(worker.getId())).toList();
            int done = (int) own.stream().filter(task -> checks.containsKey(task.getId())).count();
            return new WorkBoard.WorkerSummary(worker.getId(), name(worker), worker.getEmail(), barnCount, own.size(), done);
        }).toList();
        return new WorkBoard(day, summaries, barns);
    }

    /** Thay toàn bộ công nhân phụ trách chuồng. Không bỏ được người còn việc được giao ở chuồng này. */
    @Transactional
    public List<WorkBoard.WorkerRef> setBarnWorkers(Long barnId, BarnWorkersRequest request, String user) {
        return responsibilities.setBarn(barnId, request.workerIds(), user);
    }

    // ---------------------------------------------------------------- tasks

    @Transactional
    public WorkBoard.AssignedTask create(WorkTaskRequest request, String user) {
        WorkTask task = new WorkTask();
        task.setCreatedBy(user);
        apply(task, request);
        return response(taskRepository.saveAndFlush(task), null);
    }

    @Transactional
    public WorkBoard.AssignedTask update(Long id, WorkTaskRequest request) {
        WorkTask task = findTask(id);
        if (checkRepository.existsByTaskId(id) && (!task.getBarn().getId().equals(request.barnId())
                || !task.getAssignee().getId().equals(request.assigneeId()) || !task.getStartDate().equals(request.startDate()))) {
            throw new BadRequestException("Việc đã có ngày làm xong nên không đổi được chuồng, người làm hoặc ngày bắt đầu. "
                    + "Hãy kết thúc việc này và giao việc mới.", "WORK_TASK_HAS_CHECKS");
        }
        LocalDate end = request.endDate() == null ? request.startDate() : request.endDate();
        if (checkRepository.existsByTaskIdAndCheckDateGreaterThan(id, end)) {
            throw new BadRequestException("Đã có ngày làm xong sau " + format(end) + ", không rút ngắn việc về trước ngày đó được.", "WORK_TASK_HAS_CHECKS");
        }
        apply(task, request);
        return response(taskRepository.saveAndFlush(task), checkRepository.findByTaskIdAndCheckDate(id, today()).orElse(null));
    }

    @Transactional
    public void delete(Long id) {
        WorkTask task = findTask(id);
        checkRepository.deleteAllByTaskId(id);
        taskRepository.delete(task);
    }

    /** Công nhân được giao (hoặc chủ trại) xác nhận việc đã làm trong ngày. */
    @Transactional
    public WorkBoard.AssignedTask check(Long id, WorkTaskCheckRequest request, String user, boolean owner) {
        WorkTask task = findTask(id);
        LocalDate day = request.date();
        if (day.isAfter(today())) throw new BadRequestException("Không xác nhận trước được việc của ngày mai.", "WORK_TASK_FUTURE");
        if (day.isBefore(task.getStartDate()) || day.isAfter(task.getEndDate())) {
            throw new BadRequestException("Việc này giao từ " + format(task.getStartDate()) + " đến " + format(task.getEndDate()) + ".", "WORK_TASK_OUT_OF_RANGE");
        }
        if (!owner && !task.getAssignee().getEmail().equalsIgnoreCase(user)) {
            throw new ConflictException("Việc này được giao cho " + name(task.getAssignee()) + ".", "WORK_TASK_NOT_YOURS", null);
        }
        if (checkRepository.existsByTaskIdAndCheckDate(id, day)) throw new ConflictException("Việc này đã được xác nhận.", "WORK_TASK_ALREADY_DONE", null);
        WorkTaskCheck check = new WorkTaskCheck();
        check.setTask(task);
        check.setCheckDate(day);
        check.setNote(clean(request.note()));
        check.setDoneBy(user);
        check.setDoneAt(LocalDateTime.now());
        return response(task, checkRepository.saveAndFlush(check));
    }

    /** Hoàn tác: chủ trại hoàn tác mọi việc; công nhân chỉ hoàn tác việc của mình trong hôm nay. */
    @Transactional
    public WorkBoard.AssignedTask uncheck(Long id, LocalDate date, String user, boolean owner) {
        WorkTask task = findTask(id);
        WorkTaskCheck check = checkRepository.findByTaskIdAndCheckDate(id, date)
                .orElseThrow(() -> new ResourceNotFoundException("Việc này chưa được xác nhận."));
        if (!owner && (!check.getDoneBy().equalsIgnoreCase(user) || !date.equals(today()))) {
            throw new ConflictException("Công nhân chỉ hoàn tác được việc do mình xác nhận trong hôm nay.", "WORK_TASK_UNDO_FORBIDDEN", null);
        }
        checkRepository.delete(check);
        checkRepository.flush();
        return response(task, null);
    }

    // ---------------------------------------------------------------- used by the daily plan

    public boolean isWorkerOfBarn(String email, Long barnId) {
        return responsibilities.workersOf(barnId).stream().anyMatch(worker -> worker.getEmail().equalsIgnoreCase(email));
    }

    /** Công nhân chỉ ghi nhật ký / xác nhận việc cho chuồng mình phụ trách; chủ trại và kế toán không bị giới hạn. */
    public void requireAssigned(Authentication authentication, Long barnId) {
        boolean worker = authentication.getAuthorities().stream().anyMatch(authority -> RoleNames.FARM_WORKER.equals(authority.getAuthority()));
        if (worker && !isWorkerOfBarn(authentication.getName(), barnId)) {
            throw new ConflictException("Bạn không phụ trách chuồng này. Liên hệ chủ trại để được phân công.", "BARN_NOT_ASSIGNED", null);
        }
    }

    public Set<Long> barnIdsOf(String email) {
        return responsibilities.effectiveByBarn().entrySet().stream()
                .filter(entry -> entry.getValue().stream().anyMatch(worker -> worker.getEmail().equalsIgnoreCase(email)))
                .map(Map.Entry::getKey).collect(Collectors.toSet());
    }

    public List<WorkBoard.WorkerRef> workersOf(Long barnId) {
        return responsibilities.workersOf(barnId).stream().map(WorkAssignmentService::ref).toList();
    }

    /** Việc được giao của chuồng trong ngày; workerEmail khác null thì chỉ lấy việc của công nhân đó. */
    public List<WorkBoard.AssignedTask> tasksOf(Long barnId, LocalDate date, String workerEmail) {
        List<WorkTask> tasks = taskRepository.findActiveOnForBarn(barnId, date).stream()
                .filter(task -> workerEmail == null || task.getAssignee().getEmail().equalsIgnoreCase(workerEmail)).toList();
        Map<Long, WorkTaskCheck> checks = checksFor(tasks, date);
        return tasks.stream().map(task -> response(task, checks.get(task.getId()))).toList();
    }

    // ---------------------------------------------------------------- helpers

    private void apply(WorkTask task, WorkTaskRequest request) {
        Barn barn = barnService.find(request.barnId());
        Account assignee = accountRepository.findById(request.assigneeId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy công nhân."));
        if (!isWorkerOfBarn(assignee.getEmail(), barn.getId())) {
            throw new BadRequestException(name(assignee) + " chưa phụ trách chuồng " + barn.getName()
                    + ". Hãy phân công công nhân cho chuồng trước khi giao việc.", "WORK_ASSIGNEE_NOT_IN_BARN");
        }
        LocalDate start = request.startDate();
        LocalDate end = request.endDate() == null ? start : request.endDate();
        if (end.isBefore(start)) throw new BadRequestException("Ngày kết thúc phải từ ngày bắt đầu trở đi.", "WORK_TASK_DATE_RANGE");
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_TASK_DAYS) {
            throw new BadRequestException("Một việc lặp tối đa " + MAX_TASK_DAYS + " ngày.", "WORK_TASK_DATE_RANGE");
        }
        if (end.isBefore(today())) throw new BadRequestException("Việc giao phải còn hiệu lực từ hôm nay trở đi.", "WORK_TASK_DATE_RANGE");
        task.setBarn(barn);
        task.setAssignee(assignee);
        task.setTitle(request.title().strip());
        task.setNote(clean(request.note()));
        task.setStartDate(start);
        task.setEndDate(end);
        task.setDueTime(request.dueTime());
    }

    private List<Account> activeWorkers() {
        return accountRepository.findAllByRole_NameAndIsActiveTrueOrderByFullNameAsc(RoleNames.FARM_WORKER);
    }

    private WorkTask findTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy việc được giao."));
    }

    private Map<Long, WorkTaskCheck> checksFor(List<WorkTask> tasks, LocalDate day) {
        if (tasks.isEmpty()) return Map.of();
        return checkRepository.findAllByTaskIdInAndCheckDate(tasks.stream().map(WorkTask::getId).toList(), day).stream()
                .collect(Collectors.toMap(check -> check.getTask().getId(), Function.identity()));
    }

    private static WorkBoard.AssignedTask response(WorkTask task, WorkTaskCheck check) {
        return new WorkBoard.AssignedTask(task.getId(), task.getBarn().getId(), task.getTitle(), task.getNote(), task.getStartDate(),
                task.getEndDate(), task.getDueTime(), ref(task.getAssignee()),
                check == null ? null : new WorkBoard.Done(check.getDoneBy(), check.getDoneAt(), check.getNote()));
    }

    private static WorkBoard.WorkerRef ref(Account account) {
        return new WorkBoard.WorkerRef(account.getId(), name(account), account.getEmail());
    }

    private static String name(Account account) {
        return account.getFullName() == null || account.getFullName().isBlank() ? account.getEmail() : account.getFullName();
    }
}
