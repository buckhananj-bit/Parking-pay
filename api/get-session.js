export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sessionId = String(req.query.session_id || "").trim();
    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    // Fetch Checkout Session details from Stripe
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return res.status(500).json({ error: session?.error?.message || "Stripe error" });
    }

    // Optional: also pull line items so you can show Parking + Service Fee breakdown
    const itemsRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=10`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    });

    const itemsData = await itemsRes.json();

    return res.status(200).json({
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      customer_details: session.customer_details || null,
      metadata: session.metadata || {},
      created: session.created,
      line_items: itemsRes.ok ? (itemsData.data || []) : [],
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
