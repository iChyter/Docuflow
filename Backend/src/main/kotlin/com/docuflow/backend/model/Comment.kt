package com.docuflow.backend.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "comments")
data class Comment(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    var content: String,

    @Column(nullable = false)
    val author: String, // username del creador

    @Column(nullable = false)
    val documentId: Long,

    // Indica si es tarea o solo comentario
    @Column(nullable = false)
    val isTask: Boolean = false,

    // Asignados a la tarea/comentario (usernames)
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "comment_assignees", joinColumns = [JoinColumn(name = "comment_id")])
    @Column(name = "assignee")
    val assignees: Set<String> = emptySet(),

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    // Fecha de última edición
    var updatedAt: LocalDateTime? = null,

    // Usuario que editó por última vez
    var lastEditedBy: String? = null
)