package com.docuflow.backend.controller

import com.docuflow.backend.dto.AdminUserCreateRequest
import com.docuflow.backend.dto.AdminUserPasswordUpdateRequest
import com.docuflow.backend.dto.AdminUserPermissionsRequest
import com.docuflow.backend.dto.AdminUserUpdateRequest
import com.docuflow.backend.model.User
import com.docuflow.backend.security.JwtUtil
import com.docuflow.backend.service.AdminUserService
import com.docuflow.backend.service.AdminUserService.AdminUserException
import com.docuflow.backend.service.AdminUserService.Companion.ROLE_ADMIN
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid

@RestController
@RequestMapping(value = ["/api/admin/users", "/users", "/api/users"])
class UserManagementController(
    private val adminUserService: AdminUserService
) {

    @GetMapping
    fun listUsers(@RequestHeader("Authorization") authHeader: String?): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            val users = adminUserService.listUsers()
            ok(mapOf("users" to users), admin)
        }
    }

    @GetMapping("/{id}")
    fun getUser(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            val user = adminUserService.getUser(id)
            ok(mapOf("user" to user), admin)
        }
    }

    @PostMapping
    fun createUser(
        @Valid @RequestBody request: AdminUserCreateRequest,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            val created = adminUserService.createUser(request, admin)
            ResponseEntity.status(HttpStatus.CREATED).body(
                mutableMapOf(
                    "success" to true,
                    "message" to "Usuario creado correctamente",
                    "user" to created
                )
            )
        }
    }

    @PutMapping("/{id}")
    fun updateUser(
        @PathVariable id: Long,
        @RequestBody request: AdminUserUpdateRequest,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            val updated = adminUserService.updateUser(id, request, admin)
            ok(
                mapOf(
                    "message" to "Usuario actualizado correctamente",
                    "user" to updated
                ),
                admin
            )
        }
    }

    @PatchMapping("/{id}/password")
    fun updatePassword(
        @PathVariable id: Long,
        @Valid @RequestBody request: AdminUserPasswordUpdateRequest,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            adminUserService.updatePassword(id, request, admin)
            ok(mapOf("message" to "Contraseña actualizada correctamente"), admin)
        }
    }

    @PatchMapping("/{id}/permissions")
    fun updatePermissions(
        @PathVariable id: Long,
        @RequestBody request: AdminUserPermissionsRequest,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            val updated = adminUserService.updatePermissions(id, request, admin)
            ok(
                mapOf(
                    "message" to "Permisos actualizados correctamente",
                    "user" to updated
                ),
                admin
            )
        }
    }

    @DeleteMapping("/{id}")
    fun deleteUser(
        @PathVariable id: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            adminUserService.deleteUser(id, admin)
            ok(mapOf("message" to "Usuario eliminado correctamente"), admin)
        }
    }

    @GetMapping("/roles")
    fun listRoles(@RequestHeader("Authorization") authHeader: String?): ResponseEntity<Map<String, Any>> {
        return withAdmin(authHeader) { admin ->
            val roles = adminUserService.getRoles()
            ok(mapOf("roles" to roles), admin)
        }
    }

    private fun withAdmin(
        authHeader: String?,
        block: (admin: User) -> ResponseEntity<Map<String, Any>>
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ")
            ?: return error(HttpStatus.UNAUTHORIZED, "Token faltante")

        val username = JwtUtil.validateToken(token)
            ?: return error(HttpStatus.UNAUTHORIZED, "Token inválido")

        val admin = try {
            adminUserService.ensureAdmin(username)
        } catch (ex: AdminUserException.Authorization) {
            return error(HttpStatus.FORBIDDEN, ex.message ?: "Acceso denegado")
        }

        return try {
            block(admin)
        } catch (ex: AdminUserException.Validation) {
            error(HttpStatus.BAD_REQUEST, ex.message ?: "Solicitud inválida")
        } catch (ex: AdminUserException.NotFound) {
            error(HttpStatus.NOT_FOUND, ex.message ?: "Recurso no encontrado")
        }
    }

    private fun ok(payload: Map<String, Any>, admin: User): ResponseEntity<Map<String, Any>> {
        val response = mutableMapOf<String, Any>("success" to true)
        response.putAll(payload)
        response["performedBy"] = mapOf(
            "username" to admin.username,
            "role" to ROLE_ADMIN
        )
        return ResponseEntity.ok(response)
    }

    private fun error(status: HttpStatus, message: String): ResponseEntity<Map<String, Any>> =
        ResponseEntity.status(status).body(
            mapOf(
                "success" to false,
                "error" to message
            )
        )
}