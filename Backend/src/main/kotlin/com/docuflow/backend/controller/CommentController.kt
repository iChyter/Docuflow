package com.docuflow.backend.controller

import com.docuflow.backend.dto.CommentRequestDTO
import com.docuflow.backend.dto.CommentResponseDTO
import com.docuflow.backend.model.Comment
import com.docuflow.backend.model.LogEntry
import com.docuflow.backend.repository.CommentRepository
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.security.JwtUtil
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/comments")
class CommentController(
    private val commentRepository: CommentRepository,
    private val logEntryRepository: LogEntryRepository
) {

    @GetMapping
    fun getAllComments(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        @Suppress("UNUSED_VARIABLE")
        val validatedUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comments = commentRepository.findAll().map { comment ->
            mapOf(
                "id" to comment.id,
                "content" to comment.content,
                "author" to comment.author,
                "documentId" to comment.documentId,
                "timestamp" to comment.createdAt,
                "type" to if (comment.isTask) "task" else "comment",
                "isTask" to comment.isTask,
                "assignees" to comment.assignees,
                "status" to if (comment.isTask) "pending" else "active",
                "priority" to if (comment.isTask) "medium" else null,
                "completed" to false,
                "updatedAt" to comment.updatedAt,
                "lastEditedBy" to comment.lastEditedBy
            )
        }

        return ResponseEntity.ok(mapOf("comments" to comments))
    }

    @GetMapping("/count")
    fun getTotalComments(): ResponseEntity<Long> =
        ResponseEntity.ok(commentRepository.count())

    // Utilidad para obtener el usuario autenticado desde JWT
    private fun getCurrentUsername(): String =
        SecurityContextHolder.getContext().authentication?.principal?.toString() ?: "unknown"

    @PostMapping
    fun createComment(
        @RequestBody request: CommentRequestDTO,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comment = Comment(
            content = request.content,
            author = username,
            documentId = request.documentId,
            isTask = request.isTask,
            assignees = request.assignees,
            createdAt = LocalDateTime.now()
        )
        val saved = commentRepository.save(comment)
        
        logEntryRepository.save(LogEntry(
            action = if (request.isTask) "task_create" else "comment_create",
            username = username,
            documentId = saved.documentId,
            timestamp = LocalDateTime.now()
        ))

        val responseData = mapOf(
            "success" to true,
            "comment" to mapOf(
                "id" to saved.id,
                "content" to saved.content,
                "author" to saved.author,
                "documentId" to saved.documentId,
                "type" to if (saved.isTask) "task" else "comment",
                "isTask" to saved.isTask,
                "assignees" to saved.assignees,
                "timestamp" to saved.createdAt,
                "status" to if (saved.isTask) "pending" else "active"
            )
        )

        return ResponseEntity.ok(responseData)
    }

    @GetMapping("/document/{documentId}")
    fun getCommentsByDocument(
        @PathVariable documentId: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        @Suppress("UNUSED_VARIABLE")
        val validatedUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comments = commentRepository.findByDocumentId(documentId).map { comment ->
            mapOf(
                "id" to comment.id,
                "content" to comment.content,
                "author" to comment.author,
                "documentId" to comment.documentId,
                "timestamp" to comment.createdAt,
                "type" to if (comment.isTask) "task" else "comment",
                "isTask" to comment.isTask,
                "assignees" to comment.assignees,
                "status" to if (comment.isTask) "pending" else "active",
                "priority" to if (comment.isTask) "medium" else null,
                "completed" to false,
                "updatedAt" to comment.updatedAt,
                "lastEditedBy" to comment.lastEditedBy
            )
        }

        return ResponseEntity.ok(mapOf("success" to true, "comments" to comments))
    }

    @PutMapping("/{id}/assign")
    fun assignUsers(
        @PathVariable id: Long,
        @RequestBody assignees: Set<String>,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comment = commentRepository.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        val updated = comment.copy(
            assignees = assignees,
            updatedAt = LocalDateTime.now(),
            lastEditedBy = username
        )
        val saved = commentRepository.save(updated)
        
        logEntryRepository.save(LogEntry(
            action = "comment_assign",
            username = username,
            documentId = saved.documentId,
            timestamp = LocalDateTime.now()
        ))

        return ResponseEntity.ok(mapOf("success" to true, "comment" to saved.toResponseMap()))
    }

    @PutMapping("/{id}")
    fun editComment(
        @PathVariable id: Long,
        @RequestBody request: CommentRequestDTO,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comment = commentRepository.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        val updated = comment.copy(
            content = request.content,
            isTask = request.isTask,
            assignees = request.assignees,
            updatedAt = LocalDateTime.now(),
            lastEditedBy = username
        )
        val saved = commentRepository.save(updated)
        
        logEntryRepository.save(LogEntry(
            action = if (request.isTask) "task_edit" else "comment_edit",
            username = username,
            documentId = saved.documentId,
            timestamp = LocalDateTime.now()
        ))

        return ResponseEntity.ok(mapOf("success" to true, "comment" to saved.toResponseMap()))
    }

    @DeleteMapping("/{id}")
    fun deleteComment(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, String>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comment = commentRepository.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        commentRepository.deleteById(id)
        
        logEntryRepository.save(LogEntry(
            action = if (comment.isTask) "task_delete" else "comment_delete",
            username = username,
            documentId = comment.documentId,
            timestamp = LocalDateTime.now()
        ))

        return ResponseEntity.ok(mapOf("success" to "true", "message" to "Comentario eliminado correctamente"))
    }

    @PutMapping("/{id}/complete")
    fun completeTask(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val comment = commentRepository.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        if (!comment.isTask) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Este comentario no es una tarea"))
        }

        // Por ahora marcamos como completada añadiendo info al contenido
        val updated = comment.copy(
            content = comment.content + "\n[COMPLETADA por $username]",
            updatedAt = LocalDateTime.now(),
            lastEditedBy = username
        )
        val saved = commentRepository.save(updated)
        
        logEntryRepository.save(LogEntry(
            action = "task_complete",
            username = username,
            documentId = saved.documentId,
            timestamp = LocalDateTime.now()
        ))

        return ResponseEntity.ok(mapOf("success" to true, "message" to "Tarea marcada como completada"))
    }

    // Utilidad para mapear a respuesta JSON
    private fun Comment.toResponseMap() = mapOf(
        "id" to id,
        "content" to content,
        "author" to author,
        "documentId" to documentId,
        "timestamp" to createdAt,
        "type" to if (isTask) "task" else "comment",
        "isTask" to isTask,
        "assignees" to assignees,
        "status" to if (isTask) "pending" else "active",
        "updatedAt" to updatedAt,
        "lastEditedBy" to lastEditedBy
    )

    // Utilidad para mapear a DTO (mantenida por compatibilidad)
    private fun Comment.toResponseDTO() = CommentResponseDTO(
        id = id!!,
        content = content,
        author = author,
        isTask = isTask,
        assignees = assignees,
        documentId = documentId,
        createdAt = createdAt,
        updatedAt = updatedAt,
        lastEditedBy = lastEditedBy
    )
}