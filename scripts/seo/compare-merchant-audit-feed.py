"""Compare saved read-only candidate audit and public feed; no network or writes."""
import json
from decimal import Decimal
from pathlib import Path
import xml.etree.ElementTree as ET

directory = Path(".seo-local/merchant-catalogue-audit")
candidates = json.loads((directory / "merchant-preview.json").read_text(encoding="utf-8"))
ns = {"g": "http://base.google.com/ns/1.0"}
live = {
    item.findtext("g:id", namespaces=ns): item
    for item in ET.parse(directory / "live-feed.xml").findall("./channel/item")
}
missing, prices, stock, base_prices = [], [], [], []
for candidate in candidates:
    offer_id = candidate["offerId"]
    item = live.get(offer_id)
    if item is None:
        missing.append(offer_id)
        continue
    base_price = item.findtext("g:price", namespaces=ns).split()
    if Decimal(base_price[0]) != Decimal(str(candidate["price"])):
        base_prices.append(offer_id)
    price = (item.findtext("g:sale_price", namespaces=ns) or item.findtext("g:price", namespaces=ns)).split()
    if price[1:] != ["INR"] or Decimal(price[0]) != Decimal(str(candidate["price"])):
        prices.append(offer_id)
    if item.findtext("g:availability", namespaces=ns) != "in_stock":
        stock.append(offer_id)
print(json.dumps({"candidates": len(candidates), "live_items": len(live),
    "missing_offer_ids": missing, "selling_price_mismatch_ids": prices,
    "availability_mismatch_ids": stock,
    "base_price_differs_from_selling_price_count": len(base_prices),
    "limitation": "Separate saved reads; not a transactional snapshot or Merchant account export."}, indent=2))
