# Listing posters and deadlines

Use `/admin/listing-banners` to manage artwork by page and section. The placement map lists every poster, its audience, order, current selection and deadline. Clicking a poster opens its editor. The artwork preview uses the same component as the storefront, and unsaved edits update the map immediately. Save publishes the change.

Choose **Never** or set a deadline in **India Standard Time**. At the deadline the poster becomes ineligible on the public API and disappears from already-open storefronts. It remains in the admin list for editing. Existing posters without a deadline behave as Never. Turning a poster off still hides it immediately; turning it back on does not reset its deadline.

Home card, strip and statement artwork share the same three-poster row below deals. Two eligible side posters are needed beside the main hero, and photo-only hero slides hide the side pair. Product offer cards appear above the product-detail tabs; product rail cards appear in Overview. The map explains slot limits, targeting and Marketing section visibility. Cart promotions appear only in a non-empty full cart with recommendations enabled.

Run `node --test tests/banner-schedule.test.mjs tests/route-guards.test.mjs` for isolated scheduling, API, selection, timer and placement-map checks. These checks do not access the configured database or send messages.
