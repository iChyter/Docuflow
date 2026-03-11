package com.docuflow.backend.controller

import com.docuflow.backend.model.Document
import com.docuflow.backend.model.LogEntry
import com.docuflow.backend.repository.DocumentRepository
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.security.JwtUtil
import com.docuflow.backend.service.GcsUtil
import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import com.google.auth.oauth2.ServiceAccountCredentials
import com.google.cloud.storage.Storage
import com.google.cloud.storage.StorageOptions
import com.google.cloud.storage.BlobId
import java.io.ByteArrayInputStream
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpHeaders
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDateTime

@RestController
@RequestMapping("/files")
class FilesController(
    private val documentRepository: DocumentRepository,
    @Autowired private val logEntryRepository: LogEntryRepository
) {

    private val logger = LoggerFactory.getLogger(FilesController::class.java)

    // 🟢 Listar todos los archivos
    @GetMapping
    fun listFiles(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Any> {
        // Validar token JWT
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

        logger.debug("Usuario {} listó todos los archivos", username)

        val files = documentRepository.findAll()
        return ResponseEntity.ok(mapOf<String, Any>("success" to true, "files" to files))
    }

    // 🔍 Buscar archivos por nombre
    @GetMapping("/search")
    fun searchFiles(
        @RequestHeader("Authorization") authHeader: String?,
        @RequestParam("q") rawQuery: String?,
        @RequestParam(name = "limit", defaultValue = "10") limit: Int
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val query = rawQuery?.trim()
        if (query.isNullOrEmpty()) {
            return ResponseEntity.badRequest().body(mapOf(
                "error" to "El parámetro de búsqueda 'q' es obligatorio"
            ))
        }

        val safeLimit = limit.coerceIn(1, 50)
        val results = documentRepository.findByFilenameContainingIgnoreCase(
            query,
            PageRequest.of(0, safeLimit)
        )

        logger.debug(
            "Usuario {} buscó archivos con query='{}' (limit={}) → {} resultados",
            username,
            query,
            safeLimit,
            results.size
        )

        return ResponseEntity.ok(
            mapOf(
                "success" to true,
                "query" to query,
                "requestedLimit" to limit,
                "appliedLimit" to safeLimit,
                "files" to results
            )
        )
    }

    // 🆕 Archivos recientes
    @GetMapping("/recent")
    fun getRecentFiles(
        @RequestHeader("Authorization") authHeader: String?,
        @RequestParam(name = "limit", defaultValue = "5") limit: Int
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        val safeLimit = limit.coerceIn(1, 50)
        val recentFiles = documentRepository.findAllByOrderByUploadedAtDesc(PageRequest.of(0, safeLimit))

        logger.debug(
            "Usuario {} solicitó archivos recientes (limit={}) → {} resultados",
            username,
            safeLimit,
            recentFiles.size
        )

        return ResponseEntity.ok(
            mapOf(
                "success" to true,
                "requestedLimit" to limit,
                "appliedLimit" to safeLimit,
                "files" to recentFiles
            )
        )
    }

    // 🟢 Obtener metadatos por ID
    @GetMapping("/{id:\\d+}")
    fun getFile(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Any> {
        // Validar token JWT
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

    val file = documentRepository.findById(id)
    logger.debug("Usuario {} consultó metadatos del archivo {}", username, id)
        return if (file.isPresent) {
            ResponseEntity.ok(mapOf<String, Any>("success" to true, "file" to file.get()))
        } else {
            ResponseEntity.status(404).body(mapOf<String, Any>("error" to "Archivo no encontrado"))
        }
    }

    // 🆕 Subir un archivo a Google Cloud Storage
    @PostMapping
    fun uploadFile(
        request: HttpServletRequest,
        @RequestParam("file") file: MultipartFile,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token JWT
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        logger.debug(
            "Solicitud de subida recibida: user={}, contentType={}, length={}",
            username,
            request.contentType,
            request.contentLengthLong
        )

        return try {
            // Validar archivo
            if (file.isEmpty) {
                return ResponseEntity.badRequest()
                    .body(mapOf<String, Any>("error" to "El archivo está vacío"))
            }

            // Validar tamaño (máximo 20MB)
            if (file.size > 20 * 1024 * 1024) {
                return ResponseEntity.badRequest()
                    .body(mapOf<String, Any>("error" to "El archivo excede el tamaño máximo de 20MB"))
            }

            // Obtener credenciales y nombre del bucket desde variables de entorno
            val bucketName = System.getenv("GCP_BUCKET_NAME") 
                ?: return ResponseEntity.status(500)
                    .body(mapOf<String, Any>("error" to "GCP_BUCKET_NAME no configurado"))
            
            val credentialsConfigured = System.getenv("GCP_KEY_JSON")?.isNotBlank() == true
            if (!credentialsConfigured) {
                return ResponseEntity.status(500)
                    .body(mapOf<String, Any>("error" to "GCP_KEY_JSON no configurado"))
            }

            // Subir archivo a Google Cloud Storage
            val gcsPath = GcsUtil.uploadFile(file, bucketName)

            // Guardar metadatos en la base de datos
            val document = Document(
                filename = file.originalFilename ?: "archivo-sin-nombre",
                fileType = file.contentType ?: "application/octet-stream",
                filePath = gcsPath,
                size = file.size
            )
            val savedDocument = documentRepository.save(document)

            // Registrar log de subida
            logEntryRepository.save(
                LogEntry(
                    action = "upload",
                    username = username,
                    documentId = savedDocument.id,
                    timestamp = LocalDateTime.now()
                )
            )

            logger.info("Usuario {} subió el archivo {} ({} bytes)", username, savedDocument.filename, savedDocument.size)

            ResponseEntity.ok(mapOf<String, Any>(
                "success" to true, 
                "mensaje" to "Archivo subido exitosamente",
                "fileId" to (savedDocument.id ?: 0L),
                "filename" to savedDocument.filename
            ))
        } catch (e: Exception) {
            logger.error("Error al subir archivo {}", file.originalFilename, e)
            ResponseEntity.status(500).body(mapOf(
                "error" to (e.message ?: "Error al subir el archivo"),
                "timestamp" to LocalDateTime.now()
            ))
        }
    }

    // 🟢 Descargar un archivo desde Google Cloud Storage
    @GetMapping("/{id:\\d+}/download")
    fun downloadFile(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Any> {
        // Validar token JWT
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

        val document = documentRepository.findById(id)
        if (document.isEmpty) {
            return ResponseEntity.status(404).body(mapOf<String, Any>("error" to "Archivo no encontrado"))
        }

        return try {
            // Extraer bucket y nombre de archivo desde filePath (ej: gs://bucket/filename)
            val filePath = document.get().filePath
            val regex = Regex("""gs://([^/]+)/(.+)""")
            val match = regex.matchEntire(filePath)
            if (match == null) {
                return ResponseEntity.status(500)
                    .body(mapOf<String, Any>("error" to "Ruta de archivo inválida"))
            }
            val bucketName = match.groupValues[1]
            val fileName = match.groupValues[2]

            // Obtener credenciales de GCS
            val credentialsJson = System.getenv("GCP_KEY_JSON") 
                ?: return ResponseEntity.status(500)
                    .body(mapOf<String, Any>("error" to "GCP_KEY_JSON no configurado"))

            val storage: Storage = StorageOptions.newBuilder()
                .setCredentials(
                    ServiceAccountCredentials.fromStream(
                        ByteArrayInputStream(credentialsJson.toByteArray())
                    )
                )
                .build()
                .service

            // Obtener el archivo de GCS
            val blob = storage.get(bucketName, fileName)
            if (blob == null) {
                return ResponseEntity.status(404)
                    .body(mapOf("error" to "Archivo no encontrado en GCS"))
            }
            val fileBytes = blob.getContent()

            // Registrar log de descarga
            logEntryRepository.save(
                LogEntry(
                    action = "download",
                    username = username,
                    documentId = document.get().id,
                    timestamp = LocalDateTime.now()
                )
            )

            logger.debug("Usuario {} descargó el archivo {}", username, id)

            // Devolver el archivo
            ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                    "attachment; filename=\"${document.get().filename}\"")
                .header(HttpHeaders.CONTENT_TYPE, document.get().fileType)
                .body(fileBytes)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.status(500).body(mapOf<String, Any>(
                "error" to "Error al descargar el archivo: ${e.message}"
            ))
        }
    }

    // 🟢 Eliminar un archivo (de GCS y de la BD)
    @DeleteMapping("/{id:\\d+}")
    fun deleteFile(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        // Validar token JWT
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

        val document = documentRepository.findById(id)
        if (document.isEmpty) {
            return ResponseEntity.status(404).body(mapOf<String, Any>("error" to "Archivo no encontrado"))
        }

        return try {
            val doc = document.get()
            
            // Extraer bucket y nombre de archivo desde filePath
            val filePath = doc.filePath
            val regex = Regex("""gs://([^/]+)/(.+)""")
            val match = regex.matchEntire(filePath)
            
            if (match != null) {
                val bucketName = match.groupValues[1]
                val fileName = match.groupValues[2]

                // Obtener credenciales de GCS
                val credentialsJson = System.getenv("GCP_KEY_JSON")
                if (credentialsJson != null) {
                    val storage: Storage = StorageOptions.newBuilder()
                        .setCredentials(
                            ServiceAccountCredentials.fromStream(
                                ByteArrayInputStream(credentialsJson.toByteArray())
                            )
                        )
                        .build()
                        .service

                    // Eliminar archivo de Google Cloud Storage
                    val blobId = BlobId.of(bucketName, fileName)
                    val deleted = storage.delete(blobId)
                    
                    if (!deleted) {
                        println("⚠️ Advertencia: No se pudo eliminar el archivo de GCS")
                    }
                }
            }

            // Eliminar registro de la base de datos
            documentRepository.deleteById(id)

            // Registrar log de eliminación
            logEntryRepository.save(
                LogEntry(
                    action = "delete",
                    username = username,
                    documentId = id,
                    timestamp = LocalDateTime.now()
                )
            )

            ResponseEntity.ok(mapOf<String, Any>(
                "success" to true, 
                "mensaje" to "Archivo eliminado correctamente"
            ))
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.status(500).body(mapOf<String, Any>(
                "error" to "Error al eliminar el archivo: ${e.message}"
            ))
        }
    }

    // 🆕 Estadísticas resumidas de archivos para compatibilidad con el frontend
    @GetMapping("/stats")
    fun getFileStats(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

    val documents = documentRepository.findAll()
        val totalFiles = documents.size
        val totalSize = documents.sumOf { it.size }
        val largestFile = documents.maxByOrNull { it.size }

        val distribution = documents.groupBy { doc ->
            doc.fileType.lowercase().let { type ->
                when {
                    type.contains("pdf") -> "pdf"
                    type.contains("word") || type.contains("doc") -> "doc"
                    type.contains("excel") || type.contains("sheet") || type.contains("xls") -> "spreadsheet"
                    type.contains("image") || type.contains("png") || type.contains("jpg") || type.contains("jpeg") -> "image"
                    else -> "other"
                }
            }
        }.mapValues { it.value.size }

        logger.debug("Usuario {} consultó estadísticas de archivos", username)

        return ResponseEntity.ok(mapOf<String, Any>(
            "success" to true,
            "totalFiles" to totalFiles,
            "totalSizeBytes" to totalSize,
            "formattedTotalSize" to formatSize(totalSize),
            "averageFileSizeBytes" to if (totalFiles > 0) totalSize / totalFiles else 0L,
            "largestFile" to (largestFile?.let {
                mapOf<String, Any>(
                    "id" to (it.id ?: 0L),
                    "filename" to it.filename,
                    "size" to it.size,
                    "formattedSize" to formatSize(it.size)
                )
            } ?: emptyMap<String, Any>()),
            "fileTypeDistribution" to distribution
        ))
    }

    // 🆕 Conteo rápido de archivos
    @GetMapping("/count")
    fun getFileCount(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

        val count = documentRepository.count()
        logger.debug("Usuario {} consultó el conteo total de archivos", username)

        return ResponseEntity.ok(mapOf<String, Any>(
            "success" to true,
            "count" to count
        ))
    }

    // 🆕 Tamaño total de almacenamiento utilizado por documentos
    @GetMapping("/total-size")
    fun getTotalFileSize(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(401).body(mapOf<String, Any>("error" to "Token inválido"))

        val totalSize = documentRepository.findAll().sumOf { it.size }
        logger.debug("Usuario {} consultó el tamaño total de almacenamiento", username)

        return ResponseEntity.ok(mapOf<String, Any>(
            "success" to true,
            "totalSizeBytes" to totalSize,
            "formattedTotalSize" to formatSize(totalSize)
        ))
    }

    private fun formatSize(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
        return String.format("%.2f %s", bytes / Math.pow(1024.0, digitGroups.toDouble()), units[digitGroups])
    }
}
