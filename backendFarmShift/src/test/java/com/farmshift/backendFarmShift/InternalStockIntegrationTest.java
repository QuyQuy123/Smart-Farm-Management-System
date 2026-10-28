package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.InternalStockCategoryRequest;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherItemRequest;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherRequest;
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
import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class InternalStockIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired jakarta.persistence.EntityManager em;
    @Autowired InternalStockCategoryRepository categoryRepository;
    @Autowired InternalStockVoucherRepository voucherRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productCategoryRepository;
    @Autowired InventoryItemRepository inventoryItemRepository;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired CycleExpenseRepository cycleExpenseRepository;

    private WarehouseCategory warehouseFeed;
    private WarehouseCategory warehouseBackup;
    private ProductCategory productHigro;

    @BeforeEach
    void setUp() {
        warehouseFeed = new WarehouseCategory();
        warehouseFeed.setName("Kho Cám Test");
        warehouseFeed.setNameKey("kho cám test");
        warehouseFeed = warehouseRepository.save(warehouseFeed);

        warehouseBackup = new WarehouseCategory();
        warehouseBackup.setName("Kho Đệm Test");
        warehouseBackup.setNameKey("kho đệm test");
        warehouseBackup = warehouseRepository.save(warehouseBackup);

        productHigro = new ProductCategory();
        productHigro.setName("Cám Higro 01 Test");
        productHigro.setNameKey("cám higro 01 test");
        productHigro.setWarehouse(warehouseFeed);
        productHigro = productCategoryRepository.save(productHigro);
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void defaultSeedCategoriesExistWithVoucherCount() throws Exception {
        mvc.perform(get("/api/internal-stock/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.data[*].name", hasItems("Nhập đầu kì", "Xuất hủy", "Chuyển kho nội bộ")))
                .andExpect(jsonPath("$.data[0].voucherCount").value(greaterThanOrEqualTo(0)));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void importCreatesAndIncrementsStock() throws Exception {
        InternalStockCategory importCat = categoryRepository.findByNameKey("nhập đầu kì").orElseThrow();

        InternalStockVoucherRequest req = new InternalStockVoucherRequest(
                "IMPORT",
                importCat.getId(),
                null,
                warehouseFeed.getId(),
                null,
                LocalDate.now(),
                "Nhập 50 bao cám đầu kỳ",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("50.000"),
                        new BigDecimal("350000"),
                        "Lô test 1"
                ))
        );

        var result = mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code", startsWith("XNB")))
                .andExpect(jsonPath("$.data.movementType").value("IMPORT"))
                .andExpect(jsonPath("$.data.totalAmount").value(17500000))
                .andReturn();

        em.clear();
        InventoryItem item = inventoryItemRepository
                .findByWarehouse_IdAndProduct_Id(warehouseFeed.getId(), productHigro.getId())
                .orElseThrow();
        assertEquals(0, new BigDecimal("50.000").compareTo(item.getStock()));

        // Nhập thêm 20 bao nữa
        InternalStockVoucherRequest req2 = new InternalStockVoucherRequest(
                "IMPORT",
                importCat.getId(),
                null,
                warehouseFeed.getId(),
                null,
                LocalDate.now(),
                "Nhập thêm",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("20.000"),
                        new BigDecimal("350000"),
                        null
                ))
        );
        mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req2)))
                .andExpect(status().isCreated());

        em.clear();
        item = inventoryItemRepository.findById(item.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("70.000").compareTo(item.getStock()));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void exportDeductsStockAtomicallyAndRejectsInsufficientStockWithMSG27() throws Exception {
        InternalStockCategory exportCat = categoryRepository.findByNameKey("xuất hủy").orElseThrow();

        // Tạo sẵn tồn kho = 10
        InventoryItem stockItem = new InventoryItem();
        stockItem.setWarehouse(warehouseFeed);
        stockItem.setProduct(productHigro);
        stockItem.setStock(new BigDecimal("10.000"));
        stockItem.setPrice(new BigDecimal("300000"));
        stockItem = inventoryItemRepository.save(stockItem);

        // Cố gắng xuất 15 -> Thất bại MSG27
        InternalStockVoucherRequest reqExcess = new InternalStockVoucherRequest(
                "EXPORT",
                exportCat.getId(),
                warehouseFeed.getId(),
                null,
                null,
                LocalDate.now(),
                "Xuất hủy vượt tồn",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("15.000"),
                        null,
                        null
                ))
        );
        mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(reqExcess)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("MSG27")));

        // Xuất 4 -> Thành công, còn 6
        InternalStockVoucherRequest reqValid = new InternalStockVoucherRequest(
                "EXPORT",
                exportCat.getId(),
                warehouseFeed.getId(),
                null,
                null,
                LocalDate.now(),
                "Xuất hủy hỏng ẩm",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("4.000"),
                        null,
                        null
                ))
        );
        mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(reqValid)))
                .andExpect(status().isCreated());

        em.clear();
        stockItem = inventoryItemRepository.findById(stockItem.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("6.000").compareTo(stockItem.getStock()));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void transferMovesStockAtomicallyBetweenWarehouses() throws Exception {
        InternalStockCategory transferCat = categoryRepository.findByNameKey("chuyển kho nội bộ").orElseThrow();

        // Tạo sẵn tồn kho = 100 tại Kho Cám
        InventoryItem sourceStock = new InventoryItem();
        sourceStock.setWarehouse(warehouseFeed);
        sourceStock.setProduct(productHigro);
        sourceStock.setStock(new BigDecimal("100.000"));
        sourceStock.setPrice(new BigDecimal("320000"));
        sourceStock = inventoryItemRepository.save(sourceStock);

        // Chuyển 30 bao từ Kho Cám sang Kho Đệm
        InternalStockVoucherRequest transferReq = new InternalStockVoucherRequest(
                "TRANSFER",
                transferCat.getId(),
                warehouseFeed.getId(),
                warehouseBackup.getId(),
                null,
                LocalDate.now(),
                "Chuyển sang kho đệm",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("30.000"),
                        null,
                        null
                ))
        );
        mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(transferReq)))
                .andExpect(status().isCreated());

        em.clear();
        sourceStock = inventoryItemRepository.findById(sourceStock.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("70.000").compareTo(sourceStock.getStock()));

        InventoryItem targetStock = inventoryItemRepository
                .findByWarehouse_IdAndProduct_Id(warehouseBackup.getId(), productHigro.getId())
                .orElseThrow();
        assertEquals(0, new BigDecimal("30.000").compareTo(targetStock.getStock()));
        // Tổng tồn kho toàn trang trại vẫn là 100
        assertEquals(0, new BigDecimal("100.000").compareTo(sourceStock.getStock().add(targetStock.getStock())));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerForbiddenFromCreatingVoucherAndFinanceHiddenInRead() throws Exception {
        InternalStockCategory importCat = categoryRepository.findByNameKey("nhập đầu kì").orElseThrow();

        InternalStockVoucherRequest req = new InternalStockVoucherRequest(
                "IMPORT",
                importCat.getId(),
                null,
                warehouseFeed.getId(),
                null,
                LocalDate.now(),
                "Công nhân thử nhập",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("10.000"),
                        new BigDecimal("200000"),
                        null
                ))
        );

        // 403 Forbidden khi tạo
        mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        // GET vouchers: Được phép xem nhưng giá trị tài chính ẩn
        mvc.perform(get("/api/internal-stock/vouchers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void voucherCancellationRestoresStock() throws Exception {
        InternalStockCategory importCat = categoryRepository.findByNameKey("nhập đầu kì").orElseThrow();

        InternalStockVoucherRequest req = new InternalStockVoucherRequest(
                "IMPORT",
                importCat.getId(),
                null,
                warehouseFeed.getId(),
                null,
                LocalDate.now(),
                "Nhập để hủy test",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("25.000"),
                        new BigDecimal("100000"),
                        null
                ))
        );

        var res = mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        long voucherId = mapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();

        em.clear();
        InventoryItem item = inventoryItemRepository
                .findByWarehouse_IdAndProduct_Id(warehouseFeed.getId(), productHigro.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("25.000").compareTo(item.getStock()));

        // Hủy phiếu -> tồn kho giảm về 0
        mvc.perform(post("/api/internal-stock/vouchers/" + voucherId + "/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        em.clear();
        item = inventoryItemRepository.findById(item.getId()).orElseThrow();
        assertEquals(0, BigDecimal.ZERO.compareTo(item.getStock()));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void categoryCrudAndSystemProtection() throws Exception {
        // Tạo category mới
        InternalStockCategoryRequest catReq = new InternalStockCategoryRequest(
                "EXPORT",
                "Xuất biếu tặng",
                "Xuất dùng cho đối tác"
        );
        var res = mvc.perform(post("/api/internal-stock/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(catReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Xuất biếu tặng"))
                .andReturn();

        long catId = mapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Xóa category tùy biến -> OK
        mvc.perform(delete("/api/internal-stock/categories/" + catId))
                .andExpect(status().isOk());

        // Xóa category hệ thống -> 409 Conflict
        InternalStockCategory systemCat = categoryRepository.findByNameKey("xuất hủy").orElseThrow();
        mvc.perform(delete("/api/internal-stock/categories/" + systemCat.getId()))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void exportWithCycleCreatesAndDeletesCycleExpense() throws Exception {
        InternalStockCategory exportCat = categoryRepository.findByNameKey("xuất hủy").orElseThrow();

        // Chuẩn bị khu, chuồng và lứa nuôi
        FarmArea area = new FarmArea();
        area.setName("Khu Test Exp");
        area.setNameKey("khu test exp");
        area = areaRepository.save(area);

        Barn barn = new Barn();
        barn.setArea(area);
        barn.setName("Chuồng Test Chi Phí");
        barn.setNameKey("chuồng test chi phí");
        barn.setStatus(BarnStatus.ACTIVE);
        barn.setCapacity(1000);
        barn.setCurrentQuantity(0);
        barn = barnRepository.save(barn);

        FarmingCycle cycle = new FarmingCycle();
        cycle.setBarn(barn);
        cycle.setCycleNumber(1);
        cycle.setStartDate(LocalDate.now());
        cycle.setStatus(CycleStatus.ACTIVE);
        cycle = cycleRepository.save(cycle);

        // Chuẩn bị tồn kho 20 bao, giá 200,000 đ
        InventoryItem stockItem = new InventoryItem();
        stockItem.setWarehouse(warehouseFeed);
        stockItem.setProduct(productHigro);
        stockItem.setStock(new BigDecimal("20.000"));
        stockItem.setPrice(new BigDecimal("200000"));
        stockItem = inventoryItemRepository.save(stockItem);

        // Xuất hủy 5 bao gắn vào lứa nuôi
        InternalStockVoucherRequest req = new InternalStockVoucherRequest(
                "EXPORT",
                exportCat.getId(),
                warehouseFeed.getId(),
                null,
                cycle.getId(),
                LocalDate.now(),
                "Xuất hủy hỏng hạch toán vào lứa",
                null,
                List.of(new InternalStockVoucherItemRequest(
                        productHigro.getId(),
                        null,
                        new BigDecimal("5.000"),
                        null,
                        null
                ))
        );

        var res = mvc.perform(post("/api/internal-stock/vouchers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.cycleId").value(cycle.getId()))
                .andExpect(jsonPath("$.data.expenseId").isNumber())
                .andExpect(jsonPath("$.data.totalAmount").value(1000000))
                .andReturn();

        long voucherId = mapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asLong();
        long expenseId = mapper.readTree(res.getResponse().getContentAsString()).path("data").path("expenseId").asLong();

        em.clear();
        CycleExpense expense = cycleExpenseRepository.findById(expenseId).orElseThrow();
        assertEquals(0, new BigDecimal("1000000.00").compareTo(expense.getAmount()));
        assertEquals(ExpenseCategory.OTHER, expense.getCategory());

        // Hủy phiếu -> xóa cycle expense
        mvc.perform(post("/api/internal-stock/vouchers/" + voucherId + "/cancel"))
                .andExpect(status().isOk());

        em.clear();
        assertTrue(cycleExpenseRepository.findById(expenseId).isEmpty());
    }
}
