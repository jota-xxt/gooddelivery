import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid status transitions
const validTransitions: Record<string, { next: string; requiredRole: string; timestampField?: string }> = {
  "searching->accepted": { next: "accepted", requiredRole: "driver", timestampField: "accepted_at" },
  "accepted->collecting": { next: "collecting", requiredRole: "driver", timestampField: "collected_at" },
  "collecting->delivering": { next: "delivering", requiredRole: "driver" },
  "delivering->completed": { next: "completed", requiredRole: "driver", timestampField: "delivered_at" },
};

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
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { delivery_id, action, cancel_reason } = await req.json();
    if (!delivery_id || !action) throw new Error("Missing delivery_id or action");

    // Get current delivery
    const { data: delivery, error: fetchError } = await supabaseAdmin
      .from("deliveries")
      .select("*")
      .eq("id", delivery_id)
      .single();

    if (fetchError || !delivery) throw new Error("Delivery not found");

    // Handle accept action (special case - assigns driver)
    if (action === "accept") {
      if (delivery.status !== "searching") {
        return new Response(JSON.stringify({ error: "Essa corrida já foi aceita por outro entregador" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user is a driver and online
      const { data: driver } = await supabaseAdmin
        .from("drivers")
        .select("id, is_online")
        .eq("user_id", user.id)
        .single();

      if (!driver) throw new Error("Driver profile not found");
      if (!driver.is_online) throw new Error("You must be online to accept deliveries");

      // Check driver doesn't already have an active delivery
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

      // Atomic accept with status check
      const { error: updateError, count } = await supabaseAdmin
        .from("deliveries")
        .update({
          driver_id: driver.id,
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", delivery_id)
        .eq("status", "searching"); // Race condition protection

      if (updateError) throw updateError;

      // Insert notification for establishment
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("user_id")
        .eq("id", delivery.establishment_id)
        .single();

      if (est) {
        await supabaseAdmin.from("notifications").insert({
          user_id: est.user_id,
          title: "Entregador encontrado!",
          message: `Um entregador aceitou a corrida de ${delivery.customer_name}.`,
        });
      }

      return new Response(JSON.stringify({ success: true, status: "accepted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle advance action
    if (action === "advance") {
      const transitionKey = `${delivery.status}->${validTransitions[`${delivery.status}->` + Object.keys(validTransitions).find(k => k.startsWith(delivery.status + "->"))?.split("->")[1]]?.next}`;
      
      // Simpler: find the transition for current status
      const transition = Object.entries(validTransitions).find(([key]) => key.startsWith(delivery.status + "->"));
      if (!transition) {
        return new Response(JSON.stringify({ error: "Não é possível avançar o status desta entrega" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [, config] = transition;

      // Verify the user is the assigned driver
      const { data: driver } = await supabaseAdmin
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .single();

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
        .eq("id", delivery_id)
        .eq("status", delivery.status); // Prevent double-click

      if (updateError) throw updateError;

      // Notify establishment of status change
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("user_id")
        .eq("id", delivery.establishment_id)
        .single();

      const statusMessages: Record<string, string> = {
        collecting: `O entregador chegou para coletar o pedido de ${delivery.customer_name}.`,
        delivering: `O pedido de ${delivery.customer_name} saiu para entrega!`,
        completed: `A entrega de ${delivery.customer_name} foi concluída! ✅`,
      };

      if (est && statusMessages[config.next]) {
        await supabaseAdmin.from("notifications").insert({
          user_id: est.user_id,
          title: config.next === "completed" ? "Entrega concluída!" : "Atualização de entrega",
          message: statusMessages[config.next],
        });
      }

      return new Response(JSON.stringify({ success: true, status: config.next }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle cancel request (only admin)
    if (action === "cancel") {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem cancelar entregas" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("deliveries").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancel_reason || "Cancelado pelo administrador",
      }).eq("id", delivery_id);

      // Notify both parties
      const notifications = [];
      
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("user_id")
        .eq("id", delivery.establishment_id)
        .single();

      if (est) {
        notifications.push({
          user_id: est.user_id,
          title: "Entrega cancelada",
          message: `A entrega de ${delivery.customer_name} foi cancelada pelo admin.`,
        });
      }

      if (delivery.driver_id) {
        const { data: driver } = await supabaseAdmin
          .from("drivers")
          .select("user_id")
          .eq("id", delivery.driver_id)
          .single();

        if (driver) {
          notifications.push({
            user_id: driver.user_id,
            title: "Corrida cancelada",
            message: `A corrida de ${delivery.customer_name} foi cancelada pelo admin.`,
          });
        }
      }

      if (notifications.length > 0) {
        await supabaseAdmin.from("notifications").insert(notifications);
      }

      return new Response(JSON.stringify({ success: true, status: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
