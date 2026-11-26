package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.FarmingProgramRequest;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramExcelImportResponse;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramExcelImportResponse.CellError;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramResponse;
import com.farmshift.backendFarmShift.dto.response.ProgramStepResponse;
import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.repository.FarmingProgramRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.*;

/**
 * Xuất file mẫu, xuất chương trình nuôi hiện có và nhập chương trình nuôi từ Excel (.xlsx)
 * với kiểm tra 2 tầng: định dạng file (đuôi, MIME, magic bytes PK\x03\x04, dung lượng <= 5MB, cấu trúc 5 sheet)
 * và kiểm tra nội dung nghiệp vụ trả lỗi chi tiết theo {sheet, row, column, message}.
 */
@Service
@RequiredArgsConstructor
public class FarmingProgramExcelService {
    public static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024; // 5 MB

    public static final String SHEET_INFO = "ThongTinChung";
    public static final String SHEET_FEED = "CamDinhMuc";
    public static final String SHEET_DRINKING = "LichUongThuoc";
    public static final String SHEET_VACCINE = "LichVacXin";
    public static final String SHEET_MEDICINE = "ThuocTron";

    private static final List<String> INFO_HEADERS = List.of(
            "TenChuongTrinh", "GiongGa", "ThoiGianNuoiNgay", "CanNangMucTieuTuKg", "CanNangMucTieuDenKg", "MoTa");
    private static final List<String> FEED_HEADERS = List.of(
            "TuNgay", "DenNgay", "TenCam", "CheDoNhap", "DinhMuc", "TrongLuongBaoKg", "SoCuMoiNgay", "GhiChu");
    private static final List<String> DRINKING_HEADERS = List.of(
            "TuNgay", "DenNgay", "TenThuoc", "PhuongThuc", "LieuLuong", "DonVi", "GhiChu");
    private static final List<String> VACCINE_HEADERS = List.of(
            "TuNgay", "DenNgay", "Loai", "TenNoiDung", "CachDung", "LieuLuong", "DonVi", "GhiChu");
    private static final List<String> MEDICINE_HEADERS = List.of(
            "TuNgay", "DenNgay", "TenThuoc", "CachDung", "LieuLuong", "DonVi", "GhiChu");

    private static final Set<String> ALLOWED_DRINKING_UNITS = Set.of(
            "gói/1000 con", "goi/1000 con", "gói/1.000 con", "goi/1.000 con", "gói/1,000 con", "goi/1,000 con",
            "g/lít nước", "g/lit nuoc", "ml/lít nước", "ml/lit nuoc",
            "g/con/ngày", "g/con/ngay", "ml/con/ngày", "ml/con/ngay",
            "g/1000 con", "g/1.000 con", "ml/1000 con", "ml/1.000 con",
            "g/con", "ml/con", "lít/1000 con", "lit/1000 con", "lít/1.000 con", "lit/1.000 con");
    private static final Set<String> ALLOWED_MEDICINE_UNITS = Set.of(
            "g/kg cám", "g/kg cam", "ml/kg cám", "ml/kg cam", "g/lít nước", "g/lit nuoc",
            "ml/lít nước", "ml/lit nuoc", "g/con/ngày", "g/con/ngay", "ml/con/ngày", "ml/con/ngay",
            "g/1000 con", "g/1.000 con", "ml/1000 con", "ml/1.000 con");

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream",
            "application/zip",
            "application/x-zip-compressed"
    );

    private final FarmingProgramService programService;
    private final FarmingProgramRepository programRepository;

    /** Tạo file Excel mẫu chuẩn 5 sheet kèm quy trình 90 ngày tham chiếu. */
    public byte[] generateTemplate() {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle headerStyle = headerStyle(wb);

            Sheet info = createSheet(wb, SHEET_INFO, INFO_HEADERS, headerStyle);
            writeRow(info, 1, "Gà ta thương phẩm 90 ngày (Mẫu)", "Gà ta", 90, 1.8, 2.3,
                    "Quy trình 90 ngày chuẩn: 3 giai đoạn cám (30/100/130 bao/1.000 con), lịch uống thuốc bình xách tay & tự động, vắc-xin & làm mỏ.");

            Sheet feed = createSheet(wb, SHEET_FEED, FEED_HEADERS, headerStyle);
            writeRow(feed, 1, 1, 30, "Cám mảnh", "BAO_1000_CON", 30, 25, 4, "Sáng, trưa, chiều, tối");
            writeRow(feed, 2, 31, 60, "Cám phát triển", "BAO_1000_CON", 100, 25, 3, "Sáng, trưa, tối");
            writeRow(feed, 3, 61, 90, "Cám vỗ béo", "BAO_1000_CON", 130, 25, 2, "Sáng, tối");

            Sheet drinking = createSheet(wb, SHEET_DRINKING, DRINKING_HEADERS, headerStyle);
            writeRow(drinking, 1, 1, 7, "Thuốc úm", "HAND_DRINKER", 0.5, "gói/1000 con", "Uống bằng bình xách tay cho gà úm");
            writeRow(drinking, 2, 7, 15, "Men tiêu hóa", "HAND_DRINKER", 1, "g/lít nước", "Pha vào bình xách tay hằng ngày");
            writeRow(drinking, 3, 15, 60, "Men tiêu hóa + bổ thận, gan, vitamin", "AUTO_DRINKER", 1, "g/lít nước", "Pha hệ thống uống tự động hằng ngày");
            writeRow(drinking, 4, 75, 90, "Sâm kích lườn", "AUTO_DRINKER", 1, "ml/lít nước", "Bổ sung giai đoạn cuối");

            Sheet vaccine = createSheet(wb, SHEET_VACCINE, VACCINE_HEADERS, headerStyle);
            writeRow(vaccine, 1, 3, 3, "VACCINE", "Vắc-xin 3 chủng (Thận, IB, Newcastle/Lasota, Viêm phế quản)", "EYE_NOSE", 1, "liều/con", "Đợt vắc-xin đầu chu kỳ");
            writeRow(vaccine, 2, 8, 8, "VACCINE", "Vắc-xin Gumboro", "DRINKING_WATER", 1, "liều/con", "");
            writeRow(vaccine, 3, 12, 12, "VACCINE", "Vắc-xin Đậu gà", "WING_WEB", 1, "liều/con", "");
            writeRow(vaccine, 4, 16, 16, "VACCINE", "Vắc-xin IB lần 2", "EYE_NOSE", 1, "liều/con", "");
            writeRow(vaccine, 5, 16, 16, "CARE_PROCEDURE", "Làm mỏ lần 1", "PROCEDURE", "", "", "Thủ thuật chăm sóc định kỳ");
            writeRow(vaccine, 6, 21, 21, "VACCINE", "Nhắc lại Gumboro", "DRINKING_WATER", 1, "liều/con", "");
            writeRow(vaccine, 7, 28, 28, "VACCINE", "Vắc-xin ILT", "EYE_NOSE", 1, "liều/con", "");
            writeRow(vaccine, 8, 35, 35, "VACCINE", "Tiêm Cúm gia cầm", "INJECTION", 1, "liều/con", "");
            writeRow(vaccine, 9, 45, 45, "CARE_PROCEDURE", "Làm mỏ lại (lần 2)", "PROCEDURE", "", "", "Thủ thuật chăm sóc định kỳ");
            writeRow(vaccine, 10, 70, 70, "VACCINE", "Nhắc lại Newcastle + Cúm", "INJECTION", 1, "liều/con", "");

            Sheet med = createSheet(wb, SHEET_MEDICINE, MEDICINE_HEADERS, headerStyle);
            writeRow(med, 1, 15, 17, "Thuốc phòng cầu trùng trộn cám", "MIX_FEED", 2, "g/kg cám", "Ví dụ thuốc trộn cám");

            autosize(wb);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Không thể tạo file Excel mẫu.", e);
        }
    }

    /** Xuất chương trình nuôi hiện có ra file .xlsx đúng 5 sheet chuẩn để có thể sửa và import lại. */
    @Transactional(readOnly = true)
    public byte[] exportProgram(Long id) {
        FarmingProgramResponse program = programService.get(id);
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle headerStyle = headerStyle(wb);

            Sheet info = createSheet(wb, SHEET_INFO, INFO_HEADERS, headerStyle);
            writeRow(info, 1, program.name(), program.breed(), program.durationDays(),
                    program.targetWeightMin(), program.targetWeightMax(), program.description() == null ? "" : program.description());

            Sheet feed = createSheet(wb, SHEET_FEED, FEED_HEADERS, headerStyle);
            Sheet drinking = createSheet(wb, SHEET_DRINKING, DRINKING_HEADERS, headerStyle);
            Sheet vaccine = createSheet(wb, SHEET_VACCINE, VACCINE_HEADERS, headerStyle);
            Sheet med = createSheet(wb, SHEET_MEDICINE, MEDICINE_HEADERS, headerStyle);

            int feedRow = 1, drinkRow = 1, vacRow = 1, medRow = 1;
            for (ProgramStepResponse step : program.steps()) {
                switch (step.category()) {
                    case FEED -> {
                        boolean bagsMode = FarmingProgramService.FEED_MODE_BAGS.equalsIgnoreCase(step.feedInputMode())
                                && step.bagsPer1000Birds() != null;
                        writeRow(feed, feedRow++, step.dayFrom(), step.dayTo(), step.name(),
                                bagsMode ? "BAO_1000_CON" : "GRAM_CON_NGAY",
                                bagsMode ? step.bagsPer1000Birds() : step.quantity(),
                                bagsMode ? (step.bagWeightKg() != null ? step.bagWeightKg() : FarmingProgramService.DEFAULT_BAG_WEIGHT_KG) : "",
                                step.mealsPerDay(),
                                step.note() == null ? "" : step.note());
                    }
                    case DRINKING_MEDICINE -> writeRow(drinking, drinkRow++, step.dayFrom(), step.dayTo(), step.name(),
                            step.method() == null ? "" : step.method().name(), step.quantity(),
                            step.unit() == null ? "" : step.unit(), step.note() == null ? "" : step.note());
                    case VACCINE, CARE_PROCEDURE -> writeRow(vaccine, vacRow++, step.dayFrom(), step.dayTo(), step.category().name(),
                            step.name(), step.method() == null ? "" : step.method().name(),
                            step.quantity() == null ? "" : step.quantity(),
                            step.unit() == null ? "" : step.unit(), step.note() == null ? "" : step.note());
                    case MEDICINE -> writeRow(med, medRow++, step.dayFrom(), step.dayTo(), step.name(),
                            step.method() == null ? "" : step.method().name(), step.quantity(),
                            step.unit() == null ? "" : step.unit(), step.note() == null ? "" : step.note());
                    default -> {
                        // Legacy TEMPERATURE / WORK steps are omitted from the new 5-sheet Excel export.
                    }
                }
            }

            autosize(wb);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Không thể xuất file Excel chương trình nuôi.", e);
        }
    }

    /**
     * Kiểm tra 2 tầng (file + nội dung) và trả bản xem trước (preview) hoặc lưu DB (commit).
     * Không bọc @Transactional ở lớp ngoài để lỗi từ programService.create(...) không đánh dấu rollback-only
     * hay bị quy nhầm thành lỗi cấu trúc file Excel.
     */
    public FarmingProgramExcelImportResponse importExcel(MultipartFile file, boolean commit) {
        String mode = commit ? "commit" : "preview";
        List<CellError> errors = new ArrayList<>();

        // --- Layer 1: File format validation ---
        if (file == null || file.isEmpty()) {
            errors.add(new CellError("File", null, "file", "Vui lòng chọn file Excel (.xlsx) không rỗng."));
            return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            errors.add(new CellError("File", null, "file", "Dung lượng file vượt quá giới hạn tối đa 5 MB."));
            return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
        }
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            errors.add(new CellError("File", null, "file", "Định dạng file không hợp lệ. Chỉ chấp nhận file Excel đuôi .xlsx."));
            return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            String normalizedCt = contentType.split(";")[0].strip().toLowerCase(Locale.ROOT);
            if (!ALLOWED_CONTENT_TYPES.contains(normalizedCt)) {
                errors.add(new CellError("File", null, "file", "Kiểu MIME file (" + normalizedCt + ") không phải file Excel .xlsx hợp lệ."));
                return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
            }
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            errors.add(new CellError("File", null, "file", "Không thể đọc dữ liệu file tải lên."));
            return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
        }
        if (bytes.length < 4 || bytes[0] != 0x50 || bytes[1] != 0x4B || bytes[2] != 0x03 || bytes[3] != 0x04) {
            errors.add(new CellError("File", null, "file", "File không đúng cấu trúc nén ZIP/OOXML (.xlsx). Vui lòng không đổi đuôi từ định dạng khác."));
            return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
        }

        FarmingProgramRequest request;
        int infoRowNumber = 2;
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            DataFormatter formatter = new DataFormatter(Locale.US);
            FormulaEvaluator evaluator = wb.getCreationHelper().createFormulaEvaluator();

            Sheet infoSheet = validateSheetAndHeaders(wb, SHEET_INFO, INFO_HEADERS, formatter, evaluator, errors);
            Sheet feedSheet = validateSheetAndHeaders(wb, SHEET_FEED, FEED_HEADERS, formatter, evaluator, errors);
            Sheet drinkingSheet = validateSheetAndHeaders(wb, SHEET_DRINKING, DRINKING_HEADERS, formatter, evaluator, errors);
            Sheet vaccineSheet = validateSheetAndHeaders(wb, SHEET_VACCINE, VACCINE_HEADERS, formatter, evaluator, errors);
            Sheet medicineSheet = validateSheetAndHeaders(wb, SHEET_MEDICINE, MEDICINE_HEADERS, formatter, evaluator, errors);

            if (!errors.isEmpty()) {
                return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
            }

            // --- Layer 2: Business content validation ---
            Row infoRow = findFirstDataRow(infoSheet, formatter, evaluator);
            String name = null, breed = null, description = "";
            Integer durationDays = null;
            BigDecimal targetMin = null, targetMax = null;

            if (infoRow == null) {
                errors.add(new CellError(SHEET_INFO, 2, "TenChuongTrinh", "Thiếu dòng dữ liệu thông tin chung chương trình nuôi."));
            } else {
                int r = infoRow.getRowNum() + 1;
                infoRowNumber = r;
                name = readString(infoRow, 0, formatter, evaluator);
                breed = readString(infoRow, 1, formatter, evaluator);
                durationDays = readInteger(infoRow, 2, formatter, evaluator, SHEET_INFO, "ThoiGianNuoiNgay", true, errors);
                targetMin = readDecimal(infoRow, 3, formatter, evaluator, SHEET_INFO, "CanNangMucTieuTuKg", false, errors);
                targetMax = readDecimal(infoRow, 4, formatter, evaluator, SHEET_INFO, "CanNangMucTieuDenKg", false, errors);
                description = readString(infoRow, 5, formatter, evaluator);

                if (name.isBlank()) {
                    errors.add(new CellError(SHEET_INFO, r, "TenChuongTrinh", "Tên chương trình không được để trống."));
                } else if (name.length() > 150) {
                    errors.add(new CellError(SHEET_INFO, r, "TenChuongTrinh", "Tên chương trình không quá 150 ký tự."));
                } else {
                    String normalizedName = FarmAreaService.normalizeName(name);
                    if (programRepository.existsByNameKey(normalizedName.toLowerCase(Locale.ROOT))) {
                        errors.add(new CellError(SHEET_INFO, r, "TenChuongTrinh", "Tên chương trình \"" + normalizedName + "\" đã tồn tại trong hệ thống."));
                    }
                }
                if (breed.isBlank()) {
                    errors.add(new CellError(SHEET_INFO, r, "GiongGa", "Giống gà không được để trống."));
                } else if (breed.length() > 100) {
                    errors.add(new CellError(SHEET_INFO, r, "GiongGa", "Tên giống gà không quá 100 ký tự."));
                }
                if (durationDays != null && (durationDays < 1 || durationDays > 365)) {
                    errors.add(new CellError(SHEET_INFO, r, "ThoiGianNuoiNgay", "Thời gian nuôi phải nằm trong khoảng 1 đến 365 ngày."));
                }
                if (targetMin != null && (targetMin.compareTo(new BigDecimal("0.01")) < 0 || targetMin.compareTo(new BigDecimal("20")) > 0)) {
                    errors.add(new CellError(SHEET_INFO, r, "CanNangMucTieuTuKg", "Cân nặng mục tiêu tối thiểu phải từ 0,01 đến 20 kg."));
                }
                if (targetMax != null && (targetMax.compareTo(new BigDecimal("0.01")) < 0 || targetMax.compareTo(new BigDecimal("20")) > 0)) {
                    errors.add(new CellError(SHEET_INFO, r, "CanNangMucTieuDenKg", "Cân nặng mục tiêu tối đa phải từ 0,01 đến 20 kg."));
                }
                if (targetMin != null && targetMax != null && targetMin.compareTo(targetMax) > 0) {
                    errors.add(new CellError(SHEET_INFO, r, "CanNangMucTieuDenKg", "Cân nặng tối đa phải lớn hơn hoặc bằng tối thiểu."));
                }
                if (description.length() > 1000) {
                    errors.add(new CellError(SHEET_INFO, r, "MoTa", "Mô tả không quá 1000 ký tự."));
                }
            }

            List<FarmingProgramRequest.Step> parsedSteps = new ArrayList<>();
            parseFeedSheet(feedSheet, formatter, evaluator, durationDays, parsedSteps, errors);
            parseDrinkingSheet(drinkingSheet, formatter, evaluator, durationDays, parsedSteps, errors);
            parseVaccineSheet(vaccineSheet, formatter, evaluator, durationDays, parsedSteps, errors);
            parseMedicineSheet(medicineSheet, formatter, evaluator, durationDays, parsedSteps, errors);

            if (!errors.isEmpty()) {
                return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
            }

            request = new FarmingProgramRequest(
                    name, breed, durationDays, targetMin, targetMax, description, parsedSteps);
            try {
                FarmingProgramService.validate(request);
            } catch (com.farmshift.backendFarmShift.exception.BadRequestException e) {
                errors.add(new CellError(SHEET_INFO, infoRowNumber, "TenChuongTrinh", e.getMessage()));
                return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
            }
        } catch (Exception e) {
            errors.add(new CellError("File", null, "file", "File Excel bị lỗi cấu trúc hoặc không thể đọc được: " + e.getMessage()));
            return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
        }

        if (commit) {
            try {
                FarmingProgramResponse saved = programService.create(request);
                return new FarmingProgramExcelImportResponse(true, mode, List.of(), saved, saved);
            } catch (ConflictException e) {
                errors.add(new CellError(SHEET_INFO, infoRowNumber, "TenChuongTrinh", e.getMessage()));
                return new FarmingProgramExcelImportResponse(false, mode, errors, null, null);
            }
        }
        FarmingProgramResponse preview = buildPreview(request);
        return new FarmingProgramExcelImportResponse(true, mode, List.of(), preview, null);
    }

    private void parseFeedSheet(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator, Integer durationDays,
                                List<FarmingProgramRequest.Step> out, List<CellError> errors) {
        record FeedRow(int excelRow, int dayFrom, int dayTo) { }
        List<FeedRow> validRanges = new ArrayList<>();
        int nonBlankCount = 0;

        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (isRowBlank(row, FEED_HEADERS.size(), formatter, evaluator)) continue;
            nonBlankCount++;
            int r = i + 1;

            Integer dayFrom = readInteger(row, 0, formatter, evaluator, SHEET_FEED, "TuNgay", true, errors);
            Integer dayTo = readInteger(row, 1, formatter, evaluator, SHEET_FEED, "DenNgay", true, errors);
            String feedName = readString(row, 2, formatter, evaluator);
            String rawMode = readString(row, 3, formatter, evaluator);
            BigDecimal amount = readDecimal(row, 4, formatter, evaluator, SHEET_FEED, "DinhMuc", true, errors);
            BigDecimal bagWeight = readDecimal(row, 5, formatter, evaluator, SHEET_FEED, "TrongLuongBaoKg", false, errors);
            Integer meals = readInteger(row, 6, formatter, evaluator, SHEET_FEED, "SoCuMoiNgay", true, errors);
            String note = readString(row, 7, formatter, evaluator);

            boolean rowOk = validateDayRange(SHEET_FEED, r, dayFrom, dayTo, durationDays, errors);
            if (feedName.isBlank()) {
                errors.add(new CellError(SHEET_FEED, r, "TenCam", "Tên cám không được để trống."));
                rowOk = false;
            } else if (feedName.length() > 200) {
                errors.add(new CellError(SHEET_FEED, r, "TenCam", "Tên cám không quá 200 ký tự."));
                rowOk = false;
            }

            String feedMode = resolveFeedMode(rawMode);
            if (feedMode == null) {
                errors.add(new CellError(SHEET_FEED, r, "CheDoNhap", "Chế độ nhập phải là BAO_1000_CON hoặc GRAM_CON_NGAY."));
                rowOk = false;
            }
            if (amount == null || amount.signum() <= 0) {
                if (amount != null) errors.add(new CellError(SHEET_FEED, r, "DinhMuc", "Định mức phải lớn hơn 0."));
                rowOk = false;
            } else if (amount.setScale(3, RoundingMode.HALF_UP).compareTo(FarmingProgramService.MAX_STEP_QUANTITY) > 0) {
                errors.add(new CellError(SHEET_FEED, r, "DinhMuc", "Định mức vượt quá giới hạn tối đa cho phép."));
                rowOk = false;
            }
            if (FarmingProgramService.FEED_MODE_BAGS.equals(feedMode)) {
                if (bagWeight != null && bagWeight.signum() <= 0) {
                    errors.add(new CellError(SHEET_FEED, r, "TrongLuongBaoKg", "Trọng lượng 1 bao cám phải lớn hơn 0."));
                    rowOk = false;
                } else if (bagWeight != null && bagWeight.setScale(3, RoundingMode.HALF_UP).compareTo(FarmingProgramService.MAX_BAG_WEIGHT_KG) > 0) {
                    errors.add(new CellError(SHEET_FEED, r, "TrongLuongBaoKg", "Trọng lượng 1 bao cám vượt quá giới hạn tối đa cho phép."));
                    rowOk = false;
                }
            }
            if (meals == null || meals < 1 || meals > 8) {
                if (meals != null) errors.add(new CellError(SHEET_FEED, r, "SoCuMoiNgay", "Số cữ ăn mỗi ngày phải từ 1 đến 8."));
                rowOk = false;
            }
            if (note.length() > 1000) {
                errors.add(new CellError(SHEET_FEED, r, "GhiChu", "Ghi chú không quá 1000 ký tự."));
                rowOk = false;
            }

            if (rowOk) {
                boolean bagsMode = FarmingProgramService.FEED_MODE_BAGS.equals(feedMode);
                BigDecimal effBagWeight = bagsMode ? (bagWeight != null ? bagWeight.setScale(3, RoundingMode.HALF_UP) : FarmingProgramService.DEFAULT_BAG_WEIGHT_KG) : null;
                BigDecimal gramPerBirdDay = bagsMode
                        ? FarmingProgramService.toGramPerBirdPerDay(amount, effBagWeight, dayFrom, dayTo)
                        : amount.setScale(3, RoundingMode.HALF_UP);
                if (gramPerBirdDay.signum() <= 0) {
                    errors.add(new CellError(SHEET_FEED, r, "DinhMuc", "Định mức sau quy đổi phải lớn hơn 0 g/con/ngày."));
                    continue;
                }
                if (gramPerBirdDay.compareTo(FarmingProgramService.MAX_STEP_QUANTITY) > 0) {
                    errors.add(new CellError(SHEET_FEED, r, "DinhMuc", "Định mức sau quy đổi vượt quá giới hạn tối đa cho phép."));
                    continue;
                }
                validRanges.add(new FeedRow(r, dayFrom, dayTo));
                out.add(new FarmingProgramRequest.Step(
                        ProgramStepCategory.FEED, feedName, dayFrom, dayTo,
                        gramPerBirdDay, "g/con/ngày", meals, null, null, null, note, null,
                        feedMode, effBagWeight, bagsMode ? amount.setScale(3, RoundingMode.HALF_UP) : null));
            }
        }

        if (nonBlankCount == 0) {
            errors.add(new CellError(SHEET_FEED, 2, "TenCam", "Sheet CamDinhMuc cần có ít nhất 1 dòng định mức cám."));
            return;
        }

        validRanges.sort(Comparator.comparingInt(FeedRow::dayFrom).thenComparingInt(FeedRow::excelRow));
        for (int i = 1; i < validRanges.size(); i++) {
            FeedRow prev = validRanges.get(i - 1);
            FeedRow curr = validRanges.get(i);
            if (curr.dayFrom() <= prev.dayTo()) {
                errors.add(new CellError(SHEET_FEED, curr.excelRow(), "TuNgay",
                        "Khoảng ngày " + curr.dayFrom() + "–" + curr.dayTo() + " bị chồng lên dòng " + prev.excelRow()
                                + " (ngày " + prev.dayFrom() + "–" + prev.dayTo() + ")."));
            }
        }
    }

    private void parseDrinkingSheet(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator, Integer durationDays,
                                    List<FarmingProgramRequest.Step> out, List<CellError> errors) {
        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (isRowBlank(row, DRINKING_HEADERS.size(), formatter, evaluator)) continue;
            int r = i + 1;

            Integer dayFrom = readInteger(row, 0, formatter, evaluator, SHEET_DRINKING, "TuNgay", true, errors);
            Integer dayTo = readInteger(row, 1, formatter, evaluator, SHEET_DRINKING, "DenNgay", true, errors);
            String name = readString(row, 2, formatter, evaluator);
            String rawMethod = readString(row, 3, formatter, evaluator);
            BigDecimal qty = readDecimal(row, 4, formatter, evaluator, SHEET_DRINKING, "LieuLuong", true, errors);
            String unit = readString(row, 5, formatter, evaluator);
            String note = readString(row, 6, formatter, evaluator);

            boolean rowOk = validateDayRange(SHEET_DRINKING, r, dayFrom, dayTo, durationDays, errors);
            if (name.isBlank()) {
                errors.add(new CellError(SHEET_DRINKING, r, "TenThuoc", "Tên thuốc uống / bổ sung không được để trống."));
                rowOk = false;
            } else if (name.length() > 200) {
                errors.add(new CellError(SHEET_DRINKING, r, "TenThuoc", "Tên thuốc uống / bổ sung không quá 200 ký tự."));
                rowOk = false;
            }
            AdministrationMethod method = resolveDrinkingMethod(rawMethod);
            if (method == null) {
                errors.add(new CellError(SHEET_DRINKING, r, "PhuongThuc",
                        "Phương thức uống thuốc phải là HAND_DRINKER (Bình xách tay), AUTO_DRINKER (Hệ thống uống tự động) hoặc MIX_WATER."));
                rowOk = false;
            }
            if (qty == null || qty.signum() <= 0) {
                if (qty != null) errors.add(new CellError(SHEET_DRINKING, r, "LieuLuong", "Liều lượng phải lớn hơn 0."));
                rowOk = false;
            } else if (qty.setScale(3, RoundingMode.HALF_UP).compareTo(FarmingProgramService.MAX_STEP_QUANTITY) > 0) {
                errors.add(new CellError(SHEET_DRINKING, r, "LieuLuong", "Liều lượng vượt quá giới hạn tối đa cho phép."));
                rowOk = false;
            }
            if (unit.isBlank() || !ALLOWED_DRINKING_UNITS.contains(normalizeKey(unit))) {
                errors.add(new CellError(SHEET_DRINKING, r, "DonVi",
                        "Đơn vị liều không hợp lệ. Dùng: gói/1000 con, g/lít nước, ml/lít nước, g/con/ngày, ml/con/ngày."));
                rowOk = false;
            }
            if (note.length() > 1000) {
                errors.add(new CellError(SHEET_DRINKING, r, "GhiChu", "Ghi chú không quá 1000 ký tự."));
                rowOk = false;
            }

            if (rowOk) {
                out.add(new FarmingProgramRequest.Step(
                        ProgramStepCategory.DRINKING_MEDICINE, name, dayFrom, dayTo,
                        qty.setScale(3, RoundingMode.HALF_UP), unit, null, method, null, null, note, null,
                        null, null, null));
            }
        }
    }

    private void parseVaccineSheet(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator, Integer durationDays,
                                   List<FarmingProgramRequest.Step> out, List<CellError> errors) {
        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (isRowBlank(row, VACCINE_HEADERS.size(), formatter, evaluator)) continue;
            int r = i + 1;

            Integer dayFrom = readInteger(row, 0, formatter, evaluator, SHEET_VACCINE, "TuNgay", true, errors);
            Integer dayTo = readInteger(row, 1, formatter, evaluator, SHEET_VACCINE, "DenNgay", true, errors);
            String rawType = readString(row, 2, formatter, evaluator);
            String name = readString(row, 3, formatter, evaluator);
            String rawMethod = readString(row, 4, formatter, evaluator);
            BigDecimal qty = readDecimal(row, 5, formatter, evaluator, SHEET_VACCINE, "LieuLuong", false, errors);
            String unit = readString(row, 6, formatter, evaluator);
            String note = readString(row, 7, formatter, evaluator);

            boolean rowOk = validateDayRange(SHEET_VACCINE, r, dayFrom, dayTo, durationDays, errors);
            ProgramStepCategory category = resolveVaccineRowCategory(rawType);
            if (category == null) {
                errors.add(new CellError(SHEET_VACCINE, r, "Loai", "Loại phải là VACCINE hoặc CARE_PROCEDURE (Thủ thuật)."));
                rowOk = false;
            }
            if (name.isBlank()) {
                errors.add(new CellError(SHEET_VACCINE, r, "TenNoiDung", "Tên vắc-xin / thủ thuật không được để trống."));
                rowOk = false;
            } else if (name.length() > 200) {
                errors.add(new CellError(SHEET_VACCINE, r, "TenNoiDung", "Tên vắc-xin / thủ thuật không quá 200 ký tự."));
                rowOk = false;
            }

            AdministrationMethod method = null;
            if (category == ProgramStepCategory.VACCINE) {
                method = resolveVaccineMethod(rawMethod);
                if (method == null) {
                    errors.add(new CellError(SHEET_VACCINE, r, "CachDung",
                            "Cách dùng vắc-xin phải thuộc: EYE_NOSE, MOUTH, DRINKING_WATER, INJECTION, WING_WEB."));
                    rowOk = false;
                }
            } else if (category == ProgramStepCategory.CARE_PROCEDURE) {
                if (rawMethod.isBlank()) {
                    method = AdministrationMethod.PROCEDURE;
                } else {
                    method = resolveProcedureMethod(rawMethod);
                    if (method == null) {
                        errors.add(new CellError(SHEET_VACCINE, r, "CachDung", "Cách dùng thủ thuật phải là PROCEDURE (Thủ thuật)."));
                        rowOk = false;
                    }
                }
            }

            if (qty != null && qty.signum() <= 0) {
                errors.add(new CellError(SHEET_VACCINE, r, "LieuLuong", "Liều lượng (nếu nhập) phải lớn hơn 0."));
                rowOk = false;
            } else if (qty != null && qty.setScale(3, RoundingMode.HALF_UP).compareTo(FarmingProgramService.MAX_STEP_QUANTITY) > 0) {
                errors.add(new CellError(SHEET_VACCINE, r, "LieuLuong", "Liều lượng vượt quá giới hạn tối đa cho phép."));
                rowOk = false;
            }
            if (unit.length() > 50) {
                errors.add(new CellError(SHEET_VACCINE, r, "DonVi", "Đơn vị không quá 50 ký tự."));
                rowOk = false;
            }
            if (note.length() > 1000) {
                errors.add(new CellError(SHEET_VACCINE, r, "GhiChu", "Ghi chú không quá 1000 ký tự."));
                rowOk = false;
            }

            if (rowOk) {
                out.add(new FarmingProgramRequest.Step(
                        category, name, dayFrom, dayTo,
                        qty == null ? null : qty.setScale(3, RoundingMode.HALF_UP),
                        unit.isBlank() ? (category == ProgramStepCategory.VACCINE && qty != null ? "liều/con" : "") : unit,
                        null, method, null, null, note, null, null, null, null));
            }
        }
    }

    private void parseMedicineSheet(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator, Integer durationDays,
                                    List<FarmingProgramRequest.Step> out, List<CellError> errors) {
        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (isRowBlank(row, MEDICINE_HEADERS.size(), formatter, evaluator)) continue;
            int r = i + 1;

            Integer dayFrom = readInteger(row, 0, formatter, evaluator, SHEET_MEDICINE, "TuNgay", true, errors);
            Integer dayTo = readInteger(row, 1, formatter, evaluator, SHEET_MEDICINE, "DenNgay", true, errors);
            String name = readString(row, 2, formatter, evaluator);
            String rawMethod = readString(row, 3, formatter, evaluator);
            BigDecimal qty = readDecimal(row, 4, formatter, evaluator, SHEET_MEDICINE, "LieuLuong", true, errors);
            String unit = readString(row, 5, formatter, evaluator);
            String note = readString(row, 6, formatter, evaluator);

            boolean rowOk = validateDayRange(SHEET_MEDICINE, r, dayFrom, dayTo, durationDays, errors);
            if (name.isBlank()) {
                errors.add(new CellError(SHEET_MEDICINE, r, "TenThuoc", "Tên thuốc trộn không được để trống."));
                rowOk = false;
            } else if (name.length() > 200) {
                errors.add(new CellError(SHEET_MEDICINE, r, "TenThuoc", "Tên thuốc trộn không quá 200 ký tự."));
                rowOk = false;
            }
            AdministrationMethod method = resolveMedicineMethod(rawMethod);
            if (method == null) {
                errors.add(new CellError(SHEET_MEDICINE, r, "CachDung", "Cách dùng thuốc trộn phải là MIX_FEED (Trộn cám) hoặc MIX_WATER (Pha nước uống)."));
                rowOk = false;
            }
            if (qty == null || qty.signum() <= 0) {
                if (qty != null) errors.add(new CellError(SHEET_MEDICINE, r, "LieuLuong", "Liều lượng phải lớn hơn 0."));
                rowOk = false;
            } else if (qty.setScale(3, RoundingMode.HALF_UP).compareTo(FarmingProgramService.MAX_STEP_QUANTITY) > 0) {
                errors.add(new CellError(SHEET_MEDICINE, r, "LieuLuong", "Liều lượng vượt quá giới hạn tối đa cho phép."));
                rowOk = false;
            }
            if (unit.isBlank() || !ALLOWED_MEDICINE_UNITS.contains(normalizeKey(unit))) {
                errors.add(new CellError(SHEET_MEDICINE, r, "DonVi",
                        "Đơn vị liều thuốc trộn không hợp lệ. Dùng: g/kg cám, ml/kg cám, g/lít nước, ml/lít nước."));
                rowOk = false;
            }
            if (note.length() > 1000) {
                errors.add(new CellError(SHEET_MEDICINE, r, "GhiChu", "Ghi chú không quá 1000 ký tự."));
                rowOk = false;
            }

            if (rowOk) {
                out.add(new FarmingProgramRequest.Step(
                        ProgramStepCategory.MEDICINE, name, dayFrom, dayTo,
                        qty.setScale(3, RoundingMode.HALF_UP), unit, null, method, null, null, note, null,
                        null, null, null));
            }
        }
    }

    private FarmingProgramResponse buildPreview(FarmingProgramRequest request) {
        List<ProgramStepResponse> steps = new ArrayList<>();
        for (int i = 0; i < request.steps().size(); i++) {
            FarmingProgramRequest.Step s = request.steps().get(i);
            steps.add(new ProgramStepResponse(
                    (long) (i + 1), s.category(), s.name().strip(), s.dayFrom(), s.dayTo(),
                    s.quantity(), s.unit(), s.mealsPerDay(), s.method(), s.tempMin(), s.tempMax(),
                    s.note(), null, null, null, null,
                    s.feedInputMode(), s.bagWeightKg(), s.bagsPer1000Birds()));
        }
        return new FarmingProgramResponse(
                null, "PREVIEW", FarmAreaService.normalizeName(request.name()),
                FarmAreaService.normalizeName(request.breed()), request.durationDays(),
                request.targetWeightMin(), request.targetWeightMax(),
                CycleService.clean(request.description()), steps, 0L, null);
    }

    private static Sheet validateSheetAndHeaders(Workbook wb, String sheetName, List<String> expectedHeaders,
                                                 DataFormatter formatter, FormulaEvaluator evaluator, List<CellError> errors) {
        Sheet sheet = wb.getSheet(sheetName);
        if (sheet == null) {
            errors.add(new CellError(sheetName, 1, sheetName, "Thiếu sheet bắt buộc \"" + sheetName + "\"."));
            return null;
        }
        Row headerRow = sheet.getRow(0);
        if (headerRow == null) {
            errors.add(new CellError(sheetName, 1, expectedHeaders.getFirst(), "Sheet \"" + sheetName + "\" thiếu dòng tiêu đề cột (dòng 1)."));
            return null;
        }
        for (int col = 0; col < expectedHeaders.size(); col++) {
            String expected = expectedHeaders.get(col);
            String actual = readString(headerRow, col, formatter, evaluator);
            if (!expected.equalsIgnoreCase(actual)) {
                errors.add(new CellError(sheetName, 1, expected,
                        "Cột thứ " + (col + 1) + " phải có tiêu đề \"" + expected + "\" (đang là \"" + actual + "\")."));
            }
        }
        return sheet;
    }

    private static boolean validateDayRange(String sheet, int row, Integer dayFrom, Integer dayTo, Integer durationDays, List<CellError> errors) {
        boolean ok = true;
        if (dayFrom == null || dayFrom < 1 || dayFrom > 365) {
            if (dayFrom != null) errors.add(new CellError(sheet, row, "TuNgay", "Ngày bắt đầu phải từ 1 đến 365."));
            ok = false;
        }
        if (dayTo == null || dayTo < 1 || dayTo > 365) {
            if (dayTo != null) errors.add(new CellError(sheet, row, "DenNgay", "Ngày kết thúc phải từ 1 đến 365."));
            ok = false;
        }
        if (dayFrom != null && dayTo != null) {
            if (dayFrom > dayTo) {
                errors.add(new CellError(sheet, row, "DenNgay", "Ngày bắt đầu (" + dayFrom + ") phải nhỏ hơn hoặc bằng ngày kết thúc (" + dayTo + ")."));
                ok = false;
            }
            if (durationDays != null && dayTo > durationDays) {
                errors.add(new CellError(sheet, row, "DenNgay", "Ngày kết thúc (" + dayTo + ") vượt quá thời gian nuôi (" + durationDays + " ngày)."));
                ok = false;
            }
        }
        return ok;
    }

    private static String resolveFeedMode(String raw) {
        if (raw == null || raw.isBlank()) return FarmingProgramService.FEED_MODE_GRAM;
        String key = normalizeKey(raw);
        return switch (key) {
            case "bao_1000_con", "bags_per_1000_birds", "bao/1000 con", "bao/1.000 con" -> FarmingProgramService.FEED_MODE_BAGS;
            case "gram_con_ngay", "gram_per_bird_day", "g/con/ngày", "g/con/ngay" -> FarmingProgramService.FEED_MODE_GRAM;
            default -> null;
        };
    }

    private static AdministrationMethod resolveDrinkingMethod(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String key = normalizeKey(raw);
        return switch (key) {
            case "hand_drinker", "bình xách tay", "binh xach tay" -> AdministrationMethod.HAND_DRINKER;
            case "auto_drinker", "hệ thống uống tự động", "he thong uong tu dong", "uống tự động", "uong tu dong" -> AdministrationMethod.AUTO_DRINKER;
            case "mix_water", "pha nước uống", "pha nuoc uong", "drinking_water" -> AdministrationMethod.MIX_WATER;
            default -> null;
        };
    }

    private static ProgramStepCategory resolveVaccineRowCategory(String raw) {
        if (raw == null || raw.isBlank()) return ProgramStepCategory.VACCINE;
        String key = normalizeKey(raw);
        return switch (key) {
            case "vaccine", "vắc-xin", "vac-xin", "vacxin" -> ProgramStepCategory.VACCINE;
            case "care_procedure", "thu_thuat", "thủ thuật", "thu thuat", "thủ thuật chăm sóc" -> ProgramStepCategory.CARE_PROCEDURE;
            default -> null;
        };
    }

    private static AdministrationMethod resolveVaccineMethod(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String key = normalizeKey(raw);
        return switch (key) {
            case "eye_nose", "nhỏ mắt, mũi", "nho mat, mui", "nhỏ mắt mũi", "nho mat mui" -> AdministrationMethod.EYE_NOSE;
            case "mouth", "nhỏ miệng", "nho mieng" -> AdministrationMethod.MOUTH;
            case "drinking_water", "pha nước uống", "pha nuoc uong" -> AdministrationMethod.DRINKING_WATER;
            case "injection", "tiêm", "tiem" -> AdministrationMethod.INJECTION;
            case "wing_web", "chủng màng cánh", "chung mang canh" -> AdministrationMethod.WING_WEB;
            default -> null;
        };
    }

    private static AdministrationMethod resolveProcedureMethod(String raw) {
        String key = normalizeKey(raw);
        return switch (key) {
            case "procedure", "thủ thuật", "thu thuat", "thực hiện thủ thuật" -> AdministrationMethod.PROCEDURE;
            default -> null;
        };
    }

    private static AdministrationMethod resolveMedicineMethod(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String key = normalizeKey(raw);
        return switch (key) {
            case "mix_feed", "trộn cám", "tron cam" -> AdministrationMethod.MIX_FEED;
            case "mix_water", "pha nước uống", "pha nuoc uong" -> AdministrationMethod.MIX_WATER;
            default -> null;
        };
    }

    private static String normalizeKey(String value) {
        return Normalizer.normalize(value.strip().replaceAll("\\s+", " "), Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }

    private static Row findFirstDataRow(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator) {
        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (!isRowBlank(row, INFO_HEADERS.size(), formatter, evaluator)) return row;
        }
        return null;
    }

    private static boolean isRowBlank(Row row, int colCount, DataFormatter formatter, FormulaEvaluator evaluator) {
        if (row == null) return true;
        for (int c = 0; c < colCount; c++) {
            if (!readString(row, c, formatter, evaluator).isBlank()) return false;
        }
        return true;
    }

    private static String readString(Row row, int col, DataFormatter formatter, FormulaEvaluator evaluator) {
        if (row == null) return "";
        Cell cell = row.getCell(col);
        if (cell == null) return "";
        return formatter.formatCellValue(cell, evaluator).strip();
    }

    private static Integer readInteger(Row row, int col, DataFormatter formatter, FormulaEvaluator evaluator,
                                       String sheet, String column, boolean required, List<CellError> errors) {
        int r = row.getRowNum() + 1;
        Cell cell = row.getCell(col);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            if (required) errors.add(new CellError(sheet, r, column, "Trường \"" + column + "\" không được để trống."));
            return null;
        }
        if (cell.getCellType() == CellType.FORMULA) {
            CellValue evaluated = evaluator.evaluate(cell);
            if (evaluated == null || evaluated.getCellType() == CellType.BLANK) {
                if (required) errors.add(new CellError(sheet, r, column, "Trường \"" + column + "\" không được để trống."));
                return null;
            }
            if (evaluated.getCellType() == CellType.ERROR) {
                errors.add(new CellError(sheet, r, column, "Công thức tại cột \"" + column + "\" bị lỗi."));
                return null;
            }
            if (evaluated.getCellType() == CellType.NUMERIC) {
                return toExactInt(evaluated.getNumberValue(), sheet, r, column, errors);
            }
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            return toExactInt(cell.getNumericCellValue(), sheet, r, column, errors);
        }
        String text = formatter.formatCellValue(cell, evaluator).strip();
        if (text.isBlank()) {
            if (required) errors.add(new CellError(sheet, r, column, "Trường \"" + column + "\" không được để trống."));
            return null;
        }
        try {
            BigDecimal bd = new BigDecimal(text.replace(',', '.'));
            return bd.intValueExact();
        } catch (RuntimeException e) {
            errors.add(new CellError(sheet, r, column, "Giá trị \"" + text + "\" không phải số nguyên hợp lệ."));
            return null;
        }
    }

    private static Integer toExactInt(double value, String sheet, int row, String column, List<CellError> errors) {
        if (!Double.isFinite(value)) {
            errors.add(new CellError(sheet, row, column, "Giá trị phải là số nguyên hợp lệ."));
            return null;
        }
        try {
            return BigDecimal.valueOf(value).intValueExact();
        } catch (ArithmeticException e) {
            errors.add(new CellError(sheet, row, column, "Giá trị phải là số nguyên."));
            return null;
        }
    }

    private static BigDecimal readDecimal(Row row, int col, DataFormatter formatter, FormulaEvaluator evaluator,
                                          String sheet, String column, boolean required, List<CellError> errors) {
        int r = row.getRowNum() + 1;
        Cell cell = row.getCell(col);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            if (required) errors.add(new CellError(sheet, r, column, "Trường \"" + column + "\" không được để trống."));
            return null;
        }
        if (cell.getCellType() == CellType.FORMULA) {
            CellValue evaluated = evaluator.evaluate(cell);
            if (evaluated == null || evaluated.getCellType() == CellType.BLANK) {
                if (required) errors.add(new CellError(sheet, r, column, "Trường \"" + column + "\" không được để trống."));
                return null;
            }
            if (evaluated.getCellType() == CellType.ERROR) {
                errors.add(new CellError(sheet, r, column, "Công thức tại cột \"" + column + "\" bị lỗi."));
                return null;
            }
            if (evaluated.getCellType() == CellType.NUMERIC) {
                double v = evaluated.getNumberValue();
                if (!Double.isFinite(v)) {
                    errors.add(new CellError(sheet, r, column, "Giá trị công thức không phải số hợp lệ."));
                    return null;
                }
                return BigDecimal.valueOf(v);
            }
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            return BigDecimal.valueOf(cell.getNumericCellValue());
        }
        String text = formatter.formatCellValue(cell, evaluator).strip();
        if (text.isBlank()) {
            if (required) errors.add(new CellError(sheet, r, column, "Trường \"" + column + "\" không được để trống."));
            return null;
        }
        try {
            return new BigDecimal(text.replace(',', '.'));
        } catch (NumberFormatException e) {
            errors.add(new CellError(sheet, r, column, "Giá trị \"" + text + "\" không phải số hợp lệ."));
            return null;
        }
    }

    private static CellStyle headerStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private static Sheet createSheet(Workbook wb, String name, List<String> headers, CellStyle headerStyle) {
        Sheet sheet = wb.createSheet(name);
        Row header = sheet.createRow(0);
        for (int i = 0; i < headers.size(); i++) {
            Cell cell = header.createCell(i);
            cell.setCellValue(headers.get(i));
            cell.setCellStyle(headerStyle);
        }
        return sheet;
    }

    private static void writeRow(Sheet sheet, int rowIndex, Object... values) {
        Row row = sheet.createRow(rowIndex);
        for (int i = 0; i < values.length; i++) {
            Object v = values[i];
            if (v == null || (v instanceof String s && s.isEmpty())) continue;
            Cell cell = row.createCell(i);
            if (v instanceof Number n) {
                cell.setCellValue(n.doubleValue());
            } else {
                cell.setCellValue(String.valueOf(v));
            }
        }
    }

    private static void autosize(Workbook wb) {
        for (int s = 0; s < wb.getNumberOfSheets(); s++) {
            Sheet sheet = wb.getSheetAt(s);
            Row header = sheet.getRow(0);
            if (header == null) continue;
            for (int c = 0; c < header.getLastCellNum(); c++) {
                sheet.setColumnWidth(c, Math.min(42 * 256, Math.max(16 * 256, header.getCell(c).getStringCellValue().length() * 320)));
            }
        }
    }
}
