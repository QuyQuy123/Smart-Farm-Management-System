package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record InternalStockVoucherRequest(
    @NotBlank(message = "Loại phiếu không được để trống")
    @Pattern(regexp = "IMPORT|EXPORT|TRANSFER", message = "Loại phiếu phải là IMPORT, EXPORT hoặc TRANSFER")
    String movementType,

    @NotNull(message = "Danh mục phiếu không được để trống")
    Long categoryId,

    Long sourceWarehouseId,
    Long targetWarehouseId,
    Long cycleId,

    @NotNull(message = "Ngày chứng từ không được để trống")
    LocalDate movementDate,

    @Size(max = 1000, message = "Ghi chú không được vượt quá 1000 ký tự")
    String note,

    @Size(max = 500, message = "Đường dẫn đính kèm không hợp lệ")
    String attachmentUrl,

    @NotEmpty(message = "Danh sách hàng hóa không được để trống")
    List<@Valid InternalStockVoucherItemRequest> items
) {}
