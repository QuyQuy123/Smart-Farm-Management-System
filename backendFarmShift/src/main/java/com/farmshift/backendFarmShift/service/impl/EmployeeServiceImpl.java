package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.dto.request.EmployeeCreateRequest;
import com.farmshift.backendFarmShift.dto.request.EmployeeUpdateRequest;
import com.farmshift.backendFarmShift.dto.response.EmployeeResponse;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.AccountSpecifications;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.farmshift.backendFarmShift.dto.response.EmployeeSearchSummary;
import com.farmshift.backendFarmShift.repository.CustomerSpecifications;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ForkJoinPool;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Employee management (Owner-only). Identity/role/status live in {@code accounts};
 * contact details (phone...) live in the linked {@code customers} row, which the existing
 * profile flow already uses — so no schema change is needed.
 *
 * <h3>Business rules</h3>
 * <ul>
 *   <li>Email is unique (case-insensitive) — MSG47.</li>
 *   <li>Employees may only be assigned ROLE_ACCOUNTANT or ROLE_FARM_WORKER — MSG48.</li>
 *   <li>Farm Owner accounts cannot have their role or status changed here — MSG05.
 *       This also prevents the Owner from locking themselves out.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    static final String MSG_PERMISSION_DENIED = "MSG05";
    static final String MSG_EMAIL_IN_USE = "MSG47";
    static final String MSG_INVALID_EMPLOYEE_ROLE = "MSG48";

    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private ThreadPoolTaskExecutor searchTaskExecutor;

    private Executor getExecutor() {
        return searchTaskExecutor != null ? searchTaskExecutor : ForkJoinPool.commonPool();
    }

    // ------------------------------------------------------------------ queries

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponse> getEmployees(String keyword, String role, Boolean isActive) {
        return getEmployeesAsync(keyword, role, isActive).join();
    }

    @Override
    @Transactional(readOnly = true)
    public CompletableFuture<List<EmployeeResponse>> getEmployeesAsync(String keyword, String role, Boolean isActive) {
        Executor executor = getExecutor();

        // ── Luồng 1 (Branch A): Truy vấn đa điều kiện trên bảng accounts
        CompletableFuture<List<Account>> accountsFuture = CompletableFuture.supplyAsync(() -> {
            List<Specification<Account>> filters = new ArrayList<>();
            filters.add(AccountSpecifications.keyword(keyword));
            filters.add(AccountSpecifications.role(role));
            filters.add(AccountSpecifications.isActive(isActive));
            filters.removeIf(Objects::isNull);

            return accountRepository.findAll(
                    Specification.allOf(filters), Sort.by(Sort.Direction.ASC, "id"));
        }, executor);

        // ── Luồng 2 (Branch B): Truy vấn song song trên bảng customers nếu có từ khóa
        CompletableFuture<List<Customer>> customersFuture = CompletableFuture.supplyAsync(() -> {
            if (!StringUtils.hasText(keyword)) {
                return List.of();
            }
            Specification<Customer> customerSpec = CustomerSpecifications.keyword(keyword);
            if (customerSpec == null) {
                return List.of();
            }
            return customerRepository.findAll(customerSpec);
        }, executor);

        // ── Hợp nhất kết quả đa luồng (Cross-table Data Fusion & Deduplication)
        return accountsFuture.thenCombineAsync(customersFuture, (accounts, matchingCustomers) -> {
            Set<Long> accountIds = accounts.stream().map(Account::getId).collect(Collectors.toSet());
            List<Account> allAccounts = new ArrayList<>(accounts);

            // Bổ sung các tài khoản từ luồng bảng customers nếu chưa có trong danh sách
            if (!matchingCustomers.isEmpty()) {
                for (Customer customer : matchingCustomers) {
                    Account linkedAccount = customer.getAccount();
                    if (linkedAccount != null && !accountIds.contains(linkedAccount.getId())) {
                        if (matchesRoleAndStatus(linkedAccount, role, isActive)) {
                            allAccounts.add(linkedAccount);
                            accountIds.add(linkedAccount.getId());
                        }
                    }
                }
                allAccounts.sort(Comparator.comparing(Account::getId));
            }

            if (allAccounts.isEmpty()) {
                return List.of();
            }

            // Map cache từ luồng customers
            Map<Long, Customer> customersByAccountId = new HashMap<>();
            for (Customer c : matchingCustomers) {
                if (c.getAccount() != null) {
                    customersByAccountId.put(c.getAccount().getId(), c);
                }
            }

            // Batch lookup các tài khoản còn thiếu thông tin customer
            List<Account> accountsNeedingProfiles = allAccounts.stream()
                    .filter(a -> !customersByAccountId.containsKey(a.getId()))
                    .toList();

            if (!accountsNeedingProfiles.isEmpty()) {
                customerRepository.findByAccountIn(accountsNeedingProfiles).forEach(c -> {
                    if (c.getAccount() != null) {
                        customersByAccountId.put(c.getAccount().getId(), c);
                    }
                });
            }

            return allAccounts.stream()
                    .map(account -> toResponse(account, customersByAccountId.get(account.getId())))
                    .toList();
        }, executor);
    }

    @Override
    @Transactional(readOnly = true)
    public CompletableFuture<EmployeeSearchSummary> getEmployeeSearchSummaryAsync() {
        return CompletableFuture.supplyAsync(() -> {
            long total = accountRepository.count();
            long active = accountRepository.count(AccountSpecifications.isActive(true));
            long inactive = accountRepository.count(AccountSpecifications.isActive(false));
            long ownerCount = accountRepository.count(AccountSpecifications.role(RoleNames.FARM_OWNER));
            long accountantCount = accountRepository.count(AccountSpecifications.role(RoleNames.ACCOUNTANT));
            long workerCount = accountRepository.count(AccountSpecifications.role(RoleNames.FARM_WORKER));

            return EmployeeSearchSummary.builder()
                    .total(total)
                    .active(active)
                    .inactive(inactive)
                    .ownerCount(ownerCount)
                    .accountantCount(accountantCount)
                    .workerCount(workerCount)
                    .build();
        }, getExecutor());
    }

    private boolean matchesRoleAndStatus(Account account, String role, Boolean isActive) {
        if (isActive != null) {
            boolean active = Boolean.TRUE.equals(account.getIsActive());
            if (active != isActive) {
                return false;
            }
        }
        if (StringUtils.hasText(role)) {
            if (account.getRole() == null) {
                return false;
            }
            String roleFilter = role.trim();
            if (roleFilter.chars().allMatch(Character::isDigit)) {
                Long roleId = Long.valueOf(roleFilter);
                if (!Objects.equals(account.getRole().getId(), roleId)) {
                    return false;
                }
            } else {
                if (!account.getRole().getName().equalsIgnoreCase(roleFilter)) {
                    return false;
                }
            }
        }
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeResponse getEmployeeById(Long id) {
        Account account = findAccount(id);
        return toResponse(account, customerRepository.findByAccount(account).orElse(null));
    }

    // ------------------------------------------------------------------ commands

    @Override
    @Transactional
    public EmployeeResponse createEmployee(EmployeeCreateRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (accountRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("This email address is already in use.", MSG_EMAIL_IN_USE, "email");
        }

        Role role = resolveAssignableRole(request.getRoleName());

        Account account = new Account();
        account.setEmail(email);
        String rawPassword = StringUtils.hasText(request.getPassword()) ? request.getPassword().trim() : "123456";
        if (rawPassword.length() < 6) {
            throw new BadRequestException("Password must be at least 6 characters.");
        }
        account.setPassword(passwordEncoder.encode(rawPassword));
        account.setFullName(request.getFullName().trim());
        account.setAvatarUrl(blankToNull(request.getAvatarUrl()));
        account.setRole(role);
        account.setIsActive(true);
        account = accountRepository.save(account);

        Customer customer = new Customer();
        customer.setAccount(account);
        customer.setFullName(account.getFullName());
        customer.setPhone(blankToNull(request.getPhone()));
        customer.setAvatarUrl(account.getAvatarUrl());
        customer = customerRepository.save(customer);

        log.info("Employee created: id={}, email={}, role={}", account.getId(), email, role.getName());
        return toResponse(account, customer);
    }

    @Override
    @Transactional
    public EmployeeResponse updateEmployee(Long id, EmployeeUpdateRequest request) {
        Account account = findAccount(id);

        String email = normalizeEmail(request.getEmail());
        if (!email.equalsIgnoreCase(account.getEmail())
                && accountRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new ConflictException("This email address is already in use.", MSG_EMAIL_IN_USE, "email");
        }

        boolean targetIsOwner = account.getRole() != null
                && RoleNames.FARM_OWNER.equals(account.getRole().getName());

        if (targetIsOwner) {
            guardOwnerAccount(account, request);
        } else if (StringUtils.hasText(request.getRoleName())) {
            account.setRole(resolveAssignableRole(request.getRoleName()));
        }

        if (!targetIsOwner && request.getIsActive() != null) {
            account.setIsActive(request.getIsActive());
        }

        account.setEmail(email);
        account.setFullName(request.getFullName().trim());
        if (request.getAvatarUrl() != null) {
            account.setAvatarUrl(blankToNull(request.getAvatarUrl()));
        }
        account = accountRepository.save(account);

        Customer customer = customerRepository.findByAccount(account).orElseGet(Customer::new);
        customer.setAccount(account);
        customer.setFullName(account.getFullName());
        customer.setAvatarUrl(account.getAvatarUrl());
        if (request.getPhone() != null) {
            customer.setPhone(blankToNull(request.getPhone()));
        }
        customer = customerRepository.save(customer);

        log.info("Employee updated: id={}, role={}, active={}",
                account.getId(),
                account.getRole() != null ? account.getRole().getName() : null,
                account.getIsActive());
        return toResponse(account, customer);
    }

    // ------------------------------------------------------------------ helpers

    private Account findAccount(Long id) {
        return accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));
    }

    /** Owners keep their role and stay active; only profile fields may be edited. */
    private void guardOwnerAccount(Account account, EmployeeUpdateRequest request) {
        boolean roleChanged = StringUtils.hasText(request.getRoleName())
                && !RoleNames.FARM_OWNER.equalsIgnoreCase(request.getRoleName().trim());
        boolean deactivated = Boolean.FALSE.equals(request.getIsActive());
        if (roleChanged || deactivated) {
            log.warn("Rejected role/status change on owner account id={}", account.getId());
            throw new BadRequestException(
                    "The Farm Owner account's role and status cannot be changed.", MSG_PERMISSION_DENIED);
        }
    }

    private Role resolveAssignableRole(String roleName) {
        String normalized = roleName == null ? "" : roleName.trim().toUpperCase(Locale.ROOT);
        if (!RoleNames.ASSIGNABLE_EMPLOYEE_ROLES.contains(normalized)) {
            throw new BadRequestException(
                    "Employee accounts can only be assigned the Accountant or Worker role.",
                    MSG_INVALID_EMPLOYEE_ROLE);
        }
        return roleRepository.findByName(normalized)
                .orElseThrow(() -> new ResourceNotFoundException("Role not configured: " + normalized));
    }

    /** Login lower-cases the email (AuthServiceImpl), so stored emails must be lower-case too. */
    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static EmployeeResponse toResponse(Account account, Customer customer) {
        Role role = account.getRole();
        EmployeeResponse.EmployeeResponseBuilder builder = EmployeeResponse.builder()
                .id(account.getId())
                .email(account.getEmail())
                .fullName(account.getFullName())
                .avatarUrl(account.getAvatarUrl())
                .roleId(role != null ? role.getId() : null)
                .roleName(role != null ? role.getName() : null)
                .roleDescription(role != null ? role.getDescription() : null)
                .isActive(Boolean.TRUE.equals(account.getIsActive()))
                .createdAt(account.getCreatedAt());

        if (customer != null) {
            builder.phone(customer.getPhone())
                    .citizenId(customer.getCitizenId())
                    .address(customer.getAddress())
                    .dateOfBirth(customer.getDateOfBirth());
        }
        return builder.build();
    }
}
