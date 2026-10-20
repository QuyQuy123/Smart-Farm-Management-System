package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.service.FileUploadService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "storage.provider", havingValue = "local")
public class LocalFileUploadService implements FileUploadService {
    private final Path directory;

    public LocalFileUploadService(@Value("${storage.local.directory:}") String configuredDirectory) {
        Path workingDirectory = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        Path frontend = Files.isDirectory(workingDirectory.resolve("frontendFarmShift"))
                ? workingDirectory.resolve("frontendFarmShift")
                : workingDirectory.resolve("../frontendFarmShift");
        directory = (configuredDirectory.isBlank() ? frontend.resolve("public/img") : Path.of(configuredDirectory))
                .toAbsolutePath().normalize();
    }

    @Override
    public String uploadFile(MultipartFile file, String folder) {
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Ảnh phải có dung lượng lớn hơn 0 và không quá 5MB.");
        }
        if (folder == null || !folder.matches("[a-zA-Z0-9_-]+")) {
            throw new BadRequestException("Thư mục upload không hợp lệ.");
        }
        try {
            byte[] bytes = file.getBytes();
            String format;
            try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) throw new BadRequestException("Chỉ hỗ trợ ảnh PNG, JPEG hoặc GIF.");
                var reader = readers.next();
                try {
                    format = reader.getFormatName().toLowerCase(Locale.ROOT);
                } finally {
                    reader.dispose();
                }
            }
            String extension = switch (format) {
                case "jpeg", "jpg" -> ".jpg";
                case "png" -> ".png";
                case "gif" -> ".gif";
                default -> throw new BadRequestException("Chỉ hỗ trợ ảnh PNG, JPEG hoặc GIF.");
            };
            if ("products".equals(folder)) {
                var optimized = ProductImageOptimizer.optimize(bytes);
                bytes = optimized.bytes(); extension = optimized.extension();
            } else if (ImageIO.read(new ByteArrayInputStream(bytes)) == null) {
                throw new BadRequestException("Nội dung ảnh không hợp lệ.");
            }
            Path targetDirectory = directory.resolve(folder).normalize();
            if (!targetDirectory.startsWith(directory)) throw new BadRequestException("Thư mục upload không hợp lệ.");
            Files.createDirectories(targetDirectory);
            String filename = UUID.randomUUID() + extension;
            Files.write(targetDirectory.resolve(filename), bytes, StandardOpenOption.CREATE_NEW);
            return "/img/" + folder + "/" + filename;
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể lưu ảnh vào thư mục local.", exception);
        }
    }
}
