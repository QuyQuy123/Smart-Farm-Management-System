package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class InventoryItemIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired InventoryItemRepository inventory;
    @Autowired WarehouseCategoryRepository warehouses;
    @Autowired ProductCategoryRepository products;
    @Autowired BrandRepository brands;
    @Autowired MeasurementUnitRepository units;
    Long warehouseId, productId, brandId, unitId;
    static final String API = "/api/inventory-items";
    @BeforeEach void setup() {
        var warehouse = new WarehouseCategory(); warehouse.setName("Kho kiểm thử"); warehouse.setNameKey("kho kiểm thử"); warehouse = warehouses.saveAndFlush(warehouse); warehouseId = warehouse.getId();
        var product = new ProductCategory(); product.setName("Cám kiểm thử"); product.setNameKey("cám kiểm thử"); product.setWarehouse(warehouse); productId = products.saveAndFlush(product).getId();
        var unit = new MeasurementUnit(); unit.setCode("KG_TEST"); unit.setCodeKey("kg_test"); unit.setName("Kg kiểm thử"); unit.setNameKey("kg kiểm thử"); unitId = units.saveAndFlush(unit).getId();
        var brand = new Brand(); brand.setName("Nhãn hiệu kiểm thử"); brand.setNameKey("nhãn hiệu kiểm thử"); brandId = brands.saveAndFlush(brand).getId();
    }
    String payload(Map<String, Object> overrides) throws Exception {
        var values = new HashMap<String, Object>();
        values.put("warehouseId", warehouseId); values.put("name", "Cám kiểm thử"); values.put("brandId", brandId);
        values.put("unitId", unitId); values.put("price", "125000.50"); values.put("imageUrl", "/img/products/test.jpg"); values.putAll(overrides);
        return mapper.writeValueAsString(values);
    }
    long create() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("stock", 999))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.stock").value(0))
            .andExpect(jsonPath("$.data.code").doesNotExist()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
    }
    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void crudPersistsPhotoPriceAndReferencesAndStockCannotBeEdited() throws Exception {
        long id = create();
        String code = inventory.findById(id).orElseThrow().getCode();
        assertTrue(code.startsWith("SP"));
        mvc.perform(get(API).param("warehouseId", warehouseId.toString())).andExpect(jsonPath("$.data[0].name").value("Cám kiểm thử"));
        mvc.perform(get(API + "/" + id)).andExpect(jsonPath("$.data.imageUrl").value("/img/products/test.jpg"))
            .andExpect(jsonPath("$.data.unitId").value(unitId)).andExpect(jsonPath("$.data.unitName").value("Kg kiểm thử"))
            .andExpect(jsonPath("$.data.brandName").value("Nhãn hiệu kiểm thử"));
        var item = inventory.findById(id).orElseThrow(); item.setStock(new BigDecimal("7")); inventory.saveAndFlush(item);
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("price", "250000", "stock", 0))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.stock").value(7)).andExpect(jsonPath("$.data.price").value(250000));
        assertEquals(code, inventory.findById(id).orElseThrow().getCode());
        mvc.perform(delete(API + "/" + id)).andExpect(status().isConflict());
        item = inventory.findById(id).orElseThrow(); item.setStock(BigDecimal.ZERO); inventory.saveAndFlush(item);
        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(status().isNotFound());
    }
    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void preventsDuplicatesAndProtectsLinkedCatalogRows() throws Exception {
        create();
        mvc.perform(delete("/api/measurement-units/" + unitId)).andExpect(status().isConflict());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of()))).andExpect(status().isConflict());
        mvc.perform(delete("/api/product-categories/" + productId)).andExpect(status().isConflict());
        mvc.perform(delete("/api/brands/" + brandId)).andExpect(status().isConflict());
        mvc.perform(delete("/api/warehouse-categories/" + warehouseId)).andExpect(status().isConflict());
        mvc.perform(get("/api/warehouse-categories/" + warehouseId)).andExpect(jsonPath("$.data.itemCount").value(1));
        mvc.perform(get("/api/product-categories/" + productId)).andExpect(jsonPath("$.data.itemCount").value(1));
    }
    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void rejectsNegativePriceWrongWarehouseAndInvalidReferences() throws Exception {
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("price", -1)))).andExpect(status().isBadRequest());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("price", "1.234")))).andExpect(status().isBadRequest());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("brandId", 9999999)))).andExpect(status().isNotFound());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("unitId", 9999999)))).andExpect(status().isNotFound());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("unitId", "")))).andExpect(status().isBadRequest());
        var other = new WarehouseCategory(); other.setName("Kho khác"); other.setNameKey("kho khác"); other = warehouses.saveAndFlush(other);
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("warehouseId", other.getId())))).andExpect(status().isBadRequest());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("imageUrl", "data:image/png;base64,abc")))).andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void createsTypedNameAndRejectsBlankName() throws Exception {
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("name", "Hàng nhập mới"))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.name").value("Hàng nhập mới"));
        assertTrue(products.existsByNameKey("hàng nhập mới"));
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("name", "   ")))).andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(authorities="ROLE_FARM_WORKER")
    void workerCanReadButCannotWrite() throws Exception {
        mvc.perform(get(API).param("warehouseId", warehouseId.toString())).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(payload(Map.of()))).andExpect(status().isForbidden());
        mvc.perform(delete(API + "/1")).andExpect(status().isForbidden());
    }
    @Test void anonymousCannotRead() throws Exception { mvc.perform(get(API).param("warehouseId", warehouseId.toString())).andExpect(status().is4xxClientError()); }
}
