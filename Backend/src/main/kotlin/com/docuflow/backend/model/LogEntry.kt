package com.docuflow.backend.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "logs")
data class LogEntry(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val action: String, // "upload", "download", "delete", "comment", etc.

    @Column(nullable = false)
    val username: String,

    @Column(nullable = true)
    val documentId: Long? = null,

    @Column(name = "target_username")
    val targetUsername: String? = null,

    @Column(columnDefinition = "TEXT")
    val details: String? = null,

    @Column(nullable = false)
    val timestamp: LocalDateTime = LocalDateTime.now()
)