package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Bảng tin trong ngày. Công nhân chỉ thấy các chuồng mình phụ trách; finance, supplierDebt và unpaidInvoices
 * là null với vai trò không được xem tiền.
 */
public record DashboardResponse(LocalDate date, Kpis kpis, List<Alert> alerts, List<BarnCard> barns, List<Upcoming> upcoming,
                                Finance finance, List<DayTasks> taskHistory, List<Growth> growth) {

    /** Việc của một ngày (7 ngày gần nhất): missed = việc chưa làm (ngày đã qua) hoặc việc quá giờ (hôm nay). */
    public record DayTasks(LocalDate date, int done, int total, int missed) {
    }

    /** Cân TB theo ngày tuổi của một chuồng (lúc nhập + các lần cân mẫu) và mốc mục tiêu xuất chuồng của chương trình nuôi. */
    public record Growth(Long barnId, String barnName, List<WeightPoint> points, Integer targetDay, BigDecimal targetWeightKg) {
    }

    public record WeightPoint(int ageDays, LocalDate date, BigDecimal avgWeightKg) {
    }

    /** loss7dRate: % hao hụt (chết + loại) 7 ngày qua so với số con đầu kỳ (đang nuôi + đã hao hụt). */
    public record Kpis(int liveQuantity, int activeBarns, int lossToday, int loss7d, BigDecimal loss7dRate,
                       int tasksDone, int tasksTotal, int overdueTasks, Long supplierDebt, Integer unpaidInvoices) {
    }

    /** level: DANGER / WARN / INFO. barnId để mở đúng chuồng (null nếu không gắn chuồng). */
    public record Alert(String level, String type, String title, String detail, Long barnId) {
    }

    /** status: OK / WARN / DANGER theo việc trễ, kho thiếu, hao hụt hôm nay, chưa có người phụ trách. */
    public record BarnCard(Long barnId, Long cycleId, String barnName, String areaName, Integer ageDays, int quantity,
                           BigDecimal avgWeightKg, BigDecimal fcr, BigDecimal lossRate, int lossToday, int tasksDone, int tasksTotal,
                           int overdueTasks, List<String> workers, String status, int totalIn, int deaths, int culls) {
    }

    /** kind: VACCINE / MEDICINE / FEED (đổi cám) / HARVEST (dự kiến xuất chuồng theo chương trình nuôi). */
    public record Upcoming(LocalDate date, int inDays, Long barnId, String barnName, String kind, String title) {
    }

    /** Cộng dồn các lứa đang nuôi. otherCost: các khoản chi ngoài con giống và cám (điện, nước, nhân công, thuốc…). */
    public record Finance(BigDecimal chickCost, BigDecimal feedCost, BigDecimal totalCost, BigDecimal revenue, BigDecimal profit,
                          BigDecimal otherCost) {
    }
}
