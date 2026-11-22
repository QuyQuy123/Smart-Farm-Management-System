package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.FileUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Endpoint for uploading files (images, avatars) to Cloudflare R2.
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "avatars") String folder,
            Authentication authentication) {

        boolean isWorker = authentication != null && authentication.getAuthorities() != null
                && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_FARM_WORKER".equals(a.getAuthority()));
        if (isWorker && ("products".equals(folder) || "purchases".equals(folder))) {
            throw new AccessDeniedException("Tài khoản Công nhân không có quyền tải tệp lên danh mục này.");
        }

        String url = fileUploadService.uploadFile(file, folder);
        
        return ResponseEntity.ok(ApiResponse.success("File uploaded successfully", Map.of("url", url)));
    }
}
