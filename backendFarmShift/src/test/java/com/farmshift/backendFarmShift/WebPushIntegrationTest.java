package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.JwtProvider;
import com.farmshift.backendFarmShift.service.WebPushDeliveryClient;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WebPushIntegrationTest {

    private static final String SAMPLE_P256DH =
            "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
    private static final String SAMPLE_AUTH = "tBHItJI5svbpez7KI4CCXg";

    @Autowired MockMvc mockMvc;
    @Autowired JwtProvider jwtProvider;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PushSubscriptionRepository subscriptionRepository;
    @Autowired FarmAreaRepository farmAreaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired PushService pushService;

    @MockitoBean
    WebPushDeliveryClient deliveryClient;

    private Account owner;
    private Account assignedWorker;
    private Account otherWorker;
    private Barn assignedBarn;
    private String ownerToken;
    private String assignedWorkerToken;
    private String otherWorkerToken;

    @BeforeEach
    void setUp() throws Exception {
        subscriptionRepository.deleteAll();
        barnRepository.deleteAll();
        farmAreaRepository.deleteAll();

        Role ownerRole = roleRepository.findByName("ROLE_FARM_OWNER").orElseGet(() -> {
            Role r = new Role();
            r.setName("ROLE_FARM_OWNER");
            return roleRepository.save(r);
        });
        Role workerRole = roleRepository.findByName("ROLE_FARM_WORKER").orElseGet(() -> {
            Role r = new Role();
            r.setName("ROLE_FARM_WORKER");
            return roleRepository.save(r);
        });

        owner = ensureAccount("push.owner@farmshift.local", "Chủ trại Push", ownerRole);
        assignedWorker = ensureAccount("push.worker1@farmshift.local", "Công nhân Push 1", workerRole);
        otherWorker = ensureAccount("push.worker2@farmshift.local", "Công nhân Push 2", workerRole);

        ownerToken = jwtFor(owner.getEmail(), "ROLE_FARM_OWNER");
        assignedWorkerToken = jwtFor(assignedWorker.getEmail(), "ROLE_FARM_WORKER");
        otherWorkerToken = jwtFor(otherWorker.getEmail(), "ROLE_FARM_WORKER");

        FarmArea area = new FarmArea();
        area.setName("Khu Push " + UUID.randomUUID().toString().substring(0, 6));
        area.setNameKey(area.getName().toLowerCase());
        area.getWorkers().add(assignedWorker);
        area = farmAreaRepository.save(area);

        Barn barn = new Barn();
        barn.setArea(area);
        barn.setName("Nhà Push A1");
        barn.setNameKey("nhà push a1");
        barn.setStatus(BarnStatus.ACTIVE);
        barn.setCapacity(1000);
        barn.setCurrentQuantity(500);
        barn.setWorkersOverride(false);
        assignedBarn = barnRepository.save(barn);

        when(deliveryClient.send(anyString(), anyString(), anyString(), anyString())).thenReturn(201);
    }

    private Account ensureAccount(String email, String fullName, Role role) {
        return accountRepository.findByEmail(email).orElseGet(() -> {
            Account a = new Account();
            a.setEmail(email);
            a.setPassword("$2a$10$dummy");
            a.setFullName(fullName);
            a.setRole(role);
            a.setIsActive(true);
            return accountRepository.save(a);
        });
    }

    private String jwtFor(String email, String role) {
        return jwtProvider.generateToken(new UsernamePasswordAuthenticationToken(
                email, null, List.of(new SimpleGrantedAuthority(role))
        ));
    }

    @Test
    void testGetVapidPublicKey_ReturnsValidBase64UrlKey() throws Exception {
        mockMvc.perform(get("/api/push/vapid-public-key"))
                .andExpect(status().isForbidden());

        String body = mockMvc.perform(get("/api/push/vapid-public-key")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicKey").isString())
                .andExpect(jsonPath("$.publicKey", not(emptyString())))
                .andReturn().getResponse().getContentAsString();

        assertTrue(body.contains("\"publicKey\""));

        // Verify the auto-generated keypair works for genuine RFC 8291 Push encryption
        String publicKey = com.fasterxml.jackson.databind.json.JsonMapper.builder().build()
                .readTree(body).get("publicKey").asText();
        byte[] decoded = Base64.getUrlDecoder().decode(publicKey);
        assertEquals(65, decoded.length, "Uncompressed P-256 public key must be 65 bytes");
        assertEquals((byte) 0x04, decoded[0], "Uncompressed EC point must start with 0x04");

        Notification realEncrypted = new Notification(
                "https://fcm.googleapis.com/fcm/send/sample",
                SAMPLE_P256DH,
                SAMPLE_AUTH,
                "{\"title\":\"Test\"}".getBytes(StandardCharsets.UTF_8)
        );
        assertDoesNotThrow(() -> pushService.preparePost(realEncrypted, nl.martijndwars.webpush.Encoding.AES128GCM));
    }

    @Test
    void testSubscribeAndCheckStatus_PersistsSubscriptionForAuthenticatedUser() throws Exception {
        String endpoint = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
        String json = """
                {
                  "endpoint": "%s",
                  "keys": {
                    "p256dh": "%s",
                    "auth": "%s"
                  },
                  "userAgent": "Android Chrome Mobile"
                }
                """.formatted(endpoint, SAMPLE_P256DH, SAMPLE_AUTH);

        mockMvc.perform(post("/api/push/subscribe")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(true))
                .andExpect(jsonPath("$.id").isNumber());

        // Upsert idempotency: subscribing same endpoint again updates rather than duplicates
        mockMvc.perform(post("/api/push/subscribe")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(true));

        mockMvc.perform(get("/api/push/status")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasActiveSubscription").value(true))
                .andExpect(jsonPath("$.deviceCount").value(1));
    }

    @Test
    void testUnsubscribe_DeactivatesSubscription() throws Exception {
        String endpoint = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
        subscribeAccount(ownerToken, endpoint);

        mockMvc.perform(post("/api/push/unsubscribe")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"" + endpoint + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(false));

        mockMvc.perform(get("/api/push/status")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasActiveSubscription").value(false))
                .andExpect(jsonPath("$.deviceCount").value(0));

        PushSubscription saved = subscriptionRepository.findByEndpoint(endpoint).orElseThrow();
        assertFalse(saved.isActive());
    }

    @Test
    void testTriggerTestPush_ExecutesCleanlyForSubscribedUser() throws Exception {
        String endpoint = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
        subscribeAccount(ownerToken, endpoint);

        mockMvc.perform(post("/api/push/test")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Demo Test\",\"body\":\"Xin chào Mobile\",\"url\":\"/iot\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sentCount").value(1))
                .andExpect(jsonPath("$.message").value("Đã gửi thông báo thử nghiệm tới thiết bị của bạn."));

        verify(deliveryClient, times(1)).send(
                eq(endpoint),
                eq(SAMPLE_P256DH),
                eq(SAMPLE_AUTH),
                contains("Demo Test")
        );
    }

    @Test
    void testDeadSubscriptionCleanup_DeactivatesOnHttp410Gone() throws Exception {
        String endpoint = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
        subscribeAccount(ownerToken, endpoint);
        when(deliveryClient.send(eq(endpoint), anyString(), anyString(), anyString())).thenReturn(410);

        mockMvc.perform(post("/api/push/test")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sentCount").value(0));

        PushSubscription updated = subscriptionRepository.findByEndpoint(endpoint).orElseThrow();
        assertFalse(updated.isActive(), "HTTP 410 Gone must automatically deactivate subscription");
    }

    @Test
    void testIoTAlert_DispatchesToOwnersAndAssignedBarnWorkersOnly() throws Exception {
        String ownerEndpoint = "https://fcm.googleapis.com/fcm/send/owner-" + UUID.randomUUID();
        String worker1Endpoint = "https://fcm.googleapis.com/fcm/send/worker1-" + UUID.randomUUID();
        String worker2Endpoint = "https://fcm.googleapis.com/fcm/send/worker2-" + UUID.randomUUID();

        subscribeAccount(ownerToken, ownerEndpoint);
        subscribeAccount(assignedWorkerToken, worker1Endpoint);
        subscribeAccount(otherWorkerToken, worker2Endpoint);

        String alertBody = """
                {
                  "barnId": %d,
                  "title": "Cảnh báo nhiệt độ Nhà Push A1",
                  "body": "Nhiệt độ đạt 35.5°C vượt ngưỡng an toàn",
                  "severity": "CRITICAL"
                }
                """.formatted(assignedBarn.getId());

        // Unassigned worker must be blocked by RBAC (403)
        mockMvc.perform(post("/api/push/iot-alert")
                        .header("Authorization", "Bearer " + otherWorkerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(alertBody))
                .andExpect(status().isForbidden());

        // Assigned worker succeeds and triggers async dispatch to Owner + Assigned Worker (never worker2)
        mockMvc.perform(post("/api/push/iot-alert")
                        .header("Authorization", "Bearer " + assignedWorkerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(alertBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dispatched").value(true));

        verify(deliveryClient, timeout(3000)).send(eq(ownerEndpoint), anyString(), anyString(), contains("35.5"));
        verify(deliveryClient, timeout(3000)).send(eq(worker1Endpoint), anyString(), anyString(), contains("35.5"));
        verify(deliveryClient, after(200).never()).send(eq(worker2Endpoint), anyString(), anyString(), anyString());
    }

    private void subscribeAccount(String token, String endpoint) throws Exception {
        String body = """
                {
                  "endpoint": "%s",
                  "keys": {
                    "p256dh": "%s",
                    "auth": "%s"
                  }
                }
                """.formatted(endpoint, SAMPLE_P256DH, SAMPLE_AUTH);
        mockMvc.perform(post("/api/push/subscribe")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }
}
