package com.docuflow.backend.controller

import com.docuflow.backend.repository.*
import com.docuflow.backend.security.JwtUtil
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@RestController
@RequestMapping("/export")
class ExportController(
    private val logEntryRepository: LogEntryRepository,
    private val documentRepository: DocumentRepository,
    private val userRepository: UserRepository,
    private val commentRepository: CommentRepository
) {

    @GetMapping("/logs")
    fun exportLogs(
        @RequestParam(defaultValue = "csv") format: String,
        @RequestParam(required = false) startDate: String?,
        @RequestParam(required = false) endDate: String?,
        @RequestParam(required = false) username: String?,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Any> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        @Suppress("UNUSED_VARIABLE")
        val validatedUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            var logs = logEntryRepository.findAll()
            
            // Filtros opcionales
            if (!username.isNullOrEmpty()) {
                logs = logs.filter { it.username == username }
            }
            
            // Aquí podrías agregar filtros de fecha si implementas parsing de fechas
            
            when (format.lowercase()) {
                "csv" -> {
                    val csvContent = generateLogsCsv(logs)
                    val headers = HttpHeaders()
                    headers.contentType = MediaType.parseMediaType("text/csv")
                    headers.setContentDispositionFormData("attachment", "logs_export_${getCurrentTimestamp()}.csv")
                    
                    return ResponseEntity.ok()
                        .headers(headers)
                        .body(csvContent)
                }
                "json" -> {
                    val jsonData = logs.map { log ->
                        val document = documentRepository.findById(log.documentId ?: 0L).orElse(null)
                        mapOf(
                            "id" to (log.id ?: 0L),
                            "action" to log.action,
                            "username" to log.username,
                            "documentId" to log.documentId,
                            "documentName" to (document?.filename ?: "N/A"),
                            "timestamp" to log.timestamp.toString()
                        )
                    }
                    
                    val response = mapOf(
                        "success" to true,
                        "totalLogs" to logs.size,
                        "exportTimestamp" to LocalDateTime.now(),
                        "data" to jsonData
                    )
                    
                    val headers = HttpHeaders()
                    headers.contentType = MediaType.APPLICATION_JSON
                    headers.setContentDispositionFormData("attachment", "logs_export_${getCurrentTimestamp()}.json")
                    
                    return ResponseEntity.ok()
                        .headers(headers)
                        .body(response)
                }
                else -> {
                    return ResponseEntity.badRequest().body(mapOf(
                        "error" to "Formato no soportado. Use: csv, json"
                    ))
                }
            }
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "error" to "Error al exportar logs: ${e.message}"
            ))
        }
    }

    @GetMapping("/stats")
    fun exportStats(
        @RequestParam(defaultValue = "csv") format: String,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Any> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        @Suppress("UNUSED_VARIABLE")
        val validatedUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            val stats = generateSystemStats()
            
            when (format.lowercase()) {
                "csv" -> {
                    val csvContent = generateStatsCsv(stats)
                    val headers = HttpHeaders()
                    headers.contentType = MediaType.parseMediaType("text/csv")
                    headers.setContentDispositionFormData("attachment", "stats_export_${getCurrentTimestamp()}.csv")
                    
                    return ResponseEntity.ok()
                        .headers(headers)
                        .body(csvContent)
                }
                "json" -> {
                    val headers = HttpHeaders()
                    headers.contentType = MediaType.APPLICATION_JSON
                    headers.setContentDispositionFormData("attachment", "stats_export_${getCurrentTimestamp()}.json")
                    
                    return ResponseEntity.ok()
                        .headers(headers)
                        .body(stats)
                }
                else -> {
                    return ResponseEntity.badRequest().body(mapOf(
                        "error" to "Formato no soportado. Use: csv, json"
                    ))
                }
            }
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "error" to "Error al exportar estadísticas: ${e.message}"
            ))
        }
    }

    @GetMapping("/files")
    fun exportFiles(
        @RequestParam(defaultValue = "csv") format: String,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Any> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        @Suppress("UNUSED_VARIABLE")
        val validatedUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            val files = documentRepository.findAll()
            
            when (format.lowercase()) {
                "csv" -> {
                    val csvContent = generateFilesCsv(files)
                    val headers = HttpHeaders()
                    headers.contentType = MediaType.parseMediaType("text/csv")
                    headers.setContentDispositionFormData("attachment", "files_export_${getCurrentTimestamp()}.csv")
                    
                    return ResponseEntity.ok()
                        .headers(headers)
                        .body(csvContent)
                }
                "json" -> {
                    val jsonData = files.map { file ->
                        mapOf(
                            "id" to (file.id ?: 0L),
                            "filename" to file.filename,
                            "fileType" to file.fileType,
                            "size" to file.size,
                            "sizeFormatted" to formatFileSize(file.size),
                            "filePath" to file.filePath
                        )
                    }
                    
                    val response = mapOf(
                        "success" to true,
                        "totalFiles" to files.size,
                        "totalSize" to files.sumOf { it.size },
                        "exportTimestamp" to LocalDateTime.now(),
                        "data" to jsonData
                    )
                    
                    val headers = HttpHeaders()
                    headers.contentType = MediaType.APPLICATION_JSON
                    headers.setContentDispositionFormData("attachment", "files_export_${getCurrentTimestamp()}.json")
                    
                    return ResponseEntity.ok()
                        .headers(headers)
                        .body(response)
                }
                else -> {
                    return ResponseEntity.badRequest().body(mapOf(
                        "error" to "Formato no soportado. Use: csv, json"
                    ))
                }
            }
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "error" to "Error al exportar archivos: ${e.message}"
            ))
        }
    }

    private fun generateLogsCsv(logs: List<com.docuflow.backend.model.LogEntry>): String {
        val header = "ID,Action,Username,DocumentID,DocumentName,Timestamp"
        val rows = logs.map { log ->
            val document = documentRepository.findById(log.documentId ?: 0L).orElse(null)
            "${log.id ?: 0},${log.action},${log.username},${log.documentId ?: ""},${document?.filename ?: "N/A"},${log.timestamp}"
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun generateStatsCsv(stats: Map<String, Any>): String {
        val header = "Metric,Value"
        val rows = stats.flatMap { (key, value) ->
            when (value) {
                is Map<*, *> -> value.map { (subKey, subValue) -> "$key.$subKey,$subValue" }
                else -> listOf("$key,$value")
            }
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun generateFilesCsv(files: List<com.docuflow.backend.model.Document>): String {
        val header = "ID,Filename,FileType,Size,SizeFormatted,FilePath"
        val rows = files.map { file ->
            "${file.id ?: 0},${file.filename},${file.fileType},${file.size},${formatFileSize(file.size)},${file.filePath}"
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun generateSystemStats(): Map<String, Any> {
        return mapOf(
            "export_timestamp" to LocalDateTime.now(),
            "general" to mapOf(
                "total_users" to userRepository.count(),
                "total_files" to documentRepository.count(),
                "total_comments" to commentRepository.count(),
                "total_logs" to logEntryRepository.count(),
                "total_file_size" to documentRepository.findAll().sumOf { it.size }
            ),
            "file_types" to documentRepository.findAll()
                .groupBy { it.fileType }
                .mapValues { it.value.size },
            "user_roles" to userRepository.findAll()
                .groupBy { it.role }
                .mapValues { it.value.size },
            "activity_actions" to logEntryRepository.findAll()
                .groupBy { it.action }
                .mapValues { it.value.size }
        )
    }

    private fun formatFileSize(bytes: Long): String {
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        var size = bytes.toDouble()
        var unitIndex = 0
        
        while (size >= 1024 && unitIndex < units.size - 1) {
            size /= 1024
            unitIndex++
        }
        
        return "%.1f %s".format(size, units[unitIndex])
    }

    private fun getCurrentTimestamp(): String {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
    }
}