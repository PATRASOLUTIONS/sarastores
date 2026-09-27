# import sys
# import os
# import json
# import subprocess

# def main():
#     if len(sys.argv) < 3:
#         print("Usage: python scripts/fetch_amazon_to_db.py <SKU> <URL>")
#         sys.exit(1)

#     sku = sys.argv[1].strip()
#     url = sys.argv[2].strip()

#     if not sku or not url:
#         print("SKU and URL are required.")
#         sys.exit(1)

#     print(f"ByteWise Testing Point Scraping URL for SKU={sku}: {url}")

#     # Call the Node.js scraper and capture JSON output
#     try:
#         result = subprocess.run(
#             ["node", "scripts/amazon_scraper.js", url],
#             capture_output=True, text=True, check=True
#         )
#         product = json.loads(result.stdout)
#     except Exception as e:
#         print("Scraper failed:", e)
#         sys.exit(1)

#     # Prepare payload for our app's DB
#     payload = {
#         "sku": sku,
#         "url": product.get("url"),
#         "title": product.get("title"),
#         "asin": product.get("asin"),
#         "technical_details": product.get("technical_details") or {},
#         "from_manufacturer": product.get("from_manufacturer"),
#         "images": product.get("images") or [],
#     }

#     api_base = os.environ.get("API_BASE", "http://localhost:3000")
#     endpoint = f"{api_base}/api/products/specifications/upload"

#     print(f"ByteWise Testing Point Uploading to: {endpoint}")
#     try:
#         import requests
#         res = requests.post(endpoint, json=payload, timeout=30)
#         res.raise_for_status()
#         print("ByteWise Testing Point Upload successful:", res.json())
#     except Exception as e:
#         print("ByteWise Testing Point Upload failed:", e)
#         sys.exit(1)

#     print("ByteWise Testing Point Done.")

# if __name__ == "__main__":
#     main()