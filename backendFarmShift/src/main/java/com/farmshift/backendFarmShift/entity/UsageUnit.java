package com.farmshift.backendFarmShift.entity;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Đơn vị sử dụng của vật tư chăn nuôi, dùng để quy đổi định mức chương trình nuôi sang đơn vị tồn kho.
 * Ví dụ đơn vị tồn kho "Bao (25kg)" chứa 25 KG, "Lọ 1000 liều" chứa 1000 DOSE, "Chai 1L" chứa 1 L.
 */
public enum UsageUnit {
    KG(Dimension.MASS, 1000, "kg"),
    G(Dimension.MASS, 1, "g"),
    L(Dimension.VOLUME, 1000, "lít"),
    ML(Dimension.VOLUME, 1, "ml"),
    DOSE(Dimension.DOSE, 1, "liều");

    /** Hai đơn vị chỉ quy đổi được cho nhau khi cùng loại đại lượng. */
    public enum Dimension { MASS, VOLUME, DOSE }

    private final Dimension dimension;
    private final BigDecimal factor;
    private final String label;

    UsageUnit(Dimension dimension, int factor, String label) {
        this.dimension = dimension;
        this.factor = BigDecimal.valueOf(factor);
        this.label = label;
    }

    public Dimension dimension() { return dimension; }

    public String label() { return label; }

    /** Lượng tính theo đơn vị nhỏ nhất của loại đại lượng (g, ml, liều). */
    public BigDecimal toBase(BigDecimal quantity) { return quantity.multiply(factor); }

    public BigDecimal fromBase(BigDecimal base, int scale) {
        return base.divide(factor, scale, java.math.RoundingMode.HALF_UP);
    }

    /**
     * Đọc phần tử số của đơn vị liều trong chương trình: "g/kg cám" → G, "ml/lít nước" → ML, "liều/con", "giọt/con" → DOSE.
     * Trả về null khi không nhận ra.
     */
    public static UsageUnit ofDoseUnit(String unit) {
        if (unit == null || unit.isBlank()) return null;
        String head = unit.strip().toLowerCase(Locale.ROOT).split("/")[0].strip();
        return switch (head) {
            case "kg" -> KG;
            case "g", "gam", "gram" -> G;
            case "l", "lít", "lit" -> L;
            case "ml" -> ML;
            case "liều", "lieu", "giọt", "giot", "dose" -> DOSE;
            default -> null;
        };
    }
}
