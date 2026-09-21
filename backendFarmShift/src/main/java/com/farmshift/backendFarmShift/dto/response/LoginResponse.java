package com.farmshift.backendFarmShift.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    private String accessToken;

    /**
     * Fixed value: "Bearer" — @Builder.Default ensures it is included in
     * the JSON response even when built via the fluent builder.
     */
    @Builder.Default
    private String tokenType = "Bearer";

    private String email;

    /** The user's assigned role name, e.g. ROLE_FARM_OWNER. */
    private String role;
}
