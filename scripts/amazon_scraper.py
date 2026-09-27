# import json
# import os
# import re
# import requests
# from bs4 import BeautifulSoup
# from openpyxl import Workbook, load_workbook

# HEADERS = {
#     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
#                   " AppleWebKit/537.36 (KHTML, like Gecko)"
#                   " Chrome/116.0.0.0 Safari/537.36",
#     "Accept-Language": "en-US,en;q=0.9"
# }

# def get_html(url):
#     response = requests.get(url, headers=HEADERS, timeout=15)
#     response.raise_for_status()
#     return response.text

# def extract_title(soup):
#     title = soup.find(id="productTitle")
#     return title.get_text(strip=True) if title else None

# def extract_asin(url, soup):
#     m = re.search(r"/dp/([A-Z0-9]{10})", url)
#     if m:
#         return m.group(1)
#     asin_tag = soup.find("th", string=re.compile("ASIN", re.I))
#     if asin_tag:
#         val = asin_tag.find_next_sibling("td")
#         if val:
#             return val.get_text(strip=True)
#     return None

# def extract_technical_details(soup):
#     details = {}
#     table1 = soup.find(id="productDetails_techSpec_section_1")
#     if table1:
#         for row in table1.find_all("tr"):
#             key = row.find("th").get_text(strip=True)
#             val = row.find("td").get_text(strip=True)
#             details[key] = val
#     table2 = soup.find(id="productDetails_detailBullets_sections1")
#     if table2:
#         for row in table2.find_all("tr"):
#             cols = row.find_all("td")
#             if len(cols) >= 2:
#                 key = cols[0].get_text(strip=True)
#                 val = cols[1].get_text(strip=True)
#                 details[key] = val
#     bullets = soup.select("#detailBullets_feature_div li")
#     for li in bullets:
#         txt = li.get_text(" ", strip=True)
#         if ':' in txt:
#             k, v = txt.split(':', 1)
#             details[k.strip()] = v.strip()
#     return details

# def extract_from_manufacturer(soup):
#     section = soup.find("h2", string=re.compile("From the manufacturer", re.I))
#     if section:
#         nxt = section.find_next()
#         if nxt:
#             return nxt.get_text(" ", strip=True)
#     desc = soup.find(id="productDescription")
#     if desc:
#         return desc.get_text(" ", strip=True)
#     return None

# def extract_images(soup, html_text):
#     images = []
#     img = soup.find(id="landingImage")
#     if img and img.get("data-a-dynamic-image"):
#         try:
#             data = json.loads(img["data-a-dynamic-image"])
#             images.extend(data.keys())
#         except:
#             pass
#     m = re.search(r'\'ImageBlockATF\':\s*({.*?})\s*,\n', html_text, re.S)
#     if m:
#         try:
#             ib = json.loads(m.group(1).replace("'", '"'))
#             if "mainUrl" in ib:
#                 images.append(ib["mainUrl"])
#             if "variant" in ib:
#                 for k, v in ib["variant"].items():
#                     if isinstance(v, dict):
#                         images.append(v.get("hiRes") or v.get("large") or v.get("main"))
#         except:
#             pass
#     thumbs = soup.select("#altImages img")
#     for t in thumbs:
#         src = t.get("src") or t.get("data-src")
#         if src:
#             images.append(src.split("_")[0] + ".jpg")
#     seen = set()
#     final = []
#     for img_url in images:
#         if img_url and img_url not in seen:
#             seen.add(img_url)
#             final.append(img_url)
#     return final

# def save_to_json(data_list, filename="product.json"):
#     with open(filename, "w", encoding="utf-8") as f:
#         json.dump(data_list, f, indent=2, ensure_ascii=False)
#     print(f"✅ Saved JSON to: {filename}")

# def save_to_excel(data_list, filename="product.xlsx"):
#     if os.path.exists(filename):
#         wb = load_workbook(filename)
#         ws = wb.active
#         headers = [cell.value for cell in ws[1]]
#     else:
#         wb = Workbook()
#         ws = wb.active
#         headers = []

#     for product_data in data_list:
#         flat_details = product_data.get("technical_details", {})
#         images = product_data.get("images", [])
#         row_data = {
#             "Title": product_data.get("title"),
#             "ASIN": product_data.get("asin"),
#             "From Manufacturer": product_data.get("from_manufacturer"),
#             "URL": product_data.get("url"),
#             "Images Count": len(images),
#             "First Image": images[0] if images else "",
#             **flat_details
#         }

#         for key in row_data:
#             if key not in headers:
#                 headers.append(key)
#                 ws.cell(row=1, column=len(headers), value=key)

#         row = [row_data.get(h, "") for h in headers]
#         ws.append(row)

#     wb.save(filename)
#     print(f"✅ Appended {len(data_list)} rows to: {filename}")

# def scrape_amazon(url):
#     html = get_html(url)
#     soup = BeautifulSoup(html, "lxml")
#     return {
#         "url": url,
#         "title": extract_title(soup),
#         "asin": extract_asin(url, soup),
#         "technical_details": extract_technical_details(soup),
#         "from_manufacturer": extract_from_manufacturer(soup),
#         "images": extract_images(soup, html)
#     }
