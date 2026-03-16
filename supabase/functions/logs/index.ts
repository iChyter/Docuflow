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

    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') throw new Error('Forbidden')

    let result = null

    switch (action) {
      case 'list': {
        let query = supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })

        if (data?.limit) query = query.limit(data.limit)
        if (data?.offset) query = query.range(data.offset, data.offset + (data.limit || 20) - 1)

        const { data: logs } = await query
        result = logs
        break
      }

      case 'recent': {
        const { data: logs } = await supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(data?.limit || 10)
        
        result = logs
        break
      }

      case 'by-user': {
        const { data: logs } = await supabase
          .from('logs')
          .select('*')
          .eq('user_id', data.userId)
          .order('created_at', { ascending: false })
        
        result = logs
        break
      }

      case 'count': {
        const { count } = await supabase
          .from('logs')
          .select('*', { count: 'exact', head: true })
        
        result = { count: count || 0 }
        break
      }

      case 'export': {
        let query = supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })

        if (data?.limit) query = query.limit(data.limit)

        const { data: logs } = await query
        
        if (data?.format === 'csv') {
          const headers = ['id', 'action', 'username', 'document_id', 'details', 'created_at']
          const csvRows = [headers.join(',')]
          
          for (const log of logs || []) {
            csvRows.push([
              log.id,
              log.action,
              log.username || '',
              log.document_id || '',
              (log.details || '').replace(/,/g, ';'),
              log.created_at
            ].join(','))
          }
          
          result = csvRows.join('\n')
        } else {
          result = logs
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
