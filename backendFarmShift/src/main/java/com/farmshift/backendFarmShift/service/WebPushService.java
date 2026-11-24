package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.config.AsyncConfig;
import com.farmshift.backendFarmShift.config.WebPushConfig;
import com.farmshift.backendFarmShift.dto.request.PushPreferencesRequest;
import com.farmshift.backendFarmShift.dto.request.PushSubscribeRequest;
import com.farmshift.backendFarmShift.dto.request.PushTestRequest;
import com.farmshift.backendFarmShift.dto.response.PushPayloadDto;
import com.farmshift.backendFarmShift.dto.response.PushPreferencesResponse;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.PushSubscription;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.PushSubscriptionRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@Transactional(readOnly = true)
public class WebPushService {

    private final PushSubscriptionRepository subscriptionRepository;
    private final AccountRepository accountRepository;
    private final BarnResponsibilityService barnResponsibilityService;
    private final WebPushConfig webPushConfig;
    private final WebPushDeliveryClient deliveryClient;
    private final ObjectMapper objectMapper;
    private final TaskExecutor pushExecutor;

    public WebPushService(
            PushSubscriptionRepository subscriptionRepository,
            AccountRepository accountRepository,
            BarnResponsibilityService barnResponsibilityService,
            WebPushConfig webPushConfig,
            WebPushDeliveryClient deliveryClient,
            ObjectMapper objectMapper,
            @Qualifier(AsyncConfig.SEARCH_EXECUTOR) TaskExecutor pushExecutor
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.accountRepository = accountRepository;
        this.barnResponsibilityService = barnResponsibilityService;
        this.webPushConfig = webPushConfig;
        this.deliveryClient = deliveryClient;
        this.objectMapper = objectMapper;
        this.pushExecutor = pushExecutor;
    }

    public String getVapidPublicKey() {
        return webPushConfig.getPublicKey();
    }

    @Transactional
    public PushSubscription subscribe(String userEmail, PushSubscribeRequest request) {
        Account account = requireAccount(userEmail);
        String endpoint = request.endpoint().trim();

        PushSubscription subscription = subscriptionRepository.findByEndpoint(endpoint)
                .orElseGet(PushSubscription::new);
        subscription.setAccount(account);
        subscription.setEndpoint(endpoint);
        subscription.setP256dhKey(request.keys().p256dh().trim());
        subscription.setAuthKey(request.keys().auth().trim());
        subscription.setUserAgent(cleanUserAgent(request.userAgent()));
        subscription.setActive(true);
        return subscriptionRepository.save(subscription);
    }

    @Transactional
    public void unsubscribe(String userEmail, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return;
        }
        Account account = requireAccount(userEmail);
        subscriptionRepository.findByEndpointAndAccount_Id(endpoint.trim(), account.getId())
                .ifPresent(sub -> {
                    sub.setActive(false);
                    subscriptionRepository.save(sub);
                });
    }

    public StatusResult status(String userEmail) {
        Account account = requireAccount(userEmail);
        long count = subscriptionRepository.countByAccount_IdAndActiveTrue(account.getId());
        return new StatusResult(count > 0, (int) count);
    }

    public PushPreferencesResponse getPreferences(String userEmail) {
        return toPreferencesResponse(requireAccount(userEmail));
    }

    @Transactional
    public PushPreferencesResponse updatePreferences(String userEmail, PushPreferencesRequest request) {
        Account account = requireAccount(userEmail);
        account.setNotifyInApp(Boolean.TRUE.equals(request.inAppEnabled()));
        account.setNotifyIotAlert(Boolean.TRUE.equals(request.iotAlertEnabled()));
        account.setNotifyTaskVaccine(Boolean.TRUE.equals(request.taskVaccineReminderEnabled()));
        if (isWorkerAccount(account)) {
            account.setNotifyDebtOverdue(false);
        } else if (request.debtReminderEnabled() != null) {
            account.setNotifyDebtOverdue(request.debtReminderEnabled());
        }
        return toPreferencesResponse(accountRepository.save(account));
    }

    @Transactional
    public TestPushResult sendTestNotification(String userEmail, PushTestRequest request) {
        Account account = requireAccount(userEmail);
        List<PushSubscription> subscriptions = subscriptionRepository.findAllByAccount_IdAndActiveTrue(account.getId());
        if (subscriptions.isEmpty()) {
            return new TestPushResult(0, "Tài khoản chưa đăng ký thiết bị nhận thông báo.");
        }

        String title = request != null && notBlank(request.title())
                ? request.title().trim()
                : "FarmShift · Kiểm tra thông báo đẩy";
        String body = request != null && notBlank(request.body())
                ? request.body().trim()
                : "Thiết bị của bạn đã kết nối thành công với hệ thống cảnh báo FarmShift.";
        String url = request != null && notBlank(request.url()) ? request.url().trim() : "/iot";
        String tag = request != null && notBlank(request.tag()) ? request.tag().trim() : "farmshift-test-push";
        String severity = request != null && notBlank(request.severity()) ? request.severity().trim() : "INFO";

        PushPayloadDto payload = PushPayloadDto.of(title, body, tag, url, severity);
        String payloadJson = serializePayload(payload);

        int sent = 0;
        for (PushSubscription sub : subscriptions) {
            if (deliverSingle(toSnapshot(sub), payloadJson)) {
                sent++;
            }
        }
        String message = sent > 0
                ? "Đã gửi thông báo thử nghiệm tới thiết bị của bạn."
                : "Không thể gửi tới thiết bị đã đăng ký. Vui lòng bật lại thông báo ĐT.";
        return new TestPushResult(sent, message);
    }

    public void sendToAccount(Long accountId, PushPayloadDto payload) {
        sendToAccount(accountId, payload, NotificationCategory.GENERAL);
    }

    public void sendToAccount(Long accountId, PushPayloadDto payload, NotificationCategory category) {
        if (accountId == null || payload == null) return;
        if (category != null && category != NotificationCategory.GENERAL) {
            Account account = accountRepository.findById(accountId).orElse(null);
            if (!isPreferenceEnabled(account, category)) {
                return;
            }
        }
        List<SubscriptionSnapshot> targets = subscriptionRepository.findAllByAccount_IdAndActiveTrue(accountId)
                .stream()
                .map(WebPushService::toSnapshot)
                .toList();
        dispatchAsync(targets, payload);
    }

    public void sendToAccounts(Collection<Account> recipients, PushPayloadDto payload, NotificationCategory category) {
        if (recipients == null || recipients.isEmpty() || payload == null) return;
        Set<Long> eligibleAccountIds = new LinkedHashSet<>();
        for (Account account : recipients) {
            if (isPreferenceEnabled(account, category) && account.getId() != null) {
                eligibleAccountIds.add(account.getId());
            }
        }
        if (eligibleAccountIds.isEmpty()) return;

        List<SubscriptionSnapshot> targets = subscriptionRepository
                .findAllByAccount_IdInAndActiveTrue(eligibleAccountIds)
                .stream()
                .map(WebPushService::toSnapshot)
                .toList();
        dispatchAsync(targets, payload);
    }

    public void sendIoTAlertToAuthorizedUsers(Barn barn, String title, String body) {
        String url = barn != null && barn.getId() != null ? "/iot?barn=" + barn.getId() : "/iot";
        sendIoTAlertToAuthorizedUsers(barn, title, body, "CRITICAL", url);
    }

    public void sendIoTAlertToAuthorizedUsers(Barn barn, String title, String body, String severity, String url) {
        if (barn == null || barn.getId() == null) return;

        List<Account> recipients = new ArrayList<>();
        recipients.addAll(accountRepository.findAllByRole_NameAndIsActiveTrueOrderByFullNameAsc(RoleNames.FARM_OWNER));
        recipients.addAll(barnResponsibilityService.workersOf(barn.getId()));
        if (recipients.isEmpty()) return;

        PushPayloadDto payload = PushPayloadDto.of(
                title,
                body,
                "iot-alert-barn-" + barn.getId(),
                notBlank(url) ? url : "/iot?barn=" + barn.getId(),
                notBlank(severity) ? severity : "CRITICAL"
        );
        sendToAccounts(recipients, payload, NotificationCategory.IOT_ALERT);
    }

    private void dispatchAsync(List<SubscriptionSnapshot> targets, PushPayloadDto payload) {
        if (targets.isEmpty()) return;
        String payloadJson = serializePayload(payload);
        CompletableFuture.runAsync(() -> {
            for (SubscriptionSnapshot target : targets) {
                deliverSingle(target, payloadJson);
            }
        }, pushExecutor);
    }

    private boolean deliverSingle(SubscriptionSnapshot sub, String payloadJson) {
        try {
            int status = deliveryClient.send(sub.endpoint(), sub.p256dhKey(), sub.authKey(), payloadJson);
            if (status == 404 || status == 410) {
                deactivateSubscription(sub.id());
                return false;
            }
            if (status >= 400) {
                log.warn("Web Push service returned status {} for subscription {}", status, sub.id());
                return false;
            }
            return true;
        } catch (Exception ex) {
            log.warn("Failed to deliver Web Push notification to subscription {}: {}", sub.id(), ex.getMessage());
            return false;
        }
    }

    protected void deactivateSubscription(Long subscriptionId) {
        if (subscriptionId == null) return;
        subscriptionRepository.findById(subscriptionId).ifPresent(sub -> {
            sub.setActive(false);
            subscriptionRepository.save(sub);
            log.info("Deactivated expired/gone Web Push subscription id={}", subscriptionId);
        });
    }

    private String serializePayload(PushPayloadDto payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tuần tự hóa dữ liệu thông báo đẩy.", ex);
        }
    }

    private Account requireAccount(String email) {
        return accountRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản người dùng."));
    }

    private static SubscriptionSnapshot toSnapshot(PushSubscription sub) {
        return new SubscriptionSnapshot(sub.getId(), sub.getEndpoint(), sub.getP256dhKey(), sub.getAuthKey());
    }

    private static String cleanUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return null;
        String trimmed = userAgent.trim();
        return trimmed.length() > 500 ? trimmed.substring(0, 500) : trimmed;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    public static boolean isPreferenceEnabled(Account account, NotificationCategory category) {
        if (account == null || Boolean.FALSE.equals(account.getIsActive())) {
            return false;
        }
        if (category == null || category == NotificationCategory.GENERAL) {
            return true;
        }
        return switch (category) {
            case IOT_ALERT -> !Boolean.FALSE.equals(account.getNotifyIotAlert());
            case TASK_VACCINE -> !Boolean.FALSE.equals(account.getNotifyTaskVaccine());
            case DEBT_OVERDUE -> !isWorkerAccount(account) && !Boolean.FALSE.equals(account.getNotifyDebtOverdue());
            case GENERAL -> true;
        };
    }

    private static boolean isWorkerAccount(Account account) {
        return account != null && account.getRole() != null
                && RoleNames.FARM_WORKER.equals(account.getRole().getName());
    }

    private static PushPreferencesResponse toPreferencesResponse(Account account) {
        boolean isWorker = isWorkerAccount(account);
        return new PushPreferencesResponse(
                !Boolean.FALSE.equals(account.getNotifyInApp()),
                !Boolean.FALSE.equals(account.getNotifyIotAlert()),
                !Boolean.FALSE.equals(account.getNotifyTaskVaccine()),
                !isWorker && !Boolean.FALSE.equals(account.getNotifyDebtOverdue())
        );
    }

    public enum NotificationCategory {
        IOT_ALERT,
        TASK_VACCINE,
        DEBT_OVERDUE,
        GENERAL
    }

    public record StatusResult(boolean hasActiveSubscription, int deviceCount) {}
    public record TestPushResult(int sentCount, String message) {}
    private record SubscriptionSnapshot(Long id, String endpoint, String p256dhKey, String authKey) {}
}
