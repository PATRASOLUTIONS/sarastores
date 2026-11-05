# Homepage PageSpeed improvements - 2026-11-05

Source: https://pagespeed.web.dev/analysis/https-www-sarastores-com/4mt1hljtxs?form_factor=mobile
Lighthouse 13.6.0; saved mobile run at 2026-11-05 10:16:50 UTC.

## Baseline

Mobile performance 54, accessibility 93, best practices 100, SEO 100.
Lab FCP 1.1 seconds, LCP 5.8 seconds, TBT 320 milliseconds, CLS 0.209,
Speed Index 7.6 seconds; transfer total 1,637 KiB.
The LCP banner was not discoverable in the initial HTML. The report attributed
layout movement to Today's Deals. It estimated 316 KiB of image savings and
49 KiB of unused CSS, and recorded a 266 KiB brands-page prefetch.

URL-level real-user results for October 7-November 3 were LCP 4.9 seconds,
INP 270 milliseconds and CLS 0.48. Those 28-day results predate these changes.

## Implemented

- Initial server HTML includes scheduled banners, saved marketing content,
  Top Brands and six random unique in-stock deals. Only card fields reach the
  browser. A bounded 120-product sample replaces the full home catalogue read;
  public display data uses a 60-second cache. Canonical product-name visibility
  remains enforced. Text heroes retain their advertised starting-price lookup.
- The first banner is preloaded with responsive sizes. Uploaded banners have
  seven allowed WebP widths, a bounded process cache and immutable browser/CDN
  caching. Originals remain available; no database writes or migrations.
- Hero space and card/skeleton heights are reserved. The homepage order is banner,
  Top Brands, Today's Deals, Recently Viewed, Similar to What You Viewed, then other sections.
  Top Brands contains only fixed realme, OPPO, Mi, Samsung, Vivo and Apple entries
  with local logos. Brand catalogue reads and API requests are removed.
  Recommendations load only for visitors
  with history, with up to four category requests limited to 30 cards each.
- Removed the hidden mobile-brand-image request. Server-seeded home data avoids
  initial banner/content/brand/store API requests. Scheduled visibility still
  updates locally; banners/content revalidate after 60 seconds or on focus.
- Heavy home/product/footer navigation prefetches are disabled, except the six
  fixed brand links whose prefetch is enabled at the owner's request. The fixed
  header/footer logo is a 748x200 WebP (19,620 bytes).
- Cart drawer code/settings load on first opening. Desktop cart reminders load
  only for signed-in customers with cart items. The retired launch component,
  animation features and festival effects load separately; ambient effects
  wait for idle time and respect reduced motion. Script-font preload is disabled.
- Editor-only styles moved to the editor. Removed the unused Tailwind 4 animation
  stylesheet from the Tailwind 3 application; the existing animation plugin
  retains menu/dialog animations. Carousel touch targets and accessible labels
  are improved.
- Overlapping session checks share an in-flight request within the same auth
  generation; settled identity is never cached and later focus checks revalidate.

## Verification and follow-up

Isolated regressions cover actual first-render HTML/preload/deals, public
sampling, scheduled visibility, image dimensions/resizing/caching, protected
image paths, cart loading, Tailwind animation utilities and session lifecycle.
Validation: 79 focused regressions passed, with another 33 relevant checks passing after the final image sizing adjustment. TypeScript checks are run. No application build or lint is run, per owner request.
No environment variables, live records or deployment settings are changed.

After deployment, repeat three mobile PSI runs against the same canonical URL;
compare medians and inspect banner delivery, layout movement, cart opening,
login/logout, recommendations and menus on mobile and desktop. Targets are
LCP <=2.5 seconds, CLS <=0.1, TBT <=200 milliseconds and field INP <=200 milliseconds.
No post-deployment score or byte savings is claimed from isolated tests. CrUX
changes gradually as the rolling 28-day sample accumulates.
