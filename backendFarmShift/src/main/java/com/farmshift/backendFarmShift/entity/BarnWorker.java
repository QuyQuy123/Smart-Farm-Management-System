package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/** Công nhân phụ trách chuồng. Một chuồng có thể có nhiều công nhân, một công nhân phụ trách nhiều chuồng. */
@Entity
@Table(name = "barn_workers",
        uniqueConstraints = @UniqueConstraint(name = "uk_barn_workers_barn_account", columnNames = {"barn_id", "account_id"}))
@Data
public class BarnWorker {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "barn_id", nullable = false)
    private Barn barn;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account worker;
    @Column(name = "assigned_by", length = 150)
    private String assignedBy;
    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false)
    private LocalDateTime assignedAt;
}
