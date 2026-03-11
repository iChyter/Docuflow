package com.docuflow.backend.repository

import com.docuflow.backend.model.Notification
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface NotificationRepository : JpaRepository<Notification, Long> {
    
    fun findByIsActiveTrue(): List<Notification>
    
    fun findByTargetUsernameAndIsActiveTrue(username: String): List<Notification>
    
    fun findByTargetRoleAndIsActiveTrue(role: String): List<Notification>
    
    fun findByIsGlobalTrueAndIsActiveTrue(): List<Notification>
    
    @Query("SELECT n FROM Notification n WHERE n.isActive = true AND (n.expiresAt IS NULL OR n.expiresAt > :currentTime)")
    fun findActiveNotExpired(@Param("currentTime") currentTime: LocalDateTime): List<Notification>
    
    @Query("SELECT n FROM Notification n WHERE n.isActive = true AND (n.isGlobal = true OR n.targetUsername = :username OR n.targetRole = :role) AND (n.expiresAt IS NULL OR n.expiresAt > :currentTime)")
    fun findNotificationsForUser(
        @Param("username") username: String, 
        @Param("role") role: String, 
        @Param("currentTime") currentTime: LocalDateTime
    ): List<Notification>
    
    fun findByTypeAndIsActiveTrue(type: String): List<Notification>
    
    fun findByCreatedByAndIsActiveTrue(createdBy: String): List<Notification>
}