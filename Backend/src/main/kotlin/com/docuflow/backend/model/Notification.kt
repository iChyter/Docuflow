package com.docuflow.backend.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "notifications")
data class Notification(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val title: String,

    @Column(nullable = false, length = 1000)
    val message: String,

    @Column(nullable = false)
    val type: String, // info, warning, error, success, announcement

    @Column(nullable = false)
    val priority: String, // low, medium, high, urgent

    // Usuario específico o null para notificación global
    @Column(nullable = true)
    val targetUsername: String? = null,

    // Rol específico o null para todos los roles
    @Column(nullable = true)
    val targetRole: String? = null,

    @Column(nullable = false)
    val isGlobal: Boolean = false,

    @Column(nullable = false)
    var isActive: Boolean = true,

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(nullable = true)
    val expiresAt: LocalDateTime? = null,

    @Column(nullable = false)
    val createdBy: String, // username del administrador que creó la notificación

    // Metadata adicional como JSON string
    @Column(nullable = true, length = 2000)
    val metadata: String? = null
)