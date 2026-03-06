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

  const users = [
    { email: "admin@gooddelivery.test", password: "Test1234!", role: "admin", full_name: "Admin Teste", phone: "(11) 99999-0001" },
    { email: "estabelecimento@gooddelivery.test", password: "Test1234!", role: "establishment", full_name: "Restaurante Teste", phone: "(11) 99999-0002" },
    { email: "entregador@gooddelivery.test", password: "Test1234!", role: "driver", full_name: "Entregador Teste", phone: "(11) 99999-0003" },
  ];

  const results = [];

  for (const u of users) {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, phone: u.phone, role: u.role },
    });

    if (authError) {
      // If user already exists, skip
      results.push({ email: u.email, status: "skipped", error: authError.message });
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
        plate: "ABC-1234",
        is_online: true,
      });
    }

    results.push({ email: u.email, password: u.password, role: u.role, status: "created" });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
