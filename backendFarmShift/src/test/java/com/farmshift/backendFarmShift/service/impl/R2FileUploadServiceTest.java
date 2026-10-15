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
}
