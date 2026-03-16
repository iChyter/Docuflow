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

    const { action, data } = await req.json()
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    let user = null
    if (token) {
      const { data: { user: u } } = await supabase.auth.getUser(token)
      user = u
    }

    let result = null

    switch (action) {
      case 'list': {
        // Público - no requiere auth
        let query = supabase
          .from('documents')
          .select('*, profiles(username, full_name)')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })

        if (data?.limit) query = query.limit(data.limit)
        if (data?.offset) query = query.range(data.offset, data.offset + (data.limit || 10) - 1)

        const { data: documents } = await query
        result = documents
        break
      }

      case 'search': {
        // Público - no requiere auth
        
        const { data: documents } = await supabase
          .from('documents')
          .select('*')
          .eq('is_deleted', false)
          .ilike('filename', `%${data.q}%`)
          .order('uploaded_at', { ascending: false })
          .limit(data.limit || 10)
        
        result = documents
        break
      }

      case 'recent': {
        // Público - no requiere auth
        const { data: documents } = await supabase
          .from('documents')
          .select('*')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })
          .limit(data.limit || 5)
        
        result = documents
        break
      }

      case 'get': {
        // Público - no requiere auth
        
        const { data: document } = await supabase
          .from('documents')
          .select('*, profiles(username, full_name)')
          .eq('id', data.id)
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
        
        const { data: document } = await supabase
          .from('documents')
          .select('uploaded_by')
          .eq('id', data.id)
          .single()

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (document?.uploaded_by !== user.id && profile?.role !== 'admin') {
          throw new Error('Forbidden')
        }

        await supabase
          .from('documents')
          .update({ is_deleted: true })
          .eq('id', data.id)

        await supabase.from('logs').insert({
          action: 'delete',
          user_id: user.id,
          document_id: data.id,
          details: `Deleted file`
        })

        result = { success: true }
        break
      }

      case 'stats': {
        // Público - no requiere auth
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
        // Público - no requiere auth
        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false)
        
        result = { count: count || 0 }
        break
      }

      case 'total-size': {
        // Público - no requiere auth
        
        const { data: files } = await supabase
          .from('documents')
          .select('size')
          .eq('is_deleted', false)

        const total = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0
        result = { total }
        break
      }

      default:
        throw new Error('Invalid action')
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
