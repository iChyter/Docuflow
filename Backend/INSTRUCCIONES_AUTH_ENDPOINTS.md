# Guía de integración Frontend ↔ Backend

Esta guía resume los endpoints disponibles en DocuFlow y el flujo recomendado para la SPA. Todas las URLs deben construirse con la variable `BACKEND_URL` (por ejemplo, `https://docuflow-backend.onrender.com`).

## 1. Autenticación
- **Base**: `${BACKEND_URL}/auth`
- **Formato de error**: `{ "error": "Mensaje descriptivo", "details": { … opcional … } }`
- **Tokens**: access token (1h) + refresh token (14d)

| Acción | Método | Endpoint | Notas |
| --- | --- | --- | --- |
| Registro | `POST` | `/auth/register` | Campos requeridos: `email`, `password`, `name` |
| Login | `POST` | `/auth/login` | Normaliza `username` a minúsculas. Autocreación de admin si coincide con `APP_USER/APP_PASS` |
| Refresh | `POST` | `/auth/refresh` | Recibe `{ "refreshToken": "..." }` |
| Logout | `POST` | `/auth/logout` | Requiere header `Authorization: Bearer` |

### Respuesta de login
```json
{
  "success": true,
  "token": "<jwt>",
  "refreshToken": "<refresh-token>",
  "expiresIn": 3600,
  "user": {
    "username": "usuario@example.com",
    "name": "Nombre Apellido",
    "role": "viewer",
    "permissions": ["files.read", "files.download", "comments.read"]
  },
  "message": "Login exitoso"
}
```

### Buenas prácticas frontend
1. Guardar `token` y `refreshToken` en almacenamiento seguro (`localStorage` o `sessionStorage`).
2. Interceptar respuestas 401 e intentar `/auth/refresh` una sola vez; si falla, redirigir a login.
3. En logout, llamar al backend y luego limpiar el almacenamiento local.

## 2. Archivos y compatibilidad SPA
- **Base**: `${BACKEND_URL}/files`
- Todos los endpoints devuelven `{ "success": true, ... }` cuando la operación es exitosa.

| Endpoint | Descripción |
| --- | --- |
| `GET /files` | Lista documentos registrados en la BD |
| `GET /files/{id}` | Devuelve metadatos (`id`, `filename`, `fileType`, `size`, `filePath`) |
| `POST /files` | Subida con campo `file` (máx. 20 MB) |
| `GET /files/{id}/download` | Descarga el binario desde GCS |
| `DELETE /files/{id}` | Elimina en GCS + BD |
| `GET /files/stats` | Métricas resumidas (total, más grande, distribución por tipo) |
| `GET /files/count` | Conteo rápido |
| `GET /files/total-size` | Tamaño agregado en bytes y texto |

> El endpoint legacy `POST /upload` sigue disponible para compatibilidad: usa el mismo flujo de subida con validaciones de extensión (`pdf`, `docx`, `xlsx`).

## 3. Dashboard y métricas
- **Base**: `${BACKEND_URL}/api/dashboard`
- Respuestas JSON con campos reales; si alguna agregación no tiene datos, el backend devuelve colecciones vacías en lugar de demo data.

Endpoints clave:
- `GET /stats`: totales de archivos, usuarios, comentarios, logs y almacenamiento.
- `GET /activity`: últimas 20 acciones registradas.
- `GET /recent-files?limit=5`: lista de archivos nuevos (orden descendente).
- `GET /files/stats`: tipos de archivo, mayor tamaño, archivo más reciente.
- `GET /downloads/today`: número de descargas realizadas el día en curso.

## 4. Gestión de usuarios
- **Base recomendada**: `${BACKEND_URL}/api/admin/users`
- Objeto de respuesta incluye `performedBy` con datos del admin que ejecuta la acción.

| Acción | Método | Endpoint |
| --- | --- | --- |
| Listar usuarios | `GET` | `/api/admin/users` |
| Obtener usuario | `GET` | `/api/admin/users/{id}` |
| Crear usuario | `POST` | `/api/admin/users` |
| Actualizar datos | `PUT` | `/api/admin/users/{id}` |
| Actualizar contraseña | `PATCH` | `/api/admin/users/{id}/password` |
| Actualizar permisos | `PATCH` | `/api/admin/users/{id}/permissions` |
| Eliminar usuario | `DELETE` | `/api/admin/users/{id}` |
| Consultar roles disponibles | `GET` | `/api/admin/users/roles` |

> La ruta histórica `/users` permanece activa pero migrar a `/api/admin/users` garantiza consistencia con la versión actual.

## 5. Permisos
- **Base**: `${BACKEND_URL}/permissions`

Endpoints relevantes:
- `GET /modules`: catálogo completo de módulos y acciones (para construir UI de permisos).
- `GET /user/{userId}`: permisos del usuario en formato granular (`{ module: { action: boolean } }`).
- `PUT /user/{userId}`: actualiza permisos a partir de la lista granular que envíe el frontend.
- `POST /check`: se usa para validar rápidamente si el usuario actual tiene un permiso puntual.
- `GET /roles/permissions`: mapa de permisos por rol (admin, colaborador, viewer).

## 6. Comentarios y tareas
- **Base**: `${BACKEND_URL}/api/comments`

| Endpoint | Uso |
| --- | --- |
| `GET /api/comments` | Lista general |
| `GET /api/comments/document/{id}` | Filtra por documento |
| `POST /api/comments` | Crea comentario o tarea (`isTask`, `assignees`) |
| `PUT /api/comments/{id}` | Edita contenido/asignaciones |
| `PUT /api/comments/{id}/assign` | Asigna usuarios |
| `PUT /api/comments/{id}/complete` | Marca tarea completada |
| `DELETE /api/comments/{id}` | Elimina |

Los campos `status`, `priority` y `completed` se derivan en el backend sin valores ficticios.

## 7. Logs y exportaciones
- Logs: `${BACKEND_URL}/api/logs` con paginación (`page`, `size`).
- Exportaciones: `${BACKEND_URL}/export/{logs|files|stats}` con parámetro `format=csv|json`.

## 8. GCS y métricas de almacenamiento
- **Base**: `${BACKEND_URL}/api/gcs`
- `GET /files`: devuelve todos los blobs reales del bucket.
- `GET /stats`: usa `GCP_BUCKET_NAME`, `GCP_KEY_JSON` y (opcional) `GCP_TOTAL_STORAGE_BYTES` para calcular métricas.
- Si la configuración está incompleta, la respuesta incluye `"ready": false` y un mensaje explicativo; no se exponen datos simulados.

## 9. Notificaciones
- **Base**: `${BACKEND_URL}/notifications`
- Operaciones principales: listar (`GET /notifications`), crear (`POST /notifications`), filtrar por tipo/prioridad y administrar (`/notifications/admin/all`, `/notifications/stats`).
- Solo los usuarios con rol `ADMIN` pueden crear notificaciones globales o consultar estadísticas agregadas.

## 10. Consideraciones adicionales
- Usar siempre HTTPS en producción.
- Los endpoints devuelven colecciones vacías cuando no hay datos reales; no se incluirán registros de demostración.
- Verificar que el frontend envíe el header `Authorization` en todas las llamadas protegidas.
- Mantener sincronizado el manejo de errores: `401` → intentar refresh, `403` → mostrar mensaje de permisos, `503` → reintentar o mostrar alerta de servicio.

Última actualización: 4 de octubre de 2025.
