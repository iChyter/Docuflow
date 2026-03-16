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
    let profile = null
    if (token) {
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
    }

    if (!user) throw new Error('Unauthorized')

    let result = null

    switch (action) {
      case 'list': {
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (!profile || profile.role !== 'admin') {
          query = query.eq('user_id', user.id).or('is_global.eq.true')
        }

        if (data?.limit) query = query.limit(data.limit)

        const { data: notifications } = await query
        result = notifications
        break
      }

      case 'admin-list': {
        if (!profile || profile.role !== 'admin') throw new Error('Forbidden')

        let query = supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })

        if (data?.limit) query = query.limit(data.limit)

        const { data: notifications } = await query
        result = notifications
        break
      }

      case 'get': {
        const { data: notification } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', data.id)
          .single()
        
        result = notification
        break
      }

      case 'create': {
        const canCreate = profile?.role === 'admin' || data.isGlobal
        
        if (!canCreate) throw new Error('Forbidden')

        const { data: notification } = await supabase
          .from('notifications')
          .insert({
            title: data.title,
            message: data.message,
            type: data.type || 'info',
            priority: data.priority || 'medium',
            user_id: data.userId || null,
            is_global: data.isGlobal || false,
            metadata: data.metadata || {},
            expires_at: data.expiresAt || null,
            created_by: profile?.username || 'system'
          })
          .select()
          .single()
        
        result = notification
        break
      }

      case 'deactivate': {
        if (!profile || profile.role !== 'admin') throw new Error('Forbidden')

        await supabase
          .from('notifications')
          .update({ is_active: false })
          .eq('id', data.id)
        
        result = { success: true }
        break
      }

      case 'delete': {
        if (!profile || profile.role !== 'admin') throw new Error('Forbidden')

        await supabase
          .from('notifications')
          .delete()
          .eq('id', data.id)
        
        result = { success: true }
        break
      }

      case 'stats': {
        if (!profile || profile.role !== 'admin') throw new Error('Forbidden')

        const { count: total } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })

        const { count: active } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)

        const { count: global_ } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_global', true)

        const { data: byType } = await supabase
          .from('notifications')
          .select('type')

        const typeCounts = byType?.reduce((acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1
          return acc
        }, {}) || {}

        result = {
          total: total || 0,
          active: active || 0,
          global: global_ || 0,
          byType: typeCounts
        }
        break
      }

      case 'types': {
        result = ['info', 'warning', 'error', 'success', 'announcement']
        break
      }

      case 'priorities': {
        result = ['low', 'medium', 'high', 'urgent']
        break
      }

      case 'by-type': {
        const { data: notifications } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', data.type)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
        
        result = notifications
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
