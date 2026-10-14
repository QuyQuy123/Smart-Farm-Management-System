package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.entity.Role;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.Locale;

/**
 * Composable JPA Specifications for the employee list (keyword / role / status filters).
 * Each factory returns {@code null} when its filter is not supplied, which Spring Data ignores.
 */
public final class AccountSpecifications {

    private static final char ESCAPE = '\\';

    private AccountSpecifications() {
    }

    /** Matches full name or email (case-insensitive) or the phone stored on the linked customer. */
    public static Specification<Account> keyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String term = escapeLike(keyword.trim().toLowerCase(Locale.ROOT));
        String textPattern = "%" + term + "%";
        String phonePattern = "%" + term.replaceAll("\\s+", "") + "%";

        return (root, query, cb) -> {
            Subquery<Long> phoneMatch = query.subquery(Long.class);
            Root<Customer> customer = phoneMatch.from(Customer.class);
            phoneMatch.select(customer.get("id"))
                    .where(
                            cb.equal(customer.get("account"), root),
                            cb.like(customer.get("phone"), phonePattern, ESCAPE));

            return cb.or(
                    cb.like(cb.lower(root.get("fullName")), textPattern, ESCAPE),
                    cb.like(cb.lower(root.get("email")), textPattern, ESCAPE),
                    cb.exists(phoneMatch));
        };
    }

    /** {@code role} may be a numeric role id ("2") or a role name ("ROLE_ACCOUNTANT"). */
    public static Specification<Account> role(String role) {
        if (!StringUtils.hasText(role)) {
            return null;
        }
        String value = role.trim();
        if (value.chars().allMatch(Character::isDigit)) {
            Long roleId = Long.valueOf(value);
            return (root, query, cb) -> {
                Join<Account, Role> join = root.join("role", JoinType.LEFT);
                return cb.equal(join.get("id"), roleId);
            };
        }
        String roleName = value.toUpperCase(Locale.ROOT);
        return (root, query, cb) -> {
            Join<Account, Role> join = root.join("role", JoinType.LEFT);
            return cb.equal(cb.upper(join.get("name")), roleName);
        };
    }

    /** A {@code NULL} is_active is treated as inactive, consistent with CustomUserDetailsService. */
    public static Specification<Account> isActive(Boolean isActive) {
        if (isActive == null) {
            return null;
        }
        return (root, query, cb) -> isActive
                ? cb.isTrue(root.get("isActive"))
                : cb.or(cb.isFalse(root.get("isActive")), cb.isNull(root.get("isActive")));
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
