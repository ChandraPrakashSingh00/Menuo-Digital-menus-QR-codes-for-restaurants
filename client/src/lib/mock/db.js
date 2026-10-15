// A tiny localStorage-backed database used by the mock API adapter (demo mode).
// Records use the same field names as the Express API's models (server/models), so the
// frontend behaves the same against the mock and the real backend.

const STORAGE_KEY = 'menuo_mock_db_v3'
// Older demo databases have a different shape; they are discarded, not migrated.
const LEGACY_STORAGE_KEYS = ['menuo_mock_db_v1', 'menuo_mock_db_v2']
// Stand-in for the API's HttpOnly session cookie: holds the signed-in user's id.
const SESSION_KEY = 'menuo_mock_session'

export const DEMO_CREDENTIALS = { email: 'demo@menuo.app', password: 'demo1234' }

export function uid(prefix = '') {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export function isoDay(date = new Date()) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString()
}

// Demo photos are bundled in client/public/images. Stored as absolute URLs because the API
// (and the mock adapter) only accept http(s) or data: image URLs.
const demoImage = (path) => `${window.location.origin}/images/${path}`

const DEMO_MENU = [
  {
    name: 'Pizza',
    description: 'Hand-stretched, wood-fired and loaded with cheese.',
    items: [
      { name: 'Margherita Pizza', price: 279, tags: ['veg', 'bestseller'], image: 'margherita-pizza', description: 'Fresh tomatoes, mozzarella, basil and olive oil.' },
      { name: 'Farmhouse Pizza', price: 349, tags: ['veg'], image: 'farmhouse-pizza', description: 'Capsicum, onion, mushroom, sweet corn and black olives on a cheesy base.' },
      { name: 'Tandoori Paneer Pizza', price: 379, tags: ['veg', 'spicy'], image: 'tandoori-paneer-pizza', description: 'Tandoori-spiced paneer, red onion and capsicum with a mint mayo drizzle.' },
    ],
  },
  {
    name: 'Burgers',
    description: 'Stacked high and served with our house sauce.',
    items: [
      { name: 'Veg Burger', price: 159, tags: ['veg', 'bestseller'], image: 'veg-burger', description: 'Crispy veg patty, lettuce, tomato and cheese in a toasted sesame bun.' },
      { name: 'Crispy Chicken Burger', price: 219, tags: ['non-veg'], image: 'chicken-burger', description: 'Buttermilk fried chicken, crunchy slaw and smoky chipotle mayo.' },
      { name: 'Double Cheese Burger', price: 249, tags: ['non-veg'], image: 'double-cheese-burger', description: 'Two grilled patties, double cheddar, caramelised onions and pickles.' },
    ],
  },
  {
    name: 'Pasta',
    description: 'Tossed to order in our signature sauces.',
    items: [
      { name: 'Pasta Alfredo', price: 249, tags: ['veg', 'bestseller'], image: 'pasta-alfredo', description: 'Fettuccine in a rich parmesan cream sauce with garlic and herbs.' },
      { name: 'Penne Arrabbiata', price: 229, tags: ['veg', 'spicy'], image: 'penne-arrabbiata', description: 'Penne in a fiery tomato, garlic and red chilli sauce.' },
      { name: 'Prawn Spaghetti', price: 329, tags: ['non-veg'], image: 'prawn-spaghetti', description: 'Spaghetti with garlic prawns, cherry tomatoes and chilli flakes.' },
    ],
  },
  {
    name: 'Sides',
    description: 'Perfect for sharing.',
    items: [
      { name: 'French Fries', price: 99, tags: ['veg', 'bestseller'], image: 'french-fries', description: 'Golden, crispy and lightly salted.' },
      { name: 'Peri Peri Fries', price: 129, tags: ['veg', 'spicy'], image: 'peri-peri-fries', description: 'Fries tossed in tangy peri peri seasoning, served with a cheesy dip.' },
      { name: 'Garlic Bread', price: 119, tags: ['veg'], image: 'garlic-bread', description: 'Toasted baguette with garlic butter, herbs and mozzarella.' },
    ],
  },
  {
    name: 'Drinks',
    description: 'Chilled, brewed and freshly shaken.',
    items: [
      { name: 'Cold Coffee', price: 129, tags: ['veg', 'bestseller'], image: 'cold-coffee', description: 'Creamy blended coffee with a scoop of vanilla ice cream.' },
      { name: 'Cappuccino', price: 119, tags: ['veg'], image: 'cappuccino', description: 'Double espresso with velvety steamed milk.' },
      { name: 'Virgin Mojito', price: 139, tags: ['vegan'], image: 'virgin-mojito', description: 'Fresh mint, lime and soda over crushed ice.' },
      { name: 'Lemon Iced Tea', price: 99, tags: ['vegan'], image: 'iced-tea', description: 'House-brewed black tea with lemon and a hint of mint.' },
    ],
  },
  {
    name: 'Desserts',
    description: 'Save some room.',
    items: [
      { name: 'Chocolate Cake', price: 149, tags: ['veg', 'bestseller'], image: 'chocolate-cake', description: 'Moist chocolate sponge layered with rich ganache.' },
      { name: 'Chocolate Brownie', price: 129, tags: ['veg'], image: 'chocolate-brownie', description: 'Warm, fudgy brownie with a drizzle of chocolate sauce.' },
      { name: 'Raspberry Cream Cake', price: 169, tags: ['veg'], image: 'raspberry-cake', description: 'Vanilla sponge with fresh cream and raspberries.', isAvailable: false },
    ],
  },
]

function buildSeed() {
  const now = new Date().toISOString()
  const userId = 'usr_demo'
  const restaurantId = 'rst_demo'

  const categories = []
  const items = []
  DEMO_MENU.forEach((category, categoryIndex) => {
    const categoryId = `cat_demo_${categoryIndex}`
    categories.push({
      id: categoryId,
      restaurantId,
      name: category.name,
      description: category.description,
      isVisible: true,
      sortOrder: categoryIndex,
      createdAt: now,
      updatedAt: now,
    })
    category.items.forEach((item, itemIndex) => {
      items.push({
        id: `itm_demo_${categoryIndex}_${itemIndex}`,
        restaurantId,
        categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: demoImage(`menu/${item.image}.webp`),
        tags: item.tags,
        isAvailable: item.isAvailable ?? true,
        isFeatured: item.tags.includes('bestseller'),
        sortOrder: itemIndex,
        createdAt: now,
        updatedAt: new Date(Date.now() - (categoryIndex * 4 + itemIndex) * 3600000).toISOString(),
      })
    })
  })

  const views = []
  for (let i = 29; i >= 0; i--) {
    const trend = 60 + (29 - i) * 3
    const weekend = [0, 6].includes(new Date(Date.now() - i * 86400000).getDay()) ? 45 : 0
    views.push({ restaurantId, date: isoDay(Date.now() - i * 86400000), count: Math.round(trend + weekend + Math.random() * 30) })
  }

  return {
    users: [
      {
        id: userId,
        name: 'Rahul Sharma',
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
        role: 'owner',
        // The demo restaurant already used this owner's one free trial.
        trialUsedAt: now,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    restaurants: [
      {
        id: restaurantId,
        ownerId: userId,
        name: 'The Food Villa',
        slug: 'the-food-villa',
        logo: demoImage('restaurant-logo.webp'),
        cover: demoImage('restaurant-cover.webp'),
        brandColor: '#05805F',
        description: 'Good food, great vibes — always. Wood-fired pizzas, stacked burgers and creamy pastas made fresh every day.',
        cuisine: 'Pizza · Burgers · Pasta · Desserts',
        address: '27, Hauz Khas Village, New Delhi',
        phone: '+91 98110 45678',
        email: 'hello@thefoodvilla.in',
        openingHours: '11:00 AM – 11:00 PM',
        currency: 'INR',
        isPublished: true,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    categories,
    items,
    subscriptions: [
      {
        id: 'sub_demo',
        restaurantId,
        ownerId: userId,
        plan: 'pro',
        status: 'trialing',
        trialStartedAt: now,
        trialEndsAt: daysFromNow(7),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        gatewaySubscriptionId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    views,
  }
}

let cache = null

export function getDb() {
  if (cache) return cache
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) cache = JSON.parse(raw)
  } catch {
    cache = null
  }
  if (!cache) {
    cache = buildSeed()
    // Store the seed right away so trial dates and view counts stay the same across reloads.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch {
      // Storage unavailable: the demo still works in memory for this page load.
    }
  }
  return cache
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Drop the unsaved in-memory change so the cache matches what is stored.
    cache = null
    throw Object.assign(new Error('Browser storage is full. Try using smaller images.'), { status: 507, code: 'STORAGE_FULL' })
  }
}

export function resetDb() {
  cache = buildSeed()
  saveDb()
  clearSession()
}

// ---------- session (emulates the API's HttpOnly cookie) ----------

export function getSession() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function setSession(userId) {
  try {
    localStorage.setItem(SESSION_KEY, userId)
  } catch {
    // Storage unavailable: the next request will be treated as signed out.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}

export { daysFromNow }
