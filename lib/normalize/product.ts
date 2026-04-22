/**
 * 제품/브랜드명 정규화.
 * 같은 제품을 일관되게 식별하기 위함.
 */

import type { OYProduct } from '@/lib/scrapers/oliveyoung'

export type ProductCategory = 'skincare' | 'makeup' | 'haircare' | 'bodycare' | 'mens' | 'innerbeauty'

export type NormalizedProduct = {
  brandName: string                       // 정규화된 브랜드명
  productName: string                     // 디스플레이용 제품명
  normalizedName: string                  // 검색/매칭용 (특수문자 제거, 소문자)
  variant: string                         // "100ml", "30매", "" 등
  category: ProductCategory | null        // 우리 enum (null이면 MVP 범위 외)
  subcategory: string | null              // 중카테고리 ("마스크팩")
}

// 올영 대카테고리 코드 → 우리 enum
const CATEGORY_MAP: Record<string, ProductCategory> = {
  '01': 'skincare',     // 스킨케어, 마스크팩, 클렌징, 선케어, 페이셜
  '02': 'makeup',       // 베이스, 립, 아이, 네일
  '04': 'bodycare',
  '05': 'haircare',
  // 08(식품), 09(패션 소품), 11(구강) 제외
}

export function normalizeBrandName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * 제품명 정제 — 브랜드 마케팅 노이즈 제거, variant 보존
 * "[슈브데 한정 10+1매 판매/15년 연속 1위] 메디힐 에센셜 마스크팩 10+1매 기획 7종 골라담기"
 * → "메디힐 에센셜 마스크팩"
 */
export function cleanProductName(raw: string, brand: string): string {
  let n = raw

  // 대괄호/소괄호 안의 마케팅 문구 제거
  n = n.replace(/\[[^\]]*\]/g, ' ')
  n = n.replace(/\([^)]*\)/g, ' ')

  // 브랜드명이 앞에 중복이면 1번만 유지
  const brandRe = new RegExp(`^\\s*${escapeRe(brand)}\\s*`, 'i')
  // (제거 X — 검색 가능성 위해 브랜드 유지)

  // 흔한 마케팅 단어 제거
  n = n.replace(/\b(기획|증정|특별|대용량|골라담기|7종|3종|2종|판매|한정|SALE|세일)\b/gi, ' ')

  // 멀티 공백 정리
  n = n.replace(/[+]/g, ' ').replace(/\s+/g, ' ').trim()

  return n
}

/**
 * 검색/매칭용 정규화 — 한글/영문/숫자만, 공백 단일화, 소문자
 */
export function normalizeForSearch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * variant 추출 — "100ml", "30매" 등
 */
export function extractVariant(rawName: string): string {
  // 우선순위: 매수 > 용량(ml/g) > 정/캡슐
  const patterns = [
    /(\d+(?:\+\d+)?매)/i,                  // "10+1매", "100매"
    /(\d+(?:\.\d+)?\s?ml)\b/i,             // "100ml", "50ml"
    /(\d+(?:\.\d+)?\s?g)\b/i,              // "200g"
    /(\d+(?:\.\d+)?\s?(?:정|캡슐|개))\b/i,
  ]
  for (const p of patterns) {
    const m = rawName.match(p)
    if (m) return m[1].replace(/\s/g, '').toLowerCase()
  }
  return ''
}

/**
 * 카테고리 breadcrumb에서 중카테고리(서브) 추출.
 * "01 > 마스크팩 > 시트팩" → "마스크팩" (또는 더 구체적인 시트팩)
 */
export function extractSubcategory(categoryFull: string): string | null {
  const parts = categoryFull.split('>').map((s) => s.trim())
  // [code, mid, sub]
  return parts[2] ?? parts[1] ?? null
}

export function normalizeOYProduct(p: OYProduct): NormalizedProduct {
  const brandName = normalizeBrandName(p.brand)
  const productName = cleanProductName(p.name, brandName)
  const normalizedName = normalizeForSearch(productName)
  const variant = extractVariant(p.name)
  const category = CATEGORY_MAP[p.categoryCode] ?? null
  const subcategory = extractSubcategory(p.categoryFull)

  return { brandName, productName, normalizedName, variant, category, subcategory }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
