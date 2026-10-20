package com.farmshift.backendFarmShift.service.impl;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.PutObjectRequest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

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

}
