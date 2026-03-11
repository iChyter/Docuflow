package com.docuflow.backend.dto

import java.time.LocalDateTime

data class CommentResponseDTO(
    val id: Long,
    val content: String,
    val author: String,
    val isTask: Boolean,
    val assignees: Set<String>,
    val documentId: Long,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime?,
    val lastEditedBy: String?
)