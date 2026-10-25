# Product and inventory flow review

Reviewed in source on 2026-10-26. Tests, TypeScript checks, builds, browser journeys and live database operations were not run: the user previously stopped testing, and the request to resume isolated checks is still unanswered. This is an implementation review, not a certification that the complete deployed flow works.

| Step | Stored data and behavior |
| --- | --- |
| `/admin/scraper` | Creates product details and specifications together. Existing item numbers, including inactive/legacy records, are skipped. New stock starts at zero. Manual entries stay drafts pending review; bulk entries retain automatic publication. Item numbers are normalized to uppercase and limited to 100 characters to match the inventory join key. |
| `/admin/products` metadata update | Changes name, division, category, segment and brand using the item number as the join key. It leaves pricing and stock alone. |
| `/admin/products` price update | Changes price, optional MRP and optional visibility. The server validates positive finite pricing and Price <= MRP, ignores old stock columns and preserves inventory. Explicit visibility changes synchronize `active` and `status`. |
| Product editor | Stock is read-only and excluded from the payload. PATCH/PUT ignore incoming stock, preventing a stale editor from undoing a later stock upload. Activation also clears draft/inactive status through an explicit status update. |
| `/admin/stock-check` | Requires existing item/store codes and explicit nonnegative integer quantities, with a per-row maximum of 1,000,000. Blank quantities never imply zero. Duplicate store/item rows and unknown codes reject the upload. Excel is bounded to 10 MB and 50,000 rows; Google Sheets uses the existing bounded download. |
| Stock persistence | One MongoDB transaction updates store/item quantities, zeros omitted items for each fully replaced store, and writes the cumulative sum to `products.stock`. A store revision write serializes concurrent full replacements of the same store. Other stores remain unchanged. Warehouses contribute to the overall total. |
| Stock inspection | Shows an item's per-store quantities, uploaded cumulative total and product stock, flags a mismatch, and refreshes a displayed lookup after upload. |
| Customer `/products` | Reads `products.stock`, shows the cumulative count, and disables Add to Cart for zero/malformed stock or an invalid price. The catalogue bypasses its former five-minute browser cache and shared API cache; focus/visibility and 30-second visible polling refresh it. |

Example: item T1 has 5 units at store A, 3 at store B and 2 at warehouse W. Its stored and displayed overall stock is 10. A later complete replacement for A setting T1 to 1 produces overall stock 6; B and W retain their quantities. Price or metadata changes must keep that stock at 6. Pickup still checks the selected active retail store's quantity rather than the overall count.

The review corrected draft activation, stale product-editor stock overwrites, stock imports treating blank quantities as zero, partially recognized full-store imports changing inventory, same-store replacement races, stale product listings and absent numeric customer stock labels.

Required verification before calling the flow production-ready: isolated regression cases for duplicate scraper entries, transaction rollback, metadata/price inventory preservation, draft activation, multi-store/warehouse totals, omitted-item zeroing, invalid imports, concurrent replacements and customer refresh behavior; TypeScript/build checks; and an isolated browser journey through the four pages. MongoDB transaction support and required unique indexes must also exist in the deployment. No inventory reservations or SAP synchronization changes were added by this review. Browser refresh is periodic, not a push subscription. Legacy duplicate identities, malformed stock rows and deployed data/configuration remain unverified.
