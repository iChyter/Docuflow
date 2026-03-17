-- =====================================================
-- MIGRACIÓN: Actualizar roles y permisos
-- Cambios: viewer → usuario, permisos específicos por rol
-- =====================================================

-- =====================================================
-- 1. ACTUALIZAR ROL: viewer → usuario
-- =====================================================

-- Actualizar constraint del rol en profiles
alter table public.profiles 
drop constraint if exists profiles_role_check;

alter table public.profiles 
add constraint profiles_role_check 
check (role in ('admin', 'colaborador', 'usuario'));

-- Actualizar usuarios existentes de viewer a usuario
update public.profiles 
set role = 'usuario' 
where role = 'viewer';

-- =====================================================
-- 2. FUNCIONES HELPER PARA PERMISOS
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

-- Función para verificar si el usuario puede editar documentos (admin o colaborador)
CREATE OR REPLACE FUNCTION public.can_edit_documents()
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
    
    RETURN user_role IN ('admin', 'colaborador');
END;
$$;

-- Función para verificar si el usuario puede gestionar usuarios (solo admin)
CREATE OR REPLACE FUNCTION public.can_manage_users()
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

-- Función para verificar si el usuario puede ver logs (solo admin)
CREATE OR REPLACE FUNCTION public.can_view_logs()
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

-- Función para verificar si el usuario puede eliminar documentos
-- Admin: puede eliminar cualquier documento
-- Colaborador: puede eliminar sus propios documentos
-- Usuario: no puede eliminar
CREATE OR REPLACE FUNCTION public.can_delete_document(doc_uploaded_by uuid)
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
    
    -- Admin puede eliminar cualquier documento
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Colaborador puede eliminar sus propios documentos
    IF user_role = 'colaborador' AND doc_uploaded_by = current_user_id THEN
        RETURN true;
    END IF;
    
    -- Usuario no puede eliminar
    RETURN false;
END;
$$;

-- Función para verificar si el usuario puede editar comentarios
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
-- 3. ACTUALIZAR POLÍTICAS RLS - DOCUMENTS
-- =====================================================

-- Eliminar políticas existentes de documents
DROP POLICY IF EXISTS "Authenticated users can read documents" ON public.documents;
DROP POLICY IF EXISTS "Collaborators can create documents" ON public.documents;
DROP POLICY IF EXISTS "Owner can update documents" ON public.documents;
DROP POLICY IF EXISTS "Owner can delete documents" ON public.documents;

-- Política: Todos los usuarios autenticados pueden leer documentos
CREATE POLICY "Authenticated users can read documents"
    ON public.documents FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND is_deleted = false
    );

-- Política: Admin y colaborador pueden crear documentos
CREATE POLICY "Admin and collaborator can create documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND public.can_edit_documents()
    );

-- Política: Admin puede actualizar cualquier documento, colaborador solo sus propios
CREATE POLICY "Admin can update any document, collaborator own documents"
    ON public.documents FOR UPDATE
    USING (
        (public.get_current_user_role() = 'admin')
        OR 
        (public.get_current_user_role() = 'colaborador' AND uploaded_by = auth.uid())
    );

-- Política: Solo admin y dueño (colaborador) pueden eliminar documentos
CREATE POLICY "Admin or owner can delete documents"
    ON public.documents FOR DELETE
    USING (
        public.can_delete_document(uploaded_by)
    );

-- =====================================================
-- 4. ACTUALIZAR POLÍTICAS RLS - COMMENTS
-- =====================================================

-- Eliminar políticas existentes de comments
DROP POLICY IF EXISTS "Anyone can read comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated can create comments" ON public.comments;
DROP POLICY IF EXISTS "Author can update comments" ON public.comments;
DROP POLICY IF EXISTS "Author can delete comments" ON public.comments;

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
CREATE POLICY "Admin or author can update comments"
    ON public.comments FOR UPDATE
    USING (
        public.can_edit_comment(author_id)
    );

-- Política: Admin puede eliminar cualquier comentario, autor puede eliminar sus propios
CREATE POLICY "Admin or author can delete comments"
    ON public.comments FOR DELETE
    USING (
        public.can_edit_comment(author_id)
    );

-- =====================================================
-- 5. ACTUALIZAR POLÍTICAS RLS - PROFILES
-- =====================================================

-- Eliminar políticas existentes de profiles
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;

-- Política: Todos pueden leer perfiles
CREATE POLICY "Anyone can read profiles"
    ON public.profiles FOR SELECT
    USING (true);

-- Política: Solo admin puede actualizar cualquier perfil (gestión de usuarios)
-- Los usuarios pueden actualizar su propio perfil excepto el rol
CREATE POLICY "Admin can manage all profiles, users own profile"
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
-- 6. ACTUALIZAR POLÍTICAS RLS - LOGS
-- =====================================================

-- Eliminar políticas existentes de logs
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
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

-- =====================================================
-- 7. ACTUALIZAR POLÍTICAS RLS - NOTIFICATIONS
-- =====================================================

-- Eliminar políticas existentes de notifications
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;

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
-- 8. ACTUALIZAR FUNCIÓN handle_new_user PARA USAR 'usuario'
-- =====================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
    username_from_email text;
BEGIN
    -- Generar username desde email
    username_from_email := split_part(new.email, '@', 1);
    
    -- Si el username ya existe, agregar sufijo único
    IF exists (select 1 from public.profiles where username = username_from_email) THEN
        username_from_email := username_from_email || '_' || left(new.id::text, 8);
    END IF;

    -- Crear perfil con rol 'usuario' por defecto (más restrictivo)
    insert into public.profiles (id, username, full_name, role)
    values (new.id, username_from_email, new.raw_user_meta_data->>'full_name', 'usuario');

    return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. ACTUALIZAR POLÍTICAS DE STORAGE
-- =====================================================

-- Eliminar políticas existentes de storage.objects
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin can update" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin can delete" ON storage.objects;

-- Política: Todos pueden ver archivos
CREATE POLICY "Anyone can view files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
    );

-- Política: Admin y colaborador pueden subir archivos
CREATE POLICY "Admin and collaborator can upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND public.can_edit_documents()
    );

-- Política: Admin puede actualizar cualquier archivo, colaborador solo sus propios
CREATE POLICY "Admin can update any, collaborator own files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND (
            public.get_current_user_role() = 'admin'
            OR 
            (public.get_current_user_role() = 'colaborador' 
             AND (storage.foldername(name))[1] = (SELECT username FROM public.profiles WHERE id = auth.uid()))
        )
    );

-- Política: Solo admin puede eliminar archivos
CREATE POLICY "Only admin can delete files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND public.get_current_user_role() = 'admin'
    );

-- =====================================================
-- 10. FUNCIÓN PARA BUSCAR DOCUMENTOS CON FILTRO DE FECHA
-- =====================================================

CREATE OR REPLACE FUNCTION search_documents_with_filters(
    search_query text DEFAULT NULL,
    start_date timestamptz DEFAULT NULL,
    end_date timestamptz DEFAULT NULL,
    limit_count int DEFAULT 10
)
RETURNS TABLE (
    id bigint,
    filename text,
    file_type text,
    size bigint,
    uploaded_by uuid,
    uploaded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.filename, d.file_type, d.size, d.uploaded_by, d.uploaded_at
    FROM public.documents d
    WHERE d.is_deleted = false
    AND (
        search_query IS NULL 
        OR d.filename ILIKE '%' || search_query || '%'
    )
    AND (
        start_date IS NULL 
        OR d.uploaded_at >= start_date
    )
    AND (
        end_date IS NULL 
        OR d.uploaded_at <= end_date
    )
    ORDER BY d.uploaded_at DESC
    LIMIT limit_count;
END;
$$;

-- =====================================================
-- RESUMEN DE CAMBIOS
-- =====================================================
-- 1. Rol 'viewer' cambiado a 'usuario'
-- 2. Admin: gestiona usuarios, ve logs, edita/elimina todo
-- 3. Colaborador: sube/edita/elimina sus archivos, comentarios, tareas
-- 4. Usuario: solo visualiza archivos, deja comentarios, busca/filtra
-- 5. Funciones helper para verificar permisos
-- 6. Políticas RLS actualizadas según roles
-- 7. Función de búsqueda con filtros de fecha
