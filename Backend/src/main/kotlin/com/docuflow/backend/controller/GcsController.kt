package com.docuflow.backend.controller

import com.docuflow.backend.repository.DocumentRepository
import com.docuflow.backend.security.JwtUtil
import com.docuflow.backend.service.GcsUtil
import com.google.cloud.storage.StorageException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.net.URI
import java.time.LocalDateTime

@RestController
@RequestMapping(value = ["/api/gcs", "/gcs"])
class GcsController(
    private val gcsUtil: GcsUtil,
    private val documentRepository: DocumentRepository
) {

    private val logger = LoggerFactory.getLogger(GcsController::class.java)

    @GetMapping("/files")
    fun getFilesFromGcs(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Token faltante"))

        JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Token inválido"))

        try {
            val bucketName = System.getenv("GCP_BUCKET_NAME") ?: "docuflow-files"
            val files = gcsUtil.listAllFilesInBucket(bucketName)
            
            val filesInfo = files.map { blob ->
                val createdEpochMs = blob.createTimeOffsetDateTime?.toInstant()?.toEpochMilli()
                val updatedEpochMs = blob.updateTimeOffsetDateTime?.toInstant()?.toEpochMilli()
                mapOf<String, Any>(
                    "name" to blob.name,
                    "size" to blob.size,
                    "contentType" to (blob.contentType ?: "unknown"),
                    "created" to (createdEpochMs ?: 0L),
                    "updated" to (updatedEpochMs ?: 0L),
                    "md5Hash" to (blob.md5 ?: ""),
                    "generation" to blob.generation,
                    "isDirectory" to blob.isDirectory,
                    "downloadUrl" to "https://storage.googleapis.com/$bucketName/${blob.name}"
                )
            }
            
            val response: Map<String, Any> = mapOf(
                "success" to true,
                "bucket" to bucketName,
                "totalFiles" to files.size,
                "totalSize" to files.sumOf { it.size },
                "files" to filesInfo,
                "timestamp" to LocalDateTime.now()
            )
            
            return ResponseEntity.ok(response)
            
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf(
                "success" to false,
                "error" to "Error al obtener archivos desde GCS: ${e.message}",
                "timestamp" to LocalDateTime.now()
            ))
        }
    }

    @GetMapping("/stats")
    fun getGcsStats(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Token faltante"))

        JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Token inválido"))

        val bucketName = System.getenv("GCP_BUCKET_NAME")?.takeIf { it.isNotBlank() }
            ?: return ResponseEntity.ok(stubStatsResponse("Bucket no configurado"))

        return try {
            val files = gcsUtil.listAllFilesInBucket(bucketName)
            val usedStorage = files.sumOf { it.size }
            val totalStorage = System.getenv("GCP_TOTAL_STORAGE_BYTES")?.toLongOrNull()?.takeIf { it > 0 }
                ?: usedStorage
            val storageUsagePercent = if (totalStorage > 0) {
                ((usedStorage.toDouble() / totalStorage.toDouble()) * 100).coerceAtMost(100.0)
            } else {
                0.0
            }

            val registeredFiles = documentRepository.findAll()
            val registeredNames = registeredFiles.mapNotNull { extractObjectName(it.filePath) }.toSet()
            val orphanedFiles = files.count { blob -> blob.name !in registeredNames }

            ResponseEntity.ok(
                mapOf(
                    "ready" to true,
                    "bucket" to bucketName,
                    "usedStorage" to usedStorage,
                    "totalStorage" to totalStorage,
                    "storageUsagePercent" to storageUsagePercent,
                    "fileCount" to files.size,
                    "orphanedFiles" to orphanedFiles,
                    "timestamp" to LocalDateTime.now()
                )
            )
        } catch (ex: IllegalStateException) {
            logger.warn("GCS stats - configuración incompleta: {}", ex.message)
            ResponseEntity.ok(stubStatsResponse(ex.message ?: "Configuración de GCS incompleta"))
        } catch (ex: StorageException) {
            logger.error("GCS stats - error al comunicarse con GCS (bucket={})", bucketName, ex)
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                errorStatsResponse("Error al comunicarse con GCS: ${ex.message}")
            )
        } catch (ex: Exception) {
            logger.error("GCS stats - error inesperado (bucket={})", bucketName, ex)
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                errorStatsResponse("Error inesperado al consultar GCS: ${ex.message}")
            )
        }
    }

    @PostMapping("/files/reconcile")
    fun reconcileFiles(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(mapOf("error" to "Token faltante"))

        JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(mapOf("error" to "Token inválido"))

        val bucketName = System.getenv("GCP_BUCKET_NAME")?.takeIf { it.isNotBlank() }
            ?: return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf(
                    "success" to false,
                    "error" to "GCP_BUCKET_NAME no configurado",
                    "timestamp" to LocalDateTime.now()
                ))

        return try {
            val blobs = gcsUtil.listAllFilesInBucket(bucketName)
            val documents = documentRepository.findAll()

            val blobNames = blobs.map { it.name }.toSet()

            val documentsMissingInGcs = documents.filter { document ->
                val objectName = extractObjectName(document.filePath)
                objectName == null || objectName !in blobNames
            }

            val documentsToDelete = documentsMissingInGcs.filter { it.id != null }
            if (documentsToDelete.isNotEmpty()) {
                documentRepository.deleteAll(documentsToDelete)
            }
            val removedDocumentSummaries = documentsMissingInGcs.map { document ->
                mapOf(
                    "id" to (document.id ?: 0L),
                    "filename" to document.filename,
                    "filePath" to document.filePath
                )
            }

            val registeredNames = documents
                .filterNot { documentsMissingInGcs.contains(it) }
                .mapNotNull { extractObjectName(it.filePath) }
                .toSet()
            val orphanedBlobs = blobs.filter { blob -> blob.name !in registeredNames }

            val deletedGcsObjects = mutableListOf<String>()
            val failedGcsObjects = mutableListOf<String>()

            orphanedBlobs.forEach { blob ->
                try {
                    val deleted = gcsUtil.deleteFile(bucketName, blob.name)
                    if (deleted) {
                        deletedGcsObjects += blob.name
                    } else {
                        failedGcsObjects += blob.name
                    }
                } catch (ex: StorageException) {
                    failedGcsObjects += blob.name
                    logger.error(
                        "GCS reconcile - error al eliminar blob {} en bucket {}",
                        blob.name,
                        bucketName,
                        ex
                    )
                }
            }

            val responseBody = mapOf(
                "success" to true,
                "bucket" to bucketName,
                "deletedDatabaseRecords" to removedDocumentSummaries.size,
                "deletedGcsObjects" to deletedGcsObjects.size,
                "failedGcsDeletions" to failedGcsObjects.size,
                "docsRemovedFromDb" to removedDocumentSummaries,
                "gcsObjectsDeleted" to deletedGcsObjects,
                "gcsObjectsSkipped" to failedGcsObjects,
                "timestamp" to LocalDateTime.now()
            )

            if (failedGcsObjects.isEmpty()) {
                ResponseEntity.ok(responseBody)
            } else {
                ResponseEntity.status(HttpStatus.ACCEPTED).body(responseBody)
            }
        } catch (ex: StorageException) {
            logger.error("GCS reconcile - error al comunicarse con GCS (bucket={})", bucketName, ex)
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                mapOf(
                    "success" to false,
                    "error" to "Error al comunicarse con GCS: ${ex.message}",
                    "timestamp" to LocalDateTime.now()
                )
            )
        } catch (ex: Exception) {
            logger.error("GCS reconcile - error inesperado (bucket={})", bucketName, ex)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                mapOf(
                    "success" to false,
                    "error" to (ex.message ?: "Error inesperado durante la reconciliación"),
                    "timestamp" to LocalDateTime.now()
                )
            )
        }
    }

    @GetMapping("/files/orphaned")
    fun getOrphanedFiles(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Token faltante"))

        JwtUtil.validateToken(token)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Token inválido"))

        try {
            // Este endpoint identifica archivos en GCS que no están registrados en la BD
            // Por ahora devolvemos una estructura de ejemplo
            // En una implementación completa, compararías los archivos de GCS con los de la BD
            
            val response: Map<String, Any> = mapOf(
                "success" to true,
                "message" to "Función en desarrollo - detectar archivos huérfanos",
                "orphanedFiles" to emptyList<Map<String, Any>>(),
                "timestamp" to LocalDateTime.now()
            )
            
            return ResponseEntity.ok(response)
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "success" to false,
                "error" to "Error al buscar archivos huérfanos: ${e.message}",
                "timestamp" to LocalDateTime.now()
            ))
        }
    }

    private fun stubStatsResponse(message: String): Map<String, Any> = mapOf(
        "ready" to false,
        "bucket" to (System.getenv("GCP_BUCKET_NAME") ?: ""),
        "usedStorage" to 0L,
        "totalStorage" to 0L,
        "storageUsagePercent" to 0.0,
        "fileCount" to 0,
        "orphanedFiles" to 0,
        "message" to message,
        "timestamp" to LocalDateTime.now()
    )

    private fun errorStatsResponse(message: String): Map<String, Any> = mapOf(
        "ready" to false,
        "error" to message,
        "timestamp" to LocalDateTime.now()
    )

    private fun extractObjectName(filePath: String): String? = try {
        val uri = URI(filePath)
        when (uri.scheme) {
            "gs" -> uri.path.trimStart('/').takeIf { it.isNotBlank() }
            "https" -> {
                val normalizedPath = uri.path.trimStart('/')
                when {
                    uri.host?.contains("storage.googleapis.com") == true ->
                        normalizedPath.substringAfter("/", normalizedPath).takeIf { it.isNotBlank() }
                    else -> normalizedPath.takeIf { it.isNotBlank() }
                }
            }
            else -> filePath.substringAfterLast('/')
        }
    } catch (_: Exception) {
        filePath.substringAfterLast('/')
    }
}