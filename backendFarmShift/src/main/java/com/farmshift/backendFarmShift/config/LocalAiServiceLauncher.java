package com.farmshift.backendFarmShift.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import java.net.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Development-only child process. Never stops an AI server that was started elsewhere. */
@Slf4j
@Component
@Profile("local & !test")
@ConditionalOnProperty(name="ai-service.autostart.enabled", havingValue="true", matchIfMissing=true)
public class LocalAiServiceLauncher {
    private final URI endpoint;
    private final Path directory;
    private final String python;
    private final int timeoutSeconds;
    private final ObjectMapper mapper;
    private Process ownedProcess;
    private boolean closing;

    public LocalAiServiceLauncher(ObjectMapper mapper,
            @Value("${ai-service.url:http://localhost:8000}") String url,
            @Value("${ai-service.autostart.directory:}") String configuredDirectory,
            @Value("${ai-service.autostart.python:}") String configuredPython,
            @Value("${ai-service.autostart.timeout-seconds:45}") int timeoutSeconds) {
        this.mapper = mapper;
        this.endpoint = URI.create(url.replaceAll("/+$", ""));
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        Path inferred = Files.isDirectory(cwd.resolve("aiServiceFarmShift")) ? cwd.resolve("aiServiceFarmShift") : cwd.resolve("../aiServiceFarmShift");
        this.directory = (configuredDirectory.isBlank() ? inferred : Path.of(configuredDirectory)).toAbsolutePath().normalize();
        this.python = resolvePython(directory, configuredPython);
        this.timeoutSeconds = Math.max(1, Math.min(timeoutSeconds, 300));
    }

    static String resolvePython(Path directory, String configured) {
        if (!configured.isBlank()) return configured;
        boolean windows = System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("win");
        for (String environment : List.of("venv", ".venv")) {
            Path candidate = directory.resolve(environment).resolve(windows ? "Scripts/python.exe" : "bin/python");
            if (Files.isRegularFile(candidate)) return candidate.toString();
        }
        return windows ? "python" : "python3";
    }

    boolean healthy() {
        try {
            var connection = (HttpURLConnection) endpoint.resolve(endpoint.getPath() + "/health").toURL().openConnection();
            connection.setConnectTimeout(800); connection.setReadTimeout(800);
            try {
                if (connection.getResponseCode() != 200) return false;
                try (var input = connection.getInputStream()) {
                    var response = mapper.readTree(input);
                    return "healthy".equals(response.path("status").asText()) && response.has("ocr_engine");
                }
            } finally { connection.disconnect(); }
        } catch (Exception ignored) { return false; }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (!"http".equals(endpoint.getScheme()) || !List.of("localhost", "127.0.0.1", "[::1]", "::1").contains(endpoint.getHost())
                || !(endpoint.getPath().isEmpty() || endpoint.getPath().equals("/"))) {
            log.info("AI autostart skipped: AI_SERVICE_URL is not a local root HTTP address."); return;
        }
        synchronized (this) {
            if (closing || (ownedProcess != null && ownedProcess.isAlive())) return;
            if (healthy()) { log.info("AI service already running at {}; reusing without taking ownership.", endpoint); return; }
            if (!Files.isRegularFile(directory.resolve("main.py"))) {
                log.warn("AI service folder not found at {}. Configure AI_SERVICE_DIRECTORY.", directory); return;
            }
            try {
                Path logDirectory = Path.of(System.getProperty("user.dir")).resolve("target");
                Files.createDirectories(logDirectory);
                int port = endpoint.getPort() == -1 ? 80 : endpoint.getPort();
                var builder = new ProcessBuilder(python, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String.valueOf(port))
                        .directory(directory.toFile()).redirectErrorStream(true)
                        .redirectOutput(ProcessBuilder.Redirect.appendTo(logDirectory.resolve("ai-service.log").toFile()));
                builder.environment().put("PYTHONUNBUFFERED", "1");
                ownedProcess = builder.start();
                log.info("Starting local AI service; logs: {}", logDirectory.resolve("ai-service.log"));
            } catch (Exception ex) {
                log.warn("Could not launch AI service. Check Python/venv and requirements.txt: {}", ex.getMessage()); return;
            }
        }
        long deadline = System.nanoTime() + Duration.ofSeconds(timeoutSeconds).toNanos();
        while (System.nanoTime() < deadline) {
            synchronized (this) { if (closing || ownedProcess == null || !ownedProcess.isAlive()) break; }
            if (healthy()) { log.info("Local AI service is ready at {}", endpoint); return; }
            try { Thread.sleep(300); }
            catch (InterruptedException ex) { Thread.currentThread().interrupt(); break; }
        }
        log.warn("Local AI service is not ready. Check target/ai-service.log and install Python requirements in its venv.");
        stopOwnedProcess();
    }

    private synchronized void stopOwnedProcess() {
        if (ownedProcess == null) return;
        var children = ownedProcess.descendants().toList();
        children.forEach(ProcessHandle::destroy);
        ownedProcess.destroy();
        try {
            if (!ownedProcess.waitFor(3, TimeUnit.SECONDS)) ownedProcess.destroyForcibly();
        } catch (InterruptedException ex) { Thread.currentThread().interrupt(); ownedProcess.destroyForcibly(); }
        children.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
        ownedProcess = null;
    }
    @PreDestroy
    public synchronized void stop() { closing = true; stopOwnedProcess(); }
}
