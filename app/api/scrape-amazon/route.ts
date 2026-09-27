import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import axios from "axios"
import * as cheerio from "cheerio"
import { connectDB } from "@/lib/db"
import { ObjectId } from "mongodb"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"
import { buildSpecificationDocument, SPECIFICATIONS_COLLECTION } from "@/lib/product-specification-schema"
import { generateProductSlug } from "@/utils/slug"

// User agents to rotate for avoiding detection (updated Feb 2026)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
]

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** Hosts we will make a server-side request to. */
const ALLOWED_HOSTS = [
  "amzn.in",
  "amzn.to",
  "amazon.in",
  "amazon.com",
  "amazon.co.uk",
  "amazon.ae",
]

function amazonHost(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  // Match the host itself or a subdomain of it — a substring test would let
  // https://internal-host/amzn.in/ through and make us fetch an internal URL.
  return ALLOWED_HOSTS.find((h) => host === h || host.endsWith(`.${h}`)) ?? null
}

function isValidAmazonUrl(url: string): boolean {
  return amazonHost(url) !== null
}

function isShortLink(url: string): boolean {
  const host = amazonHost(url)
  return host === "amzn.in" || host === "amzn.to"
}

// Extract ASIN from Amazon URL
function extractASIN(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Clean price string to number
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0
  const cleaned = priceStr.replace(/[₹,\s]/g, "").replace(/[^\d.]/g, "")
  return parseFloat(cleaned) || 0
}

// Resolve short URL to full URL by reading the redirect target
async function resolveShortUrl(shortUrl: string): Promise<string> {
  // Reading the Location header is several times faster than following the
  // redirect, which downloads the whole product page just to learn the URL.
  const response = await axios.get(shortUrl, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    maxRedirects: 0,
    timeout: 25000,
    validateStatus: (status) => status < 400,
  })

  const location = response.headers?.location
  if (typeof location === "string" && location) {
    const absolute = new URL(location, shortUrl).toString()
    if (!isValidAmazonUrl(absolute)) {
      throw new Error("Short link redirected off Amazon")
    }
    return absolute
  }

  return response.request?.res?.responseUrl || response.config?.url || shortUrl
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { url: inputUrl, saveToDatabase = false, itemno, category: inputCategory, subCategory: inputSubCategory, prod_desc: inputProdDesc, group_name: inputGroupName, char_desc: inputCharDesc, manufacturer_name: inputManufacturerName, editedData, active } = body
    const normalizedRequestMeta = extractCanonicalProductMetadata({
      itemno,
      Name: editedData?.name,
      Description: editedData?.description,
      "Category/Group Name": inputCategory || inputGroupName,
      "sub-category/PROD DESC": inputSubCategory || inputProdDesc,
      "CHAR DESC": inputCharDesc,
      "Manufacturer Name": inputManufacturerName,
    })
    const canonicalSku = normalizedRequestMeta.itemno

    if (!inputUrl || !isValidAmazonUrl(inputUrl)) {
      return NextResponse.json({ success: false, error: "Invalid Amazon URL. Please use amazon.in or amzn.in links." }, { status: 400 })
    }

    // When saving, itemno is required
    if (saveToDatabase && !canonicalSku) {
      return NextResponse.json({ success: false, error: "Item No is required to save to database" }, { status: 400 })
    }

    // If saving, enforce Input Category/SubCategory presence if that was the requirement? 
    // The user said "Category, Sub-Category need to select and then only i can save". The UI enforces this. 
    // The API should probably just use them if present.

    // ... (rest of resolution logic) ...

    // Resolve short URLs (amzn.in, amzn.to) to full URLs
    let url = inputUrl
    let asin: string | null = extractASIN(inputUrl)

    // If we can't extract ASIN directly (short URL), resolve it first
    if (!asin && isShortLink(inputUrl)) {
      console.log("Resolving short URL:", inputUrl)
      url = await resolveShortUrl(inputUrl)
      console.log("Resolved to:", url)
      asin = extractASIN(url)
    }

    if (!asin) {
      return NextResponse.json({ success: false, error: "Could not extract product ID (ASIN) from URL. Please use a direct product page link." }, { status: 400 })
    }

    // Use clean ASIN-based URL to avoid tracking params that trigger bot detection
    const domain = url.includes("amazon.in") ? "amazon.in" : "amazon.com"
    const cleanUrl = `https://www.${domain}/dp/${asin}`

    // Fetch with retry logic - try different User-Agents on failure
    let responseData = ""
    let lastError = ""
    const shuffledUAs = [...USER_AGENTS].sort(() => Math.random() - 0.5)

    for (let attempt = 0; attempt < Math.min(3, shuffledUAs.length); attempt++) {
      try {
        const ua = shuffledUAs[attempt]
        const response = await axios.get(cleanUrl, {
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Sec-CH-UA": '"Chromium";v="131", "Not_A Brand";v="24"',
            "Sec-CH-UA-Mobile": "?0",
            "Sec-CH-UA-Platform": '"Windows"',
            "Referer": `https://www.${domain}/`,
          },
          maxRedirects: 5,
          timeout: 20000,
        })
        responseData = response.data

        // Check if we got a CAPTCHA page instead of a product page
        if (responseData.includes("captcha") || responseData.includes("robot") || responseData.includes("automated access")) {
          lastError = "Amazon CAPTCHA detected"
          console.log(`Attempt ${attempt + 1}: CAPTCHA detected, retrying...`)
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500))
          continue
        }

        // If we got actual content, break out of retry loop
        if (responseData.includes("productTitle") || responseData.includes("a-size-large") || responseData.includes("product-title")) {
          break
        }

        lastError = "Page content did not contain expected product elements"
        console.log(`Attempt ${attempt + 1}: No product elements found, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
      } catch (fetchError: any) {
        lastError = fetchError.message || "Network request failed"
        console.log(`Attempt ${attempt + 1} failed:`, lastError)
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500))
      }
    }

    if (!responseData) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch Amazon page after 3 attempts. ${lastError}. Please try again.`
      }, { status: 422 })
    }

    const $ = cheerio.load(responseData)
    const html = responseData as string

    // ===== EXTRACT PRODUCT DATA =====

    // Title - try multiple selectors for different Amazon page layouts
    const title = $("#productTitle").text().trim() ||
      $("h1.a-size-large").text().trim() ||
      $("span.product-title-word-break").text().trim() ||
      $("h1#title span").text().trim() ||
      $("h1[data-automation-id='title']").text().trim() ||
      $("#titleSection h1").text().trim() ||
      $("#title_feature_div #title").text().trim() ||
      $("h1.a-size-medium").text().trim() ||
      $("span[data-action='a-popover'] h1").text().trim() ||
      $(".product-title h1").text().trim()

    if (!title) {
      // Check if we hit a CAPTCHA or dog page
      const isCaptcha = html.includes("captcha") || html.includes("robot") || html.includes("automated access")
      const isDogPage = html.includes("Sorry") && html.includes("api-services-support@amazon")
      const errorMsg = isCaptcha
        ? "Amazon CAPTCHA/bot detection triggered. Please try again in a few seconds."
        : isDogPage
          ? "Amazon is temporarily blocking requests. Please wait a minute and try again."
          : "Could not extract product title. Amazon may have blocked the request or the page structure changed."

      return NextResponse.json({
        success: false,
        error: errorMsg
      }, { status: 422 })
    }

    // Price (Current selling price)
    let price = 0
    const priceSelectors = [
      "#corePrice_feature_div .a-price .a-offscreen",
      "#apex_offerDisplay_desktop .a-price .a-offscreen",
      ".a-price .a-offscreen",
      "span.a-price-whole",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "#priceblock_saleprice",
    ]
    for (const selector of priceSelectors) {
      const priceText = $(selector).first().text().trim()
      if (priceText) {
        price = parsePrice(priceText)
        if (price > 0) break
      }
    }

    // MRP (Original price)
    let mrp = 0
    const mrpSelectors = [
      "#corePrice_feature_div .a-text-price .a-offscreen",
      ".basisPrice .a-offscreen",
      ".a-text-price .a-offscreen",
      "#listPrice",
      ".priceBlockStrikePriceString",
    ]
    for (const selector of mrpSelectors) {
      const mrpText = $(selector).first().text().trim()
      if (mrpText) {
        mrp = parsePrice(mrpText)
        if (mrp > 0) break
      }
    }

    // ===== IMAGES - Extract unique images =====
    const imageSet = new Set<string>()
    const seenImageIds = new Set<string>()

    // Helper to add unique image by extracting ID from URL
    const addUniqueImage = (url: string): boolean => {
      if (!url || url.includes("sprite") || url.includes("grey-pixel") || url.includes("loading") || url.includes("play-icon")) {
        return false
      }
      // Extract unique image ID from Amazon URL pattern /images/I/XXXXX
      const idMatch = url.match(/\/images\/I\/([A-Za-z0-9_%-]+)/)
      const imageId = idMatch ? idMatch[1].split('.')[0] : url

      if (!seenImageIds.has(imageId)) {
        seenImageIds.add(imageId)
        imageSet.add(url)
        return true
      }
      return false
    }

    // Method 1: Extract hiRes URLs from colorImages JS variable
    const hiResMatches = html.matchAll(/"hiRes"\s*:\s*"(https:\/\/[^"]+)"/g)
    for (const match of hiResMatches) {
      if (match[1]) addUniqueImage(match[1])
    }

    // Method 2: Extract large URLs if no hiRes found
    if (imageSet.size === 0) {
      const largeMatches = html.matchAll(/"large"\s*:\s*"(https:\/\/[^"]+)"/g)
      for (const match of largeMatches) {
        if (match[1]) addUniqueImage(match[1])
      }
    }

    // Method 3: Extract from data-a-dynamic-image attribute
    if (imageSet.size === 0) {
      const landingImage = $("#landingImage, #imgBlkFront, #main-image")
      const dynamicAttr = landingImage.attr("data-a-dynamic-image")
      if (dynamicAttr) {
        try {
          const imgObj = JSON.parse(dynamicAttr)
          const urls = Object.keys(imgObj).sort((a, b) => {
            const aRes = (imgObj[a]?.[0] || 0) * (imgObj[a]?.[1] || 0)
            const bRes = (imgObj[b]?.[0] || 0) * (imgObj[b]?.[1] || 0)
            return bRes - aRes
          })
          urls.forEach(url => addUniqueImage(url))
        } catch (e) {
          console.log("Failed to parse dynamic image:", e)
        }
      }
    }

    // Method 4: Fallback - get from altImages thumbnails
    if (imageSet.size === 0) {
      $("#altImages li.imageThumbnail img, #imageBlock img").each((_, el) => {
        let src = $(el).attr("data-old-hires") || $(el).attr("src") || ""
        src = src.replace(/\._[A-Z]{2}\d+_\./, ".").replace(/\._S[XY]\d+_\./, ".")
        addUniqueImage(src)
      })
    }

    const images = Array.from(imageSet).filter(url => url.length > 10)

    // Main image
    let mainImage = images.length > 0 ? images[0] : ""
    if (!mainImage) {
      mainImage = $("#landingImage").attr("data-old-hires") ||
        $("#landingImage").attr("src") || ""
      if (mainImage && !images.includes(mainImage)) images.push(mainImage)
    }

    // Brand
    const brand = $("#bylineInfo").text().replace(/Visit the|Store|Brand:|'s/gi, "").trim() ||
      $("a#bylineInfo").text().trim() ||
      $("#brand").text().trim() ||
      ""

    // Category / Breadcrumb
    const categories: string[] = []
    $("#wayfinding-breadcrumbs_feature_div a, .a-breadcrumb a").each((_, el) => {
      const cat = $(el).text().trim()
      if (cat && !categories.includes(cat)) categories.push(cat)
    })

    // Extract Category and SubCategory from breadcrumbs
    // Rule: Category is the first item (Department), SubCategory is the last item (Specific Niche)
    const scrapedCategory = categories.length > 0 ? categories[0] : "General"
    const scrapedSubCategory = categories.length > 1 ? categories[categories.length - 1] : ""

    // Legacy full path string (optional, but keeping it if needed for description or logs)
    const categoryPath = categories.join(" > ") || "General"

    // Use scraped values as defaults, but allow override if we decide to use the full path somewhere
    // For the 'category' variable used below, we'll default to the scraped top-level category
    const category = scrapedCategory

    // ===== ABOUT THIS ITEM =====
    const aboutItems: string[] = []
    $("#feature-bullets ul li span.a-list-item").each((_, el) => {
      const item = $(el).text().trim()
      if (item && item.length > 5 && !item.toLowerCase().includes("see more") && !item.includes("›")) {
        aboutItems.push(item)
      }
    })

    // ===== PRODUCT DESCRIPTION =====
    let productDescription = ""
    const descParagraphs: string[] = []
    $("#productDescription p, #productDescription_feature_div p").each((_, el) => {
      const text = $(el).text().trim()
      if (text) descParagraphs.push(text)
    })
    productDescription = descParagraphs.join("\n\n")

    // ===== TECHNICAL DETAILS =====
    const technicalDetails: Record<string, string> = {}

    // Table format 1: #productDetails_techSpec_section_1
    $("#productDetails_techSpec_section_1 tr, #productDetails_techSpec_section_2 tr").each((_, row) => {
      const key = $(row).find("th").text().trim().replace(/\s+/g, " ")
      const value = $(row).find("td").text().trim().replace(/\s+/g, " ")
      if (key && value) technicalDetails[key] = value
    })

    // Table format 2: Technical specifications
    $(".prodDetTable tr, #technicalSpecifications_section_1 tr").each((_, row) => {
      const key = $(row).find("th, td.label").first().text().trim().replace(/\s+/g, " ")
      const value = $(row).find("td.value, td:last-child").text().trim().replace(/\s+/g, " ")
      if (key && value && key !== value) technicalDetails[key] = value
    })

    // ===== ADDITIONAL INFORMATION =====
    const additionalInfo: Record<string, string> = {}

    // Detail bullets format
    $("#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr").each((_, el) => {
      const text = $(el).text().trim()
      // Split by colon or special characters
      const colonIdx = text.indexOf(":")
      if (colonIdx > 0) {
        const key = text.substring(0, colonIdx).replace(/[‏\u200f\u200e]/g, "").trim()
        const value = text.substring(colonIdx + 1).replace(/[‏\u200f\u200e]/g, "").trim()
        if (key && value && key.length < 100) additionalInfo[key] = value
      }
    })

    // ===== FROM THE MANUFACTURER - TEXT =====
    let manufacturerInfo = ""
    const mfrContent: string[] = []
    $("#aplus_feature_div p, #aplus3p_feature_div p, .apm-tablemodule p, .aplus-v2 p").each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.length > 10) mfrContent.push(text)
    })
    manufacturerInfo = mfrContent.slice(0, 15).join("\n\n")

    // ===== FROM THE MANUFACTURER - IMAGES (STRICT A+ CONTENT ONLY) =====
    const manufacturerImagesSet = new Set<string>()
    const seenMfrUrls = new Set<string>()

    // Helper to validate and add manufacturer image - STRICT filtering
    const addMfrImage = (rawSrc: string) => {
      if (!rawSrc || rawSrc.length < 50) return false

      // MUST be an Amazon image URL
      if (!rawSrc.includes("amazon.com") && !rawSrc.includes("ssl-images-amazon")) return false

      // Skip non-content images (icons, sprites, placeholders, etc.)
      const skipPatterns = [
        "sprite", "grey-pixel", "loading", "transparent-pixel", "play-icon",
        "video", "icon", "badge", "logo", "arrow", "button", "checkbox",
        "star", "prime", "shipping", "cart", "wishlist", "share", "review",
        "thumb", "small", "tiny", "mini", "_SS40_", "_SS50_", "_SS75_", "_SS100_",
        "_AC_US40_", "_AC_US100_", "blank", "spacer", "pixel"
      ]

      const lowerSrc = rawSrc.toLowerCase()
      if (skipPatterns.some(pattern => lowerSrc.includes(pattern))) return false

      // MUST be from A+ content paths (aplus-media or standard product images in A+ sections)
      // This is the key filter - only accept aplus-media URLs or images we can verify are in A+ content
      const isAplusMedia = rawSrc.includes("aplus-media") || rawSrc.includes("aplus-seller-content")

      // Normalize URL for dedup
      let normalizedUrl = rawSrc
        .replace(/\._[A-Z]{2}\d+[_,]?\./, ".")
        .replace(/\._S[XY]\d+[_,]?\./, ".")
        .replace(/\._U[SL]\d+[_,]?\./, ".")
        .replace(/\._CR\d+,\\d+,\\d+,\\d+_\./, ".")
        .replace(/\._SS\d+_\./, ".")
        .split("?")[0]

      if (seenMfrUrls.has(normalizedUrl)) return false
      seenMfrUrls.add(normalizedUrl)

      manufacturerImagesSet.add(rawSrc.split("?")[0])
      return true
    }

    // STRICT: Only extract from actual A+ content containers (not product description, not feature bullets)
    const strictAplusSelectors = [
      "#aplus_feature_div",        // Main A+ content
      "#aplus3p_feature_div",      // Third-party A+ content
      "#aplusBrandStory_feature_div", // Brand story
      ".aplus-v2",                 // A+ v2 modules
    ]

    strictAplusSelectors.forEach(containerSel => {
      $(containerSel).find("img").each((_, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src") || ""

        // Only add if it looks like a meaningful content image (not tiny icons)
        // Check for size indicators in URL - must be reasonably sized
        const hasLargeSize = src.includes("_SL") || src.includes("_AC_") ||
          src.includes("aplus-media") || src.includes("_UL") ||
          !src.match(/_[A-Z]{2}\d{2,3}_/) // No size suffix = likely full size

        if (hasLargeSize || src.includes("aplus-media")) {
          addMfrImage(src)
        }
      })
    })

    // Extract from background images in A+ sections only
    strictAplusSelectors.forEach(containerSel => {
      $(containerSel).find("[style*='background-image']").each((_, el) => {
        const style = $(el).attr("style") || ""
        const urlMatch = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/)
        if (urlMatch && urlMatch[1]) {
          addMfrImage(urlMatch[1])
        }
      })
    })

    // PRIMARY METHOD: Extract aplus-media URLs from the full page (these are guaranteed to be manufacturer images)
    // aplus-media URLs are specifically for A+ Enhanced Brand Content
    const aplusMediaPattern = /"(https:\/\/m\.media-amazon\.com\/images\/S\/aplus-media[^"]+\.(?:jpg|png|webp|gif))"/gi
    const aplusMediaMatches = html.matchAll(aplusMediaPattern)
    for (const match of aplusMediaMatches) {
      if (match[1]) {
        // Only add if not a tiny icon (check for size in filename)
        const url = match[1]
        if (!url.includes("_SS") && !url.includes("icon") && !url.includes("logo")) {
          manufacturerImagesSet.add(url.split("?")[0])
          seenMfrUrls.add(url.split("?")[0])
        }
      }
    }

    // Also check for aplus-seller-content URLs
    const aplusSellerPattern = /"(https:\/\/m\.media-amazon\.com\/images\/S\/aplus-seller-content[^"]+\.(?:jpg|png|webp|gif))"/gi
    const aplusSellerMatches = html.matchAll(aplusSellerPattern)
    for (const match of aplusSellerMatches) {
      if (match[1]) {
        manufacturerImagesSet.add(match[1].split("?")[0])
        seenMfrUrls.add(match[1].split("?")[0])
      }
    }

    const manufacturerImages = Array.from(manufacturerImagesSet)

    // ===== WHAT'S INCLUDED / BOX CONTENTS =====
    const whatsIncluded: string[] = []

    // Try various selectors for box contents/what's included
    $("#whatsInTheBox li, .whats-in-the-box li, #boxContents li").each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.length > 2 && !whatsIncluded.includes(text)) whatsIncluded.push(text)
    })

    // Check in features/about section for "in the box" mentions
    aboutItems.forEach(item => {
      const lowerItem = item.toLowerCase();
      // Method 1: Check for explicit prefixes in bullet points (common pattern: "Included Components: X, Y, Z")
      if (lowerItem.startsWith("included components") || lowerItem.startsWith("in the box") || lowerItem.startsWith("package contains") || lowerItem.startsWith("box contents")) {
        // Extract content after the first colon or dash if present
        const separatorIndex = item.search(/[:\-]/);
        if (separatorIndex > -1) {
          const content = item.substring(separatorIndex + 1).trim();
          if (content && content.length > 1 && !whatsIncluded.includes(content)) whatsIncluded.push(content);
        } else {
          // If no clear separator, check if the whole bullet is just the header (e.g. "In The Box")
          // if it's longer, maybe the whole line is the content? e.g. "Included components are X and Y"
          if (item.length > 25 && !whatsIncluded.includes(item)) whatsIncluded.push(item);
        }
      }
      // Method 2: Check for loose containment (existing fallback)
      else if (lowerItem.includes("in the box") || lowerItem.includes("included") || lowerItem.includes("package contains")) {
        if (!whatsIncluded.includes(item)) whatsIncluded.push(item)
      }
    })

    // Check technical details for box contents AND Included Components
    const boxKeys = ["In The Box", "Package Contents", "Included Components", "What's in the Box", "Box Contents"]
    boxKeys.forEach(key => {
      if (technicalDetails[key]) {
        const boxContents = technicalDetails[key]
        // Split by comma, semicolon, or newline
        boxContents.split(/[,;\n]/).forEach(item => {
          const trimmed = item.trim()
          if (trimmed && trimmed.length > 1 && !whatsIncluded.includes(trimmed)) {
            whatsIncluded.push(trimmed)
          }
        })
        // Remove from technicalDetails since we're moving it to whatsIncluded
        delete technicalDetails[key]
      }
    })

    // Also check additionalInfo for included components
    boxKeys.forEach(key => {
      if (additionalInfo[key]) {
        const boxContents = additionalInfo[key]
        boxContents.split(/[,;\n]/).forEach(item => {
          const trimmed = item.trim()
          if (trimmed && trimmed.length > 1 && !whatsIncluded.includes(trimmed)) {
            whatsIncluded.push(trimmed)
          }
        })
        delete additionalInfo[key]
      }
    })

    // ===== RETURN POLICY (Default - Not Scraped) =====
    const returnPolicy = `No Return Policy

Please note that all sales are final. We do not accept returns, exchanges, or cancellations once an order has been placed and processed.

Exceptions:
• Returns are only accepted for items that arrive damaged or defective
• Proof of damage or defect must be provided within 48 hours of delivery
• Original packaging and invoice must be retained for verification

How to Report an Issue:
• Contact our customer service team within 48 hours of receiving your order
• Provide your order number and clear photos of the damaged or defective item
• Our support team will review your request and guide you through the resolution process`

    // ===== CUSTOMER REVIEWS SUMMARY =====
    const reviewsSummary: Record<string, any> = {}

    // Overall rating
    const ratingText = $(".a-icon-alt").first().text()
    const ratingMatch = ratingText.match(/([\d.]+)\s*out of/)
    reviewsSummary.rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0

    // Review count
    const reviewCountText = $("#acrCustomerReviewText").text()
    const reviewCountMatch = reviewCountText.match(/([\d,]+)\s*rating/i)
    reviewsSummary.totalRatings = reviewCountMatch ? parseInt(reviewCountMatch[1].replace(/,/g, "")) : 0

    // Star distribution
    const starDistribution: Record<string, string> = {}
    $("#histogramTable tr, .cr-widget-Histogram tr").each((_, row) => {
      const stars = $(row).find("td:first-child a, .a-link-normal").first().text().trim()
      const percent = $(row).find(".a-text-right span, td:last-child").text().trim()
      if (stars && percent) starDistribution[stars] = percent
    })
    reviewsSummary.starDistribution = starDistribution

    // Extract reviews WITH their ratings (only 3+ star reviews)
    const customerReviews: Array<{ rating: number; text: string; title?: string }> = []
    $(".review, .a-section.review, #cm-cr-dp-review-list .review").each((_, reviewEl) => {
      // Extract star rating from the review element
      const starIconText = $(reviewEl).find(".a-icon-alt, .review-star-rating .a-icon-alt").first().text()
      const starMatch = starIconText.match(/([\d.]+)\s*out of/)
      const reviewRating = starMatch ? parseFloat(starMatch[1]) : 0

      // Only include reviews with rating >= 3
      if (reviewRating >= 3) {
        const reviewTitle = $(reviewEl).find(".review-title span:not(.a-icon-alt), .a-text-bold span").text().trim()
        const reviewText = $(reviewEl).find(".review-text-content span, .review-text span").text().trim()

        if (reviewText && reviewText.length > 20) {
          customerReviews.push({
            rating: reviewRating,
            title: reviewTitle || undefined,
            text: reviewText.substring(0, 500)
          })
        }
      }
    })

    // Limit to top 5 reviews
    reviewsSummary.customerReviews = customerReviews.slice(0, 5)

    // Keep legacy topReviews for backwards compatibility (also only 3+ star)
    reviewsSummary.topReviews = customerReviews.slice(0, 3).map(r => r.text)

    // ===== STOCK STATUS =====
    const availability = $("#availability span, #outOfStock span").text().trim().toLowerCase()
    const inStock = availability.includes("in stock") || availability.includes("available") || !availability.includes("out of stock")

    // ===== WARRANTY INFO =====
    let warranty = ""
    $(".warrantyLabel, #warranty-and-support span, #productSupportAndReturnPolicy-702702_feature_div").each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.toLowerCase().includes("warranty")) warranty = text
    })

    // Clean text helper
    const REPLACEMENT_WORD = process.env.AMAZON_SCRAPER_WORD || "Saramoblies"
    const cleanText = (text: string) => {
      if (!text) return ""
      // Regex to replace Amazon with Replacement Word (case insensitive)
      return text.replace(/Amazon/gi, REPLACEMENT_WORD)
    }

    // Clean basic fields
    const cleanedTitle = cleanText(title)
    const cleanedBrand = cleanText(brand)
    const cleanedCategory = cleanText(category)
    const cleanedDescription = cleanText(productDescription || aboutItems.join("\n"))
    const cleanedFeatures = aboutItems.map(item => cleanText(item))
    const cleanedWarranty = cleanText(warranty)
    const cleanedReturnPolicy = cleanText(returnPolicy)
    const cleanedManufacturerInfo = cleanText(manufacturerInfo)

    // Keys to ignore during scraping
    const IGNORED_KEYS = ["Best Sellers Rank", "Packer", "Importer", "Generic Name"]

    // Clean technical details (values only — keys stay verbatim so downstream
    // lookups by literal spec name keep working)
    const cleanedTechnicalDetails: Record<string, string> = {}
    Object.entries(technicalDetails).forEach(([k, v]) => {
      // Skip ignored keys
      if (IGNORED_KEYS.some(ignored => k.toLowerCase().includes(ignored.toLowerCase()))) return
      cleanedTechnicalDetails[k] = cleanText(v)
    })

    // Clean additional info
    const cleanedAdditionalInfo: Record<string, string> = {}
    Object.entries(additionalInfo).forEach(([k, v]) => {
      // Skip ignored keys
      if (IGNORED_KEYS.some(ignored => k.toLowerCase().includes(ignored.toLowerCase()))) return
      cleanedAdditionalInfo[k] = cleanText(v)
    })

    // Clean What's Included & Filter out summary items
    let cleanedWhatsIncluded = whatsIncluded.map(item => cleanText(item))
    if (cleanedWhatsIncluded.length > 1) {
      // Sort by length descending
      const sorted = [...cleanedWhatsIncluded].sort((a, b) => b.length - a.length)
      const longest = sorted[0]
      const others = sorted.slice(1)

      // Heuristic: If the longest item contains significantly more text and includes keywords or parts of others
      // often the "summary" item is just a concatenation or "Included: A, B, C"
      // We check if the longest item contains at least 2 of the other items (if there are others)
      let matchCount = 0
      others.forEach(o => {
        if (longest.includes(o)) matchCount++
      })

      // If it contains more than half of the other items, it's likely a summary list
      if (others.length > 0 && matchCount >= Math.ceil(others.length / 2)) {
        cleanedWhatsIncluded = cleanedWhatsIncluded.filter(i => i !== longest)
      }
    }

    // Clean Reviews
    const cleanedReviewsSummary = {
      ...reviewsSummary,
      customerReviews: (reviewsSummary.customerReviews as any[])?.map((r: any) => ({
        ...r,
        title: cleanText(r.title || ""),
        text: cleanText(r.text)
      })) || [],
      topReviews: (reviewsSummary.topReviews as string[])?.map((r: string) => cleanText(r)) || []
    }

    // Combine all specifications (after removing box content keys)
    const allSpecifications = { ...cleanedTechnicalDetails, ...cleanedAdditionalInfo }

    // Build the scraped Amazon data object
    const finalCategory = inputCategory || cleanedCategory
    const amazonData = {
      asin,
      amazonUrl: url,
      amazonName: cleanedTitle,
      amazonBrand: cleanedBrand,
      amazonCategory: finalCategory,
      amazonAboutThisItem: cleanedFeatures,
      amazonDescription: cleanedDescription,
      amazonTechnicalDetails: cleanedTechnicalDetails,
      amazonAdditionalInfo: cleanedAdditionalInfo,
      amazonManufacturerInfo: cleanedManufacturerInfo,
      amazonManufacturerImages: manufacturerImages,
      amazonWhatsIncluded: cleanedWhatsIncluded,
      amazonReturnPolicy: cleanedReturnPolicy,
      amazonReviewsSummary: cleanedReviewsSummary,
      amazonWarranty: cleanedWarranty,
      amazonPrice: price || mrp,
      amazonMrp: mrp || price,
      amazonImage: mainImage,
      amazonImages: images,
      amazonSpecifications: allSpecifications,
      amazonFeatures: cleanedFeatures,
      amazonRating: reviewsSummary.rating || 0,
      amazonReviewCount: reviewsSummary.totalRatings || 0,
      amazonInStock: inStock,
      scrapedAt: new Date().toISOString(),
    }


    const cleanedSubCategory = cleanText(scrapedSubCategory)

    // Build the preview product object (for frontend display)
    const scrapedProduct = {
      asin,
      sourceUrl: url,
      name: cleanedTitle,
      brand: cleanedBrand,
      category: finalCategory,
      subCategory: inputSubCategory || cleanedSubCategory || "",
      description: cleanedDescription,
      price: price || mrp,
      mrp: mrp || price,
      originalPrice: mrp || price,
      image: mainImage,
      images: images,
      specifications: allSpecifications,
      features: cleanedFeatures,
      rating: reviewsSummary.rating || 0,
      reviewCount: reviewsSummary.totalRatings || 0,
      stock: inStock ? 100 : 0,
      status: "active",
      source: "amazon-scraper",
      scrapedAt: new Date().toISOString(),
      // Extra fields for detailed view
      technicalDetails: cleanedTechnicalDetails,
      additionalInfo: cleanedAdditionalInfo,
      manufacturerInfo: cleanedManufacturerInfo,
      manufacturerImages,
      whatsIncluded: cleanedWhatsIncluded,
      returnPolicy: cleanedReturnPolicy,
      reviewsSummary: cleanedReviewsSummary,
      warranty: cleanedWarranty,
    }

    // Option to save directly to database using itemno as unique key
    // Option to save directly to database using itemno as unique key
    if (saveToDatabase && canonicalSku) {
      const db = await connectDB()
      const productsCollection = db.collection("products")

      // Find existing product by itemno
      const existing = await productsCollection.findOne({
        $or: [
          { sku: canonicalSku },
          { itemno: canonicalSku },
          { "raw.itemno": canonicalSku }
        ]
      })

      // Merge edited data if provided
      const finalData = editedData ? {
        ...amazonData,
        amazonName: editedData.name || amazonData.amazonName,
        amazonBrand: editedData.brand || amazonData.amazonBrand,
        amazonDescription: editedData.description || amazonData.amazonDescription,
        amazonPrice: editedData.price || amazonData.amazonPrice,
        amazonMrp: editedData.mrp || amazonData.amazonMrp,
        amazonTechnicalDetails: editedData.technicalDetails || amazonData.amazonTechnicalDetails,
        amazonManufacturerInfo: editedData.manufacturerInfo || amazonData.amazonManufacturerInfo,
        amazonManufacturerImages: editedData.manufacturerImages || amazonData.amazonManufacturerImages,
        amazonWhatsIncluded: editedData.whatsIncluded || amazonData.amazonWhatsIncluded,
        amazonFeatures: editedData.features || amazonData.amazonFeatures,
      } : amazonData

      if (existing) {
        const updateCanonical = extractCanonicalProductMetadata({
          itemno: canonicalSku,
          Name: editedData?.name || existing.name || cleanedTitle,
          Description: editedData?.description || existing.description || cleanedDescription || aboutItems.join("\n"),
          "Category/Group Name": inputCategory || existing.category || category,
          "sub-category/PROD DESC": inputSubCategory || existing.subCategory || scrapedSubCategory || "",
          "CHAR DESC": inputCharDesc || existing.char_desc || "",
          "Manufacturer Name": inputManufacturerName || existing.manufacturer_name || existing.manufacturerName || "",
        })
        const updateRaw = buildSchemaSynchronizedRaw(existing.raw || {}, updateCanonical)

        // Update existing product with Amazon data (prioritizing editedData)
        await productsCollection.updateOne(
          {
            $or: [
              { sku: canonicalSku },
              { itemno: canonicalSku },
              { "raw.itemno": canonicalSku }
            ]
          },
          {
            $set: {
              // Merge Amazon data into product
              ...finalData,
              sku: canonicalSku,
              itemno: canonicalSku,
              // Also update main fields - prefer edited, then existing, then scraped
              name: editedData?.name || existing.name || cleanedTitle,
              brand: editedData?.brand || existing.brand || cleanedBrand,
              category: inputCategory || existing.category || category,
              subCategory: inputSubCategory || existing.subCategory || scrapedSubCategory || "",
              description: editedData?.description || existing.description || cleanedDescription || aboutItems.join("\n"),
              mrp: editedData?.mrp || existing.mrp || (mrp || price),
              originalPrice: existing.originalPrice || (mrp || price),
              image: existing.image || mainImage,
              images: existing.images?.length > 0 ? existing.images : amazonData.amazonImages,
              specifications: { ...allSpecifications, ...(editedData?.technicalDetails || {}), ...(existing.specifications || {}) },
              features: [...new Set([...(editedData?.features || existing.features || []), ...cleanedFeatures])],
              prod_desc: inputProdDesc || existing.prod_desc || "",
              group_name: inputGroupName || existing.group_name || "",
              char_desc: inputCharDesc || existing.char_desc || "",
              manufacturer_name: inputManufacturerName || existing.manufacturer_name || "",
              manufacturerName: inputManufacturerName || existing.manufacturerName || "",
              // Without a stored slug, /product/[slug] cannot resolve the product.
              slug: existing.slug || generateProductSlug(editedData?.name || existing.name || cleanedTitle),
              raw: updateRaw,
              updatedAt: new Date().toISOString()
            }
          }
        )

        // Sync to product_specifications
        try {
          const finalCat = inputCategory || category || existing.category;
          const finalSub = inputSubCategory || scrapedSubCategory || existing.subCategory || "";

          console.log(`[Amazon Scraper] Syncing spec for SKU: ${canonicalSku}`);
          console.log(`[Amazon Scraper] Category: ${finalCat}, Sub: ${finalSub}`);

          const specsCollection = db.collection(SPECIFICATIONS_COLLECTION)
          const specDoc = buildSpecificationDocument({
            sku: canonicalSku,
            product_id: existing._id.toString(),
            category: finalCat,
            subCategory: finalSub,
            name: editedData?.name || cleanedTitle,
            mrp: editedData?.mrp || mrp || price,
            technical_details: editedData?.technicalDetails || allSpecifications,
            from_manufacturer: editedData?.manufacturerInfo || cleanedManufacturerInfo,
            gallery_images: amazonData.amazonImages,
            specification_images: editedData?.manufacturerImages || manufacturerImages,
            included_components: editedData?.whatsIncluded || cleanedWhatsIncluded,
            features: editedData?.features || cleanedFeatures,
            overview: editedData?.description || cleanedDescription,
            reviews: cleanedReviewsSummary,
            prod_desc: inputProdDesc,
            group_name: inputGroupName,
            char_desc: inputCharDesc,
            manufacturer_name: inputManufacturerName,
          })
          if (specDoc) {
            await specsCollection.updateOne({ sku: canonicalSku }, { $set: specDoc }, { upsert: true })
          }
        } catch (err) {
          console.error("Failed to sync specs:", err)
        }

        return NextResponse.json({
          success: true,
          product: { ...scrapedProduct, itemno: canonicalSku, sku: canonicalSku },
          action: "updated",
          message: `Amazon data linked to Item No: ${canonicalSku}`
        })
      } else {
        const createCanonical = extractCanonicalProductMetadata({
          itemno: canonicalSku,
          Name: editedData?.name || cleanedTitle,
          Description: editedData?.description || cleanedDescription || aboutItems.join("\n"),
          "Category/Group Name": finalCategory,
          "sub-category/PROD DESC": inputSubCategory || scrapedSubCategory || "",
          "CHAR DESC": inputCharDesc || "",
          "Manufacturer Name": inputManufacturerName || "",
        })
        const createRaw = buildSchemaSynchronizedRaw({}, createCanonical)

        // Create new product with itemno and Amazon data
        const result = await productsCollection.insertOne({
          itemno: canonicalSku,
          sku: canonicalSku,
          ...finalData,
          // Also set main fields
          name: editedData?.name || cleanedTitle,
          brand: editedData?.brand || cleanedBrand,
          slug: generateProductSlug(editedData?.name || cleanedTitle),
          category: finalCategory,
          subCategory: inputSubCategory || scrapedSubCategory || "",
          description: editedData?.description || cleanedDescription || aboutItems.join("\n"),
          price: editedData?.price || price || mrp,
          mrp: editedData?.mrp || mrp || price,
          originalPrice: mrp || price,
          image: mainImage,
          images: amazonData.amazonImages,
          specifications: editedData?.technicalDetails || allSpecifications,
          features: editedData?.features || cleanedFeatures,
          rating: reviewsSummary.rating || 0,
          reviewCount: reviewsSummary.totalRatings || 0,
          stock: inStock ? 100 : 0,
          active: active !== undefined ? active : true,
          status: "active",
          source: "amazon-scraper",
          prod_desc: inputProdDesc || "",
          group_name: inputGroupName || "",
          char_desc: inputCharDesc || "",
          manufacturer_name: inputManufacturerName || "",
          manufacturerName: inputManufacturerName || "",
          raw: createRaw,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

        // Sync to product_specifications
        try {
          const finalSub = inputSubCategory || scrapedSubCategory || "";

          console.log(`[Amazon Scraper] Syncing NEW spec for SKU: ${canonicalSku}`);

          const specsCollection = db.collection(SPECIFICATIONS_COLLECTION)
          const newSpecDoc = buildSpecificationDocument({
            sku: canonicalSku,
            product_id: result.insertedId.toString(),
            category: finalCategory,
            subCategory: finalSub,
            name: editedData?.name || cleanedTitle,
            mrp: editedData?.mrp || mrp || price,
            technical_details: editedData?.technicalDetails || allSpecifications,
            from_manufacturer: editedData?.manufacturerInfo || cleanedManufacturerInfo,
            gallery_images: amazonData.amazonImages,
            specification_images: editedData?.manufacturerImages || manufacturerImages,
            included_components: editedData?.whatsIncluded || cleanedWhatsIncluded,
            features: editedData?.features || cleanedFeatures,
            overview: editedData?.description || cleanedDescription,
            reviews: cleanedReviewsSummary,
            prod_desc: inputProdDesc,
            group_name: inputGroupName,
            char_desc: inputCharDesc,
            manufacturer_name: inputManufacturerName,
          })
          if (newSpecDoc) {
            await specsCollection.updateOne(
              { sku: canonicalSku },
              { $set: newSpecDoc, $setOnInsert: { createdAt: new Date() } },
              { upsert: true },
            )
          }
        } catch (err) {
          console.error("Failed to sync specs (new):", err)
        }

        return NextResponse.json({
          success: true,
          product: { ...scrapedProduct, itemno: canonicalSku, sku: canonicalSku, _id: result.insertedId },
          action: "created",
          message: `New product created with Item No: ${canonicalSku}`
        })
      }
    }

    return NextResponse.json({ success: true, product: scrapedProduct })

  } catch (error: any) {
    console.error("Scrape error:", error)

    if (error.response?.status === 503) {
      return NextResponse.json({
        success: false,
        error: "Amazon is blocking requests. Try again later or use a different product URL."
      }, { status: 503 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || "Failed to scrape product"
    }, { status: 500 })
  }
}
