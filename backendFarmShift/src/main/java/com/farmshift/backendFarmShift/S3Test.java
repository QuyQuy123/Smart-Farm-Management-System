package com.farmshift.backendFarmShift;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;

import java.io.ByteArrayInputStream;

public class S3Test {
    public static void main(String[] args) {
        try {
            AmazonS3 s3Client = AmazonS3ClientBuilder.standard()
                .withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration("https://example.r2.cloudflarestorage.com", "auto"))
                .withCredentials(new AWSStaticCredentialsProvider(new BasicAWSCredentials("foo", "bar")))
                .disableChunkedEncoding()
                .withPathStyleAccessEnabled(true)
                .build();
            
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(5);
            s3Client.putObject(new PutObjectRequest("bucket", "test.txt", new ByteArrayInputStream("hello".getBytes()), metadata));
            System.out.println("Success");
        } catch (Exception e) {
            e.printStackTrace();
        } catch (Error e) {
            e.printStackTrace();
        }
    }
}
