package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.service.AssistantNavigationRouter;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AiRbacPolicy;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Tier 1: Pure Screen Navigation Command Handler (<5ms execution, 0 LLM tokens).
 * Resolves natural language commands like "mở ghi nhật ký", "xem báo cáo", "qua kho hàng".
 */
@Slf4j
@Component
@Order(10)
public class NavigationCommandHandler implements AssistantCommandHandler {

    @Autowired(required = false)
    private BarnRepository barnRepository;

    @Autowired(required = false)
    private WorkAssignmentService workAssignmentService;

    private static final Set<String> OWNER_ONLY_ROUTES = Set.of(
            "/iot", "/account", "/catalog-settings", "/breeding-settings", "/general-settings"
    );
    private static final Set<String> FINANCE_ROUTES = Set.of(
            "/dashboard", "/inventory", "/purchases", "/sales", "/reports"
    );
    private static final Set<String> FARM_OPS_ROUTES = Set.of(
            "/barns", "/today-tasks", "/journal"
    );

    @Override
    public int getOrder() {
        return 10;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            return false;
        }
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(context.getMessage());
        return AssistantNavigationRouter.resolve(norm) != null;
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(context.getMessage());
        if (context.isWorker() && barnRepository != null && workAssignmentService != null) {
            Barn mentionedBarn = findMentionedBarn(norm);
            if (mentionedBarn != null && !workAssignmentService.barnIdsOf(context.getUsername()).contains(mentionedBarn.getId())) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Bạn chỉ có thể ghi nhận hoặc tra cứu dữ liệu cho các chuồng được phân công cho mình. Chuồng **"
                                + mentionedBarn.getName() + "** nằm ngoài phạm vi phân công (MSG51).")
                        .actionType("BARN_NOT_ASSIGNED")
                        .executed(false)
                        .build();
            }
        }
        AssistantNavigationRouter.Route route = AssistantNavigationRouter.resolve(norm);
        if (route == null) {
            return null;
        }

        AiAssistantResponse rbacDenied = enforceRouteRbac(route.path(), context);
        if (rbacDenied != null) {
            return rbacDenied;
        }

        Map<String, Object> navSummary = new LinkedHashMap<>();
        navSummary.put("title", "Điều hướng nhanh");
        navSummary.put("detail", "Đã mở màn hình " + route.label() + ".");
        navSummary.put("timestamp", LocalDateTime.now(CycleService.VN_ZONE).toString());

        return AiAssistantResponse.builder()
                .reply("Đang mở màn hình **" + route.label() + "**.")
                .actionType("NAVIGATE_AND_PREFILL")
                .executed(true)
                .navigateTo(route.path())
                .actionSummary(navSummary)
                .build();
    }

    public static AiAssistantResponse enforceRouteRbac(String path, AssistantExecutionContext context) {
        if (path == null || context == null) {
            return null;
        }
        boolean isWorker = context.isWorker() || hasAuthority(context, "ROLE_FARM_WORKER");
        boolean isAccountant = hasAuthority(context, "ROLE_ACCOUNTANT");
        boolean isOwner = !isWorker && !isAccountant
                && (hasAuthority(context, "ROLE_FARM_OWNER") || hasAuthority(context, "ROLE_ADMIN"));
        return enforceRouteRbac(path, isWorker, isAccountant, isOwner);
    }

    public static AiAssistantResponse enforceRouteRbac(String path, boolean isWorker, boolean isAccountant, boolean isOwner) {
        if (path == null) {
            return null;
        }
        if (OWNER_ONLY_ROUTES.contains(path)) {
            if (!isOwner) {
                return isWorker
                        ? AiRbacPolicy.createForbiddenResponse()
                        : AiRbacPolicy.createAccountantForbiddenResponse();
            }
            return null;
        }
        if (FINANCE_ROUTES.contains(path)) {
            if (isWorker || (!isOwner && !isAccountant)) {
                return AiRbacPolicy.createForbiddenResponse();
            }
            return null;
        }
        if (FARM_OPS_ROUTES.contains(path)) {
            if (isAccountant || (!isOwner && !isWorker)) {
                return AiRbacPolicy.createAccountantForbiddenResponse();
            }
        }
        return null;
    }

    private Barn findMentionedBarn(String norm) {
        if (norm == null || norm.isBlank() || barnRepository == null) {
            return null;
        }
        String normCompact = norm.replaceAll("\\b([a-z])\\s+(\\d+)\\b", "$1$2");
        List<Barn> barns = new ArrayList<>(barnRepository.findAll());
        barns.sort((b1, b2) -> Integer.compare(b2.getName().length(), b1.getName().length()));
        for (Barn b : barns) {
            if (b.getName() == null) continue;
            String bNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(b.getName())
                    .toLowerCase(Locale.ROOT)
                    .replaceAll("\\b([a-z])\\s+(\\d+)\\b", "$1$2");
            if (normCompact.matches(".*\\b" + Pattern.quote(bNorm) + "\\b.*")) {
                return b;
            }
            String shortCode = bNorm.replace("nha", "").replace("chuong", "").trim();
            if (!shortCode.isBlank() && !shortCode.matches("\\d+")
                    && normCompact.matches(".*\\b" + Pattern.quote(shortCode) + "\\b.*")) {
                return b;
            }
        }
        return null;
    }

    private static boolean hasAuthority(AssistantExecutionContext context, String expected) {
        if (context.getAuthorities() == null) {
            return false;
        }
        for (GrantedAuthority auth : context.getAuthorities()) {
            if (auth != null && expected.equalsIgnoreCase(auth.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}

