package com.farmshift.backendFarmShift.security;

import java.util.Set;

/**
 * Canonical role names stored in the {@code roles} table (see insert_data.txt).
 * Used for @PreAuthorize expressions and employee-role business rules.
 */
public final class RoleNames {

    public static final String FARM_OWNER  = "ROLE_FARM_OWNER";
    public static final String ACCOUNTANT  = "ROLE_ACCOUNTANT";
    public static final String FARM_WORKER = "ROLE_FARM_WORKER";

    /** Roles an Owner may assign to an employee account (MSG48). */
    public static final Set<String> ASSIGNABLE_EMPLOYEE_ROLES = Set.of(ACCOUNTANT, FARM_WORKER);

    private RoleNames() {
    }
}
