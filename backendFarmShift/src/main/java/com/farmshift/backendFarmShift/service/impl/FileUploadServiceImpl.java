package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.service.FileUploadService;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "storage.provider", havingValue = "r2", matchIfMissing = true)
@RequiredArgsConstructor
public class FileUploadServiceImpl implements FileUploadService {

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
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        // Global multipart limit is 10MB (for OCR invoices); keep uploaded images at 5MB max.
        if (file.getSize() > 5L * 1024 * 1024) {
            throw new com.farmshift.backendFarmShift.exception.BadRequestException(
                    "Ảnh phải có dung lượng lớn hơn 0 và không quá 5MB.");
        }

        try {
            // Generate a unique filename to prevent overwrites
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            ProductImageOptimizer.Result optimized = "products".equals(folder) ? ProductImageOptimizer.optimize(file.getBytes()) : null;
            if (optimized != null) extension = optimized.extension();
            String fileName = folder + "/" + UUID.randomUUID() + extension;

            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType(optimized == null ? file.getContentType() : optimized.contentType());
            metadata.setContentLength(optimized == null ? file.getSize() : optimized.bytes().length);
            if ("products".equals(folder)) metadata.setCacheControl("public, max-age=31536000, immutable");

            // Upload to R2
            try (var input = optimized == null ? file.getInputStream() : new java.io.ByteArrayInputStream(optimized.bytes())) {
                s3Client.putObject(new PutObjectRequest(bucketName, fileName, input, metadata));
            }

            // Return public URL (Cloudflare R2 Dev URL or Custom Domain)
            String filePublicUrl = publicUrl + "/" + fileName;
            log.info("File uploaded successfully to R2: {}", filePublicUrl);
            return filePublicUrl;

        } catch (IOException e) {
            log.error("Failed to upload file to Cloudflare R2", e);
            throw new RuntimeException("Failed to upload file", e);
        }
    }
}
