package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Customer;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Locale;

/**
 * Composable JPA Specifications for the Customer/Profile entity.
 * Supports multi-field dynamic matching (phone, citizenId, fullName, address).
 */
public final class CustomerSpecifications {

    private static final char ESCAPE = '\\';

    private CustomerSpecifications() {
    }

    /**
     * Matches keyword against full name, phone number (stripped of spaces),
     * citizen ID, or address.
     */
    public static Specification<Customer> keyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String term = escapeLike(keyword.trim().toLowerCase(Locale.ROOT));
        String textPattern = "%" + term + "%";
        String phonePattern = "%" + term.replaceAll("\\s+", "") + "%";

        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("fullName")), textPattern, ESCAPE),
                cb.like(root.get("phone"), phonePattern, ESCAPE),
                cb.like(cb.lower(root.get("citizenId")), textPattern, ESCAPE),
                cb.like(cb.lower(root.get("address")), textPattern, ESCAPE)
        );
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
