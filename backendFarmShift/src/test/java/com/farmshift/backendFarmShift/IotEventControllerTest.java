package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.config.IotEventSchemaUpgrade;
import com.farmshift.backendFarmShift.controller.IotEventController;
import com.farmshift.backendFarmShift.service.BarnService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class IotEventControllerTest {
    private final BarnService barns = mock(BarnService.class);
    private final UsernamePasswordAuthenticationToken worker = new UsernamePasswordAuthenticationToken(
        "worker@example.com", null, List.of(new SimpleGrantedAuthority("ROLE_FARM_WORKER")));

    @Test
    void schemaIsRepeatableAndHistoryIsScopedOrderedAndPaged() {
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:h2:mem:iot_events;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        var upgrade = new IotEventSchemaUpgrade(jdbc);
        upgrade.run(null);
        upgrade.run(null);
        for (int i = 0; i < 22; i++) {
            jdbc.update("INSERT INTO iot_activation_events(id,barn_id,device_name,device_type,relay,mode,temperature1,occurred_at,actor) VALUES(?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), i == 21 ? 2 : 1, "Quạt", "FAN", 4, "MANUAL", 30.0,
                Timestamp.from(Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i)), "owner@example.com");
        }
        var controller = new IotEventController(jdbc, barns);
        var first = controller.list(1L, 0, worker).getData();
        assertEquals(5, first.size());
        assertTrue(first.get(0).occurredAt().isAfter(first.get(1).occurredAt()));
        assertEquals(30.0, first.get(0).temperature1());
        assertNull(first.get(0).temperature3());
        var second = controller.list(1L, 1, worker).getData();
        assertEquals(5, second.size());
        assertTrue(first.get(4).occurredAt().isAfter(second.get(0).occurredAt()));
        assertEquals(1, controller.list(1L, 4, worker).getData().size());
        assertTrue(controller.list(1L, 5, worker).getData().isEmpty());
        verify(barns, times(4)).get(1L, "worker@example.com");
    }

    @Test
    void unauthorizedBarnCannotBeWritten() {
        var jdbc = mock(JdbcTemplate.class);
        when(barns.get(2L, "worker@example.com")).thenThrow(new IllegalStateException("not assigned"));
        var controller = new IotEventController(jdbc, barns);
        assertThrows(IllegalStateException.class, () -> controller.create(2L,
            new IotEventController.Activation(UUID.randomUUID(), "Quạt", "FAN", 4, "AUTO", 40.0, 42.0, Instant.now()), worker));
        verifyNoInteractions(jdbc);
    }

    @Test
    void validatesEventTypeRelayTemperatureAndTimeBeforeWriting() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        var mvc = MockMvcBuilders.standaloneSetup(new IotEventController(jdbc, barns)).build();
        String valid = """
            {"id":"%s","deviceName":"Fan","deviceType":"FAN","relay":4,"mode":"MANUAL",
             "temperature1":30,"temperature3":null,"occurredAt":"2026-01-01T00:00:00Z"}
            """.formatted(UUID.randomUUID());
        for (String invalid : List.of(valid.replace("FAN", "LIGHT"), valid.replace("\"relay\":4", "\"relay\":5"),
            valid.replace("\"temperature1\":30", "\"temperature1\":999"), valid.replace("2026-01-01", "2099-01-01"))) {
            mvc.perform(post("/api/barns/1/iot-events").principal(worker).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(jdbc);
        mvc.perform(post("/api/barns/1/iot-events").principal(worker).contentType(MediaType.APPLICATION_JSON).content(valid))
            .andExpect(status().isOk());
        verify(barns).get(1L, "worker@example.com");
    }
}
