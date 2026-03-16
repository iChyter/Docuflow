# DocuFlow - Migración a Supabase

## Estructura del Proyecto

```
supabase/
├── sql/
│   ├── schema.sql          # Esquema de base de datos completo
│   └── policies.sql        # Políticas de Storage
├── functions/
│   ├── auth/               # Autenticación
│   ├── files/              # Gestión de archivos
│   ├── comments/           # Comentarios y tareas
│   ├── logs/               # Logs de auditoría
│   ├── dashboard/          # Estadísticas
│   ├── notifications/      # Notificaciones
│   └── users/              # Gestión de usuarios
└── storage/
    └── policies.sql         # Políticas de Storage
```

## Pasos de Deployment

### 1. Crear Proyecto Supabase

1. Ir a [supabase.com](https://supabase.com) y crear cuenta
2. Crear nuevo proyecto
3. Anotar:
   - Project URL
   - anon public key
   - service_role key

### 2. Configurar Base de Datos

1. Ir al **SQL Editor** en Supabase Dashboard
2. Copiar y ejecutar el contenido de `supabase/sql/schema.sql`
3. Verificar que las tablas se crearon correctamente

### 3. Configurar Storage

1. Ir a **Storage** en el menú lateral
2. Crear nuevo bucket llamado `documents`
3. Configurar políticas:
   - **Public Access**: NO
   - Usar las políticas del SQL o crear desde el UI

### 4. Desplegar Edge Functions

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar sesión
supabase login

# Link al proyecto
supabase link --project-ref YOUR_PROJECT_REF

# Desplegar todas las funciones
supabase functions deploy auth
supabase functions deploy files
supabase functions deploy comments
supabase functions deploy logs
supabase functions deploy dashboard
supabase functions deploy notifications
supabase functions deploy users
```

### 5. Configurar Frontend

1. Editar `Frontend/shared/services/config.js`
2. Reemplazar los valores de producción:
```javascript
export const SUPABASE_CONFIG = {
  url: 'https://TU_PROYECTO.supabase.co',
  anonKey: 'TU_ANON_KEY',
  edgeFunctionUrl: 'https://TU_PROYECTO.supabase.co/functions/v1'
};
```

### 6. Desplegar Frontend

#### Opción A: Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Opción B: GitHub + Vercel
1. Subir código a GitHub
2. Importar proyecto en Vercel
3. Configurar build: Empty (static)
4. Deploy automático en push

## Variables de Entorno

### Supabase (automático)
- `SUPABASE_URL` - URL del proyecto
- `SUPABASE_ANON_KEY` - Clave pública
- `SUPABASE_SERVICE_ROLE_KEY` - Clave de servicio (solo para CLI)

### Frontend (en config.js)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `EDGE_FUNCTION_URL`

## Funcionalidades Implementadas

| Feature | Estado | Notas |
|---------|--------|-------|
| Auth (Email/Password) | ✅ | Registro, login, logout, refresh token |
| CRUD Users | ✅ | Admin puede gestionar usuarios |
| CRUD Files | ✅ | Upload/download/delete |
| Comments | ✅ | Comentarios y tareas |
| Tasks | ✅ | Completar tareas |
| Notifications | ✅ | Global y por usuario |
| Dashboard Stats | ✅ | Estadísticas |
| Logs | ✅ | Auditoría |
| Storage | ✅ | Supabase Storage |
| Realtime | ⚠️ | Opcional (notificaciones) |

## Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **admin** | Todo: users, files, comments, logs, notifications |
| **colaborador** | Upload, download, delete files, comments, tasks |
| **viewer** | Solo lectura |

## Diferencias con Backend Original

| Aspecto | Original | Supabase |
|---------|----------|----------|
| Backend | Spring Boot (Kotlin) | Edge Functions (Deno) |
| Database | PostgreSQL + Hibernate | PostgreSQL + PostgREST |
| Auth | JWT manual | Supabase Auth |
| Storage | Google Cloud Storage | Supabase Storage |
| API | REST manual | PostgREST + Edge Functions |
| RLS | Manual | Automático |

## Notas Importantes

1. **Anon Key vs Service Role**: 
   - Anon Key: Para frontend (tiene restricciones RLS)
   - Service Role: Solo para Edge Functions (bypass RLS)

2. **Límites Supabase Free**:
   - Database: 500MB
   - Storage: 1GB
   - Edge Functions: 500K invocaciones/mes
   - Realtime: 200K mensajes/mes

3. **Production**:
   - Cambiar URL y claves en config.js
   - Configurar dominio custom en Vercel
   - Habilitar SSL (automático en Vercel)
