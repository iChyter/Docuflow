package com.docuflow.backend.controller

import com.docuflow.backend.model.LogEntry
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.repository.DocumentRepository
import com.docuflow.backend.security.JwtUtil
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/logs")
class LogController(
    private val logEntryRepository: LogEntryRepository,
    private val documentRepository: DocumentRepository
) {

    private val logger = LoggerFactory.getLogger(LogController::class.java)

    @GetMapping
    fun getLogs(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            logger.debug("Usuario {} solicitó logs (page={}, size={})", username, page, size)
            val allLogs = logEntryRepository.findAll()
                .sortedByDescending { it.timestamp }
            
            val totalLogs = allLogs.size
            val totalPages = (totalLogs + size - 1) / size
            val startIndex = page * size
            val endIndex = minOf(startIndex + size, totalLogs)
            
            val paginatedLogs = if (startIndex < totalLogs) {
                allLogs.subList(startIndex, endIndex).map { log ->
                    val document = log.documentId?.let { documentRepository.findById(it).orElse(null) }
                    mapOf<String, Any>(
                        "id" to (log.id ?: 0L),
                        "action" to log.action,
                        "username" to log.username,
                        "target" to (log.targetUsername ?: log.username),
                        "documentName" to (document?.filename ?: "N/A"),
                        "timestamp" to log.timestamp,
                        "level" to getLogLevel(log.action),
                        "details" to getLogDetails(log, document?.filename)
                    )
                }
            } else {
                emptyList()
            }
            
            val response: Map<String, Any> = mapOf(
                "logs" to paginatedLogs,
                "pagination" to mapOf(
                    "currentPage" to page,
                    "totalPages" to totalPages,
                    "totalLogs" to totalLogs,
                    "hasNext" to (page < totalPages - 1),
                    "hasPrevious" to (page > 0)
                )
            )
            
            return ResponseEntity.ok(response)
        } catch (e: Exception) {
            return ResponseEntity.status(500)
                .body(mapOf("error" to "Error al obtener logs"))
        }
    }

    @GetMapping("/recent")
    fun getRecentLogs(
        @RequestParam(defaultValue = "10") limit: Int,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<List<Map<String, Any>>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(emptyList())
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(emptyList())

        try {
            logger.debug("Usuario {} solicitó logs recientes (limit={})", username, limit)
            val recentLogs = logEntryRepository.findAll()
                .sortedByDescending { it.timestamp }
                .take(limit)
                .map { log ->
                    val document = log.documentId?.let { documentRepository.findById(it).orElse(null) }
                    mapOf<String, Any>(
                        "id" to (log.id ?: 0L),
                        "action" to log.action,
                        "username" to log.username,
                        "target" to (log.targetUsername ?: log.username),
                        "documentName" to (document?.filename ?: "N/A"),
                        "timestamp" to log.timestamp,
                        "level" to getLogLevel(log.action),
                        "details" to getLogDetails(log, document?.filename)
                    )
                }
            
            return ResponseEntity.ok(recentLogs)
        } catch (e: Exception) {
            return ResponseEntity.ok(emptyList<Map<String, Any>>())
        }
    }

    @GetMapping("/count")
    fun getLogsCount(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            logger.debug("Usuario {} solicitó el conteo total de logs", username)
            val totalCount = logEntryRepository.count()
            return ResponseEntity.ok(mapOf("count" to totalCount))
        } catch (e: Exception) {
            return ResponseEntity.status(500)
                .body(mapOf("error" to "Error al obtener conteo de logs"))
        }
    }

    @GetMapping("/user/{username}")
    fun getLogsByUser(
        @PathVariable username: String,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<List<Map<String, Any>>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(emptyList())
        
        val requestingUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(emptyList())

        try {
            logger.debug("Usuario {} consultó los logs del usuario {}", requestingUser, username)
            val userLogs = logEntryRepository.findAll()
                .filter { it.username == username }
                .sortedByDescending { it.timestamp }
                .map { log ->
                    val document = log.documentId?.let { documentRepository.findById(it).orElse(null) }
                    mapOf<String, Any>(
                        "id" to (log.id ?: 0L),
                        "action" to log.action,
                        "username" to log.username,
                        "target" to (log.targetUsername ?: log.username),
                        "documentName" to (document?.filename ?: "N/A"),
                        "timestamp" to log.timestamp,
                        "level" to getLogLevel(log.action),
                        "details" to getLogDetails(log, document?.filename)
                    )
                }
            
            return ResponseEntity.ok(userLogs)
        } catch (e: Exception) {
            return ResponseEntity.ok(emptyList<Map<String, Any>>())
        }
    }

    private fun getLogLevel(action: String): String = when (action) {
        "login", "upload", "comment", "user_create", "user_update", "user_permissions_update", "user_password_reset" -> "info"
        "download" -> "success"
        "delete", "user_delete" -> "warning"
        "error", "failed_login" -> "danger"
        else -> "info"
    }

    private fun getLogDetails(log: LogEntry, filename: String?): String {
        val details = log.details
        if (!details.isNullOrBlank()) {
            return details
        }
        val action = log.action
        val target = log.targetUsername ?: log.username
        return when (action) {
            "login" -> "Usuario ${log.username} autenticado exitosamente"
            "upload" -> "${log.username} subió el archivo ${filename ?: "desconocido"}"
            "download" -> "${log.username} descargó el archivo ${filename ?: "desconocido"}"
            "delete" -> "${log.username} eliminó el archivo ${filename ?: "desconocido"}"
            "comment" -> "${log.username} agregó un comentario"
            "failed_login" -> "Intento de login fallido para ${log.username}"
            "user_create" -> "${log.username} creó al usuario $target"
            "user_update" -> "${log.username} actualizó al usuario $target"
            "user_permissions_update" -> "${log.username} ajustó permisos de $target"
            "user_password_reset" -> "${log.username} reinició la contraseña de $target"
            "user_delete" -> "${log.username} eliminó la cuenta de $target"
            else -> "Acción realizada: $action"
        }
    }
}