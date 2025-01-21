export interface RetryOptions {
  tries: number
  delay: number
  callback: () => Promise<any>
}

export async function retry<T>({ tries, delay, callback }) {
  retry: try {
    return await callback()
  } catch (err) {
    if (tries-- === 0) throw err

    // Wait a bit before trying again _ this exists for projects like
    // Nuxt that create a several tsconfig files at once
    await new Promise((resolve) => setTimeout(resolve, delay))

    break retry
  }
}
