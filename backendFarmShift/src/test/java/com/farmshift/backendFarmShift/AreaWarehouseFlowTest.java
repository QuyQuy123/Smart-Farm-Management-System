package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.FarmArea;
import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = "ROLE_FARM_OWNER")
class AreaWarehouseFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;

    @Test
    void testAreaWarehouseFlow_AutoCreateAndSharedWarehouse() throws Exception {
        // Case B: Tạo Khu 1 không chọn kho -> Tự động tạo kho cám & kho thuốc riêng cho Khu 1
        var res1 = mvc.perform(post("/api/farm-areas")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "name", "Khu Nuôi 1",
                        "description", "Khu 1 thử nghiệm"
                ))))
                .andExpect(status().isCreated())
                .andReturn();

        long area1Id = mapper.readTree(res1.getResponse().getContentAsString()).path("data").path("id").asLong();
        List<WarehouseCategory> area1Whs = warehouseRepository.findAllByArea_Id(area1Id);
        assertFalse(area1Whs.isEmpty(), "Khu 1 phải tự động có kho riêng");
        assertTrue(area1Whs.stream().anyMatch(w -> "FEED".equals(w.getKind())), "Khu 1 phải có kho FEED");
        assertTrue(area1Whs.stream().anyMatch(w -> "MEDICINE".equals(w.getKind())), "Khu 1 phải có kho MEDICINE");

        WarehouseCategory feedWh1 = area1Whs.stream().filter(w -> "FEED".equals(w.getKind())).findFirst().orElseThrow();

        // Case A: Tạo Khu 2 và chọn kho có sẵn của Khu 1 (dùng chung kho)
        var res2 = mvc.perform(post("/api/farm-areas")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "name", "Khu Nuôi 2",
                        "description", "Khu 2 dùng chung kho với Khu 1",
                        "warehouseId", feedWh1.getId()
                ))))
                .andExpect(status().isCreated())
                .andReturn();

        long area2Id = mapper.readTree(res2.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Kiểm tra cả Khu 1 và Khu 2 đều liên kết với feedWh1
        List<WarehouseCategory> area2Whs = warehouseRepository.findAllByArea_Id(area2Id);
        assertTrue(area2Whs.stream().anyMatch(w -> w.getId().equals(feedWh1.getId())),
                "Khu 2 phải được liên kết với kho dùng chung của Khu 1");

        List<WarehouseCategory> recheckedArea1Whs = warehouseRepository.findAllByArea_Id(area1Id);
        assertTrue(recheckedArea1Whs.stream().anyMatch(w -> w.getId().equals(feedWh1.getId())),
                "Khu 1 vẫn phải liên kết với kho");
    }
}

