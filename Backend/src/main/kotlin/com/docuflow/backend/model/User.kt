package com.docuflow.backend.model

import jakarta.persistence.*

@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, unique = true)
    val username: String,

    @Column(nullable = false)
    val password: String,

    @Column(name = "full_name")
    var fullName: String? = null,

    @Column(nullable = false)
    var role: String = "colaborador", // o "admin"

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_permissions", joinColumns = [JoinColumn(name = "user_id")])
    @Column(name = "permission")
    var permissions: Set<String> = emptySet(), // Ej: "descargar", "eliminar", "comentar", "inhabilitado"

    @Column(nullable = false, columnDefinition = "BOOLEAN DEFAULT TRUE")
    var active: Boolean = true
)