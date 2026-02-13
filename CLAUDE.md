# efb-monitor-mcp

> 전자금융업 등록/말소 현황 조회 MCP 서버 - 금융감독원 FINE 포털 데이터 자동 수집

## Quick Start

```bash
npm install
npm run build
npm test          # 전체 테스트 실행
npm run test:coverage  # 커버리지 확인
```

## Architecture

```
src/types.ts          (leaf node - no imports)
    ▲    ▲    ▲    ▲    ▲
    │    │    │    │    └── src/formatters.ts
    │    │    │    └─────── src/validation.ts
    │    │    └──────────── src/cache.ts ──▶ fine-portal, excel-parser
    │    └───────────────── src/excel-parser.ts
    └────────────────────── src/fine-portal.ts

src/index.ts ──▶ all modules (MCP server entrypoint)
```

- `src/types.ts`는 유일한 공유 의존성 (다른 src/ 모듈 import 금지)
- 순환 참조 금지
- 의존성 방향: `index → cache → fine-portal/excel-parser → types`

## Module Rules

| Module | Responsibility | Lines |
|--------|---------------|:-----:|
| `src/types.ts` | 상수, 타입, 인터페이스, env 검증 | ~75 |
| `src/validation.ts` | MCP 도구 입력 검증 | ~43 |
| `src/formatters.ts` | 검색 결과/통계 포맷팅 | ~111 |
| `src/fine-portal.ts` | FINE 포털 HTML fetch, Excel URL 추출 | ~87 |
| `src/excel-parser.ts` | Excel 시트 파싱 (등록/말소) | ~161 |
| `src/cache.ts` | 인메모리 캐시 (TTL 6시간) + 오케스트레이션 | ~41 |
| `src/index.ts` | MCP 서버 설정, 도구 핸들러 | ~133 |

- 단일 파일 200줄 초과 시 분리 검토
- 파일당 한 가지 책임

## Coding Conventions

### TypeScript

- ESM only (`"type": "module"`, `.js` 확장자 import)
- strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`)
- 파일명: kebab-case (`fine-portal.ts`, `excel-parser.ts`)

### Naming

- 상수: `UPPER_SNAKE_CASE` (`FINE_BASE_URL`, `CACHE_TTL_MS`)
- 타입/인터페이스: `PascalCase` (`EFinanceCompany`, `BusinessType`)
- 함수: `camelCase` (`parseRegisteredSheet`, `filterCompanies`)
- MCP 응답: 한국어
- 로그: 한국어 (`[EFB] 파싱 완료`)

### Quotes

- 큰따옴표(`"`) 사용 (TypeScript ESM)

## Testing

### Framework: Vitest

- `tests/**/*.test.ts` — 소스 모듈별 1:1 대응
- `tests/fixtures/test-helpers.ts` — 팩토리 함수
- `index.ts`는 통합 테스트 범위 (단위 테스트 제외)

### Mocking Patterns

| 대상 | 방법 |
|------|------|
| global fetch | `vi.stubGlobal("fetch", vi.fn())` |
| 모듈 (cache 테스트) | `vi.doMock()` + `vi.resetModules()` + dynamic import |
| 시간 (TTL) | `vi.useFakeTimers()` + `vi.advanceTimersByTime()` |
| console.error | `vi.spyOn(console, "error").mockImplementation(() => {})` |

- `vi.mock()` 사용 금지 — ESM 환경에서 `vi.doMock()` 사용
- `restoreMocks: true` 설정으로 자동 정리

### Coverage

- 목표: Statements 85%+
- 현재: Statements 95.65%, Lines 98.9%

## Security Rules

- fetch 요청: `redirect: "error"` 필수 (SSRF 방어)
- 다운로드 URL: `FINE_ALLOWED_PATH_PREFIX` 경로 화이트리스트
- 환경변수 `FINE_PAGE_NTT_ID`: 숫자만 허용 (`/^\d{1,10}$/`)
- 입력 검증: `VALID_BUSINESS_TYPES`, `VALID_STATUSES` 화이트리스트 기반
- 에러 응답: 내부 정보 노출 금지 (일반 한국어 메시지)
- 타임아웃: `AbortController` 30초

## Environment Variables

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `FINE_PAGE_NTT_ID` | FINE 포털 게시글 ID (숫자만) | `63573` |

## Skills

| Skill | Description |
|-------|-------------|
| `verify-tests` | 테스트 커버리지, 모킹 패턴, 설정 정합성, 팩토리 동기화 검증 |

## Reference Docs

- `docs/01-plan/glossary.md` — 도메인 용어 정의
- `docs/01-plan/schema.md` — 데이터 구조, 엔티티, 관계
- `docs/01-plan/structure.md` — 모듈 분리 기준, 의존성 규칙
