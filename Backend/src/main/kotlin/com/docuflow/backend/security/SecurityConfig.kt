package com.docuflow.backend.security

import com.docuflow.backend.service.TokenService
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
class SecurityConfig(
    private val tokenService: TokenService
) {

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { } 
            .sessionManagement { it.sessionCreationPolicy(org.springframework.security.config.http.SessionCreationPolicy.STATELESS) }
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter::class.java)
            .authorizeHttpRequests {
                it.requestMatchers("/login").permitAll()
                it.requestMatchers("/auth/login", "/auth/register", "/auth/refresh").permitAll()
                it.requestMatchers("/health", "/health/**").permitAll()
                it.requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                // Proteger rutas de GCS
                it.requestMatchers("/api/gcs/**", "/gcs/**").authenticated()
                // Proteger todas las rutas /files
                it.requestMatchers("/files/**").authenticated()
                // Mantener compatibilidad con /documents por si aún se usa
                it.requestMatchers("/documents/**").authenticated()
                it.anyRequest().authenticated()
            }
            .httpBasic { it.disable() }
            .formLogin { it.disable() }
            .logout { it.disable() }

        return http.build()
    }

    @Bean
    fun jwtAuthenticationFilter() = JwtAuthenticationFilter(tokenService)

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOriginPatterns = listOf(
            "http://127.0.0.1:5500",
            "http://localhost:5500",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "https://renatojmv.github.io",
            "https://docuflow-frontend.onrender.com",
            "https://docuflow-frontend*.onrender.com",
            "https://touched-included-elephant.ngrok-free.app",
            "https://holapex9.github.io"
        )
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
        configuration.allowedHeaders = listOf(
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With"
        )
        configuration.allowCredentials = true
        configuration.exposedHeaders = listOf("Authorization", "Content-Type", "Content-Disposition")
    configuration.maxAge = 3600L
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }
}
