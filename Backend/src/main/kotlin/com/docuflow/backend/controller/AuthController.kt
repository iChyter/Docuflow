package com.docuflow.backend.controller

import com.docuflow.backend.model.LogEntry
import com.docuflow.backend.model.User
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.repository.UserRepository
import com.docuflow.backend.security.JwtUtil
import com.docuflow.backend.service.TokenService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

data class LoginRequest(val username: String, val password: String)
data class RegisterRequest(val email: String?, val password: String?, val name: String?)
data class RefreshTokenRequest(val refreshToken: String?)

@RestController
@RequestMapping("/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val tokenService: TokenService,
    private val passwordEncoder: PasswordEncoder,
    private val logEntryRepository: LogEntryRepository
) {

    companion object {
        private const val ACCESS_TOKEN_EXPIRATION_SECONDS = 3600L
        private val EMAIL_REGEX = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
        private val DEFAULT_VIEWER_PERMISSIONS = setOf("files.read", "files.download", "comments.read")
        private val DEFAULT_ADMIN_PERMISSIONS = setOf(
            "files.read", "files.upload", "files.download", "files.delete",
            "tasks.complete", "comments.read", "comments.create", "comments.edit", "comments.delete",
            "logs.view", "users.read", "users.create", "users.update", "users.delete", "users.permissions"
        )
    }

    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): ResponseEntity<Map<String, Any>> {
        val username = request.username.trim().lowercase()
        if (username.isBlank() || request.password.isBlank()) {
            return errorResponse(HttpStatus.BAD_REQUEST, "Credenciales inválidas", "Usuario y contraseña son obligatorios")
        }

        var user = userRepository.findByUsername(username)

        if (user == null) {
            val envUser = (System.getenv("APP_USER") ?: "estudiante").trim().lowercase()
            val envPass = System.getenv("APP_PASS") ?: "123456"
            if (username == envUser && request.password == envPass) {
                val hashed = passwordEncoder.encode(envPass)
                user = userRepository.save(
                    User(
                        username = username,
                        password = hashed,
                        fullName = "Administrador",
                        role = "admin",
                        permissions = DEFAULT_ADMIN_PERMISSIONS
                    )
                )
            } else {
                return errorResponse(HttpStatus.UNAUTHORIZED, "Credenciales inválidas", "Usuario o contraseña incorrectos")
            }
        }

        if (!user.active) {
            return errorResponse(HttpStatus.FORBIDDEN, "La cuenta está deshabilitada")
        }

        val passwordMatches = passwordEncoder.matches(request.password, user.password) || user.password == request.password
        if (!passwordMatches) {
            return errorResponse(HttpStatus.UNAUTHORIZED, "Credenciales inválidas", "Usuario o contraseña incorrectos")
        }

        if (user.password == request.password) {
            user = userRepository.save(user.copy(password = passwordEncoder.encode(request.password)))
        }

        val accessToken = JwtUtil.generateToken(user.username, ACCESS_TOKEN_EXPIRATION_SECONDS * 1000)
        val refreshToken = tokenService.generateRefreshToken(user)
        tokenService.cleanupExpiredTokens()

        logEntryRepository.save(
            LogEntry(
                action = "login",
                username = user.username,
                timestamp = LocalDateTime.now()
            )
        )

        val body = mapOf(
            "success" to true,
            "token" to accessToken,
            "refreshToken" to refreshToken.token,
            "expiresIn" to ACCESS_TOKEN_EXPIRATION_SECONDS,
            "user" to mapOf(
                "username" to user.username,
                "name" to (user.fullName ?: user.username),
                "role" to user.role,
                "permissions" to user.permissions
            ),
            "message" to "Login exitoso"
        )

        return ResponseEntity.ok(body)
    }

    @PostMapping("/register")
    fun register(@RequestBody request: RegisterRequest): ResponseEntity<Map<String, Any>> {
        val email = request.email?.trim()?.lowercase() ?: return validationError("El email es obligatorio")
        val password = request.password?.trim() ?: return validationError("La contraseña es obligatoria")
        val name = request.name?.trim() ?: return validationError("El nombre es obligatorio")

        if (!EMAIL_REGEX.matches(email)) {
            return validationError("El email no tiene un formato válido")
        }
        if (password.length < 8) {
            return validationError("La contraseña debe tener al menos 8 caracteres")
        }
        if (name.length < 2) {
            return validationError("El nombre es demasiado corto")
        }

        if (userRepository.findByUsername(email) != null) {
            return errorResponse(HttpStatus.BAD_REQUEST, "El email ya está registrado")
        }

        val user = User(
            username = email,
            password = passwordEncoder.encode(password),
            fullName = name,
            role = "viewer",
            permissions = DEFAULT_VIEWER_PERMISSIONS
        )

        userRepository.save(user)

        logEntryRepository.save(
            LogEntry(
                action = "register",
                username = email,
                timestamp = LocalDateTime.now()
            )
        )

        val body = mapOf(
            "success" to true,
            "message" to "User registered successfully"
        )

        return ResponseEntity.status(HttpStatus.CREATED).body(body)
    }

    @PostMapping("/logout")
    fun logout(@RequestHeader("Authorization") authHeader: String?): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") ?: return errorResponse(HttpStatus.UNAUTHORIZED, "Token faltante")
        val username = JwtUtil.validateToken(token) ?: return errorResponse(HttpStatus.UNAUTHORIZED, "Token inválido")

        val expiresAt = JwtUtil.getExpiration(token) ?: LocalDateTime.now().plusHours(1)
        tokenService.revokeAccessToken(token, expiresAt)

        val user = userRepository.findByUsername(username)
        if (user != null) {
            tokenService.revokeAllRefreshTokens(user)
            logEntryRepository.save(
                LogEntry(
                    action = "logout",
                    username = user.username,
                    timestamp = LocalDateTime.now()
                )
            )
        }

        return ResponseEntity.ok(
            mapOf(
                "success" to true,
                "message" to "Logged out successfully"
            )
        )
    }

    @PostMapping("/refresh")
    fun refresh(@RequestBody request: RefreshTokenRequest): ResponseEntity<Map<String, Any>> {
        val tokenValue = request.refreshToken?.trim()
            ?: return errorResponse(HttpStatus.BAD_REQUEST, "Refresh token requerido")

        val storedToken = tokenService.validateRefreshToken(tokenValue)
            ?: return errorResponse(HttpStatus.UNAUTHORIZED, "Refresh token inválido", mapOf("code" to "INVALID_REFRESH_TOKEN"))

        val user = storedToken.user
        tokenService.revokeRefreshToken(storedToken)

        val newAccessToken = JwtUtil.generateToken(user.username, ACCESS_TOKEN_EXPIRATION_SECONDS * 1000)
        val newRefreshToken = tokenService.generateRefreshToken(user)

        val body = mapOf(
            "success" to true,
            "token" to newAccessToken,
            "refreshToken" to newRefreshToken.token,
            "expiresIn" to ACCESS_TOKEN_EXPIRATION_SECONDS
        )

        return ResponseEntity.ok(body)
    }

    private fun validationError(message: String): ResponseEntity<Map<String, Any>> =
        errorResponse(HttpStatus.UNPROCESSABLE_ENTITY, message)

    private fun errorResponse(status: HttpStatus, message: String, details: Any? = null): ResponseEntity<Map<String, Any>> {
        val payload = mutableMapOf<String, Any>("error" to message)
        if (details != null) {
            payload["details"] = details
        }
        return ResponseEntity.status(status).body(payload)
    }
}
