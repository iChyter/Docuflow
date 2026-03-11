package com.docuflow.backend.repository

import com.docuflow.backend.model.RevokedToken
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface RevokedTokenRepository : JpaRepository<RevokedToken, Long> {
    fun findByToken(token: String): RevokedToken?
    fun existsByToken(token: String): Boolean
}
