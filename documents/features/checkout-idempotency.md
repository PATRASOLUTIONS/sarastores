# Duplicate checkout and payment recovery

Payment initiation sends a persisted, owner-scoped UUID in `Idempotency-Key`. Razorpay creation, hosted order creation and store payment requests require the key. Other order submissions can send one; paid order persistence also atomically consumes the existing checkout capability.

The server inserts a `checkout_requests` record using MongoDB's unique `_id` before contacting a gateway. Identical retries replay its stored response and private capability. A concurrent request receives 409 while the first is processing. Reusing the key with a different account or payload receives 409. Keys are hashed in the database; response data is private and never cacheable.

The browser retains the request body and original order snapshot in shared local storage before sending the request. Web Locks serialize initial creation across tabs when supported. If shared storage cannot be written, payment does not start. Refreshes reuse the same attempt. Checkout changes cannot replace an unresolved attempt. Completion removes only purchased quantities using the original snapshot, retaining later cart additions.

Validation errors before provider invocation may explicitly return `Checkout-Retry-Safe: true`, allowing a fresh attempt after correction. A provider timeout, lost response or persistence failure never releases a claimed attempt. These failures require reconciliation/support; they do not trigger automatic creation of another gateway session. Processing/uncertain records must not be reclaimed merely because time elapsed. Successful initiation replay stops before capability expiry (55 minutes online, 23 hours store request), while retaining the claim for reconciliation. Confirmed hosted failures clear browser recovery to permit an intentional retry; dismissal of Razorpay preserves its original provider order.

## Scenario coverage

| Scenario | Isolated check |
| --- | --- |
| Single click | One provider call and one capability |
| Double/repeated click | Actual Pay Now handlers for all three providers ignore concurrent clicks |
| Repeated HTTP request | Same result replayed without provider calls |
| Refresh | Persisted key, receipt and original cart retained |
| Multiple tabs/payment link | Shared key retained; same intent settles once |
| Callback/webhook retries | Existing authoritative reconciliation and signature fixtures |
| Timeout after provider creates session | Attempt retained; no second session |
| Repeated website return | Receipt remains recoverable; consumed intent cannot settle twice |
| Concurrent order creation | One capability claim, payment record and order insert |
| Failed payment retry | New key only after confirmed failure clears recovery |
| Cart changes during setup | Original purchased snapshot preserved; mismatched retry rejected |
| Pre-gateway validation failure | Explicit safe retry flag survives replay |

Checks use actual source with mocked provider/network/database boundaries. They do not certify real provider behavior, browser/device behavior or a deployed MongoDB transaction topology. Providers must prevent duplicate capture of their own payable order/session; this cannot be established by application fixtures. Simultaneous first-use tabs without Web Locks retain server protection for a shared request key, but cross-tab creation of different keys is not proven atomic. Deliberately creating different keys represents different attempts and is outside per-key deduplication.

No live payment, customer database write, index migration or deployment was performed. The new collection uses MongoDB's existing unique `_id` index; no additional unique-index rollout is required. Existing API clients must supply the key on the payment-initiation endpoints.

## Verification — 26 October 2026

- **132 targeted checks passed**, zero failures: checkout idempotency, payment gateways, order security, store payment and route guards.
- `npx tsc --noEmit` passed after the final source changes.
- The strict production build passed with exit code 0 and **216 static pages**. TypeScript and ESLint gates remained enabled; existing lint warnings remain.
- The compiled API output contains the expiry guard and the final stock/total safe-retry headers.
- The build used the existing read-only MongoDB fixture and private audit output directory. The runner restored `tsconfig.json` and `next-env.d.ts` afterward. Font downloads required network access after the sandboxed attempt failed.

Non-sensitive verification logs remain local under `documents/private-artifacts/checkout-idempotency-tests.log` and `checkout-idempotency-build-final.log`. They are excluded from version control and publishing. These results cover isolated application behavior, not live gateway certification.
