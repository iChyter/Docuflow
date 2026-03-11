package com.docuflow.backend.controller

import com.docuflow.backend.model.User
import com.docuflow.backend.model.Comment
import com.docuflow.backend.model.LogEntry
import com.docuflow.backend.model.Document
import com.docuflow.backend.repository.UserRepository
import com.docuflow.backend.repository.CommentRepository
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.repository.DocumentRepository
import org.springframework.web.bind.annotation.*
import org.springframework.http.ResponseEntity
import java.time.LocalDate
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/dashboard")
class DashboardController(
    private val userRepository: UserRepository,
    private val commentRepository: CommentRepository,
    private val logEntryRepository: LogEntryRepository,
    private val documentRepository: DocumentRepository
) {

    @GetMapping("/stats")
    fun getDashboardStats(): ResponseEntity<Map<String, Any?>> {
        try {
            val totalFiles = documentRepository.count()
            val totalUsers = userRepository.count()
            val today = LocalDate.now()
            val downloadsToday = logEntryRepository.findAll()
                .count { it.action == "download" && it.timestamp.toLocalDate() == today }
            
            // Calcular tamaño total de archivos
            val totalSize = documentRepository.findAll().sumOf { it.size }
            val storageSizeFormatted = formatFileSize(totalSize)
            
            // Contar actividades recientes (últimos 7 días)
            val recentActivities = logEntryRepository.findAll()
                .count { it.timestamp.isAfter(LocalDateTime.now().minusDays(7)) }
            
            val stats: Map<String, Any?> = mapOf(
                "totalFiles" to totalFiles,
                "totalStorageUsed" to totalSize, // En bytes como espera el frontend
                "totalUsers" to totalUsers,
                "totalComments" to commentRepository.count(),
                "recentActivities" to recentActivities,
                "storageUsed" to storageSizeFormatted, // Formato legible para compatibilidad
                "downloadsToday" to downloadsToday,
                "pendingTasks" to commentRepository.findAll().count { 
                    it.content.contains("task") || it.content.contains("tarea") 
                }
            )
            
            return ResponseEntity.ok(stats)
        } catch (e: Exception) {
            // Devolver estadísticas por defecto en caso de error
            val defaultStats: Map<String, Any?> = mapOf(
                "totalFiles" to 0,
                "totalStorageUsed" to 0,
                "totalUsers" to 0,
                "totalComments" to 0,
                "recentActivities" to 0,
                "storageUsed" to "0 B",
                "downloadsToday" to 0,
                "pendingTasks" to 0
            )
            return ResponseEntity.ok(defaultStats)
        }
    }

    @GetMapping("/activity")
    fun getRecentActivity(): ResponseEntity<List<Map<String, Any?>>> {
        try {
            val recentLogs = logEntryRepository.findAll()
                .sortedByDescending { it.timestamp }
                .take(20)
                .map { log ->
                    val document = documentRepository.findById(log.documentId ?: 0L).orElse(null)
                    mapOf<String, Any?>(
                        "id" to (log.id ?: 0L),
                        "action" to log.action,
                        "username" to log.username,
                        "documentName" to document?.filename,
                        "timestamp" to log.timestamp,
                        "status" to getActionStatus(log.action),
                        "details" to getActionDetails(log.action, document?.filename)
                    )
                }
            
            return ResponseEntity.ok(recentLogs)
        } catch (e: Exception) {
            // Devolver lista vacía en caso de error
            return ResponseEntity.ok(emptyList<Map<String, Any?>>())
        }
    }

    @GetMapping("/users")
    fun getAllUsers(): ResponseEntity<List<Map<String, Any?>>> {
        val users = userRepository.findAll().map { user ->
            mapOf<String, Any?>(
                "id" to (user.id ?: 0L),
                "username" to user.username,
                "email" to user.username,
                "fullName" to user.fullName,
                "role" to user.role,
                "status" to if (user.active) "active" else "inactive",
                "lastLogin" to null
            )
        }
        return ResponseEntity.ok(users)
    }

    @GetMapping("/comments")
    fun getAllComments(): ResponseEntity<List<Comment>> {
        return ResponseEntity.ok(commentRepository.findAll())
    }

    @GetMapping("/logs")
    fun getAllLogs(): ResponseEntity<List<Map<String, Any?>>> {
        val logs = logEntryRepository.findAll().map { log ->
            val document = documentRepository.findById(log.documentId ?: 0L).orElse(null)
            mapOf<String, Any?>(
                "id" to (log.id ?: 0L),
                "action" to log.action,
                "username" to log.username,
                "documentId" to (log.documentId ?: 0L),
                "documentName" to document?.filename,
                "timestamp" to log.timestamp,
                "level" to mapActionToLevel(log.action),
                "details" to getActionDetails(log.action, document?.filename),
                "ip" to null
            )
        }
        return ResponseEntity.ok(logs)
    }

    @GetMapping("/downloads/today")
    fun getDownloadsToday(): ResponseEntity<Map<String, Int>> {
        val today = LocalDate.now()
        val count = logEntryRepository.findAll()
            .count { it.action == "download" && it.timestamp.toLocalDate() == today }
        return ResponseEntity.ok(mapOf("count" to count))
    }

    @GetMapping("/files")
    fun getAllFiles(): ResponseEntity<List<Map<String, Any?>>> {
        val files = documentRepository.findAll().map { doc ->
            mapOf<String, Any?>(
                "id" to (doc.id ?: 0L),
                "filename" to doc.filename,
                "fileType" to doc.fileType,
                "size" to doc.size,
                "filePath" to doc.filePath,
                "formattedSize" to formatFileSize(doc.size),
                "extension" to doc.filename.substringAfterLast('.', "").uppercase().ifEmpty { null }
            )
        }
        return ResponseEntity.ok(files)
    }

    private fun formatFileSize(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val k = 1024.0
        val sizes = arrayOf("B", "KB", "MB", "GB", "TB")
        val i = (Math.log(bytes.toDouble()) / Math.log(k)).toInt()
        return String.format("%.1f %s", bytes / Math.pow(k, i.toDouble()), sizes[i])
    }

    private fun getActionStatus(action: String): String {
        return when (action) {
            "upload" -> "success"
            "download" -> "info"
            "delete" -> "warning"
            "login" -> "success"
            else -> "info"
        }
    }

    private fun getActionDetails(action: String, filename: String?): String {
        val suffix = filename?.takeIf { it.isNotBlank() }?.let { " '$it'" } ?: ""
        return when (action) {
            "upload" -> "Archivo$suffix subido exitosamente"
            "download" -> "Archivo$suffix descargado"
            "delete" -> "Archivo$suffix eliminado"
            "login" -> "Usuario autenticado correctamente"
            else -> "Acción '$action' realizada${if (suffix.isNotEmpty()) " sobre$suffix" else ""}"
        }
    }

    private fun mapActionToLevel(action: String): String {
        return when (action) {
            "upload", "login" -> "success"
            "download" -> "info"
            "delete" -> "warning"
            "error" -> "error"
            else -> "info"
        }
    }

    @GetMapping("/files/stats")
    fun getDashboardFileStats(): ResponseEntity<Map<String, Any?>> {
        try {
            val allFiles = documentRepository.findAll()
            val totalFiles = allFiles.size.toLong()
            val totalSize = allFiles.sumOf { it.size }
            
            val largestFile = allFiles.maxByOrNull { it.size }
            val mostRecentFile = allFiles.maxByOrNull { it.id ?: 0L }
            
            val fileTypeDistribution = allFiles
                .groupBy { 
                    when {
                        it.fileType.contains("pdf") -> "pdf"
                        it.fileType.contains("word") || it.fileType.contains("docx") -> "docx"
                        it.fileType.contains("excel") || it.fileType.contains("xlsx") -> "xlsx"
                        it.fileType.contains("image") -> "image"
                        else -> "other"
                    }
                }
                .mapValues { it.value.size }

            val stats: Map<String, Any?> = mapOf(
                "totalFiles" to totalFiles,
                "totalSize" to totalSize,
                "largestFile" to largestFile?.filename,
                "largestFileSize" to (largestFile?.size ?: 0L),
                "mostRecentFile" to mostRecentFile?.filename,
                "fileTypeDistribution" to fileTypeDistribution
            )
            
            return ResponseEntity.ok(stats)
        } catch (e: Exception) {
            val defaultStats: Map<String, Any?> = mapOf(
                "totalFiles" to 0,
                "totalSize" to 0,
                "largestFile" to null,
                "largestFileSize" to 0,
                "mostRecentFile" to null,
                "fileTypeDistribution" to mapOf<String, Int>()
            )
            return ResponseEntity.ok(defaultStats)
        }
    }

    @GetMapping("/recent-files")
    fun getRecentFiles(@RequestParam(defaultValue = "5") limit: Int): ResponseEntity<List<Map<String, Any?>>> {
        try {
            val recentFiles = documentRepository.findAll()
                .sortedByDescending { it.id ?: 0L }
                .take(limit)
                .map { doc ->
                    mapOf<String, Any?>(
                        "id" to (doc.id ?: 0L),
                        "filename" to doc.filename,
                        "fileType" to doc.fileType,
                        "size" to doc.size,
                        "uploadedAt" to null
                    )
                }
            
            return ResponseEntity.ok(recentFiles)
        } catch (e: Exception) {
            return ResponseEntity.ok(emptyList<Map<String, Any?>>())
        }
    }

    @GetMapping("/recent-activities")
    fun getRecentActivities(@RequestParam(defaultValue = "10") limit: Int): ResponseEntity<List<Map<String, Any?>>> {
        try {
            val recentActivities = logEntryRepository.findAll()
                .sortedByDescending { it.timestamp }
                .take(limit)
                .map { log ->
                    val document = documentRepository.findById(log.documentId ?: 0L).orElse(null)
                    mapOf<String, Any?>(
                        "id" to (log.id ?: 0L),
                        "type" to getActivityType(log.action),
                        "file" to document?.filename,
                        "action" to getActivityDescription(log.action, document?.filename),
                        "user" to log.username,
                        "timestamp" to log.timestamp,
                        "status" to getActionStatus(log.action)
                    )
                }
            
            return ResponseEntity.ok(recentActivities)
        } catch (e: Exception) {
            return ResponseEntity.ok(emptyList<Map<String, Any?>>())
        }
    }

    private fun getActivityType(action: String): String {
        return when (action) {
            "upload" -> "file_upload"
            "download" -> "file_download"
            "delete" -> "file_delete"
            "comment" -> "comment_added"
            "login" -> "user_login"
            else -> "system_action"
        }
    }

    private fun getActivityDescription(action: String, filename: String?): String {
        val suffix = filename?.takeIf { it.isNotBlank() }?.let { " $it" } ?: ""
        return when (action) {
            "upload" -> "Subió archivo$suffix"
            "download" -> "Descargó archivo$suffix"
            "delete" -> "Eliminó archivo$suffix"
            "comment" -> if (suffix.isBlank()) "Agregó un comentario" else "Agregó comentario en$suffix"
            "login" -> "Inició sesión en el sistema"
            else -> "Realizó acción: $action"
        }
    }
}