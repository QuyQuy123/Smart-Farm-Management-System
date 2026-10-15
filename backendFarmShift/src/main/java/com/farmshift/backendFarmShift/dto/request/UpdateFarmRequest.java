package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateFarmRequest {
    @NotBlank @Size(max = 200)
    private String name;
    @NotBlank @Size(max = 100)
    private String owner;
    @NotBlank @Size(max = 20)
    @Pattern(regexp = "(?=(?:\\D*\\d){9,15}\\D*$)[0-9+() .-]{9,20}", message = "Số điện thoại phải có từ 9 đến 15 chữ số")
    private String phone;
    @Size(max = 100)
    private String scale;
    @Size(max = 500)
    private String address;
    @Size(max = 200)
    private String type;
}
