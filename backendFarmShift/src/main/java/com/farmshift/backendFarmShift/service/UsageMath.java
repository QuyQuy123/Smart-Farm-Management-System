package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.InventoryItem;
import com.farmshift.backendFarmShift.entity.MeasurementUnit;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import com.farmshift.backendFarmShift.entity.UsageUnit;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/**
 * Quy đổi định mức chương trình nuôi (tính cho 1 con) sang lượng dùng của cả chuồng và sang đơn vị tồn kho.
 * Cám: g/con/ngày. Thuốc: liều theo kg cám, theo lít nước uống hoặc theo con. Vắc-xin: liều theo con.
 */
final class UsageMath {
    /** Nước uống ước tính theo lượng cám (gà uống khoảng 1,8–2 lít nước cho mỗi kg cám). */
    static final BigDecimal WATER_LITERS_PER_FEED_KG = BigDecimal.valueOf(2);

    /** Liều thuốc / vắc-xin được tính trên cơ sở nào. */
    enum Basis { PER_HEAD, PER_FEED_KG, PER_WATER_LITER }

    private UsageMath() { }

    /** Đơn vị của lượng cần dùng: cám tính bằng g (rồi đổi ra kg), thuốc / vắc-xin theo tử số của đơn vị liều. */
    static UsageUnit usageUnit(ProgramStepCategory category, String unit) {
        return switch (category) {
            case FEED -> UsageUnit.G;
            case MEDICINE, VACCINE -> UsageUnit.ofDoseUnit(unit);
            default -> null;
        };
    }

    /** Đơn vị hiển thị trên phiếu việc: cám theo kg, còn lại giữ đơn vị của liều. */
    static UsageUnit displayUnit(ProgramStepCategory category, String unit) {
        return category == ProgramStepCategory.FEED ? UsageUnit.KG : usageUnit(category, unit);
    }

    static Basis basis(ProgramStepCategory category, String unit) {
        if (category == ProgramStepCategory.VACCINE) return Basis.PER_HEAD;
        if (category != ProgramStepCategory.MEDICINE || unit == null) return null;
        String text = unit.toLowerCase(Locale.ROOT);
        int slash = text.indexOf('/');
        if (slash < 0) return null;
        String per = text.substring(slash + 1).strip();
        if (per.startsWith("kg")) return Basis.PER_FEED_KG;
        if (per.startsWith("lít") || per.startsWith("lit") || per.startsWith("l ") || per.equals("l")) return Basis.PER_WATER_LITER;
        if (per.startsWith("con")) return Basis.PER_HEAD;
        return null;
    }

    /** Hàng hóa có quy cách (đơn vị tồn kho chứa bao nhiêu kg / ml / liều) thì mới quy đổi được. */
    static boolean hasContent(InventoryItem item) {
        MeasurementUnit unit = item.getUnit();
        return unit != null && unit.getContentQuantity() != null && unit.getContentQuantity().signum() > 0 && unit.getContentUnit() != null;
    }

    static boolean compatible(InventoryItem item, UsageUnit usage) {
        return usage != null && hasContent(item) && item.getUnit().getContentUnit().dimension() == usage.dimension();
    }

    /**
     * Số đơn vị tồn kho ứng với một lượng dùng. Vắc-xin mở lọ là dùng hết nên làm tròn lên cả lọ;
     * cám, thuốc được trừ lẻ (3 số thập phân).
     */
    static BigDecimal toStock(BigDecimal quantity, UsageUnit unit, InventoryItem item, boolean wholePacks) {
        MeasurementUnit stockUnit = item.getUnit();
        BigDecimal perPack = stockUnit.getContentUnit().toBase(stockUnit.getContentQuantity());
        BigDecimal packs = unit.toBase(quantity).divide(perPack, 6, RoundingMode.HALF_UP);
        return wholePacks ? packs.setScale(0, RoundingMode.CEILING).setScale(3) : packs.setScale(3, RoundingMode.HALF_UP);
    }

    /** Giá trên 1 kg cám từ giá của một đơn vị tồn kho (ví dụ 335.000 đ/bao 25kg → 13.400 đ/kg). */
    static BigDecimal pricePerKg(InventoryItem item) {
        MeasurementUnit stockUnit = item.getUnit();
        BigDecimal kgPerPack = UsageUnit.KG.fromBase(stockUnit.getContentUnit().toBase(stockUnit.getContentQuantity()), 6);
        return item.getPrice().divide(kgPerPack, 2, RoundingMode.HALF_UP);
    }
}
