const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export class YouTubeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
  ) {
    super(message)
    this.name = 'YouTubeApiError'
  }
}

export class YouTubeClient {
  quotaUsed = 0

  constructor(private readonly apiKey: string) {}

  async get<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${BASE_URL}/${endpoint}`)
    url.searchParams.set('key', this.apiKey)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new YouTubeApiError(
        res.status,
        endpoint,
        body.error?.message ?? `HTTP ${res.status}`,
      )
    }
    return res.json() as T
  }
}
