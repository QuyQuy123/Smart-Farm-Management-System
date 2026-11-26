package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.DailyPlanService;
import com.farmshift.backendFarmShift.service.FarmingProgramExcelService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class FarmingProgramExcelIntegrationTest {

    private static final String API = "/api/farming-programs";
    private static final String XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired FarmingProgramRepository programRepository;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FlockRepository flockRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productRepository;
    @Autowired MeasurementUnitRepository unitRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired CycleExpenseRepository expenseRepository;
    @Autowired DailyPlanService dailyPlanService;

    @Test
    void templatePreviewCommitAndExportRoundTripWorks() throws Exception {
        // 1. Download template
        byte[] templateBytes = mvc.perform(get(API + "/excel-template"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", XLSX_MIME))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(templateBytes.length).isGreaterThan(1000);
        assertThat(templateBytes[0]).isEqualTo((byte) 0x50);
        assertThat(templateBytes[1]).isEqualTo((byte) 0x4B);

        // 2. Preview import (must NOT persist)
        MockMultipartFile file = new MockMultipartFile("file", "mau-90-ngay.xlsx", XLSX_MIME, templateBytes);
        mvc.perform(multipart(API + "/import-excel").file(file).param("mode", "preview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(true))
                .andExpect(jsonPath("$.data.mode").value("preview"))
                .andExpect(jsonPath("$.data.savedProgram").doesNotExist())
                .andExpect(jsonPath("$.data.preview.durationDays").value(90))
                .andExpect(jsonPath("$.data.preview.steps[?(@.name == 'Cám mảnh')].quantity").value(25.0))
                .andExpect(jsonPath("$.data.preview.steps[?(@.name == 'Cám mảnh')].bagsPer1000Birds").value(30.0))
                .andExpect(jsonPath("$.data.preview.steps[?(@.category == 'DRINKING_MEDICINE')]", org.hamcrest.Matchers.hasSize(4)))
                .andExpect(jsonPath("$.data.preview.steps[?(@.category == 'CARE_PROCEDURE')]", org.hamcrest.Matchers.hasSize(2)));

        assertThat(programRepository.count()).isZero();

        // 3. Commit import
        String commitBody = mvc.perform(multipart(API + "/import-excel").file(file).param("mode", "commit"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.valid").value(true))
                .andExpect(jsonPath("$.data.savedProgram.id").isNumber())
                .andReturn().getResponse().getContentAsString();
        long savedId = mapper.readTree(commitBody).path("data").path("savedProgram").path("id").asLong();

        // 4. Duplicate program name rejected on second import
        mvc.perform(multipart(API + "/import-excel").file(file).param("mode", "preview"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("EXCEL_VALIDATION_FAILED"))
                .andExpect(jsonPath("$.data.errors[0].sheet").value(FarmingProgramExcelService.SHEET_INFO))
                .andExpect(jsonPath("$.data.errors[0].column").value("TenChuongTrinh"));

        // 5. Export existing program and verify round-trip preserves BAO_1000_CON & bags count
        byte[] exportedBytes = mvc.perform(get(API + "/" + savedId + "/export-excel"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(exportedBytes))) {
            Sheet feedSheet = wb.getSheet(FarmingProgramExcelService.SHEET_FEED);
            assertThat(feedSheet).isNotNull();
            assertThat(feedSheet.getRow(1).getCell(3).getStringCellValue()).isEqualTo("BAO_1000_CON");
            assertThat(feedSheet.getRow(1).getCell(4).getNumericCellValue()).isEqualTo(30.0);
            assertThat(feedSheet.getRow(2).getCell(4).getNumericCellValue()).isEqualTo(100.0);
            assertThat(feedSheet.getRow(3).getCell(4).getNumericCellValue()).isEqualTo(130.0);

            // Rename and re-import exported workbook
            wb.getSheet(FarmingProgramExcelService.SHEET_INFO).getRow(1).getCell(0).setCellValue("Gà ta 90 ngày bản sao");
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            MockMultipartFile reimport = new MockMultipartFile("file", "reimport.xlsx", XLSX_MIME, baos.toByteArray());
            mvc.perform(multipart(API + "/import-excel").file(reimport).param("mode", "commit"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.savedProgram.name").value("Gà ta 90 ngày bản sao"));
        }
    }

    @Test
    void rejectsSpoofedExtensionBadMagicBytesBadHeadersAndInvalidContent() throws Exception {
        // 1. Plain text file with .txt extension
        MockMultipartFile txt = new MockMultipartFile("file", "fake.txt", "text/plain", "hello".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart(API + "/import-excel").file(txt).param("mode", "preview"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.data.errors[0].sheet").value("File"));

        // 2. Spoofed .xlsx extension with non-ZIP magic bytes
        MockMultipartFile spoofed = new MockMultipartFile("file", "spoofed.xlsx", XLSX_MIME, "not a real xlsx".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart(API + "/import-excel").file(spoofed).param("mode", "preview"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.data.errors[0].sheet").value("File"))
                .andExpect(jsonPath("$.data.errors[0].message").value(org.hamcrest.Matchers.containsString("ZIP/OOXML")));

        // 3. Real .xlsx with missing/wrong sheet header
        byte[] templateBytes = mvc.perform(get(API + "/excel-template")).andReturn().getResponse().getContentAsByteArray();
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(templateBytes))) {
            wb.getSheet(FarmingProgramExcelService.SHEET_FEED).getRow(0).getCell(2).setCellValue("SaiTieuDe");
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            MockMultipartFile badHeader = new MockMultipartFile("file", "bad-header.xlsx", XLSX_MIME, baos.toByteArray());
            mvc.perform(multipart(API + "/import-excel").file(badHeader).param("mode", "preview"))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.data.errors[0].sheet").value(FarmingProgramExcelService.SHEET_FEED))
                    .andExpect(jsonPath("$.data.errors[0].row").value(1))
                    .andExpect(jsonPath("$.data.errors[0].column").value("TenCam"));
        }

        // 4. Content errors: dayTo > durationDays, invalid drinking unit, and >200-char drinking medicine name
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(templateBytes))) {
            wb.getSheet(FarmingProgramExcelService.SHEET_FEED).getRow(3).getCell(1).setCellValue(120); // exceeds 90
            wb.getSheet(FarmingProgramExcelService.SHEET_DRINKING).getRow(1).getCell(5).setCellValue("viên/con"); // invalid unit
            wb.getSheet(FarmingProgramExcelService.SHEET_DRINKING).getRow(2).getCell(2).setCellValue("A".repeat(205)); // >200 chars
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            MockMultipartFile badContent = new MockMultipartFile("file", "bad-content.xlsx", XLSX_MIME, baos.toByteArray());
            String resp = mvc.perform(multipart(API + "/import-excel").file(badContent).param("mode", "preview"))
                    .andExpect(status().isUnprocessableEntity())
                    .andReturn().getResponse().getContentAsString();
            JsonNode errors = mapper.readTree(resp).path("data").path("errors");
            assertThat(errors.size()).isGreaterThanOrEqualTo(3);
        }

        // 5. Invalid mode query param rejected with 400 INVALID_IMPORT_MODE
        MockMultipartFile validFile = new MockMultipartFile("file", "valid.xlsx", XLSX_MIME, templateBytes);
        mvc.perform(multipart(API + "/import-excel").file(validFile).param("mode", "bogus"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_IMPORT_MODE"));
    }

    @Test
    void evaluatesExcelFormulaCellsAndAcceptsDotThousandsDrinkingUnits() throws Exception {
        byte[] templateBytes = mvc.perform(get(API + "/excel-template")).andReturn().getResponse().getContentAsByteArray();
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(templateBytes))) {
            wb.getSheet(FarmingProgramExcelService.SHEET_INFO).getRow(1).getCell(0).setCellValue("CT Công thức Excel");
            wb.getSheet(FarmingProgramExcelService.SHEET_INFO).getRow(1).getCell(2).setCellFormula("30*3"); // 90
            wb.getSheet(FarmingProgramExcelService.SHEET_FEED).getRow(1).getCell(1).setCellFormula("1+29"); // 30
            wb.getSheet(FarmingProgramExcelService.SHEET_FEED).getRow(1).getCell(4).setCellFormula("10*3"); // 30 bags
            wb.getSheet(FarmingProgramExcelService.SHEET_DRINKING).getRow(1).getCell(4).setCellFormula("1/2"); // 0.5
            wb.getSheet(FarmingProgramExcelService.SHEET_DRINKING).getRow(1).getCell(5).setCellValue("gói/1.000 con");

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            MockMultipartFile formulaFile = new MockMultipartFile("file", "formula.xlsx", XLSX_MIME, baos.toByteArray());

            mvc.perform(multipart(API + "/import-excel").file(formulaFile).param("mode", "commit"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.valid").value(true))
                    .andExpect(jsonPath("$.data.savedProgram.durationDays").value(90))
                    .andExpect(jsonPath("$.data.savedProgram.steps[?(@.name == 'Cám mảnh')].quantity").value(25.0))
                    .andExpect(jsonPath("$.data.savedProgram.steps[?(@.name == 'Thuốc úm')].quantity").value(0.5));
        }
    }

    @Test
    void drinkingMedicineStepGeneratesDailyTaskAndDeductsFifoStock() throws Exception {
        // Setup area, barn, medicine warehouse, inventory lot with PACK unit
        FarmArea area = new FarmArea();
        area.setName("Khu Uống Thuốc");
        area.setNameKey("khu uống thuốc");
        area = areaRepository.save(area);

        WarehouseCategory medWh = new WarehouseCategory();
        medWh.setName("Kho thuốc Khu Uống Thuốc");
        medWh.setNameKey("kho thuốc khu uống thuốc");
        medWh.setKind("MEDICINE");
        medWh.setArea(area);
        medWh = warehouseRepository.save(medWh);
        area.getWarehouses().add(medWh);
        areaRepository.save(area);

        Barn barn = new Barn();
        barn.setArea(area);
        barn.setName("Chuồng 1");
        barn.setNameKey("chuồng 1");
        barn.setCapacity(2000);
        barn.setStatus(BarnStatus.ACTIVE);
        barn = barnRepository.save(barn);

        ProductCategory product = new ProductCategory();
        product.setName("Thuốc úm thảo dược");
        product.setNameKey("thuốc úm thảo dược");
        product = productRepository.save(product);

        MeasurementUnit packUnit = new MeasurementUnit();
        packUnit.setCode("GOI100G");
        packUnit.setCodeKey("goi100g");
        packUnit.setName("Gói 100g");
        packUnit.setNameKey("gói 100g");
        packUnit.setContentQuantity(BigDecimal.ONE);
        packUnit.setContentUnit(UsageUnit.PACK);
        packUnit = unitRepository.save(packUnit);

        InventoryItem lot = new InventoryItem();
        lot.setWarehouse(medWh);
        lot.setProduct(product);
        lot.setUnit(packUnit);
        lot.setStock(new BigDecimal("10.000000"));
        lot.setPrice(new BigDecimal("50000.00"));
        lot = inventoryRepository.save(lot);

        // Create program with FEED (BAGS_PER_1000_BIRDS) + DRINKING_MEDICINE (0.5 gói/1000 con)
        Map<String, Object> body = Map.of(
                "name", "CT Uống thuốc test",
                "breed", "Gà ta",
                "durationDays", 90,
                "steps", List.of(
                        Map.of("category", "FEED", "name", "Cám mảnh", "dayFrom", 1, "dayTo", 30,
                                "feedInputMode", "BAGS_PER_1000_BIRDS", "bagsPer1000Birds", 30, "bagWeightKg", 25, "mealsPerDay", 4),
                        Map.of("category", "DRINKING_MEDICINE", "name", "Thuốc úm thảo dược", "dayFrom", 1, "dayTo", 7,
                                "method", "HAND_DRINKER", "quantity", 0.5, "unit", "gói/1000 con", "inventoryItemId", lot.getId())
                )
        );
        String created = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.steps[?(@.category == 'FEED')].quantity").value(25.0))
                .andReturn().getResponse().getContentAsString();
        long programId = mapper.readTree(created).path("data").path("id").asLong();

        LocalDate today = LocalDate.now(CycleService.VN_ZONE);
        FarmingCycle cycle = new FarmingCycle();
        cycle.setBarn(barn);
        cycle.setCycleNumber(1);
        cycle.setStartDate(today);
        cycle.setStatus(CycleStatus.ACTIVE);
        cycle = cycleRepository.save(cycle);

        Flock flock = new Flock();
        flock.setCycle(cycle);
        flock.setName("Đàn 1");
        flock.setGender(FlockGender.MIXED);
        flock.setSourceType(FlockSource.PURCHASE);
        flock.setImportDate(today);
        flock.setAgeAtImport(1);
        flock.setImportQuantity(2000);
        flock.setImportAvgWeight(new BigDecimal("0.045"));
        flock.setUnitPrice(new BigDecimal("15000.00"));
        flock.setQuantity(2000);
        flock.setStatus(FlockStatus.ACTIVE);
        flock.setProgram(programRepository.findById(programId).orElseThrow());
        flockRepository.save(flock);

        var plan = dailyPlanService.barn(cycle.getId(), today, true);
        var drinkTask = plan.tasks().stream()
                .filter(t -> t.category() == ProgramStepCategory.DRINKING_MEDICINE)
                .findFirst().orElseThrow();
        // 2,000 birds * 0.5 gói / 1,000 birds = 1.000 gói
        assertThat(drinkTask.plannedQuantity()).isEqualByComparingTo("1.000");
        assertThat(drinkTask.method()).isEqualTo(AdministrationMethod.HAND_DRINKER);

        // Confirm task -> deducts 1 pack -> stock 9.000000 and books 50,000 VND MEDICINE expense
        dailyPlanService.confirm(cycle.getId(),
                new com.farmshift.backendFarmShift.dto.request.DailyTaskConfirmRequest(today, drinkTask.key(), null, null, null),
                "owner@farm.test", true);

        InventoryItem afterConfirm = inventoryRepository.findById(lot.getId()).orElseThrow();
        assertThat(afterConfirm.getStock()).isEqualByComparingTo("9.000000");
        List<CycleExpense> expenses = expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId());
        assertThat(expenses).hasSize(1);
        assertThat(expenses.getFirst().getCategory()).isEqualTo(ExpenseCategory.MEDICINE);
        assertThat(expenses.getFirst().getAmount()).isEqualByComparingTo("50000");

        // Undo -> restores stock to 10.000000 and removes CycleExpense
        dailyPlanService.undo(cycle.getId(), today, drinkTask.key(), "owner@farm.test", true, true);
        assertThat(inventoryRepository.findById(lot.getId()).orElseThrow().getStock()).isEqualByComparingTo("10.000000");
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).isEmpty();
    }
}
