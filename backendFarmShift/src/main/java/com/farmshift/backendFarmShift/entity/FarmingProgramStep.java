package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

/**
 * Một nội dung của chương trình nuôi, áp dụng từ ngày tuổi dayFrom đến dayTo. Các cột dùng theo nhóm:
 * FEED: name (loại cám), quantity (g/con/ngày), mealsPerDay (số cữ); VACCINE: name, method, quantity/unit (liều);
 * MEDICINE: name, method (trộn cám / pha nước), quantity/unit (liều); TEMPERATURE: tempMin, tempMax; WORK: name.
 */
@Entity
@Table(name = "farming_program_steps")
@Data
public class FarmingProgramStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    @lombok.ToString.Exclude
    @lombok.EqualsAndHashCode.Exclude
    private FarmingProgram program;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProgramStepCategory category;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(name = "day_from", nullable = false)
    private int dayFrom;
    @Column(name = "day_to", nullable = false)
    private int dayTo;
    @Column(precision = 14, scale = 3)
    private BigDecimal quantity;
    @Column(length = 50)
    private String unit;
    @Column(name = "meals_per_day")
    private Integer mealsPerDay;
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private AdministrationMethod method;
    @Column(name = "temp_min", precision = 4, scale = 1)
    private BigDecimal tempMin;
    @Column(name = "temp_max", precision = 4, scale = 1)
    private BigDecimal tempMax;
    /** Chế độ nhập định mức cám gốc: GRAM_PER_BIRD_DAY hoặc BAGS_PER_1000_BIRDS. */
    @Column(name = "feed_input_mode", length = 30)
    private String feedInputMode;
    /** Khối lượng 1 bao cám (kg) dùng để quy đổi khi feed_input_mode = BAGS_PER_1000_BIRDS (mặc định 25.000). */
    @Column(name = "bag_weight_kg", precision = 10, scale = 3)
    private BigDecimal bagWeightKg;
    /** Định mức gốc tính theo số bao / 1.000 con / giai đoạn (lưu lại để round-trip không lệch làm tròn). */
    @Column(name = "bags_per_1000_birds", precision = 14, scale = 3)
    private BigDecimal bagsPer1000Birds;
    @Column(length = 1000)
    private String note;
    /** Hàng hóa trong kho dùng cho nội dung này (cám, thuốc, vắc-xin) để trừ tồn kho và tính chi phí khi công nhân xác nhận. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    @lombok.ToString.Exclude
    @lombok.EqualsAndHashCode.Exclude
    private InventoryItem inventoryItem;
}
