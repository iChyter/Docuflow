package com.docuflow.backend.service

import com.docuflow.backend.model.RefreshToken
import com.docuflow.backend.model.RevokedToken
import com.docuflow.backend.model.User
import com.docuflow.backend.repository.RefreshTokenRepository
import com.docuflow.backend.repository.RevokedTokenRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.UUID

@Service
class TokenService(
    private val refreshTokenRepository: RefreshTokenRepository,
    private val revokedTokenRepository: RevokedTokenRepository
) {
    private val refreshTokenValidityDays: Long = 14

    fun generateRefreshToken(user: User): RefreshToken {
        val tokenValue = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val refreshToken = RefreshToken(
            token = tokenValue,
            user = user,
            expiresAt = LocalDateTime.now().plusDays(refreshTokenValidityDays)
        )
        return refreshTokenRepository.save(refreshToken)
    }

    fun validateRefreshToken(token: String): RefreshToken? {
        val refreshToken = refreshTokenRepository.findByToken(token) ?: return null
        if (refreshToken.revoked) {
            return null
        }
        if (refreshToken.expiresAt.isBefore(LocalDateTime.now())) {
            refreshToken.revoked = true
            refreshTokenRepository.save(refreshToken)
            return null
        }
        return refreshToken
    }

    @Transactional
    fun revokeRefreshToken(token: RefreshToken) {
        token.revoked = true
        refreshTokenRepository.save(token)
    }

    @Transactional
    fun revokeAllRefreshTokens(user: User) {
        val activeTokens = refreshTokenRepository.findAllByUserAndRevokedFalse(user)
        activeTokens.forEach {
            it.revoked = true
        }
        refreshTokenRepository.saveAll(activeTokens)
    }

    fun revokeAccessToken(token: String, expiresAt: LocalDateTime) {
        val existing = revokedTokenRepository.findByToken(token)
        if (existing != null) {
            if (expiresAt.isAfter(existing.expiresAt)) {
                revokedTokenRepository.save(existing.copy(expiresAt = expiresAt))
            }
        } else {
            revokedTokenRepository.save(
                RevokedToken(
                    token = token,
                    expiresAt = expiresAt
                )
            )
        }
    }

    fun isAccessTokenRevoked(token: String): Boolean {
        val revokedToken = revokedTokenRepository.findByToken(token) ?: return false
        if (revokedToken.expiresAt.isBefore(LocalDateTime.now())) {
            revokedTokenRepository.delete(revokedToken)
            return false
        }
        return true
    }

    fun cleanupExpiredTokens() {
        val now = LocalDateTime.now()
        val expiredRevoked = revokedTokenRepository.findAll().filter { it.expiresAt.isBefore(now) }
        if (expiredRevoked.isNotEmpty()) {
            revokedTokenRepository.deleteAll(expiredRevoked)
        }
        val expiredRefresh = refreshTokenRepository.findAll().filter { it.expiresAt.isBefore(now) }
        if (expiredRefresh.isNotEmpty()) {
            expiredRefresh.forEach { it.revoked = true }
            refreshTokenRepository.saveAll(expiredRefresh)
        }
    }
}
