import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Accept optional week_start for backfill
    let requestedWeekStart: string | null = null
    try {
      const body = await req.json()
      if (body?.week_start) requestedWeekStart = body.week_start
    } catch { /* no body or invalid json, use default */ }

    let weekStart: string
    let weekEnd: string

    if (requestedWeekStart) {
      // Use provided week_start (must be a Monday)
      const ws = new Date(requestedWeekStart + 'T00:00:00Z')
      if (ws.getUTCDay() !== 1) {
        return new Response(
          JSON.stringify({ error: 'week_start must be a Monday (YYYY-MM-DD)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      weekStart = requestedWeekStart
      const we = new Date(ws)
      we.setUTCDate(ws.getUTCDate() + 6)
      weekEnd = we.toISOString().split('T')[0]
    } else {
      // Calculate last complete week (Monday to Sunday)
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const dayOfWeek = today.getUTCDay() // 0=Sun, 1=Mon, ...

      // Find Monday of current week, then go back 7 days for last Monday
      const mondayThisWeek = new Date(today)
      mondayThisWeek.setUTCDate(today.getUTCDate() - ((dayOfWeek + 6) % 7))
      const lastMonday = new Date(mondayThisWeek)
      lastMonday.setUTCDate(mondayThisWeek.getUTCDate() - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)

      weekStart = lastMonday.toISOString().split('T')[0]
      weekEnd = lastSunday.toISOString().split('T')[0]
    }

    // Check if report already exists for this week
    const { data: existing } = await supabase
      .from('financial_weekly_reports')
      .select('id')
      .eq('week_start', weekStart)
      .limit(1)

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ message: 'Reports already generated for this week', weekStart }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get platform fee
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single()
    const feePercent = Number(settings?.value ?? 10)

    // Fetch completed deliveries from the target week
    const weekStartDate = new Date(weekStart + 'T00:00:00Z')
    const weekEndDate = new Date(weekEnd + 'T00:00:00Z')
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 1) // include full Sunday

    const { data: deliveries, error: delError } = await supabase
      .from('deliveries')
      .select('establishment_id, driver_id, delivery_fee, delivered_at')
      .eq('status', 'completed')
      .gte('delivered_at', weekStartDate.toISOString())
      .lt('delivered_at', weekEndDate.toISOString())

    if (delError) throw delError
    if (!deliveries || deliveries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No deliveries for this week', weekStart }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get establishments and drivers with names
    const estIds = [...new Set(deliveries.map(d => d.establishment_id))]
    const driverIds = [...new Set(deliveries.filter(d => d.driver_id).map(d => d.driver_id!))]

    const { data: establishments } = await supabase
      .from('establishments')
      .select('id, user_id, business_name')
      .in('id', estIds)

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, user_id')
      .in('id', driverIds.length > 0 ? driverIds : ['00000000-0000-0000-0000-000000000000'])

    const estUserMap = new Map(establishments?.map(e => [e.id, e.user_id]) ?? [])
    const estNameMap = new Map(establishments?.map(e => [e.id, e.business_name]) ?? [])
    const driverUserMap = new Map(drivers?.map(d => [d.id, d.user_id]) ?? [])

    // Resolve driver names from profiles
    let driverNameMap = new Map<string, string>()
    if (drivers && drivers.length > 0) {
      const userIds = drivers.map(d => d.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds)
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? [])
      for (const d of drivers) {
        driverNameMap.set(d.id, profileMap.get(d.user_id) ?? 'Entregador')
      }
    }

    // Group by establishment
    const estGroups: Record<string, { total: number; count: number }> = {}
    // Group by driver
    const driverGroups: Record<string, { total: number; count: number }> = {}

    for (const d of deliveries) {
      if (!estGroups[d.establishment_id]) estGroups[d.establishment_id] = { total: 0, count: 0 }
      estGroups[d.establishment_id].total += Number(d.delivery_fee)
      estGroups[d.establishment_id].count += 1

      if (d.driver_id) {
        if (!driverGroups[d.driver_id]) driverGroups[d.driver_id] = { total: 0, count: 0 }
        driverGroups[d.driver_id].total += Number(d.delivery_fee)
        driverGroups[d.driver_id].count += 1
      }
    }

    // Build insert rows
    const rows: any[] = []

    for (const [estId, g] of Object.entries(estGroups)) {
      const userId = estUserMap.get(estId)
      if (!userId) continue
      rows.push({
        week_start: weekStart,
        week_end: weekEnd,
        entity_type: 'establishment',
        entity_id: estId,
        entity_name: estNameMap.get(estId) ?? 'Estabelecimento',
        user_id: userId,
        total_deliveries: g.count,
        total_value: g.total,
        platform_fee: g.total * (feePercent / 100),
        net_payout: g.total * (1 - feePercent / 100),
        status: 'pending',
      })
    }

    for (const [driverId, g] of Object.entries(driverGroups)) {
      const userId = driverUserMap.get(driverId)
      if (!userId) continue
      rows.push({
        week_start: weekStart,
        week_end: weekEnd,
        entity_type: 'driver',
        entity_id: driverId,
        entity_name: driverNameMap.get(driverId) ?? 'Entregador',
        user_id: userId,
        total_deliveries: g.count,
        total_value: g.total,
        platform_fee: g.total * (feePercent / 100),
        net_payout: g.total * (1 - feePercent / 100),
        status: 'pending',
      })
    }

    const { error: insertError } = await supabase
      .from('financial_weekly_reports')
      .insert(rows)

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ message: 'Reports generated', weekStart, weekEnd, count: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
