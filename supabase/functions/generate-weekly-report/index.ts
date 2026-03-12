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

    // Accept date_start/date_end or week_start for backwards compat
    let dateStart: string
    let dateEnd: string

    try {
      const body = await req.json()
      if (body?.date_start && body?.date_end) {
        dateStart = body.date_start
        dateEnd = body.date_end
      } else if (body?.week_start) {
        dateStart = body.week_start
        const ws = new Date(body.week_start + 'T00:00:00Z')
        const we = new Date(ws)
        we.setUTCDate(ws.getUTCDate() + 6)
        dateEnd = we.toISOString().split('T')[0]
      } else {
        throw new Error('no dates')
      }
    } catch {
      // Default: last complete week (Monday to Sunday)
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const dayOfWeek = today.getUTCDay()
      const mondayThisWeek = new Date(today)
      mondayThisWeek.setUTCDate(today.getUTCDate() - ((dayOfWeek + 6) % 7))
      const lastMonday = new Date(mondayThisWeek)
      lastMonday.setUTCDate(mondayThisWeek.getUTCDate() - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)
      dateStart = lastMonday.toISOString().split('T')[0]
      dateEnd = lastSunday.toISOString().split('T')[0]
    }

    // Validate dates
    if (dateStart > dateEnd) {
      return new Response(
        JSON.stringify({ error: 'Data início deve ser anterior à data fim' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use dateStart as the report key (week_start) and dateEnd as week_end
    const weekStart = dateStart
    const weekEnd = dateEnd

    // Check if report already exists for this exact period
    const { data: existing } = await supabase
      .from('financial_weekly_reports')
      .select('id')
      .eq('week_start', weekStart)
      .eq('week_end', weekEnd)
      .limit(1)

    if (existing && existing.length > 0) {
      // Delete existing reports for this period so we can regenerate
      await supabase
        .from('financial_weekly_reports')
        .delete()
        .eq('week_start', weekStart)
        .eq('week_end', weekEnd)
    }

    // Get platform fee
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single()
    const feePercent = Number(settings?.value ?? 10)

    // Fetch completed deliveries from the target period
    const startDate = new Date(dateStart + 'T00:00:00Z')
    const endDate = new Date(dateEnd + 'T00:00:00Z')
    endDate.setUTCDate(endDate.getUTCDate() + 1) // include full end day

    const { data: deliveries, error: delError } = await supabase
      .from('deliveries')
      .select('establishment_id, driver_id, delivery_fee, delivered_at')
      .eq('status', 'completed')
      .gte('delivered_at', startDate.toISOString())
      .lt('delivered_at', endDate.toISOString())

    if (delError) throw delError
    if (!deliveries || deliveries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma entrega concluída neste período', weekStart, weekEnd }),
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
      JSON.stringify({
        message: `Relatório gerado: ${deliveries.length} entregas de ${weekStart} a ${weekEnd}`,
        weekStart,
        weekEnd,
        count: rows.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
