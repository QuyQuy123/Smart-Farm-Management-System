package com.farmshift.backendFarmShift.service;

import lombok.RequiredArgsConstructor;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

public interface WebPushDeliveryClient {
    int send(String endpoint, String p256dhKey, String authKey, String payloadJson) throws Exception;
}

@Component
@RequiredArgsConstructor
class DefaultWebPushDeliveryClient implements WebPushDeliveryClient {

    private final PushService pushService;

    @Override
    public int send(String endpoint, String p256dhKey, String authKey, String payloadJson) throws Exception {
        Notification notification = new Notification(
                endpoint,
                p256dhKey,
                authKey,
                payloadJson.getBytes(StandardCharsets.UTF_8)
        );
        HttpResponse response = pushService.send(notification);
        return response != null && response.getStatusLine() != null
                ? response.getStatusLine().getStatusCode()
                : 201;
    }
}
