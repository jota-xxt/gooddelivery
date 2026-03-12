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

    const now = new Date();
    const expireCutoff = new Date(now.getTime() - 60000).toISOString();

    // Expire any pending offers older than 60s for this delivery
    await supabaseAdmin
      .from("delivery_offers")
      .update({ status: "expired", responded_at: now.toISOString() })
      .eq("delivery_id", delivery_id)
      .eq("status", "pending")
      .lt("offered_at", expireCutoff);

    // Check if there's already a pending (non-expired) offer for this delivery
    const { data: existingOffer } = await supabaseAdmin
      .from("delivery_offers")
      .select("id, offered_at")
      .eq("delivery_id", delivery_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingOffer) {
      const offerAge = now.getTime() - new Date(existingOffer.offered_at).getTime();
      if (offerAge < 60000) {
        return new Response(JSON.stringify({ skipped: true, reason: "active offer exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin
        .from("delivery_offers")
        .update({ status: "expired", responded_at: now.toISOString() })
        .eq("id", existingOffer.id);
    }

    // Get drivers who already rejected/expired this delivery
    const { data: previousOffers } = await supabaseAdmin
      .from("delivery_offers")
      .select("driver_id")
      .eq("delivery_id", delivery_id)
      .in("status", ["rejected", "expired"]);

    const excludedDriverIds = previousOffers?.map(o => o.driver_id) ?? [];

    // Single optimized query: get online drivers without active deliveries and not blocked
    const nowIso = now.toISOString();
    const { data: onlineDrivers } = await supabaseAdmin
      .from("drivers")
      .select("id, user_id, phone, blocked_until")
      .eq("is_online", true)
      .not("queue_joined_at", "is", null)
      .order("queue_joined_at", { ascending: true });

    if (!onlineDrivers || onlineDrivers.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no online drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out excluded and blocked drivers
    const candidateDrivers = onlineDrivers.filter(d => {
      if (excludedDriverIds.includes(d.id)) return false;
      if (d.blocked_until && d.blocked_until > nowIso) return false;
      return true;
    });

    if (candidateDrivers.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no available drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch check: get all candidate driver IDs that have active deliveries
    const candidateIds = candidateDrivers.map(d => d.id);
    const { data: busyDeliveries } = await supabaseAdmin
      .from("deliveries")
      .select("driver_id")
      .in("driver_id", candidateIds)
      .in("status", ["accepted", "collecting", "delivering"]);

    const busyDriverIds = new Set(busyDeliveries?.map(d => d.driver_id) ?? []);

    // Pick first available driver (already sorted by queue_joined_at)
    const selectedDriver = candidateDrivers.find(d => !busyDriverIds.has(d.id));

    if (!selectedDriver) {
      return new Response(JSON.stringify({ skipped: true, reason: "no available drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create offer
    const { error: offerError } = await supabaseAdmin
      .from("delivery_offers")
      .insert({
        delivery_id,
        driver_id: selectedDriver.id,
        status: "pending",
      });

    if (offerError) throw offerError;

    // Get delivery details for WhatsApp
    const { data: deliveryDetails } = await supabaseAdmin
      .from("deliveries")
      .select("delivery_address, delivery_fee")
      .eq("id", delivery_id)
      .single();

    // Notify the driver
    await supabaseAdmin.from("notifications").insert({
      user_id: selectedDriver.user_id,
      title: "Nova corrida para você!",
      message: "Você recebeu uma oferta de corrida. Aceite em até 60 segundos!",
    });

    // WhatsApp notification (fire and forget)
    if (selectedDriver.phone && deliveryDetails) {
      const cleanPhone = selectedDriver.phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", selectedDriver.user_id)
        .single();

      const sendWhatsAppUrl = Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-whatsapp";
      fetch(sendWhatsAppUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          phone: whatsappPhone,
          template: "new_delivery_offer",
          vars: {
            name: profile?.full_name ?? "Entregador",
            address: deliveryDetails.delivery_address,
            fee: Number(deliveryDetails.delivery_fee).toFixed(2),
          },
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, driver_id: selectedDriver.id }), {
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
