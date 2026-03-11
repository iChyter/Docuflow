package com.docuflow.backend.controller

import com.docuflow.backend.model.Notification
import com.docuflow.backend.repository.NotificationRepository
import com.docuflow.backend.repository.UserRepository
import com.docuflow.backend.security.JwtUtilService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime
import jakarta.servlet.http.HttpServletRequest

@RestController
@RequestMapping("/notifications")
@CrossOrigin(origins = ["*"])
class NotificationController {

    @Autowired
    private lateinit var notificationRepository: NotificationRepository

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtUtil: JwtUtilService

    // DTO para crear notificaciones
    data class NotificationRequestDTO(
        val title: String,
        val message: String,
        val type: String,
        val priority: String,
        val isGlobal: Boolean = false,
        val targetUsername: String? = null,
        val targetRole: String? = null,
        val expiresAt: LocalDateTime? = null,
        val metadata: String? = null
    )

    // DTO para respuesta de notificación
    data class NotificationResponseDTO(
        val id: Long,
        val title: String,
        val message: String,
        val type: String,
        val priority: String,
        val isGlobal: Boolean,
        val targetUsername: String?,
        val targetRole: String?,
        val isActive: Boolean,
        val createdAt: LocalDateTime,
        val expiresAt: LocalDateTime?,
        val createdBy: String,
        val metadata: String?
    )

    @GetMapping
    fun getAllNotifications(request: HttpServletRequest): ResponseEntity<Any> {
        return try {
            val username = getUsernameFromToken(request)
            val userRole = getUserRoleFromToken(request)
            
            val notifications = notificationRepository.findNotificationsForUser(
                username, userRole, LocalDateTime.now()
            )
            
            val response = notifications.map { notification ->
                NotificationResponseDTO(
                    id = notification.id!!,
                    title = notification.title,
                    message = notification.message,
                    type = notification.type,
                    priority = notification.priority,
                    isGlobal = notification.isGlobal,
                    targetUsername = notification.targetUsername,
                    targetRole = notification.targetRole,
                    isActive = notification.isActive,
                    createdAt = notification.createdAt,
                    expiresAt = notification.expiresAt,
                    createdBy = notification.createdBy,
                    metadata = notification.metadata
                )
            }
            
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @GetMapping("/admin/all")
    fun getAllNotificationsAdmin(request: HttpServletRequest): ResponseEntity<Any> {
        return try {
            val userRole = getUserRoleFromToken(request)
            if (userRole != "ADMIN") {
                return ResponseEntity.status(403).body(mapOf("error" to "Acceso denegado"))
            }
            
            val notifications = notificationRepository.findAll()
                .sortedByDescending { it.createdAt }
            
            val response = notifications.map { notification ->
                NotificationResponseDTO(
                    id = notification.id!!,
                    title = notification.title,
                    message = notification.message,
                    type = notification.type,
                    priority = notification.priority,
                    isGlobal = notification.isGlobal,
                    targetUsername = notification.targetUsername,
                    targetRole = notification.targetRole,
                    isActive = notification.isActive,
                    createdAt = notification.createdAt,
                    expiresAt = notification.expiresAt,
                    createdBy = notification.createdBy,
                    metadata = notification.metadata
                )
            }
            
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @PostMapping
    fun createNotification(
        @RequestBody notificationRequest: NotificationRequestDTO,
        request: HttpServletRequest
    ): ResponseEntity<Any> {
        return try {
            val username = getUsernameFromToken(request)
            val userRole = getUserRoleFromToken(request)
            
            // Solo admin puede crear notificaciones globales
            if (notificationRequest.isGlobal && userRole != "ADMIN") {
                return ResponseEntity.status(403).body(mapOf("error" to "Solo administradores pueden crear notificaciones globales"))
            }
            
            val notification = Notification(
                title = notificationRequest.title,
                message = notificationRequest.message,
                type = notificationRequest.type,
                priority = notificationRequest.priority,
                isGlobal = notificationRequest.isGlobal,
                targetUsername = notificationRequest.targetUsername,
                targetRole = notificationRequest.targetRole,
                expiresAt = notificationRequest.expiresAt,
                createdBy = username,
                metadata = notificationRequest.metadata
            )
            
            val savedNotification = notificationRepository.save(notification)
            
            val response = NotificationResponseDTO(
                id = savedNotification.id!!,
                title = savedNotification.title,
                message = savedNotification.message,
                type = savedNotification.type,
                priority = savedNotification.priority,
                isGlobal = savedNotification.isGlobal,
                targetUsername = savedNotification.targetUsername,
                targetRole = savedNotification.targetRole,
                isActive = savedNotification.isActive,
                createdAt = savedNotification.createdAt,
                expiresAt = savedNotification.expiresAt,
                createdBy = savedNotification.createdBy,
                metadata = savedNotification.metadata
            )
            
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @GetMapping("/types")
    fun getNotificationTypes(): ResponseEntity<List<String>> {
        val types = listOf("INFO", "WARNING", "ERROR", "SUCCESS", "MAINTENANCE", "UPDATE")
        return ResponseEntity.ok(types)
    }

    @GetMapping("/priorities")
    fun getNotificationPriorities(): ResponseEntity<List<String>> {
        val priorities = listOf("LOW", "MEDIUM", "HIGH", "URGENT")
        return ResponseEntity.ok(priorities)
    }

    @GetMapping("/type/{type}")
    fun getNotificationsByType(
        @PathVariable type: String,
        request: HttpServletRequest
    ): ResponseEntity<Any> {
        return try {
            val username = getUsernameFromToken(request)
            val userRole = getUserRoleFromToken(request)
            
            val notifications = notificationRepository.findByTypeAndIsActiveTrue(type)
                .filter { notification ->
                    notification.isGlobal || 
                    notification.targetUsername == username || 
                    notification.targetRole == userRole
                }
                .filter { notification ->
                    val expiresAt = notification.expiresAt
                    expiresAt == null || expiresAt.isAfter(LocalDateTime.now())
                }
            
            val response = notifications.map { notification ->
                NotificationResponseDTO(
                    id = notification.id!!,
                    title = notification.title,
                    message = notification.message,
                    type = notification.type,
                    priority = notification.priority,
                    isGlobal = notification.isGlobal,
                    targetUsername = notification.targetUsername,
                    targetRole = notification.targetRole,
                    isActive = notification.isActive,
                    createdAt = notification.createdAt,
                    expiresAt = notification.expiresAt,
                    createdBy = notification.createdBy,
                    metadata = notification.metadata
                )
            }
            
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @GetMapping("/{id}")
    fun getNotificationById(
        @PathVariable id: Long,
        request: HttpServletRequest
    ): ResponseEntity<Any> {
        return try {
            val username = getUsernameFromToken(request)
            val userRole = getUserRoleFromToken(request)
            
            val notification = notificationRepository.findById(id).orElse(null)
                ?: return ResponseEntity.notFound().build()
            
            // Verificar que el usuario tenga acceso a esta notificación
            if (!notification.isGlobal && 
                notification.targetUsername != username && 
                notification.targetRole != userRole &&
                userRole != "ADMIN") {
                return ResponseEntity.status(403).body(mapOf("error" to "Acceso denegado"))
            }
            
            val response = NotificationResponseDTO(
                id = notification.id!!,
                title = notification.title,
                message = notification.message,
                type = notification.type,
                priority = notification.priority,
                isGlobal = notification.isGlobal,
                targetUsername = notification.targetUsername,
                targetRole = notification.targetRole,
                isActive = notification.isActive,
                createdAt = notification.createdAt,
                expiresAt = notification.expiresAt,
                createdBy = notification.createdBy,
                metadata = notification.metadata
            )
            
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @PutMapping("/{id}/deactivate")
    fun deactivateNotification(
        @PathVariable id: Long,
        request: HttpServletRequest
    ): ResponseEntity<Any> {
        return try {
            val username = getUsernameFromToken(request)
            val userRole = getUserRoleFromToken(request)
            
            val notification = notificationRepository.findById(id).orElse(null)
                ?: return ResponseEntity.notFound().build()
            
            // Solo el creador o admin puede desactivar
            if (notification.createdBy != username && userRole != "ADMIN") {
                return ResponseEntity.status(403).body(mapOf("error" to "Solo el creador o un administrador puede desactivar esta notificación"))
            }
            
            notification.isActive = false
            val updatedNotification = notificationRepository.save(notification)
            
            ResponseEntity.ok(mapOf(
                "message" to "Notificación desactivada exitosamente",
                "id" to updatedNotification.id
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    @GetMapping("/stats")
    fun getNotificationStats(request: HttpServletRequest): ResponseEntity<Any> {
        return try {
            val userRole = getUserRoleFromToken(request)
            if (userRole != "ADMIN") {
                return ResponseEntity.status(403).body(mapOf("error" to "Acceso denegado"))
            }
            
            val totalNotifications = notificationRepository.count()
            val activeNotifications = notificationRepository.findByIsActiveTrue().size
            val globalNotifications = notificationRepository.findByIsGlobalTrueAndIsActiveTrue().size
            
            val notificationsByType = notificationRepository.findByIsActiveTrue()
                .groupBy { it.type }
                .mapValues { it.value.size }
            
            val notificationsByPriority = notificationRepository.findByIsActiveTrue()
                .groupBy { it.priority }
                .mapValues { it.value.size }
            
            val stats = mapOf(
                "total" to totalNotifications,
                "active" to activeNotifications,
                "global" to globalNotifications,
                "byType" to notificationsByType,
                "byPriority" to notificationsByPriority
            )
            
            ResponseEntity.ok(stats)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to e.message))
        }
    }

    private fun getUsernameFromToken(request: HttpServletRequest): String {
        val token = request.getHeader("Authorization")?.substring(7)
        return jwtUtil.validateToken(token!!) ?: throw IllegalArgumentException("Token inválido")
    }

    private fun getUserRoleFromToken(request: HttpServletRequest): String {
        val username = getUsernameFromToken(request)
        val user = userRepository.findByUsername(username)
        return user?.role ?: "USER"
    }
}