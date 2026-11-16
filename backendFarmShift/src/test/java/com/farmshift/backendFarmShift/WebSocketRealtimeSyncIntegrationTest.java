package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.PurchaseTagRequest;
import com.farmshift.backendFarmShift.dto.response.RealtimeSyncEvent;
import com.farmshift.backendFarmShift.security.JwtProvider;
import com.farmshift.backendFarmShift.service.RealtimeSyncService;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class WebSocketRealtimeSyncIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    JwtProvider jwtProvider;

    @Autowired
    TestRestTemplate restTemplate;

    @Test
    void normalizeResourceMapsApiPathsConsistently() {
        assertEquals("/purchases", RealtimeSyncService.normalizeResource("/api/purchases/45/import-stock"));
        assertEquals("/sales", RealtimeSyncService.normalizeResource("/api/sales/orders/SO-001?foo=bar"));
        assertEquals("/cycles", RealtimeSyncService.normalizeResource("/api/cycles/12/daily-plan/tasks"));
        assertEquals("/work-tasks", RealtimeSyncService.normalizeResource("/api/work-tasks/8/checks"));
        assertEquals("/all", RealtimeSyncService.normalizeResource("/all"));
        assertEquals("/all", RealtimeSyncService.normalizeResource(""));
    }

    @Test
    void stompRejectsConnectionWithoutValidJwt() {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        try {
            String wsUrl = "ws://localhost:" + port + "/api/ws";
            StompHeaders badHeaders = new StompHeaders();
            badHeaders.add("Authorization", "Bearer invalid.jwt.token");

            assertThrows(Exception.class, () ->
                    client.connectAsync(wsUrl, (WebSocketHttpHeaders) null, badHeaders, new StompSessionHandlerAdapter() {})
                            .get(3, TimeUnit.SECONDS));
        } finally {
            client.stop();
        }
    }

    @Test
    void stompConnectsWithJwtAndReceivesLiveBroadcastOnHttpMutation() throws Exception {
        String token = jwtProvider.generateToken(new UsernamePasswordAuthenticationToken(
                "owner@farmshift.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_FARM_OWNER"))
        ));

        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        BlockingQueue<RealtimeSyncEvent> receivedEvents = new LinkedBlockingQueue<>();

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);

        String wsUrl = "ws://localhost:" + port + "/api/ws";
        StompSession session = client.connectAsync(
                wsUrl,
                (WebSocketHttpHeaders) null,
                connectHeaders,
                new StompSessionHandlerAdapter() {}
        ).get(5, TimeUnit.SECONDS);

        Long createdTagId = null;
        try {
            assertTrue(session.isConnected());

            session.subscribe(RealtimeSyncService.FARM_UPDATES_TOPIC, new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return RealtimeSyncEvent.class;
                }

                @Override
                public void handleFrame(StompHeaders headers, Object payload) {
                    if (payload instanceof RealtimeSyncEvent event) {
                        receivedEvents.offer(event);
                    }
                }
            });

            // Small pause so subscription registers on the simple broker before firing HTTP mutation
            Thread.sleep(150);

            HttpHeaders httpHeaders = new HttpHeaders();
            httpHeaders.setBearerAuth(token);
            httpHeaders.setContentType(MediaType.APPLICATION_JSON);
            httpHeaders.set("X-Client-Id", "sender_tab_ws_test");

            PurchaseTagRequest req = new PurchaseTagRequest(
                    "TagWS-" + UUID.randomUUID().toString().substring(0, 8),
                    "#019788",
                    "Test realtime WebSocket broadcast"
            );

            ResponseEntity<JsonNode> createRes = restTemplate.exchange(
                    "/api/purchase-tags",
                    HttpMethod.POST,
                    new HttpEntity<>(req, httpHeaders),
                    JsonNode.class
            );
            assertEquals(HttpStatus.CREATED, createRes.getStatusCode());
            if (createRes.getBody() != null && createRes.getBody().has("data")) {
                createdTagId = createRes.getBody().get("data").get("id").asLong();
            }

            RealtimeSyncEvent event = receivedEvents.poll(5, TimeUnit.SECONDS);
            assertNotNull(event, "Connected STOMP subscriber should receive live broadcast after HTTP POST");
            assertEquals("DATA_CHANGED", event.type());
            assertEquals("/purchase-tags", event.resource());
            assertEquals("POST", event.method());
            assertEquals("owner@farmshift.local", event.actor());
            assertEquals("sender_tab_ws_test", event.originClientId());
            assertNotNull(event.timestamp());
        } finally {
            if (createdTagId != null) {
                HttpHeaders deleteHeaders = new HttpHeaders();
                deleteHeaders.setBearerAuth(token);
                restTemplate.exchange(
                        "/api/purchase-tags/" + createdTagId,
                        HttpMethod.DELETE,
                        new HttpEntity<>(deleteHeaders),
                        Void.class
                );
            }
            if (session.isConnected()) {
                session.disconnect();
            }
            client.stop();
        }
    }
}
