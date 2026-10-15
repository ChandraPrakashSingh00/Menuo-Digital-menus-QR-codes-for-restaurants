import { app, itemPayload, ownerWithRestaurant, request, useTestDatabase } from './helpers.js'
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'

useTestDatabase()

describe('restaurant ownership', () => {
  let alice
  let bob
  let aliceItem

  before(async () => {
    alice = await ownerWithRestaurant({ restaurantName: 'Alice Kitchen' })
    bob = await ownerWithRestaurant({ restaurantName: 'Bob Bistro' })
    const created = await alice.client.post(`/api/menu/${alice.restaurant.id}`, itemPayload(alice.category.id))
    assert.equal(created.status, 201)
    aliceItem = created.body.item
  })

  test('owners only see their own restaurants', async () => {
    const res = await bob.client.get('/api/restaurants/mine')
    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.restaurants.map((r) => r.id),
      [bob.restaurant.id],
    )
    assert.equal(res.body.restaurants[0].ownerId, undefined)
  })

  test("another owner's restaurant is not found", async () => {
    const id = alice.restaurant.id
    assert.equal((await bob.client.get(`/api/restaurants/${id}`)).status, 404)
    assert.equal((await bob.client.patch(`/api/restaurants/${id}`, { name: 'Hijacked' })).status, 404)
    assert.equal((await bob.client.get(`/api/restaurants/${id}/stats`)).status, 404)
    assert.equal((await bob.client.delete(`/api/restaurants/${id}`)).status, 404)
    assert.equal((await bob.client.get(`/api/subscriptions/current?restaurantId=${id}`)).status, 404)
    assert.equal((await bob.client.post('/api/subscriptions/checkout', { restaurantId: id, plan: 'pro' })).status, 404)

    const mine = await alice.client.get(`/api/restaurants/${id}`)
    assert.equal(mine.body.restaurant.name, 'Alice Kitchen')
  })

  test("another owner's menu cannot be read or changed", async () => {
    const rid = alice.restaurant.id
    assert.equal((await bob.client.get(`/api/menu/${rid}`)).status, 404)
    assert.equal((await bob.client.get(`/api/menu/${rid}/categories`)).status, 404)
    assert.equal((await bob.client.post(`/api/menu/${rid}`, itemPayload(alice.category.id))).status, 404)
    assert.equal((await bob.client.post(`/api/menu/${rid}/categories`, { name: 'Sneaky' })).status, 404)
    assert.equal((await bob.client.patch(`/api/menu/item/${aliceItem.id}`, { price: 1 })).status, 404)
    assert.equal((await bob.client.post(`/api/menu/item/${aliceItem.id}/duplicate`)).status, 404)
    assert.equal((await bob.client.delete(`/api/menu/item/${aliceItem.id}`)).status, 404)
    assert.equal((await bob.client.patch(`/api/menu/category/${alice.category.id}`, { name: 'Mine now' })).status, 404)
    assert.equal((await bob.client.delete(`/api/menu/category/${alice.category.id}`)).status, 404)
    assert.equal((await bob.client.put(`/api/menu/${bob.restaurant.id}/categories/order`, { ids: [alice.category.id] })).status, 400)

    const still = await alice.client.get(`/api/menu/${alice.restaurant.id}`)
    assert.equal(still.body.items.length, 1)
    assert.equal(still.body.items[0].price, 289)
  })

  test("items cannot be attached to another restaurant's category", async () => {
    const create = await bob.client.post(`/api/menu/${bob.restaurant.id}`, itemPayload(alice.category.id))
    assert.equal(create.status, 400)
    assert.equal(create.body.code, 'INVALID_CATEGORY')

    const own = await bob.client.post(`/api/menu/${bob.restaurant.id}`, itemPayload(bob.category.id))
    const move = await bob.client.patch(`/api/menu/item/${own.body.item.id}`, { categoryId: alice.category.id })
    assert.equal(move.status, 400)
  })

  test('mass assignment of ownership fields is rejected', async () => {
    const res = await bob.client.patch(`/api/restaurants/${bob.restaurant.id}`, { ownerId: alice.user.id })
    assert.equal(res.status, 400)
    const item = await bob.client.post(`/api/menu/${bob.restaurant.id}`, { ...itemPayload(bob.category.id), restaurantId: alice.restaurant.id })
    assert.equal(item.status, 400)
  })

  test('the menu slug is permanent', async () => {
    const res = await alice.client.patch(`/api/restaurants/${alice.restaurant.id}`, { slug: 'new-link' })
    assert.equal(res.status, 400)
    assert.equal(res.body.errors.slug, 'Unknown field')
  })

  test('invalid ids return 400 and anonymous calls 401', async () => {
    assert.equal((await alice.client.get('/api/restaurants/not-an-id')).status, 400)
    assert.equal((await alice.client.patch('/api/menu/item/123', { price: 2 })).status, 400)
    assert.equal((await request(app).get(`/api/menu/${alice.restaurant.id}`)).status, 401)
  })
})
