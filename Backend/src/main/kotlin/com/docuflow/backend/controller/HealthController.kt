package com.docuflow.backend.controller

import com.docuflow.backend.repository.UserRepository
import com.docuflow.backend.repository.DocumentRepository
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.repository.CommentRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime
import javax.sql.DataSource

@RestController
@RequestMapping("/health")
class HealthController(
    private val dataSource: DataSource,
    private val userRepository: UserRepository,
    private val documentRepository: DocumentRepository,
    private val logEntryRepository: LogEntryRepository,
    private val commentRepository: CommentRepository
) {

    @GetMapping
    fun getHealthStatus(): ResponseEntity<Map<String, Any>> {
        try {
            val healthStatus = mutableMapOf<String, Any>()
            
            // Estado general
            healthStatus["status"] = "UP"
            healthStatus["timestamp"] = LocalDateTime.now()
            healthStatus["application"] = "DocuFlow Backend"
            healthStatus["version"] = "1.0.0"
            
            // Verificar base de datos
            val dbStatus = checkDatabaseHealth()
            healthStatus["database"] = dbStatus
            
            // Verificar repositorios
            val repoStatus = checkRepositoriesHealth()
            healthStatus["repositories"] = repoStatus
            
            // Verificar servicios externos
            val externalStatus = checkExternalServices()
            healthStatus["external_services"] = externalStatus
            
            // Estado de recursos del sistema
            val systemStatus = getSystemResources()
            healthStatus["system"] = systemStatus
            
            // Determinar estado general
            val overallStatus = determineOverallStatus(dbStatus, repoStatus, externalStatus)
            healthStatus["status"] = overallStatus
            
            val httpStatus = if (overallStatus == "UP") 200 else 503
            return ResponseEntity.status(httpStatus).body(healthStatus)
            
        } catch (e: Exception) {
            val errorStatus = mapOf<String, Any>(
                "status" to "DOWN",
                "timestamp" to LocalDateTime.now(),
                "error" to (e.message ?: "Error desconocido"),
                "application" to "DocuFlow Backend"
            )
            return ResponseEntity.status(503).body(errorStatus)
        }
    }

    @GetMapping("/db")
    fun getDatabaseHealth(): ResponseEntity<Map<String, Any>> {
        val dbStatus = checkDatabaseHealth()
        val httpStatus = if (dbStatus["status"] == "UP") 200 else 503
        return ResponseEntity.status(httpStatus).body(dbStatus)
    }

    @GetMapping("/simple")
    fun getSimpleHealth(): ResponseEntity<Map<String, String>> {
        return try {
            // Test simple de conexión a DB
            userRepository.count()
            ResponseEntity.ok(mapOf(
                "status" to "UP",
                "message" to "Service is healthy"
            ))
        } catch (e: Exception) {
            ResponseEntity.status(503).body(mapOf(
                "status" to "DOWN",
                "message" to "Service is unhealthy: ${e.message}"
            ))
        }
    }

    private fun checkDatabaseHealth(): Map<String, Any> {
        return try {
            val connection = dataSource.connection
            val isValid = connection.isValid(5) // 5 seconds timeout
            connection.close()
            
            mapOf(
                "status" to if (isValid) "UP" else "DOWN",
                "connection_valid" to isValid,
                "driver" to "PostgreSQL",
                "timestamp" to LocalDateTime.now()
            )
        } catch (e: Exception) {
            mapOf(
                "status" to "DOWN",
                "error" to (e.message ?: "Error desconocido"),
                "timestamp" to LocalDateTime.now()
            )
        }
    }

    private fun checkRepositoriesHealth(): Map<String, Any> {
        return try {
            val repoTests = mapOf(
                "users" to userRepository.count(),
                "documents" to documentRepository.count(),
                "logs" to logEntryRepository.count(),
                "comments" to commentRepository.count()
            )
            
            mapOf(
                "status" to "UP",
                "counts" to repoTests,
                "timestamp" to LocalDateTime.now()
            )
        } catch (e: Exception) {
            mapOf(
                "status" to "DOWN",
                "error" to (e.message ?: "Error desconocido"),
                "timestamp" to LocalDateTime.now()
            )
        }
    }

    private fun checkExternalServices(): Map<String, Any> {
        val services = mutableMapOf<String, Any>()
        
        // Google Cloud Storage check (básico)
        services["google_cloud_storage"] = try {
            // Por ahora solo verificamos que las variables estén configuradas
            val bucketName = System.getenv("GCP_BUCKET_NAME")
            mapOf(
                "status" to if (!bucketName.isNullOrEmpty()) "UP" else "CONFIGURED",
                "bucket_configured" to !bucketName.isNullOrEmpty()
            )
        } catch (e: Exception) {
            mapOf("status" to "DOWN", "error" to e.message)
        }
        
        return services
    }

    private fun getSystemResources(): Map<String, Any> {
        val runtime = Runtime.getRuntime()
        val maxMemory = runtime.maxMemory()
        val totalMemory = runtime.totalMemory()
        val freeMemory = runtime.freeMemory()
        val usedMemory = totalMemory - freeMemory
        
        return mapOf(
            "memory" to mapOf(
                "max_mb" to maxMemory / (1024 * 1024),
                "total_mb" to totalMemory / (1024 * 1024),
                "used_mb" to usedMemory / (1024 * 1024),
                "free_mb" to freeMemory / (1024 * 1024),
                "usage_percent" to ((usedMemory.toDouble() / maxMemory) * 100).toInt()
            ),
            "processors" to runtime.availableProcessors(),
            "timestamp" to LocalDateTime.now()
        )
    }

    private fun determineOverallStatus(
        dbStatus: Map<String, Any>,
        repoStatus: Map<String, Any>,
        @Suppress("UNUSED_PARAMETER") externalStatus: Map<String, Any>
    ): String {
        return when {
            dbStatus["status"] != "UP" -> "DOWN"
            repoStatus["status"] != "UP" -> "DOWN"
            else -> "UP"
        }
    }
}