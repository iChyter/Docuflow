package com.docuflow.backend.repository

import com.docuflow.backend.model.Document
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface DocumentRepository : JpaRepository<Document, Long> {
	fun findAllByOrderByUploadedAtDesc(pageable: Pageable): List<Document>
	fun findByFilenameContainingIgnoreCase(keyword: String, pageable: Pageable): List<Document>
}
