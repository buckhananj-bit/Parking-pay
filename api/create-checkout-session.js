import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { rate, amount, licensePlate, region, phone, discountCode } = req.body;

    // amount is in dollars from your page — convert to cents
    const amountCents = Math.round(Number(amount) * 100);

    if (!amountCents || amountCents < 50) {
      return res.status(400).json({ error: "Invalid amount." });
    }
    if (!licensePlate) {
      return res.status(400).json({ error: "License plate is required." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: rate === "EVENT" ? "Event Parking" : "Parking",
              description: "Seattle Parking"
            },
            unit_amount: amountCents
          },
          quantity: 1
        }
      ],
      metadata: {
        rate: rate || "",
        licensePlate: licensePlate || "",
        region: region || "",
        phone: phone || "",
        discountCode: discountCode || ""
      },
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/cancel.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}