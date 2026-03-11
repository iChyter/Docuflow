package com.docuflow.backend.service

import com.google.auth.oauth2.ServiceAccountCredentials
import com.google.cloud.storage.BlobInfo
import com.google.cloud.storage.Storage
import com.google.cloud.storage.StorageOptions
import com.google.cloud.storage.Blob
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayInputStream

@Service
object GcsUtil {

    private fun getStorageService(): Storage {
        val credentialsJson = System.getenv("GCP_KEY_JSON")?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Credenciales de GCS no configuradas")

        return StorageOptions.newBuilder()
            .setCredentials(ServiceAccountCredentials.fromStream(ByteArrayInputStream(credentialsJson.toByteArray())))
            .build()
            .service
    }

    fun uploadFile(file: MultipartFile, bucketName: String): String {
        val storage = getStorageService()
        val blobInfo = BlobInfo.newBuilder(bucketName, file.originalFilename!!).build()
        storage.create(blobInfo, file.bytes)
        return "gs://$bucketName/${file.originalFilename}"
    }

    fun listAllFilesInBucket(bucketName: String): List<Blob> {
        val storage = getStorageService()
        val blobs = storage.list(bucketName)
        return blobs.iterateAll().toList()
    }

    fun getFileInfo(bucketName: String, fileName: String): Blob? {
        val storage = getStorageService()
        return storage.get(bucketName, fileName)
    }

    fun deleteFile(bucketName: String, fileName: String): Boolean {
        val storage = getStorageService()
        return storage.delete(bucketName, fileName)
    }
}