// Development-only: creates a demo owner with "The Food Villa" restaurant and menu so
// the landing page's "See a live demo" link (/m/the-food-villa) works against the real API.
// Photos are served by the React app from client/public/images.
//
//   npm run seed:demo
//
// Refuses to run when NODE_ENV=production. Re-running is safe: existing data is left alone.

import bcrypt from 'bcryptjs'
import { config } from '../config/env.js'
import { connectDB, disconnectDB } from '../config/db.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import Restaurant from '../models/Restaurant.js'
import User from '../models/User.js'
import { createInitialSubscription } from '../services/subscriptionService.js'

if (config.isProduction) {
  console.error('seed:demo is for local development only.')
  process.exit(1)
}

const DEMO_EMAIL = 'demo@menuo.app'
const DEMO_PASSWORD = 'demo1234'

const DEMO_SLUG = 'the-food-villa'
const image = (path) => `${config.clientOrigins[0]}/images/${path}`

// [name, price, tags, description, photo, isAvailable]
const MENU = [
  {
    name: 'Pizza',
    description: 'Hand-stretched, wood-fired and loaded with cheese.',
    items: [
      ['Margherita Pizza', 279, ['veg', 'bestseller'], 'Fresh tomatoes, mozzarella, basil and olive oil.', 'margherita-pizza'],
      ['Farmhouse Pizza', 349, ['veg'], 'Capsicum, onion, mushroom, sweet corn and black olives on a cheesy base.', 'farmhouse-pizza'],
      ['Tandoori Paneer Pizza', 379, ['veg', 'spicy'], 'Tandoori-spiced paneer, red onion and capsicum with a mint mayo drizzle.', 'tandoori-paneer-pizza'],
    ],
  },
  {
    name: 'Burgers',
    description: 'Stacked high and served with our house sauce.',
    items: [
      ['Veg Burger', 159, ['veg', 'bestseller'], 'Crispy veg patty, lettuce, tomato and cheese in a toasted sesame bun.', 'veg-burger'],
      ['Crispy Chicken Burger', 219, ['non-veg'], 'Buttermilk fried chicken, crunchy slaw and smoky chipotle mayo.', 'chicken-burger'],
      ['Double Cheese Burger', 249, ['non-veg'], 'Two grilled patties, double cheddar, caramelised onions and pickles.', 'double-cheese-burger'],
    ],
  },
  {
    name: 'Pasta',
    description: 'Tossed to order in our signature sauces.',
    items: [
      ['Pasta Alfredo', 249, ['veg', 'bestseller'], 'Fettuccine in a rich parmesan cream sauce with garlic and herbs.', 'pasta-alfredo'],
      ['Penne Arrabbiata', 229, ['veg', 'spicy'], 'Penne in a fiery tomato, garlic and red chilli sauce.', 'penne-arrabbiata'],
      ['Prawn Spaghetti', 329, ['non-veg'], 'Spaghetti with garlic prawns, cherry tomatoes and chilli flakes.', 'prawn-spaghetti'],
    ],
  },
  {
    name: 'Sides',
    description: 'Perfect for sharing.',
    items: [
      ['French Fries', 99, ['veg', 'bestseller'], 'Golden, crispy and lightly salted.', 'french-fries'],
      ['Peri Peri Fries', 129, ['veg', 'spicy'], 'Fries tossed in tangy peri peri seasoning, served with a cheesy dip.', 'peri-peri-fries'],
      ['Garlic Bread', 119, ['veg'], 'Toasted baguette with garlic butter, herbs and mozzarella.', 'garlic-bread'],
    ],
  },
  {
    name: 'Drinks',
    description: 'Chilled, brewed and freshly shaken.',
    items: [
      ['Cold Coffee', 129, ['veg', 'bestseller'], 'Creamy blended coffee with a scoop of vanilla ice cream.', 'cold-coffee'],
      ['Cappuccino', 119, ['veg'], 'Double espresso with velvety steamed milk.', 'cappuccino'],
      ['Virgin Mojito', 139, ['vegan'], 'Fresh mint, lime and soda over crushed ice.', 'virgin-mojito'],
      ['Lemon Iced Tea', 99, ['vegan'], 'House-brewed black tea with lemon and a hint of mint.', 'iced-tea'],
    ],
  },
  {
    name: 'Desserts',
    description: 'Save some room.',
    items: [
      ['Chocolate Cake', 149, ['veg', 'bestseller'], 'Moist chocolate sponge layered with rich ganache.', 'chocolate-cake'],
      ['Chocolate Brownie', 129, ['veg'], 'Warm, fudgy brownie with a drizzle of chocolate sauce.', 'chocolate-brownie'],
      ['Raspberry Cream Cake', 169, ['veg'], 'Vanilla sponge with fresh cream and raspberries.', 'raspberry-cake', false],
    ],
  },
]

await connectDB(config.mongoUri)
try {
  let user = await User.findOne({ email: DEMO_EMAIL })
  if (!user) {
    user = await User.create({ name: 'Rahul Sharma', email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12) })
    console.info(`Created demo owner ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
  }

  if (await Restaurant.exists({ slug: DEMO_SLUG })) {
    console.info('Demo restaurant already exists — nothing to do.')
  } else {
    const restaurant = await Restaurant.create({
      ownerId: user._id,
      name: 'The Food Villa',
      slug: DEMO_SLUG,
      logo: image('restaurant-logo.webp'),
      cover: image('restaurant-cover.webp'),
      cuisine: 'Pizza · Burgers · Pasta · Desserts',
      description: 'Good food, great vibes — always. Wood-fired pizzas, stacked burgers and creamy pastas made fresh every day.',
      address: '27, Hauz Khas Village, New Delhi',
      phone: '+91 98110 45678',
      openingHours: '11:00 AM – 11:00 PM',
      brandColor: '#05805F',
    })
    for (const [index, section] of MENU.entries()) {
      const category = await Category.create({ restaurantId: restaurant._id, name: section.name, description: section.description, sortOrder: index })
      await MenuItem.insertMany(
        section.items.map(([name, price, tags, description, photo, isAvailable = true], position) => ({
          restaurantId: restaurant._id,
          categoryId: category._id,
          name,
          price,
          tags,
          description,
          imageUrl: image(`menu/${photo}.webp`),
          isAvailable,
          isFeatured: tags.includes('bestseller'),
          sortOrder: position,
        })),
      )
    }
    const subscription = await createInitialSubscription({ restaurant, planId: 'pro' })
    console.info(`Created /m/${DEMO_SLUG} (${subscription.status}${subscription.trialEndsAt ? ` until ${subscription.trialEndsAt.toDateString()}` : ''})`)
  }
} finally {
  await disconnectDB()
}
