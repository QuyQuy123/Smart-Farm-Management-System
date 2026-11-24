package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.AreaWarehouseService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AiRateLimiter;
import com.farmshift.backendFarmShift.service.ai.DynamicVietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.VoiceContextPromptBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
public class VoiceSttIntegrationTest {

    private static final String VOICE_TRANSCRIBE_API = "/api/ai/voice/transcribe";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Autowired BarnRepository barnRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;

    @Autowired WorkAssignmentService workAssignmentService;
    @Autowired VoiceContextPromptBuilder voiceContextPromptBuilder;
    @Autowired DynamicVietnameseSpeechNormalizer dynamicNormalizer;
    @Autowired AiRateLimiter rateLimiter;

    private Barn barnA1;
    private Barn barnB9;
    private WarehouseCategory areaAFeedWarehouse;
    private WarehouseCategory areaBFeedWarehouse;

    @BeforeEach
    void setUp() throws Exception {
        rateLimiter.resetAll();
        dynamicNormalizer.evictLexiconCache();

        long areaAId = id(postJson("/api/farm-areas", Map.of("name", "Khu Mía Thịt")));
        long areaBId = id(postJson("/api/farm-areas", Map.of("name", "Khu J Thịt")));

        long barnA1Id = id(postJson("/api/barns", Map.of("areaId", areaAId, "name", "Nhà A1", "capacity", 5000, "areaM2", 450)));
        long barnB9Id = id(postJson("/api/barns", Map.of("areaId", areaBId, "name", "Nhà B9", "capacity", 4200, "areaM2", 380)));

        barnA1 = barnRepository.findById(barnA1Id).orElseThrow();
        barnB9 = barnRepository.findById(barnB9Id).orElseThrow();

        areaAFeedWarehouse = warehouseRepository.findAllByArea_Id(areaAId).stream()
                .filter(w -> AreaWarehouseService.FEED.equalsIgnoreCase(w.getKind()))
                .findFirst()
                .orElseThrow();

        areaBFeedWarehouse = warehouseRepository.findAllByArea_Id(areaBId).stream()
                .filter(w -> AreaWarehouseService.FEED.equalsIgnoreCase(w.getKind()))
                .findFirst()
                .orElseThrow();
    }

    @Test
    void testDynamicPromptScoping_WorkerOnlyReceivesAssignedBarnsAndLinkedWarehouses() {
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role role = new Role();
            role.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(role);
        });
        Account worker = new Account();
        worker.setEmail("worker-voice@farm.test");
        worker.setPassword("bcrypt-stub");
        worker.setFullName("Công nhân Khu Mía");
        worker.setRole(workerRole);
        worker.setIsActive(true);
        worker = accountRepository.saveAndFlush(worker);

        workAssignmentService.setBarnWorkers(barnA1.getId(), new BarnWorkersRequest(List.of(worker.getId())), "owner@farm.test");

        ProductCategory feedA = new ProductCategory();
        feedA.setName("Cám Higro 510");
        feedA.setNameKey("cam higro 510");
        feedA.setWarehouse(areaAFeedWarehouse);
        productRepository.saveAndFlush(feedA);

        ProductCategory secretFeedB = new ProductCategory();
        secretFeedB.setName("Cám Bí Mật Khu J");
        secretFeedB.setNameKey("cam bi mat khu j");
        secretFeedB.setWarehouse(areaBFeedWarehouse);
        productRepository.saveAndFlush(secretFeedB);

        voiceContextPromptBuilder.evictLexiconCache();

        VoiceContextPromptBuilder.VoiceContextPayload workerPayload =
                voiceContextPromptBuilder.buildForUser("worker-voice@farm.test", true);
        String workerPrompt = workerPayload.contextPrompt();

        assertTrue(workerPrompt.length() <= VoiceContextPromptBuilder.MAX_PROMPT_CHARS,
                "Worker context prompt must stay within <= 650 chars budget");
        assertTrue(workerPrompt.contains("Nhà A1"), "Assigned barn must be present: " + workerPrompt);
        assertTrue(workerPrompt.contains(areaAFeedWarehouse.getName()), "Linked FEED warehouse must be present: " + workerPrompt);
        assertTrue(workerPrompt.contains("Cám Higro 510"), "Assigned area feed product must be present: " + workerPrompt);

        assertFalse(workerPrompt.contains("Nhà B9"), "Unassigned barn must NOT leak to worker prompt: " + workerPrompt);
        assertFalse(workerPrompt.contains("Khu J Thịt"), "Unassigned area must NOT leak to worker prompt: " + workerPrompt);
        assertFalse(workerPrompt.contains("Cám Bí Mật Khu J"), "Unassigned warehouse product must NOT leak: " + workerPrompt);
        assertFalse(workerPrompt.toLowerCase().contains("công nợ"), "Financial terms must NOT be in worker prompt");
        assertFalse(workerPrompt.toLowerCase().contains("hóa đơn"), "Financial terms must NOT be in worker prompt");
        assertFalse(workerPayload.entities().get("barns").contains("Nhà B9"));

        VoiceContextPromptBuilder.VoiceContextPayload ownerPayload =
                voiceContextPromptBuilder.buildForUser("owner@farm.test", false);
        assertTrue(ownerPayload.contextPrompt().length() <= VoiceContextPromptBuilder.MAX_PROMPT_CHARS);
        assertTrue(ownerPayload.entities().get("barns").contains("Nhà A1"));
        assertTrue(ownerPayload.entities().get("barns").contains("Nhà B9"));
        assertTrue(ownerPayload.entities().get("products").contains("Cám Bí Mật Khu J"));
    }

    @Test
    void testSpokenNumberAndUnitNormalization() {
        assertEquals("cho Nhà A1 ăn 4.5 bao cám",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("cho nhà a một ăn bốn bao rưỡi cám"));
        assertEquals("cân mẫu được 2.5 kg",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("cân mẫu được 2 cân rưỡi"));
        assertEquals("đổ thêm 0.5 bao",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("đổ thêm nửa bao"));
        assertEquals("cân được 1.5 kg",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("cân được một ký rưỡi"));
        assertEquals("cân mẫu được 1.2 kg",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("cân mẫu được một cân hai"));
        assertEquals("cân mẫu được 2.5 kg",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("cân mẫu được hai ký năm"));
        assertEquals("cân mẫu được 1.65 kg",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("cân mẫu được một phẩy sáu lăm cân"));
        assertEquals("pha 0.8 kg thuốc",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("pha 8 lạng thuốc"));

        assertEquals("Chuồng B2 chết 10 con",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("chuồng bê hai chết chục con"));
        assertEquals("hao hụt 20 con",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("hao hụt hai chục con"));
        assertEquals("nhập thêm 150 con",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("nhập thêm một trăm rưỡi con"));
        assertEquals("xuất bán 320 con",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("xuất bán ba trăm hai mươi con"));

        assertEquals("Khu C1 và Nhà A3",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("khu xê một và nhà a ba"));
        assertEquals("5 kg 3 kg 4 kg 6 kg 250 g",
                VietnameseSpeechNormalizer.normalizeSpokenTranscript("5 ký 3 kí 4 cân 6 lô 250 gam"));
    }

    @Test
    void testLexiconCacheEviction_RecognizesNewlyAddedOcrProduct() {
        // Warm cache first
        voiceContextPromptBuilder.buildForUser("owner@farm.test", false);
        assertEquals("cho Nhà A1", dynamicNormalizer.normalize("cho nhà a một"));

        // Simulate new product added from OCR purchase import + eviction
        ProductCategory ocrProduct = new ProductCategory();
        ocrProduct.setName("Cám Siêu Tăng Trọng 777");
        ocrProduct.setNameKey("cam sieu tang trong 777");
        ocrProduct.setWarehouse(areaAFeedWarehouse);
        productRepository.saveAndFlush(ocrProduct);

        dynamicNormalizer.evictLexiconCache();

        VoiceContextPromptBuilder.VoiceContextPayload refreshedCtx =
                voiceContextPromptBuilder.buildForUser("owner@farm.test", false);
        assertTrue(refreshedCtx.entities().get("products").contains("Cám Siêu Tăng Trọng 777"));

        // Fuzzy match (>= 0.78) corrects slight STT spelling drop ("tron" instead of "trong") to exact DB name
        String aligned = dynamicNormalizer.normalize("cho Nhà A1 ăn 2 bao cam sieu tang tron 777");
        assertTrue(aligned.contains("Cám Siêu Tăng Trọng 777"),
                "Expected fuzzy DB entity alignment to resolve newly evicted OCR product, got: " + aligned);
    }

    @Test
    void testScopedNormalizer_DoesNotLeakUnassignedBarnOrProductToWorker() {
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role role = new Role();
            role.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(role);
        });
        Account worker = new Account();
        worker.setEmail("worker-scoped@farm.test");
        worker.setPassword("bcrypt-stub");
        worker.setFullName("Công nhân Scoped");
        worker.setRole(workerRole);
        worker.setIsActive(true);
        worker = accountRepository.saveAndFlush(worker);

        workAssignmentService.setBarnWorkers(barnA1.getId(), new BarnWorkersRequest(List.of(worker.getId())), "owner@farm.test");

        ProductCategory feedA = new ProductCategory();
        feedA.setName("Cám Higro 510");
        feedA.setNameKey("cam higro 510");
        feedA.setWarehouse(areaAFeedWarehouse);
        productRepository.saveAndFlush(feedA);

        ProductCategory secretFeedB = new ProductCategory();
        secretFeedB.setName("Cám Bí Mật Khu J");
        secretFeedB.setNameKey("cam bi mat khu j");
        secretFeedB.setWarehouse(areaBFeedWarehouse);
        productRepository.saveAndFlush(secretFeedB);

        dynamicNormalizer.evictLexiconCache();

        VoiceContextPromptBuilder.VoiceContextPayload workerPayload =
                voiceContextPromptBuilder.buildForUser("worker-scoped@farm.test", true);

        var allowedResult = dynamicNormalizer.normalizeWithCorrectionsScoped(
                "cho nha a1 an 2 bao cam higro 510",
                workerPayload.entities()
        );
        assertTrue(allowedResult.normalizedText().contains("Nhà A1"));
        assertTrue(allowedResult.normalizedText().contains("Cám Higro 510"));

        var blockedResult = dynamicNormalizer.normalizeWithCorrectionsScoped(
                "xem nha b9 va cam bi mat khu j",
                workerPayload.entities()
        );
        assertFalse(blockedResult.normalizedText().contains("Nhà B9"));
        assertFalse(blockedResult.normalizedText().contains("Cám Bí Mật Khu J"));
        assertTrue(blockedResult.corrections().isEmpty());
    }

    @Test
    void testVoiceEndpointRejectsOversizedOrInvalidMimeFile() throws Exception {
        // 1. Disguised text/script MIME rejected with HTTP 400
        MockMultipartFile invalidMime = new MockMultipartFile(
                "file",
                "evil.txt",
                "text/plain",
                "alert('xss')".getBytes(StandardCharsets.UTF_8)
        );
        mvc.perform(multipart(VOICE_TRANSCRIBE_API).file(invalidMime))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.rejectedReason").value("INVALID_AUDIO_MIME"));

        // 2. Empty file rejected with HTTP 400
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "empty.webm",
                "audio/webm",
                new byte[0]
        );
        mvc.perform(multipart(VOICE_TRANSCRIBE_API).file(emptyFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.rejectedReason").value("EMPTY_AUDIO"));

        // 3. Payload > 10MB rejected with HTTP 400
        byte[] oversized = new byte[10 * 1024 * 1024 + 128];
        oversized[0] = 0x1A;
        oversized[1] = 0x45;
        oversized[2] = (byte) 0xDF;
        oversized[3] = (byte) 0xA3;
        MockMultipartFile hugeAudio = new MockMultipartFile(
                "file",
                "huge.webm",
                "audio/webm",
                oversized
        );
        mvc.perform(multipart(VOICE_TRANSCRIBE_API).file(hugeAudio))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.rejectedReason").value("FILE_TOO_LARGE"));
    }

    private ResultActions postJson(String url, Object body) throws Exception {
        return mvc.perform(post(url)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions actions) throws Exception {
        String body = actions.andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString();
        JsonNode root = mapper.readTree(body);
        if (root.hasNonNull("data") && root.path("data").has("id")) {
            return root.path("data").path("id").asLong();
        }
        return root.path("id").asLong();
    }
}
