package com.docuflow.backend.service

import com.docuflow.backend.dto.AdminRoleResponse
import com.docuflow.backend.dto.AdminUserCreateRequest
import com.docuflow.backend.dto.AdminUserPasswordUpdateRequest
import com.docuflow.backend.dto.AdminUserPermissionsRequest
import com.docuflow.backend.dto.AdminUserResponse
import com.docuflow.backend.dto.AdminUserUpdateRequest
import com.docuflow.backend.model.LogEntry
import com.docuflow.backend.model.User
import com.docuflow.backend.repository.LogEntryRepository
import com.docuflow.backend.repository.UserRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.time.LocalDateTime

@Service
class AdminUserService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val logEntryRepository: LogEntryRepository
) {

    companion object {
        const val ROLE_ADMIN = "admin"
        const val ROLE_COLABORADOR = "colaborador"
        const val ROLE_VIEWER = "viewer"

        private val DEFAULT_ROLE_PERMISSIONS: Map<String, Set<String>> = mapOf(
            ROLE_ADMIN to setOf(
                "files.read", "files.upload", "files.download", "files.delete",
                "tasks.complete", "comments.read", "comments.create", "comments.edit", "comments.delete",
                "logs.view", "users.read", "users.create", "users.update", "users.delete", "users.permissions"
            ),
            ROLE_COLABORADOR to setOf(
                "files.read", "files.upload", "files.download", "files.delete",
                "tasks.complete", "comments.read", "comments.create", "comments.edit"
            ),
            ROLE_VIEWER to setOf(
                "files.read", "files.download", "comments.read"
            )
        )

        private val ROLE_CATALOGUE: Map<String, AdminRoleResponse> = mapOf(
            ROLE_ADMIN to AdminRoleResponse(
                id = ROLE_ADMIN,
                name = "Administrador",
                description = "Control total de la plataforma: usuarios, permisos, archivos y logs",
                defaultPermissions = DEFAULT_ROLE_PERMISSIONS[ROLE_ADMIN] ?: emptySet()
            ),
            ROLE_COLABORADOR to AdminRoleResponse(
                id = ROLE_COLABORADOR,
                name = "Colaborador",
                description = "Puede subir, descargar y gestionar archivos; marcar tareas como completadas",
                defaultPermissions = DEFAULT_ROLE_PERMISSIONS[ROLE_COLABORADOR] ?: emptySet()
            ),
            ROLE_VIEWER to AdminRoleResponse(
                id = ROLE_VIEWER,
                name = "Visualizador",
                description = "Acceso de solo lectura",
                defaultPermissions = DEFAULT_ROLE_PERMISSIONS[ROLE_VIEWER] ?: emptySet()
            )
        )

        private val ALLOWED_PERMISSIONS: Set<String> = DEFAULT_ROLE_PERMISSIONS.values
            .flatten()
            .toSet()
    }

    fun ensureAdmin(username: String): User {
        val user = userRepository.findByUsername(username)
            ?: throw AdminUserException.Authorization("El usuario autenticado no existe")
        if (user.role != ROLE_ADMIN) {
            throw AdminUserException.Authorization("Se requieren privilegios de administrador")
        }
        return user
    }

    fun listUsers(): List<AdminUserResponse> = userRepository.findAll().map { it.toResponse() }

    fun getUser(id: Long): AdminUserResponse {
        val user = userRepository.findById(id).orElseThrow {
            AdminUserException.NotFound("Usuario no encontrado")
        }
        return user.toResponse()
    }

    fun createUser(request: AdminUserCreateRequest, actingAdmin: User): AdminUserResponse {
        val normalizedUsername = request.username.trim().lowercase()
        if (normalizedUsername.isBlank()) {
            throw AdminUserException.Validation("El email/usuario es obligatorio")
        }
        if (userRepository.findByUsername(normalizedUsername) != null) {
            throw AdminUserException.Validation("El usuario ya existe en la plataforma")
        }

        val role = normalizeRole(request.role)
        enforceAdminConstraints(role, null)

        val password = request.password.trim()
        if (password.length < 8) {
            throw AdminUserException.Validation("La contraseña debe tener al menos 8 caracteres")
        }

        val permissions = resolvePermissions(role, request.permissions)
        val newUser = User(
            username = normalizedUsername,
            password = passwordEncoder.encode(password),
            fullName = request.name?.trim()?.ifBlank { null },
            role = role,
            permissions = permissions,
            active = request.active ?: true
        )

        val saved = userRepository.save(newUser)
        logAdminAction(
            action = "user_create",
            admin = actingAdmin,
            target = saved,
            details = "Creó al usuario ${saved.username} con rol $role"
        )

        return saved.toResponse()
    }

    fun updateUser(id: Long, request: AdminUserUpdateRequest, actingAdmin: User): AdminUserResponse {
        if (request.name == null && request.role == null && request.permissions == null && request.active == null) {
            throw AdminUserException.Validation("No se recibió ningún cambio para aplicar")
        }

        val existing = userRepository.findById(id).orElseThrow {
            AdminUserException.NotFound("Usuario no encontrado")
        }

        var updated = existing

        val newName = request.name?.trim()?.ifBlank { null }
        if (newName != null && newName != existing.fullName) {
            updated = updated.copy(fullName = newName)
        }

        val newRole = request.role?.let { normalizeRole(it) }
        if (newRole != null && newRole != existing.role) {
            enforceRoleChange(existing, newRole)
            updated = updated.copy(role = newRole)
            if (request.permissions == null) {
                updated = updated.copy(permissions = DEFAULT_ROLE_PERMISSIONS[newRole] ?: existing.permissions)
            }
        }

        val newPermissions = request.permissions?.let { normalizePermissions(it) }
        if (newPermissions != null) {
            updated = updated.copy(permissions = newPermissions)
        }

        request.active?.let { isActive ->
            if (existing.role == ROLE_ADMIN && !isActive) {
                enforceAdminConstraintsOnDisable(existing)
            }
            updated = updated.copy(active = isActive)
        }

        val saved = userRepository.save(updated)
        logAdminAction(
            action = "user_update",
            admin = actingAdmin,
            target = saved,
            details = "Actualizó los datos del usuario ${saved.username}"
        )

        return saved.toResponse()
    }

    fun updatePassword(id: Long, request: AdminUserPasswordUpdateRequest, actingAdmin: User) {
        if (request.password.length < 8) {
            throw AdminUserException.Validation("La contraseña debe tener al menos 8 caracteres")
        }

        val user = userRepository.findById(id).orElseThrow {
            AdminUserException.NotFound("Usuario no encontrado")
        }

        val hashedPassword = passwordEncoder.encode(request.password)
        val updated = user.copy(password = hashedPassword)
        userRepository.save(updated)

        logAdminAction(
            action = "user_password_reset",
            admin = actingAdmin,
            target = updated,
            details = "Actualizó la contraseña del usuario ${updated.username}"
        )
    }

    fun updatePermissions(id: Long, request: AdminUserPermissionsRequest, actingAdmin: User): AdminUserResponse {
        val user = userRepository.findById(id).orElseThrow {
            AdminUserException.NotFound("Usuario no encontrado")
        }

        val normalizedPermissions = normalizePermissions(request.permissions)
        val updated = user.copy(permissions = normalizedPermissions)
        val saved = userRepository.save(updated)

        logAdminAction(
            action = "user_permissions_update",
            admin = actingAdmin,
            target = saved,
            details = "Actualizó los permisos del usuario ${saved.username}"
        )

        return saved.toResponse()
    }

    fun deleteUser(id: Long, actingAdmin: User) {
        val user = userRepository.findById(id).orElseThrow {
            AdminUserException.NotFound("Usuario no encontrado")
        }

        if (user.id == actingAdmin.id) {
            throw AdminUserException.Validation("No puedes eliminar tu propia cuenta")
        }

        if (user.role == ROLE_ADMIN) {
            enforceAdminConstraintsOnDisable(user)
        }

        userRepository.delete(user)

        logAdminAction(
            action = "user_delete",
            admin = actingAdmin,
            target = user,
            details = "Eliminó al usuario ${user.username}"
        )
    }

    fun getRoles(): List<AdminRoleResponse> = ROLE_CATALOGUE.values.toList()

    private fun normalizeRole(role: String?): String {
        val normalized = role?.trim()?.lowercase() ?: ROLE_COLABORADOR
        if (normalized !in ROLE_CATALOGUE.keys) {
            throw AdminUserException.Validation("Rol inválido: $normalized")
        }
        return normalized
    }

    private fun resolvePermissions(role: String, requested: Set<String>?): Set<String> {
        val defaults = DEFAULT_ROLE_PERMISSIONS[role] ?: emptySet()
        return requested?.let { defaults + normalizePermissions(it) } ?: defaults
    }

    private fun normalizePermissions(permissions: Set<String>): Set<String> {
        if (permissions.isEmpty()) {
            throw AdminUserException.Validation("Debe seleccionar al menos un permiso")
        }
        val normalized = permissions.map { it.trim().lowercase() }.toSet()
        val invalid = normalized.subtract(ALLOWED_PERMISSIONS)
        if (invalid.isNotEmpty()) {
            throw AdminUserException.Validation("Permisos inválidos: ${invalid.joinToString(", ")}")
        }
        return normalized
    }

    private fun enforceAdminConstraints(targetRole: String, targetUser: User?) {
        if (targetRole == ROLE_ADMIN) {
            val existingAdmins = userRepository.findByRole(ROLE_ADMIN)
            if (targetUser == null && existingAdmins.isNotEmpty()) {
                throw AdminUserException.Validation("Ya existe un administrador configurado")
            }
            if (targetUser != null && existingAdmins.size == 1 && existingAdmins.first().id == targetUser.id) {
                // ok: target is the only admin and remains admin
                return
            }
        }
    }

    private fun enforceRoleChange(existing: User, newRole: String) {
        if (existing.role == ROLE_ADMIN && newRole != ROLE_ADMIN) {
            enforceAdminConstraintsOnDisable(existing)
        }
        if (newRole == ROLE_ADMIN) {
            val existingAdmins = userRepository.findByRole(ROLE_ADMIN)
            val otherAdmins = existingAdmins.filter { it.id != existing.id }
            if (otherAdmins.isNotEmpty()) {
                throw AdminUserException.Validation("Ya existe un administrador configurado")
            }
        }
    }

    private fun enforceAdminConstraintsOnDisable(adminUser: User) {
        val admins = userRepository.findByRole(ROLE_ADMIN)
        val remaining = admins.filter { it.id != adminUser.id }
        if (remaining.isEmpty()) {
            throw AdminUserException.Validation("No se puede dejar la plataforma sin administradores")
        }
    }

    private fun logAdminAction(action: String, admin: User, target: User, details: String) {
        logEntryRepository.save(
            LogEntry(
                action = action,
                username = admin.username,
                targetUsername = target.username,
                details = details,
                timestamp = LocalDateTime.now()
            )
        )
    }

    private fun User.toResponse(): AdminUserResponse = AdminUserResponse(
        id = this.id ?: 0L,
        username = this.username,
        name = this.fullName,
        role = this.role,
        permissions = this.permissions,
        status = if (this.active) "active" else "inactive",
        active = this.active,
        email = this.username,
        lastLogin = null
    )

    sealed class AdminUserException(message: String) : RuntimeException(message) {
        class Authorization(message: String) : AdminUserException(message)
        class Validation(message: String) : AdminUserException(message)
        class NotFound(message: String) : AdminUserException(message)
    }
}
