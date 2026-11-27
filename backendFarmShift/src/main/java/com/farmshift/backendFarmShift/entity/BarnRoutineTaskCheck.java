package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Xác nhận hoàn thành một công việc hằng ngày mặc định của chuồng (Thay trấu, Vệ sinh máng, Xịt rửa chuồng)
 * trong một ngày của lứa nuôi đang hoạt động.
 */
@Entity
@Table(name = "barn_routine_task_checks",
        uniqueConstraints = @UniqueConstraint(name = "uk_barn_routine_checks_cycle_date_code", columnNames = {"cycle_id", "check_date", "task_code"}),
        indexes = @Index(name = "idx_barn_routine_checks_date", columnList = "check_date"))
@Data
public class BarnRoutineTaskCheck {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "barn_id", nullable = false)
    private Barn barn;

    @Column(name = "task_code", nullable = false, length = 60)
    private String taskCode;

    @Column(name = "task_title", nullable = false, length = 150)
    private String taskTitle;

    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    @Column(name = "done_by", nullable = false, length = 150)
    private String doneBy;

    @Column(name = "done_at", nullable = false)
    private LocalDateTime doneAt;

    @Column(length = 500)
    private String note;
}
