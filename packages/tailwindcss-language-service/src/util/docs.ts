import fetch from 'isomorphic-unfetch'
import Cache from 'tmp-cache'
import AbortController from 'abort-controller'

interface Doc {
  title: string
  url: string
}

const cache = new Cache(30)

function encode(value: any): string {
  return encodeURIComponent(
    typeof value === 'string' ? value : JSON.stringify(value)
  )
}

export async function searchDocs(
  query: string,
  params: Record<string, unknown> = {},
  fetchOptions: RequestInit = {}
) {
  const paramString = Object.keys(params)
    .map((key) => `${key}=${encode(params[key])}`)
    .join('&')

  const cacheKey = `query=${query}&` + paramString
  const cached = cache.get(cacheKey)

  if (cached) return cached

  const res = await fetch(
    `https://bh4d9od16a-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=3df93446658cd9c4e314d4c02a052188&x-algolia-application-id=BH4D9OD16A`,
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            indexName: 'tailwindcss',
            query,
            params: paramString,
          },
        ],
      }),
      ...fetchOptions,
    }
  )

  const { results } = await res.json()

  cache.set(cacheKey, results[0].hits)

  return results[0].hits.map((hit) => ({
    ...hit,
    ...(hit.url
      ? { url: hit.url.replace(/#(content-wrapper|class-reference)$/, '') }
      : {}),
  }))
}

const classNameCache = {}

export async function getDocsForClassName(
  className: string,
  timeoutMs?: number
): Promise<Doc | undefined> {
  if (classNameCache[className]) return classNameCache[className]

  let hit
  const controller = new AbortController()
  const timeout = timeoutMs
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined

  try {
    const hits = await searchDocs(
      className,
      {
        hitsPerPage: 20,
        attributesToRetrieve: [
          'hierarchy.lvl1',
          'hierarchy.lvl4',
          'type',
          'url',
        ],
        attributesToSnippet: [],
        facetFilters: 'version:v2',
        distinct: 1,
      },
      { signal: controller.signal }
    )

    hit = hits.find((hit) => {
      return (
        hit.type === 'lvl4' &&
        hit.url.endsWith('#class-reference') &&
        hit.hierarchy.lvl4 === className
      )
    })
  } finally {
    clearTimeout(timeout)
  }

  if (hit) {
    classNameCache[className] = {
      title: hit.hierarchy.lvl1,
      url: hit.url.replace(/\/?#class-reference$/, ''),
    }
    return classNameCache[className]
  }

  return undefined
}
