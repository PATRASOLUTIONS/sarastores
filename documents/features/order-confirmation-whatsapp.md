# Customer order confirmation on WhatsApp

Website checkout now notifies customers after a confirmed Razorpay/COD order,
after successful Pine Labs/Paytm reconciliation, and after an admin confirms an
order. Pending payments and payments awaiting administrator review do not send a
confirmation. Pay-at-store approval retains its existing confirmation sender.

Configure `ASKEVA_API_KEY`, `ASKEVA_API_URL`, and `ASKEVA_SENDER_NUMBER` separately
for UAT and live, then redeploy. The default template is `sara_order_confirmed_v2`.
To use your own approved template, set `ORDER_CONFIRMATION_WHATSAPP_TEMPLATE`.
Set `ORDER_CONFIRMATION_WHATSAPP_LANGUAGE` to its approved language code (default
`en`). These are transactional messages, independent of the marketing campaign flag.

## Editable template body

Create or edit this utility template in AskEva/Meta. WhatsApp requires approval
before the changed text can be sent. Preserve these six body parameters in order.
Use a different template name when changing a template used by pay-at-store.

```text
✅ Your Sara Stores order is confirmed!

Hi {{1}} 👋
Thank you for shopping with Sara Stores. Here are your order details:

🧾 Order ID: {{2}}
🛍️ Items: {{3}}
💰 Order total: {{4}}
💳 Payment: {{5}}
📦 Delivery / pickup: {{6}}

We’ll keep you updated as your order moves ahead.
For help, reply to this message with your order ID. 💬

Thank you,
Team Sara Stores 💙
```

Parameters: customer name, public order ID, item names and quantities, order total
in INR, payment details (COD never says paid), and delivery/pickup information.
No guest access tokens or private order links are included.

## Delivery troubleshooting

Check `customerNotifications.confirmationWhatsApp` on the stored order and the
deployment logs. `accepted` means AskEva accepted the message, not that the
customer received it; use the returned message ID in AskEva to inspect delivery.
`failed` means the send was not accepted. Confirm the template is approved,
has exactly six text body parameters, and matches the configured language.
Missing configuration or an invalid customer phone prevents the send.

An atomic claim prevents duplicate confirmation sends. Ambiguous failures are
not retried automatically because the provider may already have accepted the
message. Review provider delivery history before resending through AskEva.
