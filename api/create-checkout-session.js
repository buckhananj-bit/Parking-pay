export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { rate, licensePlate, region, phone } = req.body || {};
    const plate = String(licensePlate || "").trim();

    if (!plate) return res.status(400).json({ error: "License plate is required." });

    const SERVICE_FEE = 0.35;
    const OVERNIGHT = 12.50;
    const ALL_DAY = 24.99;

    const DAILY_RATE = 24.99;
const DISCOUNT_CODES = {
  SAVE10: { type: "percent", value: 10 },
  FIVEOFF: { type: "fixed", value: 5 },
  LOT88VIP: { type: "fixed", value: 12.50 }
};

function discountAmountFor(subtotal, code) {
  if (!code) return 0;
  const c = DISCOUNT_CODES[String(code).trim().toUpperCase()];
  if (!c) return 0;

  if (c.type === "percent") return subtotal * (c.value / 100);
  if (c.type === "fixed") return c.value;
  return 0;
}
let subtotal;
if (req.body.customDays) {
  const days = Math.max(1, Math.ceil(Number(req.body.customDays)));
  subtotal = days * DAILY_RATE;
} else {
  subtotal = rate === "ALL_DAY" ? ALL_DAY : OVERNIGHT;
}

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const baseUrl = `${proto}://${host}`;
const code = req.body.discountCode ? String(req.body.discountCode).trim().toUpperCase() : "";
const discountAmount = discountAmountFor(subtotal, code);
const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${baseUrl}/success.html`);
    form.set("cancel_url", `${baseUrl}/`);
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(discountedSubtotal * 100)));

    // Apple Pay / Google Pay / cards (Stripe decides what to show)
    form.set("phone_number_collection[enabled]", "true");

    // Line item 1: Parking
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][product_data][name]", "Parking - Lot #88");
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(subtotal * 100)));

    // Line item 2: Service Fee
    form.set("line_items[1][quantity]", "1");
    form.set("line_items[1][price_data][currency]", "usd");
    form.set("line_items[1][price_data][product_data][name]", "Service Fee");
    form.set("line_items[1][price_data][unit_amount]", String(Math.round(SERVICE_FEE * 100)));

    // Saved with the payment (so you can see plate + lot in Stripe)
    form.set("metadata[discount_code]", code || "");
form.set("metadata[discount_amount]", discountAmount ? discountAmount.toFixed(2) : "0.00");
    form.set("metadata[lot_number]", "Lot #88");
    form.set("metadata[address]", "120 5th Ave S, Seattle, WA");
    form.set("metadata[rate]", rate === "ALL_DAY" ? "All Day" : "Overnight");
    form.set("metadata[license_plate]", plate);
    form.set("metadata[state_province]", region ? String(region).trim() : "");
    form.set("metadata[phone_from_form]", phone ? String(phone).trim() : "");
form.set("metadata[days]", req.body.customDays || "");
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = await stripeRes.json();
    if (!stripeRes.ok) return res.status(500).json({ error: data?.error?.message || "Stripe error" });

    return res.status(200).json({ url: data.url });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
