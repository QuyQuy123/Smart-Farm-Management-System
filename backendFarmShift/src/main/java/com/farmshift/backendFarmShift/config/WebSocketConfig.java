package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.security.AccountAuthStateService;
import com.farmshift.backendFarmShift.security.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

/**
 * Configures STOMP over WebSocket at {@code /api/ws} with JWT authentication on CONNECT
 * and 20s heartbeats so connections stay alive behind Nginx, Render, and cloud proxies.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final long HEARTBEAT_INTERVAL_MS = 20_000L;

    private final JwtProvider jwtProvider;
    private final CorsOriginsProperties corsOrigins;

    @Autowired(required = false)
    private AccountAuthStateService accountAuthStateService;

    @Bean(destroyMethod = "shutdown")
    public ThreadPoolTaskScheduler wsHeartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/api/ws")
                .setAllowedOriginPatterns(corsOrigins.combinedOriginPatternsArray());
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic")
                .setHeartbeatValue(new long[]{HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS})
                .setTaskScheduler(wsHeartbeatScheduler());
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) {
                    return message;
                }
                StompCommand command = accessor.getCommand();
                if (StompCommand.CONNECT.equals(command)) {
                    String token = extractBearerToken(accessor);
                    if (!StringUtils.hasText(token) || !jwtProvider.validateToken(token)) {
                        throw new IllegalArgumentException("Phiên kết nối WebSocket không hợp lệ hoặc đã hết hạn.");
                    }
                    String email = jwtProvider.getEmailFromToken(token);
                    List<String> tokenRoles = jwtProvider.getRolesFromToken(token);
                    Long issuedAtMs = jwtProvider.getIssuedAtMillisFromToken(token);
                    List<String> effectiveRoles = tokenRoles;
                    if (accountAuthStateService != null) {
                        effectiveRoles = accountAuthStateService.resolveAuthorizedRoles(email, issuedAtMs, tokenRoles)
                                .orElseThrow(() -> new IllegalArgumentException("Tài khoản đã bị vô hiệu hóa hoặc phiên đã bị thu hồi."));
                    }
                    List<SimpleGrantedAuthority> authorities = (effectiveRoles != null ? effectiveRoles : List.<String>of()).stream()
                            .map(SimpleGrantedAuthority::new)
                            .toList();
                    accessor.setUser(new UsernamePasswordAuthenticationToken(email, null, authorities));
                } else if (StompCommand.SEND.equals(command)) {
                    throw new IllegalArgumentException("Kênh WebSocket chỉ hỗ trợ nhận đồng bộ từ máy chủ.");
                } else if (StompCommand.SUBSCRIBE.equals(command)) {
                    if (accessor.getUser() == null) {
                        throw new IllegalArgumentException("Chưa xác thực kết nối WebSocket.");
                    }
                    if (!"/topic/farm-updates".equals(accessor.getDestination())) {
                        throw new IllegalArgumentException("Không có quyền đăng ký kênh WebSocket này.");
                    }
                }
                return message;
            }
        });
    }

    private static String extractBearerToken(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (!StringUtils.hasText(header)) {
            header = accessor.getFirstNativeHeader("authorization");
        }
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7).trim();
        }
        return StringUtils.hasText(header) ? header.trim() : null;
    }
}
