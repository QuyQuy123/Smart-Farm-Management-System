package com.farmshift.backendFarmShift.config;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.bouncycastle.util.BigIntegers;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.Security;
import java.util.Base64;

/**
 * Configures RFC 8292 VAPID keys and BouncyCastle provider for Web Push notifications.
 * When VAPID environment variables are empty (local dev or automated tests), derives a
 * deterministic ECDSA P-256 keypair so browser subscriptions remain valid across restarts.
 */
@Slf4j
@Configuration
@Getter
public class WebPushConfig {

    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public WebPushConfig(
            @Value("${farmshift.webpush.public-key:}") String configuredPublicKey,
            @Value("${farmshift.webpush.private-key:}") String configuredPrivateKey,
            @Value("${farmshift.webpush.subject:mailto:admin@farmshift.vn}") String configuredSubject,
            @Value("${jwt.secret:farmshift-local-vapid-seed}") String fallbackSeed
    ) {
        ensureBouncyCastleProvider();
        String trimmedPub = configuredPublicKey == null ? "" : configuredPublicKey.trim();
        String trimmedPriv = configuredPrivateKey == null ? "" : configuredPrivateKey.trim();
        this.subject = configuredSubject == null || configuredSubject.isBlank()
                ? "mailto:admin@farmshift.vn"
                : configuredSubject.trim();

        if (!trimmedPub.isEmpty() && !trimmedPriv.isEmpty()) {
            this.publicKey = trimmedPub;
            this.privateKey = trimmedPriv;
            log.info("Loaded configured VAPID public key for Web Push ({}...)",
                    trimmedPub.substring(0, Math.min(12, trimmedPub.length())));
        } else {
            KeyPairEncoded generated = generateDeterministicP256KeyPair(fallbackSeed);
            this.publicKey = generated.publicKey();
            this.privateKey = generated.privateKey();
            log.info("Auto-generated deterministic local/test VAPID keypair. Public Key: {}", this.publicKey);
        }
    }

    @Bean
    public PushService pushService() throws GeneralSecurityException {
        Utils.loadPublicKey(publicKey);
        Utils.loadPrivateKey(privateKey);
        return new PushService(publicKey, privateKey, subject);
    }

    private static void ensureBouncyCastleProvider() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private static KeyPairEncoded generateDeterministicP256KeyPair(String seed) {
        try {
            ECNamedCurveParameterSpec spec = ECNamedCurveTable.getParameterSpec("prime256v1");
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("farmshift-vapid:" + seed).getBytes(StandardCharsets.UTF_8));
            BigInteger n = spec.getN();
            BigInteger d = new BigInteger(1, digest)
                    .mod(n.subtract(BigInteger.ONE))
                    .add(BigInteger.ONE);

            byte[] privBytes = BigIntegers.asUnsignedByteArray(32, d);
            byte[] pubBytes = spec.getG().multiply(d).normalize().getEncoded(false);

            Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
            return new KeyPairEncoded(
                    encoder.encodeToString(pubBytes),
                    encoder.encodeToString(privBytes)
            );
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể khởi tạo cặp khóa VAPID Web Push", ex);
        }
    }

    private record KeyPairEncoded(String publicKey, String privateKey) {}
}
