package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Phân công công việc: công nhân phụ trách chuồng, giao việc hằng ngày, công nhân chỉ thấy chuồng và việc của mình. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class WorkAssignmentIntegrationTest {
    private static final LocalDate TODAY = LocalDate.now();
    private static final String WORKER_A = "a.worker@farm.test";
    private static final String WORKER_B = "b.worker@farm.test";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AccountRepository accounts;
    @Autowired RoleRepository roles;

    long workerA, workerB, accountantId, barn1, barn2, cycle1, cycle2;
    final RequestPostProcessor asA = SecurityMockMvcRequestPostProcessors.user(WORKER_A).authorities(() -> RoleNames.FARM_WORKER);
    final RequestPostProcessor asB = SecurityMockMvcRequestPostProcessors.user(WORKER_B).authorities(() -> RoleNames.FARM_WORKER);

    @BeforeEach
    void setUp() throws Exception {
        workerA = account(WORKER_A, "Công nhân A", RoleNames.FARM_WORKER);
        workerB = account(WORKER_B, "Công nhân B", RoleNames.FARM_WORKER);
        accountantId = account("ketoan.assign@farm.test", "Kế toán", RoleNames.ACCOUNTANT);
        long program = id(send(post("/api/farming-programs"), Map.of("name", "Gà Mía phân công", "breed", "Gà Mía", "durationDays", 90,
                "steps", List.of(Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 90, "quantity", 40, "mealsPerDay", 2)))));
        long area = id(send(post("/api/farm-areas"), Map.of("name", "Khu phân công")));
        barn1 = id(send(post("/api/barns"), Map.of("areaId", area, "name", "Chuồng 1", "capacity", 10000, "areaM2", 500)));
        barn2 = id(send(post("/api/barns"), Map.of("areaId", area, "name", "Chuồng 2", "capacity", 10000, "areaM2", 500)));
        cycle1 = startWithFlock(barn1, program);
        cycle2 = startWithFlock(barn2, program);
    }

    // ---------------------------------------------------------------- helpers

    private long account(String email, String name, String roleName) {
        Role role = roles.findByName(roleName).orElseGet(() -> roles.save(new Role(null, roleName, roleName)));
        Account account = new Account();
        account.setEmail(email);
        account.setPassword("x");
        account.setFullName(name);
        account.setRole(role);
        account.setIsActive(true);
        return accounts.save(account).getId();
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions result) throws Exception {
        return mapper.readTree(result.andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    private long startWithFlock(long barn, long program) throws Exception {
        LocalDate start = TODAY.minusDays(5);
        long cycle = id(send(post("/api/barns/" + barn + "/cycles"), Map.of("startDate", start.toString())));
        Map<String, Object> flock = new HashMap<>(Map.of("name", "Xô", "programId", program, "gender", "MIXED", "importDate", start.toString(),
                "ageAtImport", 1, "quantity", 1000, "avgWeight", 0.04, "unitPrice", 11000));
        send(post("/api/cycles/" + cycle + "/flocks"), flock).andExpect(status().isCreated());
        return cycle;
    }

    private ResultActions assign(long barn, Long... workers) throws Exception {
        return send(put("/api/barns/" + barn + "/workers"), Map.of("workerIds", List.of(workers)));
    }

    private Map<String, Object> task(long barn, long assignee, String title, LocalDate start, LocalDate end) {
        Map<String, Object> body = new HashMap<>(Map.of("barnId", barn, "assigneeId", assignee, "title", title, "startDate", start.toString()));
        if (end != null) body.put("endDate", end.toString());
        return body;
    }

    private long giveTask(long barn, long assignee, String title) throws Exception {
        return id(send(post("/api/work-tasks"), task(barn, assignee, title, TODAY, null)));
    }

    private ResultActions check(long task, RequestPostProcessor as, LocalDate date) throws Exception {
        return mvc.perform(post("/api/work-tasks/" + task + "/checks").with(as).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("date", date.toString()))));
    }

    // ---------------------------------------------------------------- tests

    @Test
    void ownerAssignsWorkersToBarnsAndSeesThemOnTheBoard() throws Exception {
        assign(barn1, workerA).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].fullName").value("Công nhân A"));
        assign(barn1, accountantId).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORKER_NOT_AVAILABLE"));
        mvc.perform(get("/api/work-assignments"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.barns[?(@.barnId == " + barn1 + ")].workers[0].email").value(WORKER_A))
            .andExpect(jsonPath("$.data.barns[?(@.barnId == " + barn1 + ")].activeCycleId").value((int) cycle1))
            .andExpect(jsonPath("$.data.workers[?(@.id == " + workerA + ")].barnCount").value(1))
            .andExpect(jsonPath("$.data.workers[?(@.id == " + workerB + ")].barnCount").value(0));
        mvc.perform(get("/api/work-assignments").with(asA)).andExpect(status().isForbidden());
    }

    @Test
    void givesRepeatingDailyTasksOnlyToTheBarnWorkers() throws Exception {
        assign(barn1, workerA);
        send(post("/api/work-tasks"), task(barn1, workerB, "Rửa máng uống", TODAY, null))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORK_ASSIGNEE_NOT_IN_BARN"));
        send(post("/api/work-tasks"), task(barn1, workerA, "Rửa máng uống", TODAY, TODAY.minusDays(1)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_DATE_RANGE"));
        send(post("/api/work-tasks"), task(barn1, workerA, "Việc cũ", TODAY.minusDays(3), TODAY.minusDays(1)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_DATE_RANGE"));

        Map<String, Object> repeating = task(barn1, workerA, "Rửa máng uống", TODAY, TODAY.plusDays(2));
        repeating.put("dueTime", "07:30");
        send(post("/api/work-tasks"), repeating).andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.assignee.fullName").value("Công nhân A"));
        mvc.perform(get("/api/work-assignments").param("date", TODAY.plusDays(2).toString()))
            .andExpect(jsonPath("$.data.barns[?(@.barnId == " + barn1 + ")].tasks[0].title").value("Rửa máng uống"))
            .andExpect(jsonPath("$.data.barns[?(@.barnId == " + barn1 + ")].tasks[0].dueTime").value("07:30:00"));
        mvc.perform(get("/api/work-assignments").param("date", TODAY.plusDays(3).toString()))
            .andExpect(jsonPath("$.data.barns[?(@.barnId == " + barn1 + ")].tasks[*]").isEmpty());
    }

    @Test
    void workersSeeOnlyTheirOwnBarnsAndTasks() throws Exception {
        assign(barn1, workerA);
        assign(barn2, workerB);
        giveTask(barn1, workerA, "Sửa quạt hút");
        giveTask(barn2, workerB, "Thay trấu");

        mvc.perform(get("/api/daily-plan").with(asA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].barnName").value("Chuồng 1"))
            .andExpect(jsonPath("$.data[0].assignedTasks[*].title").value(contains("Sửa quạt hút")))
            .andExpect(jsonPath("$.data[0].workers[0].email").value(WORKER_A));
        mvc.perform(get("/api/cycles/" + cycle2 + "/daily-plan").with(asA))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BARN_NOT_ASSIGNED"));
        mvc.perform(post("/api/cycles/" + cycle2 + "/daily-plan/tasks").with(asA).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("date", TODAY.toString(), "taskKey", "FEED:Nhigro 01:M1"))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BARN_NOT_ASSIGNED"));

        // The owner still sees every barn with all assigned work.
        mvc.perform(get("/api/daily-plan"))
            .andExpect(jsonPath("$.data[?(@.barnName == 'Chuồng 2')].assignedTasks[*].title").value(contains("Thay trấu")))
            .andExpect(jsonPath("$.data.length()").value(greaterThanOrEqualTo(2)));
    }

    @Test
    void theAssigneeTicksTheirTaskAndOnlyTheyOrTheOwnerCanUndoIt() throws Exception {
        assign(barn1, workerA, workerB);
        long task = giveTask(barn1, workerA, "Kiểm tra đèn sưởi");

        check(task, asB, TODAY).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_NOT_YOURS"));
        check(task, asA, TODAY.plusDays(1)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_FUTURE"));
        check(task, asA, TODAY).andExpect(status().isOk()).andExpect(jsonPath("$.data.done.doneBy").value(WORKER_A));
        check(task, asA, TODAY).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_ALREADY_DONE"));

        mvc.perform(get("/api/daily-plan").with(asA))
            .andExpect(jsonPath("$.data[0].assignedTasks[0].done.doneBy").value(WORKER_A));
        mvc.perform(delete("/api/work-tasks/" + task + "/checks").with(asB).param("date", TODAY.toString()))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_UNDO_FORBIDDEN"));
        mvc.perform(delete("/api/work-tasks/" + task + "/checks").with(asA).param("date", TODAY.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.done").doesNotExist());

        // A task with a done day keeps its worker; the owner gives a new task instead.
        check(task, asA, TODAY).andExpect(status().isOk());
        send(put("/api/work-tasks/" + task), task(barn1, workerB, "Kiểm tra đèn sưởi", TODAY, null))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORK_TASK_HAS_CHECKS"));
        send(put("/api/work-tasks/" + task), task(barn1, workerA, "Kiểm tra đèn sưởi và quạt", TODAY, TODAY.plusDays(1)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("Kiểm tra đèn sưởi và quạt"));
    }

    @Test
    void aWorkerWithOpenTasksCannotBeRemovedFromTheBarn() throws Exception {
        assign(barn1, workerA);
        long task = giveTask(barn1, workerA, "Rắc vôi bột lối đi");
        assign(barn1).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("WORKER_HAS_TASKS"));
        mvc.perform(delete("/api/work-tasks/" + task)).andExpect(status().isOk());
        assign(barn1).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/daily-plan").with(asA)).andExpect(jsonPath("$.data").isEmpty());
    }
}
