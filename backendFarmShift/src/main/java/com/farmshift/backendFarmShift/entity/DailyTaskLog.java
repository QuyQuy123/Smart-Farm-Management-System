package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Một việc trong phiếu việc hằng ngày của chuồng đã được xác nhận làm xong (một cữ cám, một đợt thuốc, một mũi vắc-xin,
 * kiểm tra nhiệt độ hoặc công việc). Việc được nhận diện bằng task_key ổn định theo hàng hóa / tên và cữ, không theo id bước
 * chương trình, để sửa chương trình nuôi không làm mất lịch sử.
 * Khi xác nhận cám / thuốc / vắc-xin có gắn hàng hóa: trừ tồn kho (stock_quantity) và ghi chi phí vào lứa
 * qua feed_record (cám) hoặc cycle_expense (thuốc, vắc-xin). Hoàn tác thì hoàn lại tồn kho và xóa hai dòng đó.
 */
@Entity
@Table(name = "daily_task_logs",
        uniqueConstraints = @UniqueConstraint(name = "uk_daily_task_logs_cycle_date_key", columnNames = {"cycle_id", "task_date", "task_key"}),
        indexes = @Index(name = "idx_daily_task_logs_date", columnList = "task_date"))
@Data
public class DailyTaskLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;
    @Column(name = "task_date", nullable = false)
    private LocalDate taskDate;
    @Column(name = "task_key", nullable = false, length = 120)
    private String taskKey;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProgramStepCategory category;
    @Column(name = "task_name", nullable = false, length = 200)
    private String taskName;
    /** Cữ thứ mấy trong ngày (chỉ với cám). */
    private Integer meal;
    /** Lượng theo kế hoạch và lượng thực tế, cùng đơn vị usage_unit (kg cám, g / ml thuốc, liều vắc-xin). */
    @Column(name = "planned_quantity", precision = 14, scale = 3)
    private BigDecimal plannedQuantity;
    @Column(name = "actual_quantity", precision = 14, scale = 3)
    private BigDecimal actualQuantity;
    @Enumerated(EnumType.STRING)
    @Column(name = "usage_unit", length = 10)
    private UsageUnit usageUnit;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    private InventoryItem inventoryItem;
    /** Số đơn vị tồn kho đã trừ (bao, lọ, chai...). */
    @Column(name = "stock_quantity", precision = 14, scale = 3)
    private BigDecimal stockQuantity;
    /** Giá một đơn vị tồn kho lúc xác nhận và thành tiền đã ghi vào chi phí lứa. */
    @Column(name = "unit_price", precision = 19, scale = 2)
    private BigDecimal unitPrice;
    @Column(precision = 16, scale = 2)
    private BigDecimal cost;
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feed_record_id")
    private FeedRecord feedRecord;
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expense_id")
    private CycleExpense expense;
    /** Lệch kế hoạch quá ngưỡng cho phép, cần chủ trại xem lại. */
    @Column(nullable = false)
    private boolean deviated;
    @Column(length = 1000)
    private String note;
    @Column(name = "done_by", nullable = false, length = 150)
    private String doneBy;
    @Column(name = "done_at", nullable = false)
    private LocalDateTime doneAt;
}
