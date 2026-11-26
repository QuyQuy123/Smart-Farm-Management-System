package com.farmshift.backendFarmShift.dto.response;

import java.util.List;

/**
 * Kết quả kiểm tra / nhập chương trình nuôi từ file Excel (.xlsx).
 */
public record FarmingProgramExcelImportResponse(
        boolean valid,
        String mode,
        List<CellError> errors,
        FarmingProgramResponse preview,
        FarmingProgramResponse savedProgram
) {
    public record CellError(String sheet, Integer row, String column, String message) { }
}
