import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { service, price } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: service,
          },
          unit_amount: price * 100,
        },
        quantity: 1,
      },
    ],
    success_url: "https://tradease.tech/success.html",
    cancel_url: "https://tradease.tech/cancel.html",
  });

  res.json({ id: session.id });
}
