package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.service.ocr.SalesWeightVisionClient;
import com.farmshift.backendFarmShift.repository.SalesOrderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class SalesWeightSlipIntegrationTest {
 @TempDir static Path uploads;
 @DynamicPropertySource static void storage(DynamicPropertyRegistry registry) { registry.add("sales.weight-slips.directory", () -> uploads.toString()); }
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper mapper;
 @Autowired SalesOrderRepository orders;
 @MockitoBean SalesWeightVisionClient vision;
 byte[] png() throws Exception {
  var bytes = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(8,8,BufferedImage.TYPE_INT_RGB), "png", bytes); return bytes.toByteArray();
 }
 MockMultipartFile document() throws Exception { return new MockMultipartFile("file", "../../phieu.png", "image/png", png()); }
 MockMultipartFile data(String id) {
  String json = "{\"id\":\"" + id + "\",\"date\":\"2026-10-30\",\"customer\":\"Buyer\",\"phone\":\"0912345678\",\"address\":\"Ha Noi\",\"flock\":\"Khu A - Chuong A1\",\"quantity\":100,\"totalWeight\":250,\"unitPrice\":60000,\"status\":\"DEBT\"}";
  return new MockMultipartFile("data", "data.json", "application/json", json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
 }
 @org.springframework.test.context.transaction.AfterTransaction
 void rolledBackDocumentIsRemoved() throws Exception {
  try (var files = Files.list(uploads)) { assertEquals(0, files.count(), "rolled-back orders must not leave orphan originals"); }
 }
 @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
 void extractIsDraftOnlyAndConfirmPersistsOriginalOnce() throws Exception {
  when(vision.extract(any())).thenReturn(mapper.readTree("{\"isWeightSlip\":true,\"customer\":\"Buyer\",\"quantity\":100,\"totalWeight\":250,\"unitPrice\":60000}"));
  long before = orders.count();
  mvc.perform(multipart("/api/sales/orders/ocr").file(document())).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalWeight").value(250));
  assertEquals(before, orders.count());
  try (var files = Files.list(uploads)) { assertEquals(0, files.count()); }
  var result = mvc.perform(multipart("/api/sales/orders/weight-slip").file(document()).file(data("weight-slip-test")))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalAmount").value(15000000)).andReturn();
  String url = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("weightSlipUrl").asText();
  assertTrue(url.matches("/weigh-slips/[a-f0-9-]+\\.png"));
  assertArrayEquals(png(), Files.readAllBytes(uploads.resolve(url.substring("/weigh-slips/".length()))));
  mvc.perform(multipart("/api/sales/orders/weight-slip").file(document()).file(data("weight-slip-test"))).andExpect(status().isOk());
  assertEquals(before + 1, orders.count());
  try (var files = Files.list(uploads)) { assertEquals(1, files.count()); }
 }
 @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
 void previewsAllPdfPagesWithoutCallingAiOrPersistingFiles() throws Exception {
  var bytes = new ByteArrayOutputStream();
  try (var pdf = new org.apache.pdfbox.pdmodel.PDDocument()) {
   pdf.addPage(new org.apache.pdfbox.pdmodel.PDPage()); pdf.addPage(new org.apache.pdfbox.pdmodel.PDPage()); pdf.save(bytes);
  }
  var file = new MockMultipartFile("file", "weight-slip.pdf", "application/pdf", bytes.toByteArray());
  mvc.perform(multipart("/api/sales/orders/weight-slip/preview").file(file))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
   .andExpect(jsonPath("$.data[0]").value(org.hamcrest.Matchers.startsWith("data:image/png;base64,")));
  verifyNoInteractions(vision);
  try (var files = Files.list(uploads)) { assertEquals(0, files.count()); }
 }
 @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
 void rejectsInvalidDocumentWithoutCallingAiOrSavingOrder() throws Exception {
  var bad = new MockMultipartFile("file", "fake.jpg", "image/jpeg", "not an image".getBytes());
  mvc.perform(multipart("/api/sales/orders/ocr").file(bad)).andExpect(status().isBadRequest());
  mvc.perform(multipart("/api/sales/orders/weight-slip").file(bad).file(data("bad-weight-slip"))).andExpect(status().isBadRequest());
  verifyNoInteractions(vision);
  assertFalse(orders.existsById("bad-weight-slip"));
 }
 @Test @WithMockUser(authorities="ROLE_FARM_WORKER")
 void workerCannotExtractOrConfirm() throws Exception {
  mvc.perform(multipart("/api/sales/orders/ocr").file(document())).andExpect(status().isForbidden());
  mvc.perform(multipart("/api/sales/orders/weight-slip").file(document()).file(data("forbidden"))).andExpect(status().isForbidden());
  verifyNoInteractions(vision);
 }
 @Test @WithMockUser(authorities="ROLE_ACCOUNTANT")
 void aiFailureDoesNotCreateDraftOrder() throws Exception {
  when(vision.extract(any())).thenThrow(new com.farmshift.backendFarmShift.exception.BadRequestException("OCR unavailable"));
  long before = orders.count();
  mvc.perform(multipart("/api/sales/orders/ocr").file(document())).andExpect(status().isBadRequest());
  assertEquals(before, orders.count());
 }
}
