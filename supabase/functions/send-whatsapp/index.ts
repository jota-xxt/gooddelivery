import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'phone and message required' }), {
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
        text: message,
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
