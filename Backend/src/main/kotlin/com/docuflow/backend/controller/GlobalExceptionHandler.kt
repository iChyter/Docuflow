package com.docuflow.backend.controller

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.multipart.MultipartException

@ControllerAdvice
class GlobalExceptionHandler {

    private val logger = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(MultipartException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleMultipartException(ex: MultipartException, request: HttpServletRequest): ResponseEntity<Map<String, Any>> {
        logger.warn(
            "Solicitud multipart inválida en {} {} - contentType={}, length={}, mensaje={}",
            request.method,
            request.requestURI,
            request.contentType,
            request.contentLengthLong,
            ex.message
        )
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(
                mapOf(
                    "success" to false,
                    "error" to "La petición debe enviarse como multipart/form-data con el campo 'file'",
                    "timestamp" to java.time.LocalDateTime.now()
                )
            )
    }

    // ⚠️ Captura cualquier excepción genérica
    @ExceptionHandler(Exception::class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    fun handleException(ex: Exception): ResponseEntity<Map<String, String>> {
        logger.error("Error no controlado", ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(mapOf("error" to (ex.message ?: "Error interno del servidor")))
    }

    // ⚠️ Captura errores de entidad no encontrada
    @ExceptionHandler(NoSuchElementException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(ex: NoSuchElementException): ResponseEntity<Map<String, String>> {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(mapOf("error" to "Recurso no encontrado"))
    }
}
