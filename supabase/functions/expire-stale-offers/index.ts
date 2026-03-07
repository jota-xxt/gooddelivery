import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if queue mode is active
    const { data: modeSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_mode")
      .maybeSingle();

    if (!modeSetting || modeSetting.value !== "queue") {
      return new Response(JSON.stringify({ skipped: true, reason: "pool mode active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load penalty settings
    const { data: penaltySettings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["queue_penalty_threshold", "queue_penalty_duration_minutes"]);

    const threshold = Number(penaltySettings?.find(r => r.key === "queue_penalty_threshold")?.value ?? 3);
    const durationMinutes = Number(penaltySettings?.find(r => r.key === "queue_penalty_duration_minutes")?.value ?? 30);

    // 1. Expire all pending offers older than 60 seconds
    const cutoff = new Date(Date.now() - 60000).toISOString();
    const { data: expiredOffers } = await supabaseAdmin
      .from("delivery_offers")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("status", "pending")
      .lt("offered_at", cutoff)
      .select("delivery_id, driver_id");

    // 1b. Apply penalty to drivers whose offers just expired
    if (expiredOffers && expiredOffers.length > 0) {
      const driverIds = [...new Set(expiredOffers.map(o => o.driver_id))];
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      for (const did of driverIds) {
        const { data: infractions } = await supabaseAdmin
          .from("delivery_offers")
          .select("id")
          .eq("driver_id", did)
          .in("status", ["rejected", "expired"])
          .gte("responded_at", since24h);

        if ((infractions?.length ?? 0) >= threshold) {
          const blockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
          await supabaseAdmin.from("drivers").update({ blocked_until: blockedUntil }).eq("id", did);

          const { data: driverData } = await supabaseAdmin.from("drivers").select("user_id").eq("id", did).single();
          if (driverData) {
            await supabaseAdmin.from("notifications").insert({
              user_id: driverData.user_id,
              title: "Você foi temporariamente bloqueado",
              message: `Você perdeu/recusou ${infractions?.length} ofertas nas últimas 24h. Bloqueado por ${durationMinutes} minutos.`,
            });
          }
        }
      }
    }

    // 2. Find all deliveries in "searching" that have NO active pending offer
    const { data: searchingDeliveries } = await supabaseAdmin
      .from("deliveries")
      .select("id")
      .eq("status", "searching");

    if (!searchingDeliveries || searchingDeliveries.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        expired_offers: expiredOffers?.length ?? 0,
        requeued: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let requeued = 0;
    const processUrl = Deno.env.get("SUPABASE_URL")! + "/functions/v1/process-delivery-queue";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const delivery of searchingDeliveries) {
      // Check if there's already a valid pending offer
      const { data: activeOffer } = await supabaseAdmin
        .from("delivery_offers")
        .select("id")
        .eq("delivery_id", delivery.id)
        .eq("status", "pending")
        .maybeSingle();

      if (!activeOffer) {
        // No active offer — reprocess queue for this delivery
        await fetch(processUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ delivery_id: delivery.id }),
        });
        requeued++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      expired_offers: expiredOffers?.length ?? 0,
      requeued,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
