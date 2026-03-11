package com.docuflow.backend.controller

import com.docuflow.backend.security.JwtUtil
import com.docuflow.backend.model.Document
import com.docuflow.backend.repository.DocumentRepository
import com.docuflow.backend.service.GcsUtil
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/upload")
class UploadController {

    @Autowired
    lateinit var documentRepository: DocumentRepository

    private val logger = LoggerFactory.getLogger(UploadController::class.java)
    @PostMapping
    fun uploadFile(
        @RequestHeader("Authorization") authHeader: String?,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Map<String, String>> {

        // 1. Validar token
        val token = authHeader?.removePrefix("Bearer ") ?: return ResponseEntity.status(401)
            .body(mapOf("error" to "Token faltante"))

        val username = JwtUtil.validateToken(token) ?: return ResponseEntity.status(401)
            .body(mapOf("error" to "Token inválido"))

        // 2. Validar archivo
        val allowedExtensions = listOf("pdf", "docx", "xlsx")
        val extension = file.originalFilename?.substringAfterLast(".")?.lowercase()

        if (extension !in allowedExtensions) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Formato no permitido"))
        }
        if (file.size > 20 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Archivo demasiado grande"))
        }

        // 3. Subir archivo a Google Cloud Storage
        val bucketName = System.getenv("GCP_BUCKET_NAME")
            ?: return ResponseEntity.status(500).body(mapOf("error" to "Bucket no configurado"))
        val credentialsConfigured = System.getenv("GCP_KEY_JSON")?.isNotBlank() == true
        if (!credentialsConfigured) {
            return ResponseEntity.status(500).body(mapOf("error" to "Credenciales no configuradas"))
        }
        val gcsPath = GcsUtil.uploadFile(file, bucketName)

        // 4. Guardar metadatos en la BD
        val document = Document(
            filename = file.originalFilename!!,
            fileType = file.contentType ?: "desconocido",
            filePath = gcsPath, // Guardamos la ruta de GCS
            size = file.size
        )
        documentRepository.save(document)

        logger.info("Usuario {} subió {} ({} bytes) a {}", username, file.originalFilename, file.size, gcsPath)

        return ResponseEntity.ok(mapOf("mensaje" to "Archivo subido exitosamente"))
    }
}
