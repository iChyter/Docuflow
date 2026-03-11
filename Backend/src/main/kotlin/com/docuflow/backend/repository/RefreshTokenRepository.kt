package com.docuflow.backend.repository

import com.docuflow.backend.model.RefreshToken
import com.docuflow.backend.model.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByToken(token: String): RefreshToken?
    fun findAllByUserAndRevokedFalse(user: User): List<RefreshToken>
    fun deleteAllByUser(user: User)
}
