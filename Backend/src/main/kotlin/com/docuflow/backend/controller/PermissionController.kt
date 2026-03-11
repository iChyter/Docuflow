package com.docuflow.backend.controller

import com.docuflow.backend.repository.UserRepository
import com.docuflow.backend.security.JwtUtil
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

data class PermissionRequest(
    val module: String,
    val action: String,
    val granted: Boolean
)

data class BulkPermissionRequest(
    val permissions: List<PermissionRequest>
)

@RestController
@RequestMapping("/permissions")
class PermissionController(
    private val userRepository: UserRepository
) {

    private val logger = LoggerFactory.getLogger(PermissionController::class.java)

    @GetMapping("/modules")
    fun getAvailableModules(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

    logger.debug("Usuario {} solicitó la lista de módulos disponibles", username)

    val modules = mapOf(
            "files" to mapOf(
                "name" to "Gestión de Archivos",
                "actions" to listOf(
                    mapOf("key" to "view", "name" to "Ver archivos"),
                    mapOf("key" to "upload", "name" to "Subir archivos"),
                    mapOf("key" to "download", "name" to "Descargar archivos"),
                    mapOf("key" to "delete", "name" to "Eliminar archivos"),
                    mapOf("key" to "share", "name" to "Compartir archivos")
                )
            ),
            "comments" to mapOf(
                "name" to "Comentarios y Tareas",
                "actions" to listOf(
                    mapOf("key" to "view", "name" to "Ver comentarios"),
                    mapOf("key" to "create", "name" to "Crear comentarios"),
                    mapOf("key" to "edit", "name" to "Editar comentarios"),
                    mapOf("key" to "delete", "name" to "Eliminar comentarios"),
                    mapOf("key" to "assign", "name" to "Asignar tareas")
                )
            ),
            "users" to mapOf(
                "name" to "Gestión de Usuarios",
                "actions" to listOf(
                    mapOf("key" to "view", "name" to "Ver usuarios"),
                    mapOf("key" to "create", "name" to "Crear usuarios"),
                    mapOf("key" to "edit", "name" to "Editar usuarios"),
                    mapOf("key" to "delete", "name" to "Eliminar usuarios"),
                    mapOf("key" to "permissions", "name" to "Gestionar permisos")
                )
            ),
            "logs" to mapOf(
                "name" to "Logs y Auditoría",
                "actions" to listOf(
                    mapOf("key" to "view", "name" to "Ver logs"),
                    mapOf("key" to "export", "name" to "Exportar logs"),
                    mapOf("key" to "delete", "name" to "Eliminar logs")
                )
            ),
            "dashboard" to mapOf(
                "name" to "Dashboard y Estadísticas",
                "actions" to listOf(
                    mapOf("key" to "view", "name" to "Ver dashboard"),
                    mapOf("key" to "stats", "name" to "Ver estadísticas"),
                    mapOf("key" to "export", "name" to "Exportar datos")
                )
            ),
            "system" to mapOf(
                "name" to "Administración del Sistema",
                "actions" to listOf(
                    mapOf("key" to "settings", "name" to "Configuraciones"),
                    mapOf("key" to "backup", "name" to "Respaldos"),
                    mapOf("key" to "maintenance", "name" to "Mantenimiento")
                )
            )
        )

        return ResponseEntity.ok(mapOf(
            "success" to true,
            "modules" to modules,
            "timestamp" to LocalDateTime.now()
        ))
    }

    @GetMapping("/user/{userId}")
    fun getUserPermissions(
        @PathVariable userId: Long,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val requestingUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            logger.debug("Usuario {} consultó permisos del usuario {}", requestingUser, userId)

            val user = userRepository.findById(userId).orElse(null)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "Usuario no encontrado"))

            // Convertir permisos simples a permisos granulares
            val granularPermissions = convertToGranularPermissions(user.permissions.toList())

            return ResponseEntity.ok(mapOf(
                "success" to true,
                "userId" to userId,
                "username" to user.username,
                "role" to user.role,
                "permissions" to granularPermissions,
                "timestamp" to LocalDateTime.now()
            ))

        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "error" to "Error al obtener permisos: ${e.message}"
            ))
        }
    }

    @PutMapping("/user/{userId}")
    fun updateUserPermissions(
        @PathVariable userId: Long,
        @RequestBody request: BulkPermissionRequest,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val requestingUser = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            logger.debug("Usuario {} actualiza permisos de {}", requestingUser, userId)

            val user = userRepository.findById(userId).orElse(null)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "Usuario no encontrado"))

            // Convertir permisos granulares a permisos simples
            val simplePermissions = convertToSimplePermissions(request.permissions)
            
            val updatedUser = user.copy(permissions = simplePermissions.toSet())
            userRepository.save(updatedUser)

            return ResponseEntity.ok(mapOf(
                "success" to true,
                "message" to "Permisos actualizados correctamente",
                "userId" to userId,
                "updatedPermissions" to simplePermissions,
                "timestamp" to LocalDateTime.now()
            ))

        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "error" to "Error al actualizar permisos: ${e.message}"
            ))
        }
    }

    @PostMapping("/check")
    fun checkPermission(
        @RequestBody permission: PermissionRequest,
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

        try {
            val user = userRepository.findByUsername(username)
                ?: return ResponseEntity.status(404).body(mapOf("error" to "Usuario no encontrado"))

            val hasPermission = checkUserPermission(user.permissions.toList(), permission.module, permission.action)

            logger.debug(
                "Usuario {} verificó permiso {}.{} (resultado={})",
                username,
                permission.module,
                permission.action,
                hasPermission
            )

            return ResponseEntity.ok(mapOf(
                "success" to true,
                "hasPermission" to hasPermission,
                "module" to permission.module,
                "action" to permission.action,
                "username" to username,
                "timestamp" to LocalDateTime.now()
            ))

        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf(
                "error" to "Error al verificar permiso: ${e.message}"
            ))
        }
    }

    @GetMapping("/roles/permissions")
    fun getRolePermissions(
        @RequestHeader("Authorization") authHeader: String?
    ): ResponseEntity<Map<String, Any>> {
        val token = authHeader?.removePrefix("Bearer ") 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token faltante"))
        
        val username = JwtUtil.validateToken(token) 
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Token inválido"))

    logger.debug("Usuario {} solicitó el mapa de permisos por rol", username)

    val rolePermissions = mapOf(
            "admin" to mapOf(
                "name" to "Administrador",
                "permissions" to listOf("download", "delete", "comment", "edit", "share", "admin", "view_logs", "manage_users"),
                "granular" to getAllPermissions(true)
            ),
            "colaborador" to mapOf(
                "name" to "Colaborador",
                "permissions" to listOf("download", "comment", "edit"),
                "granular" to getCollaboratorPermissions()
            ),
            "viewer" to mapOf(
                "name" to "Visualizador",
                "permissions" to listOf("download"),
                "granular" to getViewerPermissions()
            )
        )

        return ResponseEntity.ok(mapOf(
            "success" to true,
            "roles" to rolePermissions,
            "timestamp" to LocalDateTime.now()
        ))
    }

    private fun convertToGranularPermissions(simplePermissions: List<String>): Map<String, Map<String, Boolean>> {
        val granular = mutableMapOf<String, MutableMap<String, Boolean>>()
        
        // Inicializar todos los permisos como false
        getAllModulesAndActions().forEach { (module, actions) ->
            granular[module] = actions.associateWith { false }.toMutableMap()
        }
        
        // Mapear permisos simples a granulares
        simplePermissions.forEach { permission ->
            when (permission) {
                "download" -> {
                    granular["files"]?.set("download", true)
                }
                "delete" -> {
                    granular["files"]?.set("delete", true)
                }
                "comment" -> {
                    granular["comments"]?.set("view", true)
                    granular["comments"]?.set("create", true)
                }
                "edit" -> {
                    granular["files"]?.set("view", true)
                    granular["comments"]?.set("edit", true)
                }
                "share" -> {
                    granular["files"]?.set("share", true)
                }
                "admin" -> {
                    granular["users"]?.set("permissions", true)
                    granular["system"]?.set("settings", true)
                }
                "view_logs" -> {
                    granular["logs"]?.set("view", true)
                }
                "manage_users" -> {
                    granular["users"]?.set("create", true)
                    granular["users"]?.set("edit", true)
                    granular["users"]?.set("delete", true)
                }
            }
        }
        
        return granular.mapValues { it.value.toMap() }
    }

    private fun convertToSimplePermissions(granularPermissions: List<PermissionRequest>): List<String> {
        val simplePermissions = mutableSetOf<String>()
        
        granularPermissions.filter { it.granted }.forEach { permission ->
            when ("${permission.module}.${permission.action}") {
                "files.download" -> simplePermissions.add("download")
                "files.delete" -> simplePermissions.add("delete")
                "files.share" -> simplePermissions.add("share")
                "comments.create", "comments.view" -> simplePermissions.add("comment")
                "comments.edit", "files.view" -> simplePermissions.add("edit")
                "users.permissions", "system.settings" -> simplePermissions.add("admin")
                "logs.view" -> simplePermissions.add("view_logs")
                "users.create", "users.edit", "users.delete" -> simplePermissions.add("manage_users")
            }
        }
        
        return simplePermissions.toList()
    }

    private fun checkUserPermission(userPermissions: List<String>, module: String, action: String): Boolean {
        // Lógica simplificada - en una implementación real sería más compleja
        return when ("$module.$action") {
            "files.download" -> userPermissions.contains("download")
            "files.delete" -> userPermissions.contains("delete")
            "comments.create" -> userPermissions.contains("comment")
            "users.edit" -> userPermissions.contains("manage_users")
            else -> userPermissions.contains("admin")
        }
    }

    private fun getAllModulesAndActions(): Map<String, List<String>> {
        return mapOf(
            "files" to listOf("view", "upload", "download", "delete", "share"),
            "comments" to listOf("view", "create", "edit", "delete", "assign"),
            "users" to listOf("view", "create", "edit", "delete", "permissions"),
            "logs" to listOf("view", "export", "delete"),
            "dashboard" to listOf("view", "stats", "export"),
            "system" to listOf("settings", "backup", "maintenance")
        )
    }

    private fun getAllPermissions(granted: Boolean): Map<String, Map<String, Boolean>> {
        return getAllModulesAndActions().mapValues { (_, actions) ->
            actions.associateWith { granted }
        }
    }

    private fun getCollaboratorPermissions(): Map<String, Map<String, Boolean>> {
        return mapOf(
            "files" to mapOf("view" to true, "download" to true, "upload" to false, "delete" to false, "share" to false),
            "comments" to mapOf("view" to true, "create" to true, "edit" to true, "delete" to false, "assign" to false),
            "users" to mapOf("view" to false, "create" to false, "edit" to false, "delete" to false, "permissions" to false),
            "logs" to mapOf("view" to false, "export" to false, "delete" to false),
            "dashboard" to mapOf("view" to true, "stats" to false, "export" to false),
            "system" to mapOf("settings" to false, "backup" to false, "maintenance" to false)
        )
    }

    private fun getViewerPermissions(): Map<String, Map<String, Boolean>> {
        return mapOf(
            "files" to mapOf("view" to true, "download" to true, "upload" to false, "delete" to false, "share" to false),
            "comments" to mapOf("view" to true, "create" to false, "edit" to false, "delete" to false, "assign" to false),
            "users" to mapOf("view" to false, "create" to false, "edit" to false, "delete" to false, "permissions" to false),
            "logs" to mapOf("view" to false, "export" to false, "delete" to false),
            "dashboard" to mapOf("view" to true, "stats" to false, "export" to false),
            "system" to mapOf("settings" to false, "backup" to false, "maintenance" to false)
        )
    }
}