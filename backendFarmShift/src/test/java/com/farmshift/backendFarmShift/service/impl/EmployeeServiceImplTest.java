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
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceImplTest {

    @Mock private AccountRepository accountRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks private EmployeeServiceImpl employeeService;

    private Role ownerRole;
    private Role accountantRole;
    private Role workerRole;

    @BeforeEach
    void setUp() {
        ownerRole = new Role(1L, RoleNames.FARM_OWNER, "Chủ trang trại");
        accountantRole = new Role(2L, RoleNames.ACCOUNTANT, "Kế toán");
        workerRole = new Role(3L, RoleNames.FARM_WORKER, "Công nhân");
    }

    private static Account account(Long id, String email, Role role, boolean active) {
        Account a = new Account();
        a.setId(id);
        a.setEmail(email);
        a.setPassword("hashed");
        a.setFullName("Nhân viên " + id);
        a.setRole(role);
        a.setIsActive(active);
        return a;
    }

    private static EmployeeCreateRequest createRequest(String email, String roleName) {
        return EmployeeCreateRequest.builder()
                .fullName("  Lê Công Nhân  ")
                .email(email)
                .phone("0966333444")
                .password("Password123!")
                .roleName(roleName)
                .build();
    }

    private static EmployeeUpdateRequest updateRequest(String email, String roleName, Boolean isActive) {
        return EmployeeUpdateRequest.builder()
                .fullName("Tên mới")
                .email(email)
                .phone("0911222333")
                .roleName(roleName)
                .isActive(isActive)
                .build();
    }

    @Nested
    @DisplayName("createEmployee")
    class CreateEmployee {

        @Test
        @DisplayName("hashes password, normalizes email, assigns role and creates linked customer")
        void createsEmployee() {
            when(accountRepository.existsByEmailIgnoreCase("worker@farm.vn")).thenReturn(false);
            when(roleRepository.findByName(RoleNames.FARM_WORKER)).thenReturn(Optional.of(workerRole));
            when(passwordEncoder.encode("Password123!")).thenReturn("$2a$12$hash");
            when(accountRepository.save(any(Account.class))).thenAnswer(inv -> {
                Account saved = inv.getArgument(0);
                saved.setId(10L);
                return saved;
            });
            when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

            EmployeeResponse response = employeeService.createEmployee(
                    createRequest("  Worker@Farm.VN ", "role_farm_worker"));

            ArgumentCaptor<Account> accountCaptor = ArgumentCaptor.forClass(Account.class);
            verify(accountRepository).save(accountCaptor.capture());
            Account saved = accountCaptor.getValue();
            assertThat(saved.getEmail()).isEqualTo("worker@farm.vn");
            assertThat(saved.getPassword()).isEqualTo("$2a$12$hash");
            assertThat(saved.getFullName()).isEqualTo("Lê Công Nhân");
            assertThat(saved.getRole()).isEqualTo(workerRole);
            assertThat(saved.getIsActive()).isTrue();

            ArgumentCaptor<Customer> customerCaptor = ArgumentCaptor.forClass(Customer.class);
            verify(customerRepository).save(customerCaptor.capture());
            assertThat(customerCaptor.getValue().getPhone()).isEqualTo("0966333444");
            assertThat(customerCaptor.getValue().getAccount()).isSameAs(saved);

            assertThat(response.getId()).isEqualTo(10L);
            assertThat(response.getRoleName()).isEqualTo(RoleNames.FARM_WORKER);
            assertThat(response.getPhone()).isEqualTo("0966333444");
            assertThat(response.getIsActive()).isTrue();
        }

        @Test
        @DisplayName("rejects duplicate email with MSG47 and never persists")
        void rejectsDuplicateEmail() {
            when(accountRepository.existsByEmailIgnoreCase("ketoan@smartfarm.com")).thenReturn(true);

            assertThatThrownBy(() -> employeeService.createEmployee(
                    createRequest("KeToan@SmartFarm.com", RoleNames.ACCOUNTANT)))
                    .isInstanceOf(ConflictException.class)
                    .satisfies(ex -> {
                        ConflictException ce = (ConflictException) ex;
                        assertThat(ce.getErrorCode()).isEqualTo("MSG47");
                        assertThat(ce.getField()).isEqualTo("email");
                    });

            verify(accountRepository, never()).save(any());
            verify(passwordEncoder, never()).encode(anyString());
        }

        @Test
        @DisplayName("rejects assigning ROLE_FARM_OWNER to an employee with MSG48")
        void rejectsOwnerRole() {
            when(accountRepository.existsByEmailIgnoreCase(anyString())).thenReturn(false);

            assertThatThrownBy(() -> employeeService.createEmployee(
                    createRequest("new@farm.vn", RoleNames.FARM_OWNER)))
                    .isInstanceOf(BadRequestException.class)
                    .extracting("errorCode").isEqualTo("MSG48");

            verify(accountRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateEmployee")
    class UpdateEmployee {

        @Test
        @DisplayName("changes role from Worker to Accountant and deactivates the account")
        void changesRoleAndStatus() {
            Account existing = account(4L, "congnhan@smartfarm.com", workerRole, true);
            when(accountRepository.findById(4L)).thenReturn(Optional.of(existing));
            when(roleRepository.findByName(RoleNames.ACCOUNTANT)).thenReturn(Optional.of(accountantRole));
            when(accountRepository.save(any(Account.class))).thenAnswer(inv -> inv.getArgument(0));
            when(customerRepository.findByAccount(existing)).thenReturn(Optional.empty());
            when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

            EmployeeResponse response = employeeService.updateEmployee(4L,
                    updateRequest("congnhan@smartfarm.com", RoleNames.ACCOUNTANT, false));

            assertThat(existing.getRole()).isEqualTo(accountantRole);
            assertThat(existing.getIsActive()).isFalse();
            assertThat(response.getRoleName()).isEqualTo(RoleNames.ACCOUNTANT);
            assertThat(response.getIsActive()).isFalse();
            assertThat(response.getFullName()).isEqualTo("Tên mới");
            assertThat(response.getPhone()).isEqualTo("0911222333");
        }

        @Test
        @DisplayName("keeps current role and status when they are omitted")
        void keepsRoleWhenOmitted() {
            Account existing = account(3L, "ketoan@smartfarm.com", accountantRole, true);
            when(accountRepository.findById(3L)).thenReturn(Optional.of(existing));
            when(accountRepository.save(any(Account.class))).thenAnswer(inv -> inv.getArgument(0));
            when(customerRepository.findByAccount(existing)).thenReturn(Optional.of(new Customer()));
            when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

            employeeService.updateEmployee(3L, updateRequest("ketoan@smartfarm.com", null, null));

            assertThat(existing.getRole()).isEqualTo(accountantRole);
            assertThat(existing.getIsActive()).isTrue();
            verify(roleRepository, never()).findByName(anyString());
        }

        @Test
        @DisplayName("rejects promoting an employee to Farm Owner with MSG48")
        void rejectsPromotionToOwner() {
            Account existing = account(4L, "congnhan@smartfarm.com", workerRole, true);
            when(accountRepository.findById(4L)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> employeeService.updateEmployee(4L,
                    updateRequest("congnhan@smartfarm.com", RoleNames.FARM_OWNER, true)))
                    .isInstanceOf(BadRequestException.class)
                    .extracting("errorCode").isEqualTo("MSG48");

            assertThat(existing.getRole()).isEqualTo(workerRole);
            verify(accountRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses to demote or deactivate a Farm Owner account (MSG05)")
        void protectsOwnerAccount() {
            Account owner = account(1L, "mienbinh@smartfarm.com", ownerRole, true);
            when(accountRepository.findById(1L)).thenReturn(Optional.of(owner));

            assertThatThrownBy(() -> employeeService.updateEmployee(1L,
                    updateRequest("mienbinh@smartfarm.com", RoleNames.FARM_OWNER, false)))
                    .isInstanceOf(BadRequestException.class)
                    .extracting("errorCode").isEqualTo("MSG05");

            assertThat(owner.getIsActive()).isTrue();
            verify(accountRepository, never()).save(any());
        }

        @Test
        @DisplayName("rejects changing email to one owned by another account (MSG47)")
        void rejectsEmailTakenByAnotherAccount() {
            Account existing = account(4L, "congnhan@smartfarm.com", workerRole, true);
            when(accountRepository.findById(4L)).thenReturn(Optional.of(existing));
            when(accountRepository.existsByEmailIgnoreCaseAndIdNot("ketoan@smartfarm.com", 4L)).thenReturn(true);

            assertThatThrownBy(() -> employeeService.updateEmployee(4L,
                    updateRequest("ketoan@smartfarm.com", null, null)))
                    .isInstanceOf(ConflictException.class)
                    .extracting("errorCode").isEqualTo("MSG47");
        }

        @Test
        @DisplayName("throws ResourceNotFoundException for an unknown id")
        void unknownId() {
            when(accountRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> employeeService.updateEmployee(99L,
                    updateRequest("x@farm.vn", null, null)))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
