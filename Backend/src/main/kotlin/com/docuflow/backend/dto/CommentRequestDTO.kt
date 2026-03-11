package com.docuflow.backend.dto

data class CommentRequestDTO(
    val content: String,
    val isTask: Boolean = false,
    val assignees: Set<String> = emptySet(),
    val documentId: Long
)