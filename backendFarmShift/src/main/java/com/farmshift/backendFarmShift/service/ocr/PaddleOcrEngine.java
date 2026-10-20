package com.farmshift.backendFarmShift.service.ocr;

import com.benjaminwan.ocrlibrary.OcrResult;
import com.benjaminwan.ocrlibrary.TextBlock;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import io.github.mymonstercat.Model;
import io.github.mymonstercat.ocr.InferenceEngine;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Native PaddleOCR engine wrapper using RapidOCR (PP-OCRv3 ONNX).
 * Runs completely offline inside the JVM via ONNX Runtime without Python or external services.
 */
@Slf4j
@Component
public class PaddleOcrEngine {

    private final InferenceEngine engine;

    public PaddleOcrEngine() {
        log.info("Initializing PaddleOCR (PP-OCRv3 ONNX) engine...");
        this.engine = InferenceEngine.getInstance(Model.ONNX_PPOCR_V3);
        log.info("PaddleOCR engine initialized successfully.");
    }

    public record RecognizedBlock(
            String text,
            float score,
            int x,
            int y,
            int width,
            int height
    ) {}

    public record OcrDocumentResult(
            String fullText,
            List<RecognizedBlock> blocks,
            double averageScore
    ) {}

    /**
     * Executes OCR on document bytes (image or PDF).
     */
    public OcrDocumentResult recognize(byte[] documentBytes, String mimeType) {
        if (documentBytes == null || documentBytes.length == 0) {
            throw new BadRequestException("Tệp chứng từ trống.", "OCR_EMPTY_FILE");
        }

        List<RecognizedBlock> allBlocks = new ArrayList<>();
        StringBuilder fullTextBuilder = new StringBuilder();

        if ("application/pdf".equalsIgnoreCase(mimeType)) {
            processPdf(documentBytes, allBlocks, fullTextBuilder);
        } else {
            processImage(documentBytes, mimeType, allBlocks, fullTextBuilder);
        }

        if (allBlocks.isEmpty()) {
            throw new BadRequestException(
                    "Không thể nhận diện văn bản nào từ chứng từ. Vui lòng thử lại với ảnh rõ nét hơn.",
                    "OCR_EMPTY_RESPONSE"
            );
        }

        double avgScore = allBlocks.stream().mapToDouble(RecognizedBlock::score).average().orElse(0.0);
        return new OcrDocumentResult(fullTextBuilder.toString().strip(), allBlocks, avgScore);
    }

    private void processImage(byte[] imageBytes, String mimeType, List<RecognizedBlock> allBlocks, StringBuilder fullText) {
        Path tempFile = null;
        try {
            String ext = mimeType != null && mimeType.contains("png") ? ".png" : ".jpg";
            tempFile = Files.createTempFile("paddle-ocr-", ext);
            Files.write(tempFile, imageBytes);

            OcrResult result = engine.runOcr(tempFile.toAbsolutePath().toString());
            extractResult(result, allBlocks, fullText);
        } catch (IOException ex) {
            log.error("Failed to write temporary image file for OCR", ex);
            throw new BadRequestException("Không thể xử lý tệp ảnh chứng từ.", "OCR_FILE_ERROR");
        } finally {
            deleteTempFile(tempFile);
        }
    }

    private void processPdf(byte[] pdfBytes, List<RecognizedBlock> allBlocks, StringBuilder fullText) {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            int pages = Math.min(doc.getNumberOfPages(), 3); // Read up to first 3 pages
            for (int i = 0; i < pages; i++) {
                BufferedImage pageImage = renderer.renderImageWithDPI(i, 250);
                Path tempFile = null;
                try {
                    tempFile = Files.createTempFile("paddle-pdf-page-", ".png");
                    ImageIO.write(pageImage, "png", tempFile.toFile());
                    OcrResult result = engine.runOcr(tempFile.toAbsolutePath().toString());
                    extractResult(result, allBlocks, fullText);
                } finally {
                    deleteTempFile(tempFile);
                }
            }
        } catch (IOException ex) {
            log.error("Failed to parse PDF for OCR", ex);
            throw new BadRequestException("Không thể đọc tệp PDF chứng từ.", "OCR_FILE_ERROR");
        }
    }

    private void extractResult(OcrResult result, List<RecognizedBlock> allBlocks, StringBuilder fullText) {
        if (result == null) return;
        if (result.getStrRes() != null && !result.getStrRes().isBlank()) {
            if (!fullText.isEmpty()) fullText.append("\n");
            fullText.append(result.getStrRes().strip());
        }
        if (result.getTextBlocks() != null) {
            for (TextBlock tb : result.getTextBlocks()) {
                if (tb.getText() == null || tb.getText().isBlank()) continue;
                int minX = Integer.MAX_VALUE;
                int minY = Integer.MAX_VALUE;
                int maxX = Integer.MIN_VALUE;
                int maxY = Integer.MIN_VALUE;
                if (tb.getBoxPoint() != null) {
                    for (var pt : tb.getBoxPoint()) {
                        minX = Math.min(minX, pt.getX());
                        minY = Math.min(minY, pt.getY());
                        maxX = Math.max(maxX, pt.getX());
                        maxY = Math.max(maxY, pt.getY());
                    }
                }
                if (minX == Integer.MAX_VALUE) minX = 0;
                if (minY == Integer.MAX_VALUE) minY = 0;
                int w = Math.max(0, maxX - minX);
                int h = Math.max(0, maxY - minY);
                allBlocks.add(new RecognizedBlock(tb.getText().strip(), tb.getBoxScore(), minX, minY, w, h));
            }
        }
    }

    private void deleteTempFile(Path tempFile) {
        if (tempFile != null) {
            try {
                Files.deleteIfExists(tempFile);
            } catch (Exception ignored) {}
        }
    }
}
