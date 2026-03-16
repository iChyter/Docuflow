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
    const authHeader = req.headers.get('Authorization')
    const token = authHeader ? authHeader.replace('Bearer ', '') : ''
    
    let user = null
    let profile = null
    
    if (token) {
      try {
        const { data: { user: u } } = await supabase.auth.getUser(token)
        user = u
        if (user) {
          const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          profile = p
        }
      } catch (e) {
        console.log('Token inválido o expirado')
      }
    }

    // Permitir acceso si hay usuario o si es una acción pública
    const publicActions = ['stats', 'full']
    if (!user && !publicActions.includes(action)) {
      throw new Error('Unauthorized')
    }

    let result = null

    switch (action) {
      case 'stats': {
        const { data: stats } = await supabase.rpc('get_dashboard_stats')
        result = stats
        break
      }

      case 'activity': {
        const { data: activities } = await supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(data?.limit || 10)
        
        result = activities
        break
      }

      case 'users': {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, username, full_name, role, created_at')
          .order('created_at', { ascending: false })
        
        result = users
        break
      }

      case 'comments': {
        const { data: comments } = await supabase
          .from('comments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(data?.limit || 20)
        
        result = comments
        break
      }

      case 'files': {
        const { data: files } = await supabase
          .from('documents')
          .select('*')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })
          .limit(data?.limit || 20)
        
        result = files
        break
      }

      case 'files-stats': {
        const { count: totalFiles } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false)

        const { data: files } = await supabase
          .from('documents')
          .select('size')

        const totalSize = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0

        const { count: thisMonthFiles } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .gte('uploaded_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

        result = {
          totalFiles: totalFiles || 0,
          totalSize,
          thisMonthFiles: thisMonthFiles || 0
        }
        break
      }

      case 'recent-files': {
        const { data: files } = await supabase
          .from('documents')
          .select('*, profiles(username)')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })
          .limit(data?.limit || 5)
        
        result = files
        break
      }

      case 'recent-activities': {
        const { data: activities } = await supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(data?.limit || 10)
        
        result = activities
        break
      }

      case 'full': {
        const { data: stats } = await supabase.rpc('get_dashboard_stats')
        
        const { data: recentFiles } = await supabase
          .from('documents')
          .select('*, profiles(username)')
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false })
          .limit(5)

        const { data: recentActivities } = await supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        result = {
          stats,
          recentFiles,
          recentActivities
        }
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
