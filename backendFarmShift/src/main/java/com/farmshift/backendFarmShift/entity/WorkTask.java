package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Việc chủ trại giao thêm cho một công nhân phụ trách chuồng (ngoài việc theo chương trình nuôi), ví dụ rửa máng, sửa quạt.
 * Việc lặp lại mỗi ngày từ start_date đến end_date; mỗi ngày làm xong là một dòng work_task_checks.
 */
@Entity
@Table(name = "work_tasks", indexes = @Index(name = "idx_work_tasks_dates", columnList = "start_date, end_date"))
@Data
public class WorkTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "barn_id", nullable = false)
    private Barn barn;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignee_id", nullable = false)
    private Account assignee;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(length = 1000)
    private String note;
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;
    /** Giờ nên làm trong ngày (không bắt buộc). */
    @Column(name = "due_time")
    private LocalTime dueTime;
    @Column(name = "created_by", length = 150)
    private String createdBy;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
