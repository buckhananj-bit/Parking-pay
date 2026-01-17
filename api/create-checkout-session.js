import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function getSiteUrl(req) {
  // Prefer explicit env var (most reliable on Vercel)
  const envUrl = process.env.SITE_URL;

  // Fallback to headers (works if env isn't set, but env is best)
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const headerUrl = host ? `${proto}://${host}` : null;

  const raw = envUrl || headerUrl;

  if (!raw) return null;

  // Ensure it has a scheme
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return `https://${raw}`;
  }
  return raw;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      lotNumber,
      lotAddress,
      rateType,
      amountCents,
      licensePlate,
      state,
      phone,
    } = req.body || {};

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY env var." });
    }

    if (!licensePlate || typeof licensePlate !== "string") {
      return res.status(400).json({ error: "License plate is required." });
    }

    const siteUrl = getSiteUrl(req);
    if (!siteUrl) {
      return res.status(500).json({ error: "Could not determine SITE_URL." });
    }

    // Stripe requires absolute URLs
    const successUrl = `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Number(amountCents) || 6000,
            product_data: {
              name: `Event Parking - Lot #${lotNumber || "88"}`,
              description: lotAddress || "Seattle, WA",
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        lotNumber: String(lotNumber || "88"),
        lotAddress: String(lotAddress || ""),
        rateType: String(rateType || "event"),
        licensePlate: String(licensePlate || "").toUpperCase(),
        state: String(state || ""),
        phone: String(phone || ""),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Send Stripe's real error message back to the browser (helpful for debugging)
    return res.status(400).json({ error: err?.message || "Stripe error" });
  }
}