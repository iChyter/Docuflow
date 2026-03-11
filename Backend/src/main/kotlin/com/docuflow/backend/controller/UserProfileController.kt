package com.docuflow.backend.controller

import com.docuflow.backend.repository.UserRepository
import com.docuflow.backend.security.JwtUtil
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

@RestController
@RequestMapping("/me")
class UserProfileController(
    private val userRepository: UserRepository
) {

    @GetMapping
    fun getCurrentUserProfile(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            val user = userRepository.findByUsername(username)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "Usuario no encontrado"))
            
            val profile: Map<String, Any> = mapOf(
                "success" to true,
                "user" to mapOf(
                    "id" to (user.id ?: 0L),
                    "username" to user.username,
                    "role" to user.role,
                    "permissions" to user.permissions.toList(),
                    "createdAt" to LocalDateTime.now().minusDays(30), // Simulado
                    "lastLogin" to LocalDateTime.now().minusHours(2), // Simulado
                    "status" to "active",
                    "profileComplete" to true
                ),
                "timestamp" to LocalDateTime.now()
            )
            
            return ResponseEntity.ok(profile)
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "success" to false,
                "error" to "Error al obtener perfil: ${e.message}",
                "timestamp" to LocalDateTime.now()
            ))
        }
    }

    @PutMapping("/password")
    fun changePassword(
        @RequestHeader("Authorization") authHeader: String?,
        @RequestBody request: ChangePasswordRequest
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            val user = userRepository.findByUsername(username)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "Usuario no encontrado"))
            
            // Verificar contraseña actual (en un sistema real usarías BCrypt)
            if (user.password != request.currentPassword) {
                return ResponseEntity.status(400).body(mapOf(
                    "success" to false,
                    "error" to "Contraseña actual incorrecta"
                ))
            }
            
            // Validar nueva contraseña
            if (request.newPassword.length < 6) {
                return ResponseEntity.status(400).body(mapOf(
                    "success" to false,
                    "error" to "La nueva contraseña debe tener al menos 6 caracteres"
                ))
            }
            
            // Actualizar contraseña (en un sistema real la encriptarías)
            val updatedUser = user.copy(password = request.newPassword)
            userRepository.save(updatedUser)
            
            val response: Map<String, Any> = mapOf(
                "success" to true,
                "message" to "Contraseña actualizada exitosamente",
                "timestamp" to LocalDateTime.now()
            )
            
            return ResponseEntity.ok(response)
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "success" to false,
                "error" to "Error al cambiar contraseña: ${e.message}",
                "timestamp" to LocalDateTime.now()
            ))
        }
    }

    @PutMapping("/profile")
    fun updateProfile(
        @RequestHeader("Authorization") authHeader: String?,
        @RequestBody updates: Map<String, Any>
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            val user = userRepository.findByUsername(username)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "Usuario no encontrado"))
            
            // Por ahora solo permitimos actualizar el role si es admin
            var updatedUser = user
            if (updates.containsKey("role") && user.role == "admin") {
                val newRole = updates["role"] as? String
                if (newRole != null && newRole in listOf("admin", "colaborador", "viewer")) {
                    updatedUser = updatedUser.copy(role = newRole)
                }
            }
            
            userRepository.save(updatedUser)
            
            val response: Map<String, Any> = mapOf(
                "success" to true,
                "message" to "Perfil actualizado exitosamente",
                "user" to mapOf(
                    "id" to (updatedUser.id ?: 0L),
                    "username" to updatedUser.username,
                    "role" to updatedUser.role,
                    "permissions" to updatedUser.permissions.toList()
                ),
                "timestamp" to LocalDateTime.now()
            )
            
            return ResponseEntity.ok(response)
            
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "success" to false,
                "error" to "Error al actualizar perfil: ${e.message}",
                "timestamp" to LocalDateTime.now()
            ))
        }
    }
}