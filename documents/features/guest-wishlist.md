# Wishlist count and guest saving

Implemented 2026-10-25. No tests, TypeScript checks or builds were run, following the user's instruction to stop testing.

The header heart icon shows the number of distinct wishlist products for guests and signed-in customers, on desktop and mobile. Account menu wishlist links also show the count. Empty wishlists hide the badge.

Guest product hearts save a product display snapshot in browser localStorage under `wishlist_guest`. The public `/wishlist` page lets guests view their saved products, remove them and add them to the cart. Guest items survive refreshes and remain separate from account wishlists. Signed-in shoppers use the server wishlist and the existing dashboard page. Both pages share the same wishlist content component.

Catalogue cards and product details use the shared wishlist hook. Add/remove operations notify every mounted consumer and other tabs, so the header count and product hearts update together. Account requests remain authenticated by the server; guest display snapshots are never trusted for checkout prices or product availability. Authentication hydration and owner checks prevent late responses from showing a previous account's wishlist.
