package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.FarmingProgramRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramExcelImportResponse;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramResponse;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.service.FarmingProgramExcelService;
import com.farmshift.backendFarmShift.service.FarmingProgramService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/farming-programs")
@RequiredArgsConstructor
public class FarmingProgramController {
    private static final MediaType XLSX_MEDIA_TYPE =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final FarmingProgramService service;
    private final FarmingProgramExcelService excelService;

    @GetMapping
    public ApiResponse<List<FarmingProgramResponse>> list() {
        return ApiResponse.success("Danh sách chương trình nuôi", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmingProgramResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết chương trình nuôi", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmingProgramResponse> create(@Valid @RequestBody FarmingProgramRequest request) {
        return ApiResponse.success("Đã thêm chương trình nuôi", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmingProgramResponse> update(@PathVariable Long id, @Valid @RequestBody FarmingProgramRequest request) {
        return ApiResponse.success("Đã cập nhật chương trình nuôi", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa chương trình nuôi");
    }

    @GetMapping("/excel-template")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ResponseEntity<byte[]> downloadExcelTemplate() {
        byte[] content = excelService.generateTemplate();
        return excelResponse(content, "chuong-trinh-nuoi-mau-90-ngay.xlsx");
    }

    @GetMapping("/{id}/export-excel")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')")
    public ResponseEntity<byte[]> exportExcel(@PathVariable Long id) {
        byte[] content = excelService.exportProgram(id);
        return excelResponse(content, "chuong-trinh-nuoi-" + id + ".xlsx");
    }

    @PostMapping(value = "/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ResponseEntity<ApiResponse<FarmingProgramExcelImportResponse>> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "mode", defaultValue = "preview") String mode
    ) {
        if (!"preview".equalsIgnoreCase(mode) && !"commit".equalsIgnoreCase(mode)) {
            throw new BadRequestException("Tham số mode chỉ hỗ trợ \"preview\" hoặc \"commit\".", "INVALID_IMPORT_MODE");
        }
        boolean commit = "commit".equalsIgnoreCase(mode);
        FarmingProgramExcelImportResponse result = excelService.importExcel(file, commit);
        if (!result.valid()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(ApiResponse.errorWithCode("File Excel có " + result.errors().size() + " lỗi cần chỉnh sửa.", "EXCEL_VALIDATION_FAILED", result));
        }
        if (commit) {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success("Đã nhập chương trình nuôi từ file Excel.", result));
        }
        return ResponseEntity.ok(ApiResponse.success("File Excel hợp lệ. Kiểm tra bản xem trước trước khi lưu.", result));
    }

    private static ResponseEntity<byte[]> excelResponse(byte[] content, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(XLSX_MEDIA_TYPE);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());
        headers.setContentLength(content.length);
        return ResponseEntity.ok().headers(headers).body(content);
    }
}
