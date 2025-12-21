export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { rate, licensePlate, region, phone } = req.body || {};
    const plate = String(licensePlate || "").trim();

    if (!plate) return res.status(400).json({ error: "License plate is required." });

    const SERVICE_FEE = 0.35;
    const OVERNIGHT = 12.50;
    const ALL_DAY = 24.99;

    const subtotal = rate === "ALL_DAY" ? ALL_DAY : OVERNIGHT;

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const baseUrl = `${proto}://${host}`;

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${baseUrl}/success.html`);
    form.set("cancel_url", `${baseUrl}/`);

    // Apple Pay / Google Pay / cards (Stripe decides what to show)
    form.set("automatic_payment_methods[enabled]", "true");
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
    form.set("metadata[lot_number]", "Lot #88");
    form.set("metadata[address]", "120 5th Ave S, Seattle, WA");
    form.set("metadata[rate]", rate === "ALL_DAY" ? "All Day" : "Overnight");
    form.set("metadata[license_plate]", plate);
    form.set("metadata[state_province]", region ? String(region).trim() : "");
    form.set("metadata[phone_from_form]", phone ? String(phone).trim() : "");

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
