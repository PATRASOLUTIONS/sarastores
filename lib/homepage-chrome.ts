// Fixed homepage header/footer content, verified against the public site on 2026-11-05.
// Edit here to change homepage contact details and navigation. Other pages use admin settings.
export const HOME_CHROME_SETTINGS = {
  "storeName": "Sara Mobiles and Electronics",
  "storePhone": "+91 90710 02220"
}

export const HOME_HEADER_CATEGORIES = [
  {
    "id": "Mobile",
    "name": "Mobiles"
  },
  {
    "id": "68eec65a4376548b5bdbea31",
    "name": "HOME APPLIANCES"
  },
  {
    "id": "68eec65a4376548b5bdbea32",
    "name": "PANEL"
  }
]

export const HOME_HEADER_BRANDS = [
  {
    "name": "APPLE",
    "count": 16
  },
  {
    "name": "SAMSUNG",
    "count": 21
  },
  {
    "name": "VIVO",
    "count": 20
  },
  {
    "name": "OPPO",
    "count": 36
  },
  {
    "name": "REALME",
    "count": 42
  }
]

const HOME_HEADER_PROMOTIONS = [
  {
    "id": "super-sunday",
    "title": "SARA Super Sunday",
    "href": "/super-sunday",
    "description": "Biggest Deals. Brighter Days.",
    "weekday": 0,
    "enabled": true
  },
  {
    "id": "full-moon",
    "title": "Full Moon Day",
    "href": "/products",
    "description": "Auspicious full moon day offers",
    "weekday": 1,
    "enabled": true
  }
]

export function homepageHeaderPromotion(at = new Date()) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(at)
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
  return HOME_HEADER_PROMOTIONS.find(promotion => promotion.enabled && promotion.weekday === weekday) || null
}
