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

-- Policy: Todos pueden ver archivos
CREATE POLICY "Anyone can view files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
    );

-- Policy: Admin y colaborador pueden subir archivos
CREATE POLICY "Admin and collaborator can upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND public.can_edit_documents()
    );

-- Policy: Admin puede actualizar cualquier archivo, colaborador solo sus propios
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

-- Policy: Solo admin puede eliminar archivos
CREATE POLICY "Only admin can delete files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND public.get_current_user_role() = 'admin'
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
-- - DELETE: No puede eliminar archivos
--
-- [ROL: usuario]
-- - SELECT: Puede ver todos los archivos
-- - INSERT: NO puede subir archivos
-- - UPDATE: NO puede actualizar archivos
-- - DELETE: NO puede eliminar archivos
--
-- =====================================================
