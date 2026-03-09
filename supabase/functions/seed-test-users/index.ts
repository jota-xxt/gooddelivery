import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const log: string[] = [];

  try {
    // 1. Delete all data from dependent tables first
    log.push("Cleaning database...");
    
    await supabaseAdmin.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("delivery_offers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("ratings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("financial_weekly_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("push_subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("deliveries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("drivers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("establishments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("user_roles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    log.push("Tables cleaned.");

    // 2. Delete all auth users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authUsers?.users) {
      for (const user of authUsers.users) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
      log.push(`Deleted ${authUsers.users.length} auth users.`);
    }

    // 3. Create 3 test users
    const users = [
      { email: "admin@gooddelivery.test", password: "Test1234!", role: "admin", full_name: "Admin Teste", phone: "(11) 99999-0001" },
      { email: "estabelecimento@gooddelivery.test", password: "Test1234!", role: "establishment", full_name: "Restaurante Teste", phone: "(11) 99999-0002" },
      { email: "entregador@gooddelivery.test", password: "Test1234!", role: "driver", full_name: "Entregador Teste", phone: "(11) 99999-0003" },
    ];

    const results = [];

    for (const u of users) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, phone: u.phone, role: u.role },
      });

      if (authError) {
        results.push({ email: u.email, status: "error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Approve profile
      await supabaseAdmin.from("profiles").update({ status: "approved" }).eq("user_id", userId);

      // Add role-specific data
      if (u.role === "establishment") {
        await supabaseAdmin.from("establishments").insert({
          user_id: userId,
          business_name: "Restaurante Bom Sabor",
          cnpj: "12.345.678/0001-99",
          address: "Rua das Flores, 123 - Centro",
          phone: u.phone,
          responsible_name: u.full_name,
        });
      } else if (u.role === "driver") {
        await supabaseAdmin.from("drivers").insert({
          user_id: userId,
          cpf: "123.456.789-00",
          phone: u.phone,
          vehicle_type: "motorcycle",
          is_online: true,
        });
      }

      results.push({ email: u.email, password: u.password, role: u.role, status: "created" });
    }

    return new Response(JSON.stringify({ log, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
