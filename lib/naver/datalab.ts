const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search'

export type DatalabResult = {
  keyword: string
  data: { date: string; ratio: number }[]
}

type DatalabResponse = {
  results: {
    title: string
    data: { period: string; ratio: number }[]
  }[]
}

/**
 * 네이버 데이터랩 검색어 트렌드 API.
 * 최대 5개 키워드 그룹을 1회 호출로 조회.
 * 각 키워드의 일별 상대 검색량(0~100)을 반환.
 */
export async function fetchDatalabTrends(
  clientId: string,
  clientSecret: string,
  keywords: string[],
  startDate: string,  // 'YYYY-MM-DD'
  endDate: string,
): Promise<DatalabResult[]> {
  const keywordGroups = keywords.map((kw) => ({
    groupName: kw,
    keywords: [kw],
  }))

  const res = await fetch(DATALAB_URL, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: 'date',
      keywordGroups,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DataLab API HTTP ${res.status}: ${text}`)
  }

  const json = (await res.json()) as DatalabResponse
  return (json.results ?? []).map((r) => ({
    keyword: r.title,
    data: r.data.map((d) => ({ date: d.period, ratio: d.ratio })),
  }))
}
