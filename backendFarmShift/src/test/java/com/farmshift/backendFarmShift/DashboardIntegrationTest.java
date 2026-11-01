package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.response.DashboardResponse;
import com.farmshift.backendFarmShift.service.DashboardService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Bảng tin: số liệu trong ngày, việc cần xử lý, thẻ chuồng, lịch 7 ngày tới và phân quyền theo vai trò. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class DashboardIntegrationTest {
    private static final LocalDate TODAY = LocalDate.now();
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired DashboardService dashboard;
    @Autowired com.farmshift.backendFarmShift.repository.AccountRepository accounts;
    @Autowired com.farmshift.backendFarmShift.repository.RoleRepository roles;
    long barnA;
    long barnB;
    long workerId;

    @BeforeEach
    void setUp() throws Exception {
        long areaId = id(send("/api/farm-areas", Map.of("name", "Khu Bảng Tin")));
        barnA = id(send("/api/barns", Map.of("areaId", areaId, "name", "Nhà T1", "capacity", 5000, "areaM2", 600)));
        barnB = id(send("/api/barns", Map.of("areaId", areaId, "name", "Nhà T2", "capacity", 5000, "areaM2", 600)));
        // Đàn nhập 5 ngày trước lúc 1 ngày tuổi → hôm nay 6 ngày tuổi; vắc-xin ngày 9 (còn 3 ngày), chương trình 10 ngày (xuất sau 4 ngày).
        long programId = id(send("/api/farming-programs", Map.of("name", "Gà thử bảng tin", "breed", "Gà thử", "durationDays", 10,
                "steps", List.of(
                        Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 10, "quantity", 30, "mealsPerDay", 3),
                        Map.of("category", "VACCINE", "name", "Gumboro", "dayFrom", 9, "dayTo", 9, "method", "MOUTH")))));
        for (long barn : List.of(barnA, barnB)) {
            long cycle = id(send("/api/barns/" + barn + "/cycles", Map.of("startDate", TODAY.minusDays(5).toString())));
            id(send("/api/cycles/" + cycle + "/flocks", Map.of("name", "ĐÀN " + barn, "programId", programId, "gender", "MIXED",
                    "importDate", TODAY.minusDays(5).toString(), "ageAtImport", 1, "quantity", 1000, "avgWeight", 0.04, "unitPrice", 10000)));
        }
        long flockA = data(mvc.perform(get("/api/barns/" + barnA))).path("activeCycleId").asLong();
        long flockId = data(mvc.perform(get("/api/cycles/" + flockA))).path("flocks").get(0).path("id").asLong();
        send("/api/cycles/" + flockA + "/weight-samples", Map.of("sampleDate", TODAY.minusDays(1).toString(), "avgWeightKg", 0.12, "sampleSize", 30))
                .andExpect(status().isCreated());
        send("/api/flocks/" + flockId + "/losses", Map.of("type", "DEATH", "movementDate", TODAY.toString(), "quantity", 10)).andExpect(status().isCreated());

        var role = roles.findByName("ROLE_FARM_WORKER").orElseGet(() -> roles.save(new com.farmshift.backendFarmShift.entity.Role(null, "ROLE_FARM_WORKER", "Công nhân")));
        var account = new com.farmshift.backendFarmShift.entity.Account();
        account.setEmail("worker@farm.test");
        account.setPassword("x");
        account.setFullName("Công nhân Bảng Tin");
        account.setRole(role);
        account.setIsActive(true);
        workerId = accounts.save(account).getId();
        mvc.perform(put("/api/barns/" + barnA + "/workers").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("workerIds", List.of(workerId))))).andExpect(status().isOk());
        send("/api/work-tasks", Map.of("barnId", barnA, "assigneeId", workerId, "title", "Rửa máng uống", "startDate", TODAY.toString(),
                "dueTime", "06:00")).andExpect(status().isCreated());
        send("/api/purchases", Map.of("supplierName", "NCC Bảng Tin", "date", TODAY.toString(), "paymentStatus", "Trả sau", "stockStatus", "Chưa nhập kho",
                "items", List.of(Map.of("name", "Cám thử", "qty", 2, "unit", "Bao", "price", 300000)))).andExpect(status().isCreated());
    }

    private ResultActions send(String url, Object body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions result) throws Exception {
        return data(result.andExpect(status().isCreated())).path("id").asLong();
    }

    private JsonNode data(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    private static JsonNode barn(JsonNode dashboard, long barnId) {
        for (JsonNode card : dashboard.path("barns")) if (card.path("barnId").asLong() == barnId) return card;
        return null;
    }

    @Test
    void ownerSeesWholeFarmAlertsUpcomingAndMoney() throws Exception {
        JsonNode d = data(mvc.perform(get("/api/dashboard")).andExpect(status().isOk()));
        JsonNode kpis = d.path("kpis");
        assertTrue(kpis.path("liveQuantity").asInt() >= 1990, "2 chuồng mới: 990 + 1000 con");
        assertTrue(kpis.path("activeBarns").asInt() >= 2);
        assertTrue(kpis.path("lossToday").asInt() >= 10);
        assertTrue(kpis.path("supplierDebt").asLong() >= 600_000);
        assertTrue(kpis.path("unpaidInvoices").asInt() >= 1);

        JsonNode a = barn(d, barnA);
        assertNotNull(a);
        assertEquals(990, a.path("quantity").asInt());
        assertEquals(6, a.path("ageDays").asInt());
        assertEquals(10, a.path("lossToday").asInt());
        assertEquals(1000, a.path("totalIn").asInt());
        assertEquals(10, a.path("deaths").asInt());
        assertEquals(0, a.path("culls").asInt());
        assertEquals("DANGER", a.path("status").asText(), "hao hụt 1% trong ngày");
        assertEquals("Công nhân Bảng Tin", a.path("workers").get(0).asText());
        JsonNode b = barn(d, barnB);
        assertEquals("WARN", b.path("status").asText(), "chưa có người phụ trách");

        String alerts = d.path("alerts").toString();
        assertTrue(alerts.contains("Nhà T1: hao hụt 10 con hôm nay"), alerts);
        assertTrue(alerts.contains("Nhà T2 chưa có người phụ trách"), alerts);
        assertTrue(alerts.contains("hóa đơn còn nợ nhà cung cấp"), alerts);
        assertEquals("DANGER", d.path("alerts").get(0).path("level").asText(), "việc nguy cấp đứng đầu");

        String upcoming = d.path("upcoming").toString();
        assertTrue(upcoming.contains("Vắc-xin Gumboro (ngày tuổi 9)"), upcoming);
        assertTrue(upcoming.contains("\"inDays\":3"), upcoming);
        assertTrue(upcoming.contains("Dự kiến xuất chuồng"), upcoming);
        assertTrue(d.path("finance").path("chickCost").decimalValue().signum() > 0);
    }

    @Test
    void chartsCarryTaskHistoryGrowthAndCostBreakdown() throws Exception {
        JsonNode d = data(mvc.perform(get("/api/dashboard")).andExpect(status().isOk()));
        JsonNode history = d.path("taskHistory");
        assertEquals(7, history.size(), "7 ngày gần nhất");
        assertEquals(TODAY.toString(), history.get(6).path("date").asText());
        assertEquals(TODAY.minusDays(6).toString(), history.get(0).path("date").asText());
        assertTrue(history.get(5).path("total").asInt() > 0, "hôm qua đã có cữ ăn theo chương trình");
        assertEquals(history.get(5).path("total").asInt() - history.get(5).path("done").asInt(), history.get(5).path("missed").asInt());

        JsonNode growth = null;
        for (JsonNode item : d.path("growth")) if (item.path("barnId").asLong() == barnA) growth = item;
        assertNotNull(growth);
        assertEquals(10, growth.path("targetDay").asInt());
        JsonNode points = growth.path("points");
        assertEquals(2, points.size(), "lúc nhập + 1 lần cân mẫu");
        assertEquals(1, points.get(0).path("ageDays").asInt());
        assertEquals(0.04, points.get(0).path("avgWeightKg").asDouble(), 0.0001);
        assertEquals(5, points.get(1).path("ageDays").asInt(), "cân hôm qua, hôm nay 6 ngày tuổi");
        assertEquals(0.12, points.get(1).path("avgWeightKg").asDouble(), 0.0001);

        JsonNode finance = d.path("finance");
        assertEquals(0, finance.path("otherCost").decimalValue().compareTo(finance.path("totalCost").decimalValue()
                .subtract(finance.path("chickCost").decimalValue()).subtract(finance.path("feedCost").decimalValue()).max(java.math.BigDecimal.ZERO)));

        JsonNode worker = data(mvc.perform(get("/api/dashboard").with(user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER"))));
        assertEquals(1, worker.path("growth").size(), "công nhân chỉ thấy chuồng mình");
    }

    @Test
    void lateTasksAreCountedAsOverdue() {
        DashboardResponse late = dashboard.get(true, null, LocalTime.of(23, 59));
        DashboardResponse early = dashboard.get(true, null, LocalTime.MIN);
        DashboardResponse.BarnCard a = late.barns().stream().filter(card -> card.barnId() == barnA).findFirst().orElseThrow();
        assertTrue(a.overdueTasks() >= 1, "việc giao lúc 06:00 chưa làm");
        assertTrue(late.alerts().stream().anyMatch(alert -> "OVERDUE".equals(alert.type()) && alert.detail().contains("Rửa máng uống")));
        assertEquals(0, early.kpis().overdueTasks());
    }

    @Test
    void accountantSeesMoneyWorkerOnlyOwnBarnsWithoutMoney() throws Exception {
        JsonNode accountant = data(mvc.perform(get("/api/dashboard").with(user("ketoan@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))));
        assertFalse(accountant.path("finance").isNull());
        assertTrue(accountant.path("kpis").path("supplierDebt").asLong() >= 600_000);

        JsonNode worker = data(mvc.perform(get("/api/dashboard").with(user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER")))
                .andExpect(status().isOk()));
        assertEquals(1, worker.path("barns").size());
        assertEquals(barnA, worker.path("barns").get(0).path("barnId").asLong());
        assertTrue(worker.path("finance").isNull());
        assertTrue(worker.path("kpis").path("supplierDebt").isNull());
        assertFalse(worker.path("alerts").toString().contains("hóa đơn"));
        assertFalse(worker.path("alerts").toString().contains("chưa có người phụ trách"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/dashboard").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous()))
                .andExpect(status().is4xxClientError());
    }
}
