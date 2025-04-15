export class CacheMap<TKey = string, TValue = any> extends Map<TKey, TValue> {
  remember(key: TKey, factory: (key: TKey) => TValue): TValue {
    let value = super.get(key)
    if (!value) {
      value = factory(key)
      this.set(key, value)
    }
    return value!
  }
}
