import "https://deno.land/std@0.213.0/dotenv/load.ts";

const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") || "sandbox";
const BASE44_MODE = Deno.env.get("BASE44_MODE") || "sandbox";

Deno.serve(async (req) => {
  const CLIENT_ID =
    PAYPAL_MODE === "live"
      ? Deno.env.get("PAYPAL_LIVE_CLIENT_ID")
      : Deno.env.get("PAYPAL_SANDBOX_CLIENT_ID");

  const CLIENT_SECRET =
    PAYPAL_MODE === "live"
      ? Deno.env.get("PAYPAL_LIVE_CLIENT_SECRET")
      : Deno.env.get("PAYPAL_SANDBOX_CLIENT_SECRET");

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Missing PayPal credentials" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const BASE44_API_KEY =
    BASE44_MODE === "live"
      ? Deno.env.get("BASE44_LIVE_API_KEY")
      : Deno.env.get("BASE44_SANDBOX_API_KEY");

  if (!BASE44_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing Base44 API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const BASE44_URL =
    BASE44_MODE === "live"
      ? "https://api.base44.com"
      : "https://sandbox.base44.com";

  const PAYPAL_API =
    PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  let data;
  try {
    data = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, amount, currency = "USD", note = "" } = data;

  if (!email || !amount) {
    return new Response(
      JSON.stringify({ error: "Missing email or amount" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const auth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok) {
    return new Response(
      JSON.stringify({ error: "PayPal token error", details: tokenJson }),
      {
        status: tokenRes.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const accessToken = tokenJson.access_token;

  const payoutBody = {
    sender_batch_header: {
      sender_batch_id: `batch_${crypto.randomUUID()}`,
      email_subject: "Has recibido un pago",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: { value: String(amount), currency },
        receiver: email,
        note,
      },
    ],
  };

  const payoutRes = await fetch(`${PAYPAL_API}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payoutBody),
  });

  const payoutJson = await payoutRes.json();

  if (!payoutRes.ok) {
    return new Response(
      JSON.stringify({ error: "Payout failed", details: payoutJson }),
      {
        status: payoutRes.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({ success: true, paypal: payoutJson }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
