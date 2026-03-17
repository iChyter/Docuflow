-- =====================================================
-- MIGRACIÓN: Corregir roles y permisos según especificación
-- Admin = todos los permisos
-- Colaborador y Usuario = mismos permisos (sin gestión de usuarios/logs/sistema)
-- =====================================================

-- =====================================================
-- 1. ACTUALIZAR FUNCIONES HELPER DE PERMISOS
-- =====================================================

-- Función para obtener el rol actual del usuario
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role, 'usuario');
END;
$$;

-- Función para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN user_role = 'admin';
END;
$$;

-- Función para verificar si puede gestionar usuarios (solo admin)
CREATE OR REPLACE FUNCTION public.can_manage_users()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.is_admin();
END;
$$;

-- Función para verificar si puede ver logs (solo admin)
CREATE OR REPLACE FUNCTION public.can_view_logs()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.is_admin();
END;
$$;

-- Función para verificar si puede gestionar sistema (solo admin)
CREATE OR REPLACE FUNCTION public.can_manage_system()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.is_admin();
END;
$$;

-- Función para verificar si puede subir archivos (todos los usuarios autenticados)
CREATE OR REPLACE FUNCTION public.can_upload_files()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN auth.role() = 'authenticated';
END;
$$;

-- Función para verificar si puede eliminar archivos
-- Admin: puede eliminar cualquier archivo
-- Colaborador/Usuario: pueden eliminar sus propios archivos
CREATE OR REPLACE FUNCTION public.can_delete_file(file_owner uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = current_user_id;
    
    -- Admin puede eliminar cualquier archivo
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Colaborador y usuario pueden eliminar sus propios archivos
    IF file_owner = current_user_id THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Función para verificar si puede editar archivos
-- Admin: puede editar cualquier archivo
-- Colaborador/Usuario: pueden editar sus propios archivos
CREATE OR REPLACE FUNCTION public.can_edit_file(file_owner uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = current_user_id;
    
    -- Admin puede editar cualquier archivo
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Colaborador y usuario pueden editar sus propios archivos
    IF file_owner = current_user_id THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Función para verificar si puede eliminar comentarios
-- Admin: puede eliminar cualquier comentario
-- Colaborador/Usuario: pueden eliminar sus propios comentarios
CREATE OR REPLACE FUNCTION public.can_delete_comment(comment_author_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = current_user_id;
    
    -- Admin puede eliminar cualquier comentario
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Colaborador y usuario pueden eliminar sus propios comentarios
    IF comment_author_id = current_user_id THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Función para verificar si puede editar comentarios
-- Admin: puede editar cualquier comentario
-- Colaborador/Usuario: pueden editar sus propios comentarios
CREATE OR REPLACE FUNCTION public.can_edit_comment(comment_author_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = current_user_id;
    
    -- Admin puede editar cualquier comentario
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Colaborador y usuario pueden editar sus propios comentarios
    IF comment_author_id = current_user_id THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- =====================================================
-- 2. ACTUALIZAR POLÍTICAS RLS - DOCUMENTS
-- =====================================================

-- Eliminar políticas existentes de documents
DROP POLICY IF EXISTS "Authenticated users can read documents" ON public.documents;
DROP POLICY IF EXISTS "Admin and collaborator can create documents" ON public.documents;
DROP POLICY IF EXISTS "Admin can update any document, collaborator own documents" ON public.documents;
DROP POLICY IF EXISTS "Admin or owner can delete documents" ON public.documents;

-- Política: Todos los usuarios autenticados pueden leer documentos
CREATE POLICY "Authenticated users can read documents"
    ON public.documents FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND is_deleted = false
    );

-- Política: Todos los usuarios autenticados pueden crear documentos
CREATE POLICY "Authenticated users can create documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Política: Admin puede actualizar cualquier documento, otros solo sus propios
CREATE POLICY "Users can update own documents, admin any"
    ON public.documents FOR UPDATE
    USING (
        public.can_edit_file(uploaded_by)
    );

-- Política: Admin puede eliminar cualquier documento, otros solo sus propios
CREATE POLICY "Users can delete own documents, admin any"
    ON public.documents FOR DELETE
    USING (
        public.can_delete_file(uploaded_by)
    );

-- =====================================================
-- 3. ACTUALIZAR POLÍTICAS RLS - COMMENTS
-- =====================================================

-- Eliminar políticas existentes de comments
DROP POLICY IF EXISTS "Anyone can read comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Admin or author can update comments" ON public.comments;
DROP POLICY IF EXISTS "Admin or author can delete comments" ON public.comments;

-- Política: Todos pueden leer comentarios
CREATE POLICY "Anyone can read comments"
    ON public.comments FOR SELECT
    USING (true);

-- Política: Usuarios autenticados pueden crear comentarios (todos los roles)
CREATE POLICY "Authenticated users can create comments"
    ON public.comments FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Política: Admin puede editar cualquier comentario, autor puede editar sus propios
CREATE POLICY "Users can update own comments, admin any"
    ON public.comments FOR UPDATE
    USING (
        public.can_edit_comment(author_id)
    );

-- Política: Admin puede eliminar cualquier comentario, autor puede eliminar sus propios
CREATE POLICY "Users can delete own comments, admin any"
    ON public.comments FOR DELETE
    USING (
        public.can_delete_comment(author_id)
    );

-- =====================================================
-- 4. ACTUALIZAR POLÍTICAS RLS - PROFILES (USUARIOS)
-- =====================================================

-- Eliminar políticas existentes de profiles
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles, users own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admin can delete profiles" ON public.profiles;

-- Política: Todos pueden leer perfiles
CREATE POLICY "Anyone can read profiles"
    ON public.profiles FOR SELECT
    USING (true);

-- Política: Solo admin puede actualizar cualquier perfil (gestión de usuarios)
-- Los usuarios pueden actualizar su propio perfil excepto el rol
CREATE POLICY "Admin can update any profile, users own"
    ON public.profiles FOR UPDATE
    USING (
        public.can_manage_users()
        OR 
        (id = auth.uid())
    );

-- Política: Solo admin puede crear perfiles manualmente
CREATE POLICY "Only admin can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (
        public.can_manage_users()
    );

-- Política: Solo admin puede eliminar perfiles
CREATE POLICY "Only admin can delete profiles"
    ON public.profiles FOR DELETE
    USING (
        public.can_manage_users()
    );

-- =====================================================
-- 5. ACTUALIZAR POLÍTICAS RLS - LOGS
-- =====================================================

-- Eliminar políticas existentes de logs
DROP POLICY IF EXISTS "Only admin can view logs" ON public.logs;
DROP POLICY IF EXISTS "System can insert logs" ON public.logs;

-- Política: Solo admin puede ver logs
CREATE POLICY "Only admin can view logs"
    ON public.logs FOR SELECT
    USING (
        public.can_view_logs()
    );

-- Política: Sistema puede insertar logs
CREATE POLICY "System can insert logs"
    ON public.logs FOR INSERT
    WITH CHECK (true);

-- Política: Solo admin puede eliminar logs
CREATE POLICY "Only admin can delete logs"
    ON public.logs FOR DELETE
    USING (
        public.can_view_logs()
    );

-- =====================================================
-- 6. ACTUALIZAR POLÍTICAS RLS - NOTIFICATIONS
-- =====================================================

-- Eliminar políticas existentes de notifications
DROP POLICY IF EXISTS "Users see own or global notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin can create any notification, users own" ON public.notifications;
DROP POLICY IF EXISTS "Admin can update any notification, users own" ON public.notifications;
DROP POLICY IF EXISTS "Admin can delete any notification, users own" ON public.notifications;

-- Política: Usuarios ven sus propias notificaciones o globales
CREATE POLICY "Users see own or global notifications"
    ON public.notifications FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_global = true
    );

-- Política: Solo admin puede crear notificaciones globales o para otros usuarios
-- Los usuarios pueden crear notificaciones para sí mismos
CREATE POLICY "Admin can create any notification, users own"
    ON public.notifications FOR INSERT
    WITH CHECK (
        public.can_manage_users()
        OR 
        user_id = auth.uid()
    );

-- Política: Solo admin puede actualizar cualquier notificación
-- Usuarios pueden actualizar sus propias notificaciones
CREATE POLICY "Admin can update any notification, users own"
    ON public.notifications FOR UPDATE
    USING (
        public.can_manage_users()
        OR 
        user_id = auth.uid()
    );

-- Política: Solo admin puede eliminar cualquier notificación
-- Usuarios pueden eliminar sus propias notificaciones
CREATE POLICY "Admin can delete any notification, users own"
    ON public.notifications FOR DELETE
    USING (
        public.can_manage_users()
        OR 
        user_id = auth.uid()
    );

-- =====================================================
-- 7. ACTUALIZAR POLÍTICAS DE STORAGE
-- =====================================================

-- Eliminar políticas existentes de storage.objects
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;
DROP POLICY IF EXISTS "Admin and collaborator can upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update any, collaborator own files" ON storage.objects;
DROP POLICY IF EXISTS "Only admin can delete files" ON storage.objects;

-- Política: Todos pueden ver archivos
CREATE POLICY "Anyone can view files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
    );

-- Política: Todos los usuarios autenticados pueden subir archivos
CREATE POLICY "Authenticated users can upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND auth.role() = 'authenticated'
    );

-- Política: Admin puede actualizar cualquier archivo, otros solo sus propios
CREATE POLICY "Users can update own files, admin any"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND (
            public.is_admin()
            OR 
            (storage.foldername(name))[1] = (SELECT username FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Política: Admin puede eliminar cualquier archivo, otros solo sus propios
CREATE POLICY "Users can delete own files, admin any"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND (
            public.is_admin()
            OR 
            (storage.foldername(name))[1] = (SELECT username FROM public.profiles WHERE id = auth.uid())
        )
    );

-- =====================================================
-- RESUMEN DE PERMISOS
-- =====================================================
-- ADMIN (admin):
--   - Archivos: Ver, Subir, Descargar, Eliminar, Compartir (todo)
--   - Comentarios: Ver, Crear, Editar, Eliminar, Asignar (todo)
--   - Usuarios: Ver, Crear, Editar, Eliminar, Gestionar permisos
--   - Logs: Ver, Exportar, Eliminar
--   - Dashboard: Ver, Estadísticas, Exportar
--   - Sistema: Configuraciones, Respaldos, Mantenimiento
--
-- COLABORADOR (colaborador):
--   - Archivos: Ver, Subir, Descargar, Eliminar (propios), Compartir
--   - Comentarios: Ver, Crear, Editar, Eliminar (propios), Asignar
--   - Usuarios: Ninguno
--   - Logs: Ninguno
--   - Dashboard: Ver, Estadísticas, Exportar
--   - Sistema: Ninguno
--
-- USUARIO (usuario):
--   - Archivos: Ver, Subir, Descargar, Eliminar (propios), Compartir
--   - Comentarios: Ver, Crear, Editar, Eliminar (propios), Asignar
--   - Usuarios: Ninguno
--   - Logs: Ninguno
--   - Dashboard: Ver, Estadísticas, Exportar
--   - Sistema: Ninguno
