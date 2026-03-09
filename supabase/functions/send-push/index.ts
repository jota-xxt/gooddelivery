import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push encryption helpers using Web Crypto API
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidJwt(audience: string, privateKeyJwk: JsonWebKey, subject: string) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "jwk", privateKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (already raw from Web Crypto)
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length ? salt : new Uint8Array(32)));
  
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
  return okm.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  const info = new Uint8Array(18 + typeBytes.length + 1 + 5 + 2 + clientPublicKey.length + 2 + serverPublicKey.length);
  
  let offset = 0;
  const prefix = encoder.encode("Content-Encoding: ");
  info.set(prefix, offset); offset += prefix.length;
  info.set(typeBytes, offset); offset += typeBytes.length;
  info[offset++] = 0; // null separator
  
  const p256ecdsa = encoder.encode("P-256");
  info.set(p256ecdsa, offset); offset += p256ecdsa.length;
  
  info[offset++] = 0; info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset); offset += clientPublicKey.length;
  
  info[offset++] = 0; info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);
  
  return info;
}

async function encryptPayload(
  clientPublicKeyB64: string,
  authSecretB64: string,
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
  const authSecret = base64UrlDecode(authSecretB64);

  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw", clientPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey }, serverKeyPair.privateKey, 256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive key material
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prk = await hkdf(authSecret, sharedSecret, authInfo, 32);

  const contentInfo = createInfo("aesgcm", clientPublicKeyBytes, serverPublicKeyRaw);
  const contentKey = await hkdf(salt, prk, contentInfo, 16);

  const nonceInfo = createInfo("nonce", clientPublicKeyBytes, serverPublicKeyRaw);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  // Pad payload (2 bytes padding length + padding)
  const payloadBytes = new TextEncoder().encode(payload);
  const paddingLength = 0;
  const padded = new Uint8Array(2 + paddingLength + payloadBytes.length);
  padded[0] = paddingLength >> 8;
  padded[1] = paddingLength & 0xff;
  padded.set(payloadBytes, 2 + paddingLength);

  // AES-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  return { ciphertext: encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKeyJwk: JsonWebKey
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createVapidJwt(audience, vapidPrivateKeyJwk, "mailto:contato@gooddelivery.com.br");

    const { ciphertext, salt, serverPublicKey } = await encryptPayload(
      subscription.p256dh, subscription.auth, payload
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
        "Crypto-Key": `dh=${base64UrlEncode(serverPublicKey.buffer)}; p256ecdsa=${vapidPublicKey}`,
        "Encryption": `salt=${base64UrlEncode(salt.buffer)}`,
        "TTL": "86400",
      },
      body: ciphertext,
    });

    return response.ok || response.status === 201;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id, title, message } = await req.json();
    if (!user_id || !title || !message) throw new Error("Missing user_id, title, or message");

    // Get VAPID keys
    const { data: vapidSettings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key_jwk"]);

    if (!vapidSettings || vapidSettings.length < 2) {
      throw new Error("VAPID keys not initialized. Call init-vapid-keys first.");
    }

    const vapidPublicKey = vapidSettings.find(s => s.key === "vapid_public_key")!.value;
    const vapidPrivateKeyJwk = JSON.parse(vapidSettings.find(s => s.key === "vapid_private_key_jwk")!.value);

    // Get all subscriptions for user
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body: message, icon: "/pwa-192x192.png", badge: "/pwa-192x192.png" });

    let sent = 0;
    const failed: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendPushToSubscription(sub, payload, vapidPublicKey, vapidPrivateKeyJwk);
      if (success) {
        sent++;
      } else {
        failed.push(sub.endpoint);
        // Remove invalid subscriptions
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", user_id);
      }
    }

    return new Response(JSON.stringify({ sent, failed: failed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("send-push error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
