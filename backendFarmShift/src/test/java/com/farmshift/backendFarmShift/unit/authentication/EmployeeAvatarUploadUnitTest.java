package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.service.impl.LocalFileUploadService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class EmployeeAvatarUploadUnitTest {
    @TempDir Path uploadDirectory;

    @Test void UTC065_uploadValidPngAvatarUnder5MbSucceeds() throws Exception {
        LocalFileUploadService service = new LocalFileUploadService(uploadDirectory.toString());
        MockMultipartFile image = new MockMultipartFile("file", "employee.png", "image/png", validPng());

        String path = service.uploadFile(image, "avatars");

        assertTrue(path.matches("/img/avatars/[0-9a-fA-F-]+\\.png"));
        assertTrue(Files.exists(uploadDirectory.resolve(path.replace("/img/", ""))));
    }

    @Test void UTC066_uploadAvatarOver5MbIsRejected() {
        LocalFileUploadService service = new LocalFileUploadService(uploadDirectory.toString());
        byte[] oversized = new byte[5 * 1024 * 1024 + 1];
        MockMultipartFile image = new MockMultipartFile("file", "employee.png", "image/png", oversized);

        BadRequestException error = assertThrows(BadRequestException.class, () -> service.uploadFile(image, "avatars"));
        assertEquals("Ảnh phải có dung lượng lớn hơn 0 và không quá 5MB.", error.getMessage());
    }

    @Test void UTC067_uploadNonImageDocumentIsRejected() {
        LocalFileUploadService service = new LocalFileUploadService(uploadDirectory.toString());
        MockMultipartFile document = new MockMultipartFile("file", "document.pdf", "application/pdf", "%PDF-1.4".getBytes());

        BadRequestException error = assertThrows(BadRequestException.class, () -> service.uploadFile(document, "avatars"));
        assertEquals("Chỉ hỗ trợ ảnh PNG, JPEG hoặc GIF.", error.getMessage());
    }

    private static byte[] validPng() throws Exception {
        BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
