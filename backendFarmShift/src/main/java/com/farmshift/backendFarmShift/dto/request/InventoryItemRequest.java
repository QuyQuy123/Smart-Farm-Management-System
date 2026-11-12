package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record InventoryItemRequest(
    @NotNull(message = "Vui lòng chọn kho.") @Positive Long warehouseId,
    @NotBlank(message = "Vui lòng nhập tên hàng hóa.") @Size(max = 150) String name,
    @NotNull(message = "Vui lòng chọn đơn vị tính.") @Positive Long unitId,
    @NotNull(message = "Vui lòng nhập giá tiền.") @DecimalMin(value = "0", message = "Giá tiền không được âm.")
    @Digits(integer = 17, fraction = 2, message = "Giá tiền tối đa 17 chữ số và 2 số thập phân.") BigDecimal price,
    @Positive Long brandId,
    @Size(max = 2048) String imageUrl,
    @Size(max = 100) String lotNumber,
    LocalDate expiryDate,
    @DecimalMin(value = "0", message = "Ngưỡng tồn tối thiểu không được âm.")
    @Digits(integer = 13, fraction = 6, message = "Ngưỡng tồn tối thiểu tối đa 13 chữ số và 6 số thập phân.") BigDecimal minStock) {

    public InventoryItemRequest(Long warehouseId, String name, Long unitId, BigDecimal price, Long brandId, String imageUrl) {
        this(warehouseId, name, unitId, price, brandId, imageUrl, null, null, null);
    }
}
