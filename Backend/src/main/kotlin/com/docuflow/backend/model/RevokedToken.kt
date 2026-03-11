package com.docuflow.backend.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(
    name = "revoked_tokens",
    indexes = [Index(name = "idx_revoked_token_token", columnList = "token")]
)
data class RevokedToken(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, unique = true, length = 512)
    val token: String,

    @Column(nullable = false)
    val expiresAt: LocalDateTime
)
