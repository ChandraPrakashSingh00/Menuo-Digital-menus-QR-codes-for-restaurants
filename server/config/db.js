import mongoose from 'mongoose'

mongoose.set('strictQuery', true)

export async function connectDB(uri) {
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'))
  mongoose.connection.on('reconnected', () => console.info('[db] MongoDB reconnected'))

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  // Build declared indexes (unique email, unique slug, …) before serving traffic.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()))
  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
}
