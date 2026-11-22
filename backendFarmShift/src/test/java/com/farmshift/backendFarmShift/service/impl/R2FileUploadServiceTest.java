package com.farmshift.backendFarmShift.service.impl;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.farmshift.backendFarmShift.controller.FileUploadController;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class R2FileUploadServiceTest {
    @Test
    void keepsR2UploadAndPublicUrlBehavior() {
        AmazonS3 client = mock(AmazonS3.class);
        FileUploadServiceImpl service = new FileUploadServiceImpl(client);
        ReflectionTestUtils.setField(service, "bucketName", "test-bucket");
        ReflectionTestUtils.setField(service, "publicUrl", "https://images.example.test");
        String url = service.uploadFile(new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2, 3}), "avatars");
        var request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(client).putObject(request.capture());
        assertEquals("test-bucket", request.getValue().getBucketName());
        assertEquals("https://images.example.test/" + request.getValue().getKey(), url);
        assertTrue(url.endsWith(".jpg"));
    }
    @Test void optimizesProductUploadsAndSetsImmutableCache() throws Exception {
        AmazonS3 client = mock(AmazonS3.class);
        FileUploadServiceImpl service = new FileUploadServiceImpl(client);
        ReflectionTestUtils.setField(service, "bucketName", "test-bucket");
        ReflectionTestUtils.setField(service, "publicUrl", "https://images.example.test");
        doAnswer(call -> {
            PutObjectRequest request = call.getArgument(0);
            assertEquals("public, max-age=31536000, immutable", request.getMetadata().getCacheControl());
            assertEquals("image/jpeg", request.getMetadata().getContentType());
            byte[] bytes = request.getInputStream().readAllBytes();
            assertEquals(bytes.length, request.getMetadata().getContentLength());
            assertEquals(1024, javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes)).getWidth());
            return null;
        }).when(client).putObject(any(PutObjectRequest.class));
        service.uploadFile(new MockMultipartFile("file", "product.jpg", "image/jpeg", ProductImageOptimizerTest.image("jpeg",1600,1200,false)), "products");
        verify(client).putObject(any(PutObjectRequest.class));
    }

    @Test
    void blocksFolderTraversalDisallowedExtensionsAndXssPayloads() {
        AmazonS3 client = mock(AmazonS3.class);
        FileUploadServiceImpl service = new FileUploadServiceImpl(client);
        ReflectionTestUtils.setField(service, "bucketName", "test-bucket");
        ReflectionTestUtils.setField(service, "publicUrl", "https://images.example.test");

        assertThrows(BadRequestException.class, () -> service.uploadFile(
                new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3}), "../outside"));
        assertThrows(BadRequestException.class, () -> service.uploadFile(
                new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3}), "arbitrary"));
        assertThrows(BadRequestException.class, () -> service.uploadFile(
                new MockMultipartFile("file", "evil.html", "text/html", "<html><body>x</body></html>".getBytes(StandardCharsets.UTF_8)), "avatars"));
        assertThrows(BadRequestException.class, () -> service.uploadFile(
                new MockMultipartFile("file", "xss.svg", "image/svg+xml", "<svg onload='alert(1)'/>".getBytes(StandardCharsets.UTF_8)), "avatars"));
        assertThrows(BadRequestException.class, () -> service.uploadFile(
                new MockMultipartFile("file", "fake.png", "image/png", "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)), "avatars"));
        assertThrows(BadRequestException.class, () -> service.uploadFile(
                new MockMultipartFile("file", "doc.pdf", "application/pdf", "%PDF-1.4".getBytes(StandardCharsets.UTF_8)), "avatars"));

        String pdfUrl = service.uploadFile(
                new MockMultipartFile("file", "invoice.pdf", "application/pdf", "%PDF-1.4".getBytes(StandardCharsets.UTF_8)), "purchases");
        assertTrue(pdfUrl.endsWith(".pdf"));
        verify(client, times(1)).putObject(any(PutObjectRequest.class));
    }

    @Test
    void controllerBlocksWorkerFromUploadingToProductsOrPurchases() {
        AmazonS3 client = mock(AmazonS3.class);
        FileUploadServiceImpl service = new FileUploadServiceImpl(client);
        FileUploadController controller = new FileUploadController(service);
        var workerAuth = new UsernamePasswordAuthenticationToken(
                "worker@farm.test", "n/a", List.of(new SimpleGrantedAuthority("ROLE_FARM_WORKER")));
        MockMultipartFile file = new MockMultipartFile("file", "img.png", "image/png", new byte[]{1, 2, 3});

        assertThrows(AccessDeniedException.class, () -> controller.uploadFile(file, "products", workerAuth));
        assertThrows(AccessDeniedException.class, () -> controller.uploadFile(file, "purchases", workerAuth));
        verifyNoInteractions(client);
    }

}
