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

    const { delivery_id } = await req.json();
    if (!delivery_id) throw new Error("Missing delivery_id");

    // Check delivery mode
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

    // Check delivery is still searching
    const { data: delivery } = await supabaseAdmin
      .from("deliveries")
      .select("id, status")
      .eq("id", delivery_id)
      .eq("status", "searching")
      .maybeSingle();

    if (!delivery) {
      return new Response(JSON.stringify({ skipped: true, reason: "delivery not searching" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expire any pending offers older than 60s for this delivery
    await supabaseAdmin
      .from("delivery_offers")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("delivery_id", delivery_id)
      .eq("status", "pending")
      .lt("offered_at", new Date(Date.now() - 60000).toISOString());

    // Check if there's already a pending (non-expired) offer for this delivery
    const { data: existingOffer } = await supabaseAdmin
      .from("delivery_offers")
      .select("id, offered_at")
      .eq("delivery_id", delivery_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingOffer) {
      // Still has a valid pending offer
      const offerAge = Date.now() - new Date(existingOffer.offered_at).getTime();
      if (offerAge < 60000) {
        return new Response(JSON.stringify({ skipped: true, reason: "active offer exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Expire it
      await supabaseAdmin
        .from("delivery_offers")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", existingOffer.id);
    }

    // Get drivers who already rejected/expired this delivery
    const { data: previousOffers } = await supabaseAdmin
      .from("delivery_offers")
      .select("driver_id")
      .eq("delivery_id", delivery_id)
      .in("status", ["rejected", "expired"]);

    const excludedDriverIds = previousOffers?.map(o => o.driver_id) ?? [];

    // Find next driver in queue: online, no active delivery, not already offered, ordered by queue_joined_at
    let query = supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("is_online", true)
      .not("queue_joined_at", "is", null)
      .order("queue_joined_at", { ascending: true });

    const { data: onlineDrivers } = await query;

    if (!onlineDrivers || onlineDrivers.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no online drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out excluded drivers and those with active deliveries
    let selectedDriverId: string | null = null;

    for (const driver of onlineDrivers) {
      if (excludedDriverIds.includes(driver.id)) continue;

      // Check if driver has active delivery
      const { data: activeDeliveries } = await supabaseAdmin
        .from("deliveries")
        .select("id")
        .eq("driver_id", driver.id)
        .in("status", ["accepted", "collecting", "delivering"])
        .limit(1);

      if (!activeDeliveries || activeDeliveries.length === 0) {
        selectedDriverId = driver.id;
        break;
      }
    }

    if (!selectedDriverId) {
      return new Response(JSON.stringify({ skipped: true, reason: "no available drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create offer
    const { error: offerError } = await supabaseAdmin
      .from("delivery_offers")
      .insert({
        delivery_id,
        driver_id: selectedDriverId,
        status: "pending",
      });

    if (offerError) throw offerError;

    // Notify the driver
    const { data: driverData } = await supabaseAdmin
      .from("drivers")
      .select("user_id")
      .eq("id", selectedDriverId)
      .single();

    if (driverData) {
      await supabaseAdmin.from("notifications").insert({
        user_id: driverData.user_id,
        title: "Nova corrida para você!",
        message: "Você recebeu uma oferta de corrida. Aceite em até 60 segundos!",
      });
    }

    return new Response(JSON.stringify({ success: true, driver_id: selectedDriverId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
