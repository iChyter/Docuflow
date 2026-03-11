package com.docuflow.backend.security

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTDecodeException
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.Date

object JwtUtil {
    private val SECRET = System.getenv("JWT_SECRET") ?: throw IllegalStateException("JWT_SECRET no definido")
    private val algorithm = Algorithm.HMAC256(SECRET)

    private const val DEFAULT_EXPIRATION_MILLIS: Long = 3_600_000 // 1 hora

    fun generateToken(username: String, expiresInMillis: Long = DEFAULT_EXPIRATION_MILLIS): String {
        return JWT.create()
            .withSubject(username)
            .withExpiresAt(Date(System.currentTimeMillis() + expiresInMillis))
            .sign(algorithm)
    }

    fun validateToken(token: String): String? {
        return try {
            val verifier = JWT.require(algorithm).build()
            val decoded = verifier.verify(token)
            decoded.subject
        } catch (e: Exception) {
            null
        }
    }

    fun getExpiration(token: String): LocalDateTime? {
        return try {
            val decoded = JWT.decode(token)
            decoded.expiresAt?.toInstant()?.let { LocalDateTime.ofInstant(it, ZoneOffset.UTC) }
        } catch (ex: JWTDecodeException) {
            null
        }
    }

    fun isExpired(token: String): Boolean {
        val expiration = getExpiration(token) ?: return true
        return expiration.isBefore(LocalDateTime.now(ZoneOffset.UTC))
    }
}

@Component
class JwtUtilService {
    fun generateToken(username: String, expiresInMillis: Long = 3_600_000): String {
        return JwtUtil.generateToken(username, expiresInMillis)
    }

    fun validateToken(token: String): String? {
        return JwtUtil.validateToken(token)
    }

    fun getExpiration(token: String): LocalDateTime? {
        return JwtUtil.getExpiration(token)
    }

    fun isExpired(token: String): Boolean {
        return JwtUtil.isExpired(token)
    }
}
