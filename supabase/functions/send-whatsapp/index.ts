import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ===== TEMPLATES DE MENSAGEM =====
type TemplateKey =
  | 'registration_received'
  | 'registration_approved'
  | 'registration_rejected'
  | 'new_delivery_offer'
  | 'delivery_accepted'
  | 'delivery_collecting'
  | 'delivery_delivering'
  | 'delivery_completed'
  | 'delivery_cancelled';

interface TemplateVars {
  name?: string;
  address?: string;
  fee?: string;
  reason?: string;
  role?: string;
}

const templates: Record<TemplateKey, (vars: TemplateVars) => string> = {
  registration_received: (v) =>
    `Olá ${v.name}! 👋\n\nSeu cadastro no *Good Delivery* foi recebido com sucesso! ✅\n\nEstamos analisando seus dados e você será notificado assim que sua conta for aprovada.\n\nObrigado por escolher o Good Delivery! 🚀`,

  registration_approved: (v) =>
    `Olá ${v.name}! 🎉\n\nSeu cadastro como *${v.role === 'driver' ? 'Entregador' : 'Estabelecimento'}* no *Good Delivery* foi *aprovado*! ✅\n\nVocê já pode acessar sua conta e começar a usar a plataforma.\n\nBoas entregas! 🚀`,

  registration_rejected: (v) =>
    `Olá ${v.name}! 😔\n\nInfelizmente seu cadastro no *Good Delivery* não foi aprovado.\n\n${v.reason ? `Motivo: ${v.reason}\n\n` : ''}Se tiver dúvidas, entre em contato conosco.\n\nEquipe Good Delivery`,

  new_delivery_offer: (v) =>
    `🚨 *Nova corrida disponível!*\n\nOlá ${v.name}!\n\n📍 Destino: ${v.address}\n💰 Valor: R$ ${v.fee}\n\nAceite em até *60 segundos* no app!\n\nGood Delivery 🏍️`,

  delivery_accepted: (v) =>
    `✅ *Entregador a caminho!*\n\nOlá ${v.name}!\n\nUm entregador aceitou seu pedido para *${v.address}* e está indo coletar.\n\nAcompanhe pelo app! 📱`,

  delivery_collecting: (v) =>
    `📦 *Entregador chegou!*\n\nOlá ${v.name}!\n\nO entregador chegou ao seu estabelecimento para coletar o pedido para *${v.address}*.\n\nPrepare o pedido! 🏃`,

  delivery_delivering: (v) =>
    `🛵 *Pedido saiu para entrega!*\n\nOlá ${v.name}!\n\nSeu pedido para *${v.address}* está a caminho do cliente!\n\nGood Delivery 📦`,

  delivery_completed: (v) =>
    `🎉 *Entrega concluída!*\n\nOlá ${v.name}!\n\nA entrega para *${v.address}* foi finalizada com sucesso! ✅\n\nObrigado por usar o Good Delivery! ⭐`,

  delivery_cancelled: (v) =>
    `❌ *Entrega cancelada*\n\nOlá ${v.name}!\n\nA entrega para *${v.address}* foi cancelada.\n\n${v.reason ? `Motivo: ${v.reason}\n\n` : ''}Good Delivery`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      console.error('Evolution API not configured');
      return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { phone, message, template, vars } = body as {
      phone: string;
      message?: string;
      template?: TemplateKey;
      vars?: TemplateVars;
    };

    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build message: use template if provided, otherwise raw message
    let finalMessage = message;
    if (template && templates[template]) {
      finalMessage = templates[template](vars ?? {});
    }

    if (!finalMessage) {
      return new Response(JSON.stringify({ error: 'message or valid template required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendText/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: finalMessage,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Evolution API error:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: 'Failed to send WhatsApp message' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`WhatsApp sent [${template ?? 'raw'}] to ${phone}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
