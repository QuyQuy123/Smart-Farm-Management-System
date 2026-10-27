package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Việc được giao đã làm xong trong một ngày. */
@Entity
@Table(name = "work_task_checks",
        uniqueConstraints = @UniqueConstraint(name = "uk_work_task_checks_task_date", columnNames = {"task_id", "check_date"}))
@Data
public class WorkTaskCheck {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private WorkTask task;
    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;
    @Column(length = 1000)
    private String note;
    @Column(name = "done_by", nullable = false, length = 150)
    private String doneBy;
    @Column(name = "done_at", nullable = false)
    private LocalDateTime doneAt;
}
