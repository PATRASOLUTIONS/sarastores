# Stores, warehouses and pickup availability

Implemented 2026-10-26. Changes were reviewed in source only. No tests, TypeScript checks, builds, payment attempts or live inventory changes were run, following the user's instruction to stop testing.

`/admin/store-locations` supports a Store/Warehouse selector and an active switch. Locations without a stored type remain Stores. Excel templates and exports include Location Type; a blank type in an import preserves an existing location's type. Only active Stores appear in the locator, store structured data, pickup choices and pay-at-store choices. Warehouses remain available for stock uploads and overall product inventory.

The locator shows all active Stores by default. Checkout shows store cards only for pickup, after checking stock, and includes only active Stores holding the full requested cart. It ranks eligible stores by proximity without restricting the list to Bangalore and Mysore. Existing delivery-region and pincode restrictions remain enforced for home delivery, including by the payment and order APIs.

Pickup cards show Store Code and each hardware Item Code's available and requested quantities. Quantities are summed across cart lines for the same item code. Eligibility requires every requested quantity at that store; missing codes or stock do not qualify. Software does not require a physical store stock row. Availability refreshes after cart changes, on focus and every 30 seconds while the page is visible. If a selected store loses stock, checkout offers another eligible store or a delivery fallback when overall stock is sufficient. Payment for pickup is disabled until an eligible store is selected.

Hardware pickup stock is checked by canonical item code and store code independently of the overall catalogue quantity. Home delivery checks overall catalogue stock, recomputed across inventory uploads, including warehouses. Active/product-status and purchase-limit checks apply in both modes. Final pickup address and store metadata are loaded from the database rather than trusted from the browser.

When overall catalogue stock can fulfil the cart but the chosen store cannot, checkout offers free home delivery and hides Pay at Store. It also offers free delivery when no active retail store can fulfil the whole cart. The delivery choice retains the unavailable store's ID so the server independently rechecks the fallback and computes zero shipping during payment and final order creation. Picking another eligible store restores pickup and eligible payment choices. A warehouse or inactive store cannot be used as a pickup or payment destination.

Store-payment requests and final order transactions recheck store eligibility and quantities. The final transaction uses the same MongoDB session for stock reads. These checks use current inventory snapshots; they do not reserve or decrement inventory between simultaneous shoppers.

Checkout payment choices follow fulfilment: Home delivery offers online gateways only; Pick up from store offers online gateways and Pay at Store when the selected store holds the required quantities and store payments are enabled. Switching to delivery resets Pay at Store to online payment. Store-payment requests and order creation reject delivery fulfilment and require the payment store to match the pickup store.

See [checkout recovery and validation](checkout-recovery-and-validation.md) for draft retention, payment recovery and remaining verification limits.
