package com.docuflow.backend.repository

import com.docuflow.backend.model.LogEntry
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface LogEntryRepository : JpaRepository<LogEntry, Long> {
    fun findByDocumentId(documentId: Long): List<LogEntry>
    fun findByUsername(username: String): List<LogEntry>
}