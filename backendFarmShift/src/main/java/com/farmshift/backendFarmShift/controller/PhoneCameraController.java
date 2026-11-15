package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.repository.BarnRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.Principal;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/phone-camera")
public class PhoneCameraController {
    private static final int MAX_FRAME_BYTES = 200_000;
    private static final long SESSION_MS = Duration.ofHours(8).toMillis();
    private static final long FRAME_MS = Duration.ofSeconds(5).toMillis();
    private final BarnRepository barns;
    private final Map<CameraKey, Session> cameras = new ConcurrentHashMap<>();

    public PhoneCameraController(BarnRepository barns) {
        this.barns = barns;
    }

    private record CameraKey(String owner, long barn) {}
    private record Frame(byte[] image, long receivedAt) {}
    private static final class Session {
        final String token = UUID.randomUUID().toString();
        final long expiresAt = System.currentTimeMillis() + SESSION_MS;
        volatile Frame frame;
    }

    @PostMapping("/{barn}")
    public Map<String, String> pair(@PathVariable long barn, Principal owner) {
        if (!barns.existsById(barn)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        cameras.values().removeIf(session -> session.expiresAt <= System.currentTimeMillis());
        Session session = cameras.computeIfAbsent(new CameraKey(owner.getName(), barn), key -> new Session());
        return Map.of("token", session.token);
    }

    @DeleteMapping("/{barn}")
    public ResponseEntity<Void> stop(@PathVariable long barn, Principal owner) {
        cameras.remove(new CameraKey(owner.getName(), barn));
        return ResponseEntity.noContent().build();
    }

    @PutMapping(value = "/publish/{token}", consumes = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<Void> publish(@PathVariable String token, HttpServletRequest request) throws IOException {
        Session session = cameras.values().stream()
                .filter(camera -> camera.token.equals(token) && camera.expiresAt > System.currentTimeMillis())
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        byte[] image = request.getInputStream().readNBytes(MAX_FRAME_BYTES + 1);
        if (image.length > MAX_FRAME_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        if (image.length < 4 || image[0] != (byte) 0xff || image[1] != (byte) 0xd8
                || image[image.length - 2] != (byte) 0xff || image[image.length - 1] != (byte) 0xd9) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        session.frame = new Frame(image, System.currentTimeMillis());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{barn}/frame")
    public ResponseEntity<byte[]> frame(@PathVariable long barn, Principal owner) {
        Session session = cameras.get(new CameraKey(owner.getName(), barn));
        Frame frame = session == null ? null : session.frame;
        long now = System.currentTimeMillis();
        if (frame == null || session.expiresAt <= now || now - frame.receivedAt() > FRAME_MS) {
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_JPEG)
                .header("X-Content-Type-Options", "nosniff").body(frame.image());
    }
}
