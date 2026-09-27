# BRD — Pending: external-system integrations

Source: **Ecom BRD.docx** (SARA vs Pai benchmark).

Everything in this file is **blocked on an external system, credential, or commercial agreement** and is therefore **not implemented**. Nothing here should be started until the corresponding access is provisioned. Every other BRD requirement is tracked in [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md).

Status legend: `PENDING` = not started, blocked. `PARTIAL-LOCAL` = the local half is built and waiting on the remote half.

---

## 1. SAP — P0 / Critical

**Blocked on:** SAP endpoint URLs, OData/RFC/BAPI service definitions, service-user credentials, IDoc or middleware (PI/PO/CPI) landscape, sandbox tenant.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| SAP-01 | Product master sync (SKU, name, brand, model, category, subcategory, specs, HSN, GST, MRP, selling price, status) | `PARTIAL-LOCAL` | Target fields now exist on the canonical product schema (`hsnCode`, `gstRate`, `mpn`, `gtin`, `modelNumber`). Needs the SAP pull/push job. |
| SAP-02 | Inventory sync — total / warehouse / store / reserved / available-to-sell | `PENDING` | `storeStock[]` shape is defined on the product schema; no feed populates it. Store-pickup UI degrades gracefully until then. |
| SAP-03 | Price sync — MRP, base price, promo price, store-specific price, online-exclusive price, effective start/end dates | `PARTIAL-LOCAL` | `priceValidFrom` / `priceValidTo` fields exist and are honoured by the pricing engine; SAP is not the source yet. |
| SAP-04 | Push sales order to SAP on payment success (order id, customer, address, SKU, qty, price, discount, coupon, GST, payment method, Pine Labs txn ref, EMI details) | `PENDING` | Hook point is after `computeOrderPricing()` succeeds in `app/api/orders/route.ts`. |
| SAP-05 | Order-status flow back from SAP → website (confirmed / allocated / processing / ready for pickup / shipped / out for delivery / delivered / cancelled / returned / refunded) | `PENDING` | Website must stop being the status author. Needs an inbound authenticated webhook. |
| SAP-06 | Store-pickup reservation against SAP store inventory + store notification | `PARTIAL-LOCAL` | Pickup selection, store choice and order fields are built. Reservation call is a no-op stub. |
| SAP-07 | Returns & refunds reverse flow (website → SAP return order → verification → refund initiation) | `PENDING` | Depends on SAP-04 and PL-05. |
| SAP-08 | Invoicing / e-invoice from SAP | `PENDING` | Local PDF invoice at `/api/orders/[id]/invoice` is a stopgap. |
| SAP-09 | Reconciliation job: SAP order ↔ website order ↔ payment | `PENDING` | Also depends on PL-06. |

---

## 2. Pine Labs — P0 / Critical

**Blocked on:** Pine Labs merchant ID, API keys, sandbox access, contracted product set (Online / Affordability Suite / POS), and confirmation of which acquirer offers are live. Razorpay remains the active gateway until cutover.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| PL-01 | Replace/augment the payment gateway with Pine Labs hosted or custom checkout (cards, UPI, net banking, wallets, EMI, BNPL) | `PENDING` | Current gateway is Razorpay (`lib/razorpay.ts`). Keep the gateway behind an adapter so cutover is config-only. |
| PL-02 | Affordability Suite — offer discovery API on the product page | `PARTIAL-LOCAL` | The EMI calculator and bank-offer table are built and rendered from a local config. Swap the data source to the Pine Labs offer-discovery response. |
| PL-03 | Real-time bank-offer engine with per-bank eligibility (no-cost EMI, instant discount, cashback) | `PARTIAL-LOCAL` | UI + local rules exist. Final eligibility must be validated in the transaction flow by Pine Labs. |
| PL-04 | Credit-card EMI, debit-card EMI, cardless EMI, BNPL tenures pulled live | `PARTIAL-LOCAL` | Tenures/rates currently come from `lib/emi.ts` config. |
| PL-05 | Refund API integration (admin/OMS → Pine Labs refund → reference → website status → customer notification) | `PENDING` | Refund status fields exist on the order document. |
| PL-06 | Payment reconciliation engine covering the five failure scenarios: paid-but-order-failed, order-created-but-payment-failed, double payment, browser closed after payment, payment pending | `PENDING` | Requires Pine Labs settlement/txn reports. This is the highest-risk item in the whole BRD. |
| PL-07 | Unified online + in-store Pine Labs architecture (POS cloud/API or app-to-app) | `PENDING` | Depends on which Pine Labs POS product the stores run. |

---

## 3. Shipment / logistics

**Blocked on:** courier or 3PL account (Shiprocket/Delhivery/Blue Dart/etc.), API keys, rate card, serviceability master, pickup locations.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| SHIP-01 | Courier serviceability by pincode (live) | `PARTIAL-LOCAL` | Delivery checker currently uses the local `blocked_pincodes` collection + distance heuristic. |
| SHIP-02 | Real shipping-rate calculation by weight/dimensions/zone | `PARTIAL-LOCAL` | `weightKg` and `dimensionsCm` now exist on the product schema; the pricing engine still uses a flat/threshold rule. |
| SHIP-03 | Label generation, manifest, pickup scheduling | `PENDING` | |
| SHIP-04 | AWB / tracking-number ingestion and live tracking on `/track` | `PENDING` | `/track` reads local order status only. |
| SHIP-05 | Delivery-date promise from carrier SLA rather than heuristic | `PENDING` | |
| SHIP-06 | Reverse pickup for returns | `PENDING` | Depends on SAP-07. |
| SHIP-07 | Installation-visit scheduling with the service partner | `PENDING` | |

---

## 4. CRM

**Blocked on:** chosen CRM (Zoho/Salesforce/LeadSquared/etc.), API credentials, field mapping, store-to-salesperson routing table.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| CRM-01 | Push website leads to CRM with source, campaign, product, pincode, store, phone, WhatsApp | `PARTIAL-LOCAL` | Leads are captured to the `leads` collection with all of those attributes. Only the outbound push is missing. |
| CRM-02 | Route lead to nearest SARA store → salesperson → follow-up | `PENDING` | Nearest-store resolution already exists locally. |
| CRM-03 | Online-to-offline attribution reporting | `PENDING` | |
| CRM-04 | Loyalty-point ledger sync if loyalty is CRM-owned | `PENDING` | Local rewards model is display-only today. |

---

## 5. Other externally-blocked items

| # | Task | Status | Blocked on |
| --- | --- | --- | --- |
| EXT-01 | Submit the product feed to Google Merchant Center and link to Google Ads | `PARTIAL-LOCAL` | The Merchant Center-format feed is generated at `/feed/google-merchant.xml`. Submission needs a GMC account, domain verification, and real GTINs. |
| EXT-02 | Meta Pixel + Conversions API | `PENDING` | Pixel ID and CAPI access token. |
| EXT-03 | Google Ads conversion tracking | `PENDING` | Conversion IDs/labels. |
| EXT-04 | Microsoft Clarity or equivalent session recording | `PENDING` | Project ID. |
| EXT-05 | Google Search Console property + sitemap submission | `PENDING` | Domain verification. |
| EXT-06 | GA4 property wiring (the event layer is built; the measurement ID is not set) | `PARTIAL-LOCAL` | `lib/analytics.ts` already emits the full GA4 e-commerce event set to `dataLayer`. |
| EXT-07 | WhatsApp Business template approvals for order/lead journeys | `PARTIAL-LOCAL` | AskEva client exists in `lib/marketing/whatsapp.ts`; new templates need approval. |
| EXT-08 | Exchange/buyback valuation engine | `PENDING` | Needs a valuation partner (Cashify/Servify) or an internal price grid. UI placeholders exist. |
| EXT-09 | Real customer review photo/video hosting | `PARTIAL-LOCAL` | Review submission is built; media upload needs an object-store bucket (no storage provider is configured in this repo). |

---

## Cutover notes for whoever picks this up

- **Keep the gateway behind an adapter.** `lib/razorpay.ts` is called directly in several routes. Before PL-01, introduce a `PaymentProvider` interface so Razorpay and Pine Labs can run side by side during migration.
- **SAP must own price and stock, not the website.** Once SAP-01/02/03 land, the admin product editor should make those fields read-only to prevent divergence.
- **Do not let the website author order status once SAP-05 is live** — otherwise the two systems will fight.
- **PL-06 before go-live.** Payment/order reconciliation is the difference between a launch and an incident.
