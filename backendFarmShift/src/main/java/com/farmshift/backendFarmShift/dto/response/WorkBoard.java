package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Màn Phân công công việc của chủ trại cho một ngày: công nhân, và từng chuồng với người phụ trách và việc được giao trong ngày.
 */
public record WorkBoard(LocalDate date, List<WorkerSummary> workers, List<BarnAssignment> barns) {

    public record WorkerRef(Long id, String fullName, String email) {
    }

    /** barnCount: số chuồng phụ trách; taskCount / doneCount: việc được giao trong ngày và số đã xong. */
    public record WorkerSummary(Long id, String fullName, String email, int barnCount, int taskCount, int doneCount) {
    }

    public record BarnAssignment(Long barnId, String barnName, Long areaId, String areaName, Long activeCycleId, int headcount,
                                 List<WorkerRef> workers, List<AssignedTask> tasks) {
    }

    /** Một việc được giao, kèm trạng thái làm xong của ngày đang xem (done = null khi chưa làm). */
    public record AssignedTask(Long id, Long barnId, String title, String note, LocalDate startDate, LocalDate endDate, LocalTime dueTime,
                               WorkerRef assignee, Done done) {
    }

    public record Done(String doneBy, LocalDateTime doneAt, String note) {
    }
}
