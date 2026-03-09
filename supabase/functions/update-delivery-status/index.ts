import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const validTransitions: Record<string, { next: string; requiredRole: string; timestampField?: string }> = {
  "searching->accepted": { next: "accepted", requiredRole: "driver", timestampField: "accepted_at" },
  "accepted->collecting": { next: "collecting", requiredRole: "driver", timestampField: "collected_at" },
  "collecting->delivering": { next: "delivering", requiredRole: "driver" },
  "delivering->completed": { next: "completed", requiredRole: "driver", timestampField: "delivered_at" },
};

async function getDeliveryMode(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "delivery_mode")
    .maybeSingle();
  return data?.value ?? "pool";
}

async function getDriverByUserId(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabaseAdmin
    .from("drivers")
    .select("id, is_online")
    .eq("user_id", userId)
    .single();
  return data;
}

async function sendWhatsApp(template: string, phone: string, vars: Record<string, string>) {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
    const url = Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-whatsapp";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ phone: whatsappPhone, template, vars }),
    }).catch(() => {});
  } catch {}
}

async function sendPush(userId: string, title: string, message: string) {
  try {
    const url = Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-push";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ user_id: userId, title, message }),
    }).catch(() => {});
  } catch {}
}

async function notifyEstablishment(
  supabaseAdmin: ReturnType<typeof createClient>,
  establishmentId: string,
  title: string,
  message: string,
  whatsappTemplate?: string,
  whatsappVars?: Record<string, string>
) {
  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("user_id, phone, responsible_name")
    .eq("id", establishmentId)
    .single();
   if (est) {
    await supabaseAdmin.from("notifications").insert({ user_id: est.user_id, title, message });
    
    // Send push notification
    sendPush(est.user_id, title, message);
    
    // Send WhatsApp if template provided
    if (whatsappTemplate && est.phone) {
      sendWhatsApp(whatsappTemplate, est.phone, {
        name: est.responsible_name,
        ...whatsappVars,
      });
    }
  }
  return est;
}

async function processQueueForDelivery(supabaseAdmin: ReturnType<typeof createClient>, deliveryId: string) {
  // Call process-delivery-queue internally
  const url = Deno.env.get("SUPABASE_URL")! + "/functions/v1/process-delivery-queue";
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ delivery_id: deliveryId }),
  });
}

async function handleAccept(
  supabaseAdmin: ReturnType<typeof createClient>,
  delivery: Record<string, unknown>,
  userId: string,
  deliveryId: string
) {
  if (delivery.status !== "searching") {
    return new Response(JSON.stringify({ error: "Essa corrida já foi aceita por outro entregador" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const driver = await getDriverByUserId(supabaseAdmin, userId);
  if (!driver) throw new Error("Driver profile not found");
  if (!driver.is_online) throw new Error("You must be online to accept deliveries");

  // Check active deliveries
  const { data: activeDeliveries } = await supabaseAdmin
    .from("deliveries")
    .select("id")
    .eq("driver_id", driver.id)
    .in("status", ["accepted", "collecting", "delivering"]);

  if (activeDeliveries && activeDeliveries.length > 0) {
    return new Response(JSON.stringify({ error: "Você já tem uma corrida ativa. Finalize antes de aceitar outra." }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check queue mode - validate offer exists
  const mode = await getDeliveryMode(supabaseAdmin);
  if (mode === "queue") {
    const { data: offer } = await supabaseAdmin
      .from("delivery_offers")
      .select("id, offered_at")
      .eq("delivery_id", deliveryId)
      .eq("driver_id", driver.id)
      .eq("status", "pending")
      .maybeSingle();

    if (!offer) {
      return new Response(JSON.stringify({ error: "Você não tem uma oferta ativa para esta corrida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if offer expired (60s)
    const offerAge = Date.now() - new Date(offer.offered_at).getTime();
    if (offerAge > 60000) {
      await supabaseAdmin.from("delivery_offers").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", offer.id);
      return new Response(JSON.stringify({ error: "A oferta expirou. Aguarde a próxima." }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark offer as accepted
    await supabaseAdmin.from("delivery_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offer.id);
  }

  // Atomic accept
  const { error: updateError } = await supabaseAdmin
    .from("deliveries")
    .update({
      driver_id: driver.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("status", "searching");

  if (updateError) throw updateError;

  await notifyEstablishment(
    supabaseAdmin,
    delivery.establishment_id as string,
    "Entregador encontrado!",
    `Um entregador aceitou a corrida para ${delivery.delivery_address}.`,
    "delivery_accepted",
    { address: delivery.delivery_address as string }
  );

  return new Response(JSON.stringify({ success: true, status: "accepted" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPenaltySettings(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["queue_penalty_threshold", "queue_penalty_duration_minutes"]);

  const settings = { threshold: 3, durationMinutes: 30 };
  if (data) {
    const t = data.find(r => r.key === "queue_penalty_threshold");
    const d = data.find(r => r.key === "queue_penalty_duration_minutes");
    if (t) settings.threshold = Number(t.value);
    if (d) settings.durationMinutes = Number(d.value);
  }
  return settings;
}

async function checkAndApplyPenalty(
  supabaseAdmin: ReturnType<typeof createClient>,
  driverId: string
) {
  const { threshold, durationMinutes } = await getPenaltySettings(supabaseAdmin);

  // Count rejections + expirations in the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: infractions } = await supabaseAdmin
    .from("delivery_offers")
    .select("id")
    .eq("driver_id", driverId)
    .in("status", ["rejected", "expired"])
    .gte("responded_at", since);

  const count = infractions?.length ?? 0;
  if (count >= threshold) {
    const blockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("drivers")
      .update({ blocked_until: blockedUntil })
      .eq("id", driverId);

    // Notify driver
    const { data: driverData } = await supabaseAdmin
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .single();

    if (driverData) {
      await supabaseAdmin.from("notifications").insert({
        user_id: driverData.user_id,
        title: "Você foi temporariamente bloqueado",
        message: `Você recusou/perdeu ${count} ofertas nas últimas 24h. Bloqueado por ${durationMinutes} minutos.`,
      });
      sendPush(driverData.user_id, "Você foi temporariamente bloqueado", `Bloqueado por ${durationMinutes} minutos.`);
    }

    return true;
  }
  return false;
}

async function handleReject(
  supabaseAdmin: ReturnType<typeof createClient>,
  delivery: Record<string, unknown>,
  userId: string,
  deliveryId: string
) {
  const driver = await getDriverByUserId(supabaseAdmin, userId);
  if (!driver) throw new Error("Driver profile not found");

  // Find pending offer
  const { data: offer } = await supabaseAdmin
    .from("delivery_offers")
    .select("id")
    .eq("delivery_id", deliveryId)
    .eq("driver_id", driver.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!offer) {
    return new Response(JSON.stringify({ error: "Nenhuma oferta pendente encontrada" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Reject offer
  await supabaseAdmin.from("delivery_offers").update({
    status: "rejected",
    responded_at: new Date().toISOString(),
  }).eq("id", offer.id);

  // Check and apply penalty
  await checkAndApplyPenalty(supabaseAdmin, driver.id);

  // Trigger queue to find next driver
  await processQueueForDelivery(supabaseAdmin, deliveryId);

  return new Response(JSON.stringify({ success: true, status: "rejected" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAdvance(
  supabaseAdmin: ReturnType<typeof createClient>,
  delivery: Record<string, unknown>,
  userId: string,
  deliveryId: string
) {
  const transition = Object.entries(validTransitions).find(([key]) => key.startsWith(delivery.status + "->"));
  if (!transition) {
    return new Response(JSON.stringify({ error: "Não é possível avançar o status desta entrega" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [, config] = transition;

  const driver = await getDriverByUserId(supabaseAdmin, userId);
  if (!driver || driver.id !== delivery.driver_id) {
    return new Response(JSON.stringify({ error: "Apenas o entregador atribuído pode atualizar esta entrega" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updateData: Record<string, string> = { status: config.next };
  if (config.timestampField) {
    updateData[config.timestampField] = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("deliveries")
    .update(updateData)
    .eq("id", deliveryId)
    .eq("status", delivery.status as string);

  if (updateError) throw updateError;

  // If completed, put driver back at end of queue
  if (config.next === "completed") {
    const mode = await getDeliveryMode(supabaseAdmin);
    if (mode === "queue") {
      await supabaseAdmin.from("drivers").update({ queue_joined_at: new Date().toISOString() }).eq("id", driver.id);
    }
  }

  const statusMessages: Record<string, string> = {
    collecting: `O entregador chegou para coletar o pedido para ${delivery.delivery_address}.`,
    delivering: `O pedido para ${delivery.delivery_address} saiu para entrega!`,
    completed: `A entrega para ${delivery.delivery_address} foi concluída! ✅`,
  };

  const statusToWhatsApp: Record<string, string> = {
    collecting: "delivery_collecting",
    delivering: "delivery_delivering",
    completed: "delivery_completed",
  };

  if (statusMessages[config.next]) {
    await notifyEstablishment(
      supabaseAdmin,
      delivery.establishment_id as string,
      config.next === "completed" ? "Entrega concluída!" : "Atualização de entrega",
      statusMessages[config.next],
      statusToWhatsApp[config.next],
      { address: delivery.delivery_address as string }
    );
  }

  return new Response(JSON.stringify({ success: true, status: config.next }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCancel(
  supabaseAdmin: ReturnType<typeof createClient>,
  delivery: Record<string, unknown>,
  userId: string,
  deliveryId: string,
  cancelReason?: string
) {
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Apenas administradores podem cancelar entregas" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabaseAdmin.from("deliveries").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancel_reason: cancelReason || "Cancelado pelo administrador",
  }).eq("id", deliveryId);

  // Cancel any pending offers
  await supabaseAdmin.from("delivery_offers").update({
    status: "expired",
    responded_at: new Date().toISOString(),
  }).eq("delivery_id", deliveryId).eq("status", "pending");

  const notifications = [];

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("user_id, phone, responsible_name")
    .eq("id", delivery.establishment_id as string)
    .single();

  if (est) {
    notifications.push({
      user_id: est.user_id,
      title: "Entrega cancelada",
      message: `A entrega para ${delivery.delivery_address} foi cancelada pelo admin.`,
    });
    // WhatsApp to establishment
    if (est.phone) {
      sendWhatsApp("delivery_cancelled", est.phone, {
        name: est.responsible_name,
        address: delivery.delivery_address as string,
        reason: cancelReason || "Cancelado pelo administrador",
      });
    }
  }

  if (delivery.driver_id) {
    const { data: driverData } = await supabaseAdmin
      .from("drivers")
      .select("user_id, phone")
      .eq("id", delivery.driver_id as string)
      .single();

    if (driverData) {
      notifications.push({
        user_id: driverData.user_id,
        title: "Corrida cancelada",
        message: `A corrida para ${delivery.delivery_address} foi cancelada pelo admin.`,
      });
      // WhatsApp to driver
      if (driverData.phone) {
        const { data: driverProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", driverData.user_id)
          .single();
        sendWhatsApp("delivery_cancelled", driverData.phone, {
          name: driverProfile?.full_name ?? "Entregador",
          address: delivery.delivery_address as string,
          reason: cancelReason || "Cancelado pelo administrador",
        });
      }
    }
  }

  if (notifications.length > 0) {
    await supabaseAdmin.from("notifications").insert(notifications);
    // Send push to all notified users
    for (const n of notifications) {
      sendPush(n.user_id, n.title, n.message);
    }
  }

  return new Response(JSON.stringify({ success: true, status: "cancelled" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { delivery_id, action, cancel_reason } = await req.json();
    if (!delivery_id || !action) throw new Error("Missing delivery_id or action");

    const { data: delivery, error: fetchError } = await supabaseAdmin
      .from("deliveries")
      .select("*")
      .eq("id", delivery_id)
      .single();

    if (fetchError || !delivery) throw new Error("Delivery not found");

    switch (action) {
      case "accept":
        return await handleAccept(supabaseAdmin, delivery, user.id, delivery_id);
      case "reject":
        return await handleReject(supabaseAdmin, delivery, user.id, delivery_id);
      case "advance":
        return await handleAdvance(supabaseAdmin, delivery, user.id, delivery_id);
      case "cancel":
        return await handleCancel(supabaseAdmin, delivery, user.id, delivery_id, cancel_reason);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
