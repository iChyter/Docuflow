package com.docuflow.backend.model

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

@Entity
@Table(name = "documents")
data class Document(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val filename: String,

    @Column(nullable = false)
    val fileType: String,

    @Column(nullable = false)
    val filePath: String,

    @Column(nullable = false)
    val size: Long,

    @CreationTimestamp
    @Column(name = "upload_date", nullable = false, updatable = false)
    @JsonProperty("uploadedAt")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    var uploadedAt: LocalDateTime? = null
) {
    @PrePersist
    fun touchUploadedAt() {
        if (uploadedAt == null) {
            uploadedAt = LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS)
        }
    }
}
