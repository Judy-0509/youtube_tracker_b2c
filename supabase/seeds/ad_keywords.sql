-- ============================================================
-- 광고 키워드 사전 시드
-- 카테고리: direct (직접 광고 표기) / hashtag / market (마켓·판매 신호) / regex
-- 멱등: ON CONFLICT DO NOTHING (pattern unique)
-- ============================================================

insert into public.ad_keywords (category, pattern, notes) values
  -- ── 직접 광고 마커 (한국 공정위 가이드 기반) ──
  ('direct', '광고', '단독어 — false positive 가능성'),
  ('direct', '유료광고', NULL),
  ('direct', '유료 광고', NULL),
  ('direct', '협찬', NULL),
  ('direct', '협찬받음', NULL),
  ('direct', 'PPL', NULL),
  ('direct', '[광고]', NULL),
  ('direct', '(광고)', NULL),
  ('direct', '★광고★', NULL),
  ('direct', '[Ad]', NULL),
  ('direct', '[PR]', NULL),
  ('direct', '[유료광고]', NULL),
  ('direct', '[유료광고포함]', NULL),
  ('direct', '소정의 원고료', NULL),
  ('direct', '소정의 협찬', NULL),
  ('direct', '본 영상은 유료광고를 포함', NULL),
  ('direct', '본 콘텐츠는 광고를 포함', NULL),
  ('direct', '본 영상은 ㅇㅇ로부터 제공받았습니다', '템플릿 패턴'),
  ('direct', 'sponsored', NULL),
  ('direct', 'sponsor', NULL),
  ('direct', 'Includes paid promotion', 'YouTube 영문 표기'),

  -- ── 해시태그 ──
  ('hashtag', '#광고', NULL),
  ('hashtag', '#협찬', NULL),
  ('hashtag', '#유료광고', NULL),
  ('hashtag', '#AD', NULL),
  ('hashtag', '#sponsored', NULL),
  ('hashtag', '#PR', NULL),
  ('hashtag', '#ad', NULL),
  ('hashtag', '#광고포함', NULL),

  -- ── 마켓·판매 신호 (광고 표기 누락 흔함, weight ↓) ──
  ('market', '마켓', '"OO마켓 진행중" 패턴 — 협찬 추정'),
  ('market', '라방', NULL),
  ('market', '라이브방송', NULL),
  ('market', '라이브쇼핑', NULL),
  ('market', '라이브커머스', NULL),
  ('market', '공구', NULL),
  ('market', '공동구매', NULL),
  ('market', '공동 구매', NULL),
  ('market', '단독판매', NULL),
  ('market', '단독상품', NULL),
  ('market', '단독구성', NULL),
  ('market', '한정판매', NULL),
  ('market', '한정수량', NULL),
  ('market', '한정판', NULL),
  ('market', '사은품', NULL),
  ('market', '추가증정', NULL),
  ('market', '추가구성', NULL),
  ('market', '구매링크', NULL),
  ('market', '사러가기', NULL),
  ('market', '할인코드', NULL),
  ('market', '쿠폰코드', NULL),
  ('market', '프로모션코드', NULL),
  ('market', '첫구매 할인', NULL),
  ('market', '신규가입 혜택', NULL),
  ('market', '구매처', NULL),

  -- ── 정규식 패턴 ──
  ('regex', '\d+%\s?(할인|세일|DC)', '"20% 할인"'),
  ('regex', '구매링크.{0,20}(↓|⬇|아래)', '"구매링크 ↓"'),
  ('regex', '(쿠팡|네이버|올영|올리브영|무신사)\s(단독|특가|최저가)', '플랫폼 단독')
on conflict (pattern) do nothing;
