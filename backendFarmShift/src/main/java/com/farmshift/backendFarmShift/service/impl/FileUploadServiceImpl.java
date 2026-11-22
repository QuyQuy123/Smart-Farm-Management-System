package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.service.FileUploadService;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "storage.provider", havingValue = "r2", matchIfMissing = true)
@RequiredArgsConstructor
public class FileUploadServiceImpl implements FileUploadService {

    private static final Set<String> ALLOWED_FOLDERS = Set.of("avatars", "products", "losses", "purchases");
    private static final Map<String, String> EXTENSION_TO_MIME = Map.of(
            ".jpg", "image/jpeg",
            ".jpeg", "image/jpeg",
            ".png", "image/png",
            ".gif", "image/gif",
            ".webp", "image/webp",
            ".pdf", "application/pdf"
    );
    private static final Map<String, String> MIME_TO_EXTENSION = Map.of(
            "image/jpeg", ".jpg",
            "image/jpg", ".jpg",
            "image/pjpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp",
            "application/pdf", ".pdf"
    );

    private final AmazonS3 s3Client;

    @Value("${r2.bucket-name}")
    private String bucketName;

    @Value("${r2.public-url}")
    private String publicUrl;

    /**
     * Uploads a file to Cloudflare R2 and returns its public URL.
     *
     * @param file   the multipart file from the frontend
     * @param folder the folder path inside the bucket (e.g., "avatars")
     * @return the public URL of the uploaded file
     */
    public String uploadFile(MultipartFile file, String folder) {
        if (file == null || file.isEmpty() || file.getSize() > 5L * 1024 * 1024) {
            throw new BadRequestException("Ảnh phải có dung lượng lớn hơn 0 và không quá 5MB.");
        }
        if (folder == null || !folder.matches("[a-zA-Z0-9_-]+") || !ALLOWED_FOLDERS.contains(folder)) {
            throw new BadRequestException("Thư mục upload không hợp lệ.");
        }

        String extension = resolveValidatedExtension(file, folder);

        try {
            byte[] bytes = file.getBytes();
            assertSafeContentBytes(bytes);

            ProductImageOptimizer.Result optimized = "products".equals(folder)
                    ? ProductImageOptimizer.optimize(bytes)
                    : null;
            if (optimized != null) {
                extension = optimized.extension();
            }
            byte[] uploadBytes = optimized != null ? optimized.bytes() : bytes;
            String contentType = optimized != null
                    ? optimized.contentType()
                    : EXTENSION_TO_MIME.getOrDefault(extension, "application/octet-stream");
            String fileName = folder + "/" + UUID.randomUUID() + extension;

            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType(contentType);
            metadata.setContentLength(uploadBytes.length);
            if ("products".equals(folder)) {
                metadata.setCacheControl("public, max-age=31536000, immutable");
            }

            // Upload to R2
            try (var input = new ByteArrayInputStream(uploadBytes)) {
                s3Client.putObject(new PutObjectRequest(bucketName, fileName, input, metadata));
            }

            // Return public URL (Cloudflare R2 Dev URL or Custom Domain)
            String filePublicUrl = publicUrl + "/" + fileName;
            log.info("File uploaded successfully to R2: {}", filePublicUrl);
            return filePublicUrl;

        } catch (BadRequestException e) {
            throw e;
        } catch (IOException e) {
            log.error("Failed to upload file to Cloudflare R2", e);
            throw new RuntimeException("Failed to upload file", e);
        }
    }

    private static String resolveValidatedExtension(MultipartFile file, String folder) {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) {
                extension = originalFilename.substring(dot).trim().toLowerCase(Locale.ROOT);
            }
        }
        if (extension.isEmpty() && file.getContentType() != null) {
            String baseMime = file.getContentType().split(";")[0].trim().toLowerCase(Locale.ROOT);
            extension = MIME_TO_EXTENSION.getOrDefault(baseMime, "");
        }
        boolean allowedImage = ".jpg".equals(extension)
                || ".jpeg".equals(extension)
                || ".png".equals(extension)
                || ".gif".equals(extension)
                || ".webp".equals(extension);
        boolean allowedPdf = ".pdf".equals(extension) && "purchases".equals(folder);
        if (!allowedImage && !allowedPdf) {
            throw new BadRequestException("Chỉ hỗ trợ ảnh PNG, JPEG, GIF, WEBP (hoặc PDF cho chứng từ).");
        }
        return extension;
    }

    private static void assertSafeContentBytes(byte[] bytes) {
        int inspectLen = Math.min(bytes.length, 512);
        String head = new String(bytes, 0, inspectLen, StandardCharsets.UTF_8)
                .replace("\uFEFF", "")
                .stripLeading()
                .toLowerCase(Locale.ROOT);
        if (head.contains("<script")
                || head.contains("<html")
                || head.contains("<svg")
                || head.contains("<!doctype html")) {
            throw new BadRequestException("Nội dung tệp tải lên không hợp lệ.");
        }
    }
}
