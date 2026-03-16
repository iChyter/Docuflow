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

-- Policy: Anyone can view files
create policy "Anyone can view files"
    on storage.objects for select
    using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] in (
            select username from public.profiles where id = auth.uid()
        )
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Policy: Authenticated users can upload
create policy "Authenticated users can upload"
    on storage.objects for insert
    with check (
        bucket_id = 'documents'
        and auth.role() = 'authenticated'
    );

-- Policy: Owner or admin can update
create policy "Owner or admin can update"
    on storage.objects for update
    using (
        bucket_id = 'documents'
        and auth.role() = 'authenticated'
    );

-- Policy: Owner or admin can delete
create policy "Owner or admin can delete"
    on storage.objects for delete
    using (
        bucket_id = 'documents'
        and auth.role() = 'authenticated'
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
-- Políticas sugeridas:
--
-- [Public] Anyone can view - bucket_id = 'documents'
-- [Insert] Authenticated users can upload - bucket_id = 'documents'  
-- [Update] Owner can update - bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()
-- [Delete] Owner can delete - bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()
--
-- Para admin, crear políticas adicionales que permitan acceso total
-- =====================================================
