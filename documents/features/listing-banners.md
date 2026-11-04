# Listing posters and deadlines

Use `/admin/listing-banners` to manage artwork by page and section. The placement map lists every poster, its audience, order, current selection and deadline. Clicking a poster opens its editor. The artwork preview uses the same component as the storefront, and unsaved edits update the map immediately. Save publishes the change.

Choose **Never** or set a deadline in **India Standard Time**. At the deadline the poster becomes ineligible on the public API and disappears from already-open storefronts. It remains in the admin list for editing. Existing posters without a deadline behave as Never. Turning a poster off still hides it immediately; turning it back on does not reset its deadline.

The **Visibility schedule** also supports Sunday through Saturday and an optional **Visible from** start date/time. Select the weekdays to show the poster, or choose **Every day**. Set the end through **Visible until**, or select **Never end**. All conditions apply together in IST: start is inclusive, end is exclusive, and a checked weekday is required. A poster can repeat weekly forever or only within the configured date range. Existing posters start immediately on every day. An end must be after the start; an empty weekday selection cannot be saved.

The public API returns currently eligible posters by default. Storefront hooks request active schedule candidates with `schedule=1`, then apply the same visibility rules locally. Local timers reveal scheduled posters at their start time, update weekday selection at IST midnight, and hide them at their end time. The placement map and saved-poster list show the schedule and distinguish future, wrong-weekday and expired posters.

Home card, strip and statement artwork share the same three-poster row below deals. Two eligible side posters are needed beside the main hero, and photo-only hero slides hide the side pair. Product offer cards appear above the product-detail tabs; product rail cards appear in Overview. The map explains slot limits, targeting and Marketing section visibility. Cart promotions appear only in a non-empty full cart with recommendations enabled.

Run `node --test tests/banner-schedule.test.mjs tests/route-guards.test.mjs` for isolated scheduling, API, selection, timer and placement-map checks. These checks do not access the configured database or send messages.
