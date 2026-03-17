-- =====================================================
-- SUPABASE STORAGE - POLÍTICAS RLS
-- =====================================================

-- =====================================================
-- BUCKET: documents
-- =====================================================

-- Crear bucket (ejecutar en Dashboard de Supabase o via API)
-- El bucket debe llamarse "documents"

-- =====================================================
-- POLÍTICAS DE STORAGE
-- =====================================================

-- Habilitar RLS en storage.objects
alter table storage.objects enable row level security;

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
-- NOTA: Las políticas de Storage se configuran mejor
-- desde el Dashboard de Supabase
--
-- Configuración recomendada:
-- 1. Ir a Storage > Policies
-- 2. Crear bucket "documents" si no existe
-- 3. Crear políticas basadas en roles del perfil
--
-- PERMISOS POR ROL:
--
-- [ROL: admin]
-- - SELECT: Puede ver todos los archivos
-- - INSERT: Puede subir archivos
-- - UPDATE: Puede actualizar cualquier archivo
-- - DELETE: Puede eliminar cualquier archivo
--
-- [ROL: colaborador]
-- - SELECT: Puede ver todos los archivos
-- - INSERT: Puede subir archivos
-- - UPDATE: Solo puede actualizar sus propios archivos
-- - DELETE: Solo puede eliminar sus propios archivos
--
-- [ROL: usuario]
-- - SELECT: Puede ver todos los archivos
-- - INSERT: Puede subir archivos
-- - UPDATE: Solo puede actualizar sus propios archivos
-- - DELETE: Solo puede eliminar sus propios archivos
--
-- =====================================================
