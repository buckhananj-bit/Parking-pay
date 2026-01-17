import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY env var." });
    }

    const {
      lotNumber,
      lotAddress,
      rateType,
      amountCents,
      licensePlate,
      state,
      phone,
    } = req.body || {};

    if (!licensePlate || typeof licensePlate !== "string" || !licensePlate.trim()) {
      return res.status(400).json({ error: "License plate is required." });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Number(amountCents) || 6000,
      currency: "usd",
      automatic_payment_methods: { enabled: true }, // enables Apple Pay / Google Pay when available
      metadata: {
        lotNumber: String(lotNumber || "88"),
        lotAddress: String(lotAddress || ""),
        rateType: String(rateType || "event"),
        licensePlate: String(licensePlate || "").toUpperCase(),
        state: String(state || ""),
        phone: String(phone || ""),
      },
    });

    return res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    return res.status(400).json({ error: err?.message || "Stripe error" });
  }
}