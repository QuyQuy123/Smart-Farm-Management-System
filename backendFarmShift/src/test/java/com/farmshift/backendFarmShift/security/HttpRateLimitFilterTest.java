package com.farmshift.backendFarmShift.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class HttpRateLimitFilterTest {

    @Test
    void authEndpoint_blocksExcessiveRequestsFromSameIpWith429() throws Exception {
        HttpRateLimitFilter filter = new HttpRateLimitFilter(true);
        AtomicInteger passed = new AtomicInteger();
        FilterChain chain = (req, res) -> passed.incrementAndGet();

        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.setRemoteAddr("203.0.113.10");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
            assertThat(res.getStatus()).isEqualTo(200);
        }

        MockHttpServletRequest blockedReq = new MockHttpServletRequest("POST", "/api/auth/login");
        blockedReq.setRemoteAddr("203.0.113.10");
        MockHttpServletResponse blockedRes = new MockHttpServletResponse();
        filter.doFilter(blockedReq, blockedRes, chain);

        assertThat(passed.get()).isEqualTo(20);
        assertThat(blockedRes.getStatus()).isEqualTo(429);
        assertThat(blockedRes.getHeader("Retry-After")).isNotBlank();
        assertThat(blockedRes.getContentAsString()).contains("Quá nhiều yêu cầu");
    }

    @Test
    void rateLimit_isolatesDifferentIpsAndTiers() throws Exception {
        HttpRateLimitFilter filter = new HttpRateLimitFilter(true);
        FilterChain chain = (req, res) -> {};

        // Exhaust AUTH bucket for IP A
        for (int i = 0; i < 25; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.setRemoteAddr("198.51.100.1");
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }

        // Different IP on AUTH still passes
        MockHttpServletRequest otherIpReq = new MockHttpServletRequest("POST", "/api/auth/login");
        otherIpReq.setRemoteAddr("198.51.100.2");
        MockHttpServletResponse otherIpRes = new MockHttpServletResponse();
        filter.doFilter(otherIpReq, otherIpRes, chain);
        assertThat(otherIpRes.getStatus()).isEqualTo(200);

        // Same IP A hitting general API tier is still allowed within API quota
        MockHttpServletRequest apiReq = new MockHttpServletRequest("GET", "/api/dashboard");
        apiReq.setRemoteAddr("198.51.100.1");
        MockHttpServletResponse apiRes = new MockHttpServletResponse();
        filter.doFilter(apiReq, apiRes, chain);
        assertThat(apiRes.getStatus()).isEqualTo(200);
    }

    @Test
    void optionsPreflight_isNeverRateLimited() throws Exception {
        HttpRateLimitFilter filter = new HttpRateLimitFilter(true);
        FilterChain chain = (req, res) -> {};

        for (int i = 0; i < 40; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("OPTIONS", "/api/auth/login");
            req.setRemoteAddr("198.51.100.99");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
            assertThat(res.getStatus()).isEqualTo(200);
        }
    }
}

