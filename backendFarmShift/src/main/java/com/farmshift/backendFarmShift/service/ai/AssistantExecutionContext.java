package com.farmshift.backendFarmShift.service.ai;

import lombok.Builder;
import lombok.Data;
import org.springframework.security.core.GrantedAuthority;

import java.util.*;

@Data
@Builder
public class AssistantExecutionContext {
    private String message;
    private String rawMessage;
    private String currentRoute;
    private String username;
    private Collection<? extends GrantedAuthority> authorities;
    private boolean isWorker;
    private boolean autoExecute;
    @Builder.Default
    private List<Map<String, String>> history = new ArrayList<>();
    private Map<String, Object> lastActionContext;
    private Map<String, Object> pendingActionPayload;
    private Boolean confirmAction;

    public boolean isWorker() {
        return isWorker;
    }

    public boolean isOwner() {
        if (authorities == null) return false;
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().contains("OWNER") || a.getAuthority().contains("ADMIN"));
    }

    public boolean isAccountant() {
        if (authorities == null) return false;
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().contains("ACCOUNTANT"));
    }
}

