package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "storage.provider=local")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "avatar@test.local", authorities = "ROLE_FARM_OWNER")
class LocalAvatarIntegrationTest {
    @TempDir static Path imageDirectory;
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry properties) {
        properties.add("storage.local.directory", () -> imageDirectory.toString());
    }

    @Autowired MockMvc mvc;
    @Autowired AccountRepository accounts;
    @Autowired CustomerRepository customers;
    @Autowired EntityManager entityManager;
    @Autowired ObjectMapper mapper;

    @BeforeEach
    void setup() {
        Account account = new Account();
        account.setEmail("avatar@test.local");
        account.setPassword("test");
        account.setFullName("Avatar User");
        account.setAvatarUrl("/img/old.png");
        accounts.saveAndFlush(account);
        Customer customer = new Customer();
        customer.setAccount(account);
        customer.setFullName("Avatar User");
        customer.setAvatarUrl("/img/old.png");
        customers.saveAndFlush(customer);
    }

    private MockMultipartFile image() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        return new MockMultipartFile("file", "../../avatar.html", "image/png", bytes.toByteArray());
    }

    @Test
    void writesImageToDiskAndImmediatelyPersistsPathForProfileReload() throws Exception {
        var response = mvc.perform(multipart("/api/user/avatar").file(image()))
            .andExpect(status().isOk()).andReturn();
        String url = mapper.readTree(response.getResponse().getContentAsString()).path("data").path("url").asText();
        assertTrue(url.matches("/img/avatars/[a-f0-9-]+\\.png"));
        assertTrue(Files.isRegularFile(imageDirectory.resolve(url.substring("/img/".length()))));
        entityManager.flush();
        entityManager.clear();
        Account account = accounts.findByEmail("avatar@test.local").orElseThrow();
        assertEquals(url, account.getAvatarUrl());
        assertEquals(url, customers.findByAccount(account).orElseThrow().getAvatarUrl());
        mvc.perform(get("/api/user/profile")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.avatarUrl").value(url));
    }

    @Test
    void rejectsFakeImagesWithoutChangingSavedAvatar() throws Exception {
        mvc.perform(multipart("/api/user/avatar").file(new MockMultipartFile(
                "file", "fake.png", "image/png", "<script>fake</script>".getBytes())))
            .andExpect(status().isBadRequest());
        assertEquals("/img/old.png", accounts.findByEmail("avatar@test.local").orElseThrow().getAvatarUrl());
    }

    @Test
    void rejectsInvalidFolderAndOversizedFile() throws Exception {
        mvc.perform(multipart("/api/files/upload").file(image()).param("folder", "../outside"))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/user/avatar").file(new MockMultipartFile(
                "file", "large.png", "image/png", new byte[5 * 1024 * 1024 + 1])))
            .andExpect(status().isBadRequest());
    }

    @Test
    @WithAnonymousUser
    void requiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/user/avatar").file(image())).andExpect(status().is4xxClientError());
    }
}
