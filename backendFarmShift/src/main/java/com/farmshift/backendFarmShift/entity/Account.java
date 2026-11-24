package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "accounts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String email;

    @Column(nullable = false)
    private String password;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id")
    private Role role;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "notify_in_app", nullable = false)
    private Boolean notifyInApp = true;

    @Column(name = "notify_iot_alert", nullable = false)
    private Boolean notifyIotAlert = true;

    @Column(name = "notify_task_vaccine", nullable = false)
    private Boolean notifyTaskVaccine = true;

    @Column(name = "notify_debt_overdue", nullable = false)
    private Boolean notifyDebtOverdue = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}