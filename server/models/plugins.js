/** Serialises documents as `{ id, ...fields }` without `_id` / `__v`. */
export function toJSONPlugin(schema, { hide = [] } = {}) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id)
      delete ret._id
      for (const field of hide) delete ret[field]
      return ret
    },
  })
}

/**
 * Blocks hard deletes for financial records. Payments and subscriptions are kept
 * for accounting and dispute handling; archive the restaurant instead.
 */
export function preventDeletePlugin(schema, { modelName }) {
  const block = () => {
    throw new Error(`${modelName} records cannot be deleted. Archive the related restaurant instead.`)
  }
  schema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], { document: true, query: true }, block)
}
