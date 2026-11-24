package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.entity.FarmingProgram;
import com.farmshift.backendFarmShift.entity.FarmingProgramStep;
import com.farmshift.backendFarmShift.entity.InventoryItem;
import com.farmshift.backendFarmShift.repository.FarmingProgramStepRepository;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Hybrid RAG Retriever (BM25 Sparse + Character 3-gram Cosine + Reciprocal Rank Fusion)
 * combining:
 * 1. Curated Poultry Veterinary & Husbandry corpus (poultry_vet_knowledge.json)
 * 2. Live PostgreSQL `farming_program_steps` & linked warehouse stock (RBAC-safe, no prices).
 */
@Slf4j
@Service
public class FarmKnowledgeRagService {

    private static final int RRF_K = 60;
    private static final double BM25_K1 = 1.5;
    private static final double BM25_B = 0.75;
    private static final int MAX_RAG_PROMPT_CHARS = 1800;
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[a-z0-9]+");

    private static final Pattern RAG_TRIGGER_CUE = Pattern.compile(
            "(?i)\\b(?:benh|thuoc|vac[\\s-]?xin|tiem\\s+phong|lich\\s+tiem|trieu\\s+chung|kho\\s+khe|ngap\\s+gio|cau\\s+trung|gumboro|newcastle|ga\\s+ru|coryza|sung\\s+phu\\s+dau|sung\\s+mat|marek|crd|tieu\\s+chay|phan\\s+sap|phan\\s+trang|phan\\s+xanh|phan\\s+mau|u\\s+ru|bo\\s+an|chong\\s+nong|stress\\s+nhiet|um\\s+ga|nhiet\\s+do\\s+um|fcr|adg|quy\\s+trinh|chuong\\s+trinh\\s+nuoi|sat\\s+trung|bkc|toltrazuril|han[\\s-]?coc|bio[\\s-]?zyme|men\\s+tieu\\s+hoa|dien\\s+giai|gluco|doxycycline|tylosin|enrofloxacin|amoxicillin|lasota)\\b"
    );

    public record RagDocument(
            String id,
            String sourceType, // VET_DOC | PROGRAM_STEP
            String category,
            String title,
            String content,
            List<String> keywords,
            Integer dayFrom,
            Integer dayTo,
            String breed
    ) {}

    public record RagHit(
            RagDocument document,
            double rrfScore,
            double bm25Score,
            double cosineScore
    ) {}

    private final FarmingProgramStepRepository programStepRepository;
    private final ObjectMapper objectMapper;
    private volatile List<RagDocument> staticVetDocs = List.of();

    @Autowired
    public FarmKnowledgeRagService(
            FarmingProgramStepRepository programStepRepository,
            ObjectMapper objectMapper
    ) {
        this.programStepRepository = programStepRepository;
        this.objectMapper = objectMapper;
        loadStaticCorpus();
    }

    @PostConstruct
    void init() {
        if (staticVetDocs.isEmpty()) {
            loadStaticCorpus();
        }
    }

    private void loadStaticCorpus() {
        List<RagDocument> docs = new ArrayList<>();
        try (InputStream in = FarmKnowledgeRagService.class.getResourceAsStream("/rag/poultry_vet_knowledge.json")) {
            if (in != null) {
                JsonNode root = objectMapper.readTree(in);
                JsonNode arr = root.path("documents");
                if (arr.isArray()) {
                    for (JsonNode d : arr) {
                        List<String> kws = new ArrayList<>();
                        if (d.path("keywords").isArray()) {
                            d.path("keywords").forEach(k -> kws.add(k.asText("")));
                        }
                        String combinedBody = d.path("symptoms").asText("") + "\n" + d.path("content").asText("");
                        docs.add(new RagDocument(
                                d.path("id").asText(""),
                                "VET_DOC",
                                d.path("category").asText("VET"),
                                d.path("title").asText(""),
                                combinedBody.trim(),
                                List.copyOf(kws),
                                null,
                                null,
                                null
                        ));
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Could not load poultry_vet_knowledge.json: {}", ex.getMessage());
        }
        staticVetDocs = List.copyOf(docs);
    }

    public static boolean shouldInjectRagContext(String query) {
        if (query == null || query.isBlank()) {
            return false;
        }
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(query).toLowerCase(Locale.ROOT);
        return RAG_TRIGGER_CUE.matcher(norm).find();
    }

    @Transactional(readOnly = true)
    public List<RagHit> retrieveHybrid(
            String query,
            Integer activeAgeDays,
            Set<Long> allowedWarehouseIds,
            boolean isWorker,
            int topK
    ) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        List<RagDocument> corpus = new ArrayList<>(staticVetDocs);
        corpus.addAll(loadLiveProgramStepDocs(allowedWarehouseIds, isWorker));
        if (corpus.isEmpty()) {
            return List.of();
        }

        String queryNorm = normalizePlain(query);
        List<String> queryTokens = tokenize(queryNorm);
        Map<String, Double> queryNgrams = charNgrams(queryNorm, 3);

        // Build document token lists & IDF for BM25
        List<List<String>> docTokenLists = new ArrayList<>(corpus.size());
        Map<String, Integer> docFreq = new HashMap<>();
        double totalLen = 0.0;
        for (RagDocument doc : corpus) {
            String fullText = normalizePlain(doc.title() + " " + String.join(" ", doc.keywords()) + " " + doc.content());
            List<String> tokens = tokenize(fullText);
            docTokenLists.add(tokens);
            totalLen += tokens.size();
            Set<String> unique = new HashSet<>(tokens);
            for (String tok : unique) {
                docFreq.merge(tok, 1, Integer::sum);
            }
        }
        double avgDocLen = totalLen > 0 ? (totalLen / corpus.size()) : 1.0;

        int n = corpus.size();
        double[] bm25Scores = new double[n];
        double[] cosineScores = new double[n];
        double[] ageBoosts = new double[n];

        for (int idx = 0; idx < n; idx++) {
            RagDocument doc = corpus.get(idx);
            List<String> dTokens = docTokenLists.get(idx);
            Map<String, Integer> tf = new HashMap<>();
            for (String t : dTokens) {
                tf.merge(t, 1, Integer::sum);
            }
            double bm25 = 0.0;
            for (String qt : queryTokens) {
                int f = tf.getOrDefault(qt, 0);
                if (f == 0) continue;
                int df = docFreq.getOrDefault(qt, 0);
                double idf = Math.log(1.0 + (n - df + 0.5) / (df + 0.5));
                double denom = f + BM25_K1 * (1.0 - BM25_B + BM25_B * (dTokens.size() / avgDocLen));
                bm25 += idf * ((f * (BM25_K1 + 1.0)) / denom);
            }
            // Keyword phrase match boost
            for (String kw : doc.keywords()) {
                String kwPlain = normalizePlain(kw);
                if (!kwPlain.isBlank() && queryNorm.contains(kwPlain)) {
                    bm25 += 2.5;
                }
            }
            bm25Scores[idx] = bm25;

            String docNgramText = normalizePlain(doc.title() + " " + String.join(" ", doc.keywords()) + " " + doc.content());
            cosineScores[idx] = cosineSimilarity(queryNgrams, charNgrams(docNgramText, 3));

            if (activeAgeDays != null && doc.dayFrom() != null && doc.dayTo() != null) {
                if (activeAgeDays >= doc.dayFrom() && activeAgeDays <= doc.dayTo()) {
                    ageBoosts[idx] = 0.025;
                } else if (doc.dayFrom() > activeAgeDays && doc.dayFrom() - activeAgeDays <= 7) {
                    ageBoosts[idx] = 0.012;
                }
            }
        }

        // Rank indices separately for BM25 and Cosine
        List<Integer> bm25Order = sortedIndicesByScore(bm25Scores);
        List<Integer> cosOrder = sortedIndicesByScore(cosineScores);

        Map<Integer, Integer> bm25Rank = new HashMap<>();
        Map<Integer, Integer> cosRank = new HashMap<>();
        for (int r = 0; r < n; r++) {
            bm25Rank.put(bm25Order.get(r), r + 1);
            cosRank.put(cosOrder.get(r), r + 1);
        }

        List<RagHit> hits = new ArrayList<>();
        for (int idx = 0; idx < n; idx++) {
            if (bm25Scores[idx] <= 0.0 && cosineScores[idx] < 0.08) {
                continue;
            }
            double rrf = (1.0 / (RRF_K + bm25Rank.get(idx))) + (1.0 / (RRF_K + cosRank.get(idx))) + ageBoosts[idx];
            hits.add(new RagHit(corpus.get(idx), rrf, bm25Scores[idx], cosineScores[idx]));
        }
        hits.sort(Comparator.comparingDouble(RagHit::rrfScore).reversed());
        if (hits.size() > topK) {
            return List.copyOf(hits.subList(0, topK));
        }
        return List.copyOf(hits);
    }

    @Transactional(readOnly = true)
    public String buildPromptRagSection(
            String query,
            Integer activeAgeDays,
            Set<Long> allowedWarehouseIds,
            boolean isWorker
    ) {
        if (!shouldInjectRagContext(query)) {
            return "";
        }
        List<RagHit> hits = retrieveHybrid(query, activeAgeDays, allowedWarehouseIds, isWorker, 4);
        if (hits.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("<retrieved_knowledge>\n");
        for (RagHit hit : hits) {
            RagDocument doc = hit.document();
            String entry = String.format("- [%s | %s] %s:\n  %s\n",
                    doc.sourceType(), doc.category(), doc.title(), doc.content().replace("\n", "\n  "));
            if (sb.length() + entry.length() > MAX_RAG_PROMPT_CHARS) {
                break;
            }
            sb.append(entry);
        }
        sb.append("</retrieved_knowledge>\n");
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public String buildOfflineRagReply(
            String query,
            String barnName,
            Integer activeAgeDays,
            Set<Long> allowedWarehouseIds,
            boolean isWorker
    ) {
        List<RagHit> hits = retrieveHybrid(query, activeAgeDays, allowedWarehouseIds, isWorker, 3);
        if (hits.isEmpty()) {
            return null;
        }
        RagDocument primary = hits.get(0).document();
        StringBuilder sb = new StringBuilder();
        sb.append("📚 **").append(primary.title()).append("**");
        if (barnName != null && activeAgeDays != null) {
            sb.append(" *(Tham chiếu ").append(barnName).append(" — ngày tuổi ").append(activeAgeDays).append(")*");
        }
        sb.append("\n").append(primary.content());

        for (int i = 1; i < hits.size(); i++) {
            RagDocument extra = hits.get(i).document();
            if ("PROGRAM_STEP".equals(extra.sourceType())) {
                sb.append("\n\n📋 **").append(extra.title()).append(":** ").append(extra.content());
            }
        }
        if ("DISEASE".equals(primary.category()) || "VACCINE".equals(primary.category())) {
            sb.append("\n\n⚕️ *Lưu ý (MSG38): Thông tin trên chỉ mang tính tham khảo hỗ trợ chăn nuôi; khi đàn có dấu hiệu bệnh nặng hoặc lây lan nhanh, vui lòng tham vấn bác sĩ thú y trực tiếp.*");
        }
        return sb.toString();
    }

    private List<RagDocument> loadLiveProgramStepDocs(Set<Long> allowedWarehouseIds, boolean isWorker) {
        if (programStepRepository == null) {
            return List.of();
        }
        try {
            List<FarmingProgramStep> steps = programStepRepository.findAllByOrderByProgramIdAscDayFromAscIdAsc();
            List<RagDocument> out = new ArrayList<>();
            for (FarmingProgramStep step : steps) {
                FarmingProgram prog = step.getProgram();
                String progName = prog != null ? prog.getName() : "Chương trình nuôi";
                String breed = prog != null ? prog.getBreed() : "";
                StringBuilder body = new StringBuilder();
                body.append("Áp dụng ngày tuổi ").append(step.getDayFrom()).append("–").append(step.getDayTo()).append(". ");
                if (step.getMethod() != null) {
                    body.append("Đường dùng: ").append(step.getMethod().name()).append(". ");
                }
                if (step.getQuantity() != null) {
                    body.append("Định mức: ").append(step.getQuantity().stripTrailingZeros().toPlainString());
                    if (step.getUnit() != null && !step.getUnit().isBlank()) {
                        body.append(" ").append(step.getUnit());
                    }
                    body.append(". ");
                }
                if (step.getTempMin() != null && step.getTempMax() != null) {
                    body.append("Nhiệt độ chuẩn: ").append(step.getTempMin()).append("–").append(step.getTempMax()).append("°C. ");
                }
                if (step.getNote() != null && !step.getNote().isBlank()) {
                    body.append(step.getNote()).append(" ");
                }

                InventoryItem linked = step.getInventoryItem();
                if (linked != null && linked.getProduct() != null) {
                    boolean whAllowed = !isWorker
                            || (allowedWarehouseIds != null
                            && linked.getWarehouse() != null
                            && allowedWarehouseIds.contains(linked.getWarehouse().getId()));
                    if (whAllowed) {
                        BigDecimal stock = linked.getStock() != null
                                ? linked.getStock().setScale(2, RoundingMode.HALF_UP).stripTrailingZeros()
                                : BigDecimal.ZERO;
                        String unitName = (linked.getUnit() != null && linked.getUnit().getName() != null && !linked.getUnit().getName().isBlank())
                                ? (" " + linked.getUnit().getName())
                                : "";
                        body.append("Vật tư kho: ").append(linked.getProduct().getName())
                                .append(" (tồn ").append(stock.toPlainString()).append(unitName).append(").");
                    }
                }

                String title = progName + (breed != null && !breed.isBlank() ? " (" + breed + ")" : "")
                        + " — " + step.getName() + " (Ngày " + step.getDayFrom() + "–" + step.getDayTo() + ")";
                List<String> keywords = new ArrayList<>();
                keywords.add(step.getName());
                if (breed != null && !breed.isBlank()) keywords.add(breed);
                if (step.getCategory() != null) keywords.add(step.getCategory().name());

                out.add(new RagDocument(
                        "prog_step_" + step.getId(),
                        "PROGRAM_STEP",
                        step.getCategory() != null ? step.getCategory().name() : "PROGRAM",
                        title,
                        body.toString().trim(),
                        keywords,
                        step.getDayFrom(),
                        step.getDayTo(),
                        breed
                ));
            }
            return out;
        } catch (Exception ex) {
            log.debug("Could not load farming_program_steps for RAG: {}", ex.getMessage());
            return List.of();
        }
    }

    private static List<Integer> sortedIndicesByScore(double[] scores) {
        List<Integer> indices = new ArrayList<>(scores.length);
        for (int i = 0; i < scores.length; i++) {
            indices.add(i);
        }
        indices.sort((a, b) -> Double.compare(scores[b], scores[a]));
        return indices;
    }

    private static String normalizePlain(String raw) {
        if (raw == null) return "";
        return VietnameseSpeechNormalizer.removeVietnameseDiacritics(raw)
                .replaceAll("[^a-z0-9\\s]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static List<String> tokenize(String plain) {
        if (plain == null || plain.isBlank()) return List.of();
        List<String> tokens = new ArrayList<>();
        Matcher m = TOKEN_PATTERN.matcher(plain);
        while (m.find()) {
            String tok = m.group();
            if (tok.length() >= 2) {
                tokens.add(tok);
            }
        }
        return tokens;
    }

    private static Map<String, Double> charNgrams(String plain, int n) {
        Map<String, Double> vec = new HashMap<>();
        if (plain == null || plain.isBlank()) return vec;
        String padded = " " + plain + " ";
        if (padded.length() < n) {
            vec.put(padded, 1.0);
            return vec;
        }
        for (int i = 0; i <= padded.length() - n; i++) {
            String gram = padded.substring(i, i + n);
            vec.merge(gram, 1.0, Double::sum);
        }
        return vec;
    }

    private static double cosineSimilarity(Map<String, Double> a, Map<String, Double> b) {
        if (a.isEmpty() || b.isEmpty()) return 0.0;
        double dot = 0.0;
        for (Map.Entry<String, Double> e : a.entrySet()) {
            Double bv = b.get(e.getKey());
            if (bv != null) {
                dot += e.getValue() * bv;
            }
        }
        if (dot == 0.0) return 0.0;
        double normA = 0.0;
        for (double v : a.values()) normA += v * v;
        double normB = 0.0;
        for (double v : b.values()) normB += v * v;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
