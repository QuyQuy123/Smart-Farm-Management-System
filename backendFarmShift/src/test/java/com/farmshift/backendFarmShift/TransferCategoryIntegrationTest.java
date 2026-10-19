package com.farmshift.backendFarmShift;
import com.farmshift.backendFarmShift.repository.TransferCategoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class TransferCategoryIntegrationTest {
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper mapper;
 @Autowired TransferCategoryRepository repository;
 static final String API="/api/transfer-categories";
 static final String BODY="{\"type\":\"EXPORT\",\"name\":\"Test category\",\"description\":\"Description\"}";
 @Test @WithMockUser(authorities="ROLE_FARM_OWNER") void crudAndDuplicateValidation() throws Exception {
   var result=mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated())
     .andExpect(jsonPath("$.data.code").doesNotExist()).andExpect(jsonPath("$.data.slipCount").value(0)).andExpect(jsonPath("$.data.createdAt").exists()).andReturn();
   long id=mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("EXPORT", "Custom receipt type"))).andExpect(status().isCreated());
   String code=repository.findById(id).orElseThrow().getCode(); assertTrue(code.startsWith("DM"));
   mvc.perform(get(API+"/"+id)).andExpect(jsonPath("$.data.name").value("Test category"));
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("Test category", "  TEST CATEGORY  "))).andExpect(status().isConflict());
   mvc.perform(put(API+"/"+id).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("Test category", "Updated"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Updated"));
   assertEquals(code,repository.findById(id).orElseThrow().getCode());
   mvc.perform(get(API)).andExpect(status().isOk());
   mvc.perform(delete(API+"/"+id)).andExpect(status().isOk());
   mvc.perform(get(API+"/"+id)).andExpect(status().isNotFound());
 }
 @Test @WithMockUser(authorities="ROLE_FARM_OWNER") void rejectsInvalidFields() throws Exception {
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("Test category", "   "))).andExpect(status().isBadRequest());
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("EXPORT", "   "))).andExpect(status().isBadRequest());
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("Test category", "x".repeat(151)))).andExpect(status().isBadRequest());
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("Description", "x".repeat(1001)))).andExpect(status().isBadRequest());
 }
 @Test @WithMockUser(authorities="ROLE_FARM_WORKER") void workerReadsButCannotMutate() throws Exception {
   mvc.perform(get(API)).andExpect(status().isOk());
   mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
   mvc.perform(put(API+"/1").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
   mvc.perform(delete(API+"/1")).andExpect(status().isForbidden());
 }
 @Test void requiresAuthentication() throws Exception { mvc.perform(get(API)).andExpect(status().is4xxClientError()); }
}
