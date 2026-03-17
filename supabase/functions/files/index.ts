import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { action, data } = await req.json().catch(() => ({ action: '', data: {} }))
    const authHeader = req.headers.get('Authorization')
    const token = authHeader ? authHeader.replace('Bearer ', '') : null
    
    let user = null
    if (token) {
      try {
        const { data: { user: u } } = await supabase.auth.getUser(token)
        user = u
      } catch (e) {
        console.log('Token validation failed:', e.message)
      }
    }

    let result = null

    switch (action) {
      case 'list': {
        let query = supabase
          .from('documents')
          .select('*, profiles(username, full_name)')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })

        if (data?.limit) query = query.limit(data.limit)
        if (data?.offset) query = query.range(data.offset, data.offset + (data.limit || 10) - 1)

        const { data: documents } = await query
        result = documents || []
        break
      }

      case 'search': {
        const { data: documents } = await supabase
          .from('documents')
          .select('*')
          .eq('is_deleted', false)
          .ilike('filename', `%${data?.q || ''}%`)
          .order('uploaded_at', { ascending: false })
          .limit(data?.limit || 10)
        
        result = documents || []
        break
      }

      case 'recent': {
        const { data: documents } = await supabase
          .from('documents')
          .select('*')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })
          .limit(data?.limit || 5)
        
        result = documents || []
        break
      }

      case 'get': {
        const { data: document } = await supabase
          .from('documents')
          .select('*, profiles(username, full_name)')
          .eq('id', data?.id)
          .single()
        
        result = document
        break
      }

      case 'create': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (!profile || !['admin', 'colaborador'].includes(profile.role)) {
          throw new Error('Forbidden')
        }

        const { data: document } = await supabase
          .from('documents')
          .insert({
            filename: data.filename,
            file_type: data.fileType,
            file_path: data.filePath,
            size: data.size,
            uploaded_by: user.id
          })
          .select()
          .single()
        
        result = document
        
        if (document) {
          await supabase.from('logs').insert({
            action: 'upload',
            user_id: user.id,
            document_id: document.id,
            details: `Uploaded file: ${data.filename}`
          })
        }
        break
      }

      case 'delete': {
        if (!user) throw new Error('Unauthorized')
        
        // Obtener el documento completo para obtener el file_path
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('*, profiles(username, full_name)')
          .eq('id', data?.id)
          .single()

        if (docError || !document) {
          throw new Error('Document not found')
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (document?.uploaded_by !== user.id && profile?.role !== 'admin') {
          throw new Error('Forbidden')
        }

        // Eliminar archivo del Storage
        if (document.file_path) {
          try {
            // Extraer el path relativo del archivo
            let filePath = document.file_path
            if (filePath.includes('/storage/v1/object/public/')) {
              filePath = filePath.split('/storage/v1/object/public/')[1]
            } else if (filePath.includes('/storage/v1/object/')) {
              filePath = filePath.split('/storage/v1/object/')[1]
            }
            
            console.log('Deleting file from storage:', filePath)
            
            // Eliminar usando el cliente con service role key
            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([filePath])
            
            if (storageError) {
              console.error('Storage delete error:', storageError)
            } else {
              console.log('File deleted from storage successfully')
            }
          } catch (storageErr) {
            console.error('Storage delete exception:', storageErr)
          }
        }

        // Marcar documento como eliminado
        await supabase
          .from('documents')
          .update({ is_deleted: true })
          .eq('id', data?.id)

        await supabase.from('logs').insert({
          action: 'delete',
          user_id: user.id,
          document_id: data?.id,
          details: `Deleted file`
        })

        result = { success: true }
        break
      }

      case 'stats': {
        const { count: totalFiles } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false)

        const { data: files } = await supabase
          .from('documents')
          .select('size')
          .eq('is_deleted', false)

        const totalSize = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0

        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        const { count: totalComments } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })

        result = {
          totalFiles: totalFiles || 0,
          totalSize,
          totalUsers: totalUsers || 0,
          totalComments: totalComments || 0
        }
        break
      }

      case 'count': {
        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false)
        
        result = { count: count || 0 }
        break
      }

      case 'total-size': {
        const { data: files } = await supabase
          .from('documents')
          .select('size')
          .eq('is_deleted', false)

        const total = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0
        result = { total }
        break
      }

      default:
        result = []
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
