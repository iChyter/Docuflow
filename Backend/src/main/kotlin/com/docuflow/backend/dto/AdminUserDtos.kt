package com.docuflow.backend.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * Request payload to create a new platform user from the admin panel.
 */
data class AdminUserCreateRequest(
    @field:NotBlank(message = "El email/usuario es obligatorio")
    @field:Email(message = "Debe proporcionar un email válido")
    val username: String,

    @field:NotBlank(message = "La contraseña es obligatoria")
    @field:Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
    val password: String,

    val name: String? = null,
    val role: String? = null,
    val permissions: Set<String>? = null,
    val active: Boolean? = null
)

/**
 * Payload for updating the basic information of an existing user (name/role/active).
 */
data class AdminUserUpdateRequest(
    val name: String? = null,
    val role: String? = null,
    val permissions: Set<String>? = null,
    val active: Boolean? = null
)

/**
 * Payload for setting a brand-new password for the target user.
 */
data class AdminUserPasswordUpdateRequest(
    @field:NotBlank(message = "La contraseña es obligatoria")
    @field:Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
    val password: String
)

/**
 * Payload for overriding the permissions of an existing user.
 */
data class AdminUserPermissionsRequest(
    val permissions: Set<String>
)

/**
 * DTO exposed to the admin panel when listing or retrieving platform users.
 */
data class AdminUserResponse(
    val id: Long,
    val username: String,
    val name: String?,
    val role: String,
    val permissions: Set<String>,
    val status: String,
    val active: Boolean,
    val email: String,
    val lastLogin: String? = null
)

/**
 * DTO representing an available role with its description and default permissions.
 */
data class AdminRoleResponse(
    val id: String,
    val name: String,
    val description: String,
    val defaultPermissions: Set<String>
)
