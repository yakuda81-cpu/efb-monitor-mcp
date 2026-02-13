---
name: verify-tests
description: 테스트 커버리지, 모킹 패턴, 테스트-소스 매핑 검증. 테스트 파일 추가/수정 또는 소스 모듈 변경 후 사용.
---

## Purpose

1. **테스트 커버리지** — 모든 src/ 모듈(index.ts 제외)에 대응하는 테스트 파일이 존재하는지 확인
2. **모킹 안전성** — fetch 모킹은 stubGlobal, 모듈 모킹은 doMock+resetModules 패턴 준수
3. **테스트 독립성** — 각 테스트 파일이 독립 실행 가능한지, 모듈 상태 누수가 없는지 확인
4. **헬퍼 일관성** — test-helpers.ts의 팩토리 함수가 소스 타입과 동기화되어 있는지 확인
5. **설정 정합성** — vitest.config.ts와 package.json 스크립트가 올바르게 구성되어 있는지 확인

## When to Run

- 새 테스트 파일을 추가한 후
- src/ 모듈의 exported 함수나 타입을 변경한 후
- vitest.config.ts 또는 package.json 테스트 스크립트를 수정한 후
- test-helpers.ts의 팩토리 함수를 수정한 후
- 모킹 패턴을 변경하거나 새 모킹 전략을 도입한 후

## Related Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest 설정 (include 패턴, restoreMocks) |
| `package.json` | test/test:watch/test:coverage 스크립트 |
| `tests/fixtures/test-helpers.ts` | createCompany, createData 팩토리 함수 |
| `tests/validation.test.ts` | src/validation.ts 테스트 (19 cases) |
| `tests/formatters.test.ts` | src/formatters.ts 테스트 (21 cases) |
| `tests/fine-portal.test.ts` | src/fine-portal.ts 테스트 (12 cases) |
| `tests/excel-parser.test.ts` | src/excel-parser.ts 테스트 (19 cases) |
| `tests/cache.test.ts` | src/cache.ts 테스트 (6 cases) |
| `tests/types.test.ts` | src/types.ts 테스트 (16 cases) |
| `src/types.ts` | 공유 상수/타입 (leaf node) |
| `src/validation.ts` | MCP 입력 검증 |
| `src/formatters.ts` | 검색 결과/통계 포맷팅 |
| `src/fine-portal.ts` | FINE 포털 HTML fetch, Excel URL 추출 |
| `src/excel-parser.ts` | Excel 시트 파싱 |
| `src/cache.ts` | 인메모리 캐시 + 데이터 오케스트레이션 |

## Workflow

### Step 1: 테스트-소스 매핑 검증

**도구:** Glob, Bash

모든 src/ 모듈(index.ts 제외)에 대응하는 테스트 파일이 존재하는지 확인합니다.

```bash
for f in src/types.ts src/validation.ts src/formatters.ts src/fine-portal.ts src/excel-parser.ts src/cache.ts; do
  base=$(basename "$f" .ts)
  test="tests/${base}.test.ts"
  if [ ! -f "$test" ]; then echo "FAIL: $test missing for $f"; fi
done
```

**PASS:** 6개 소스 모듈 모두 대응 테스트 파일 존재
**FAIL:** 대응 테스트 파일이 없는 소스 모듈 발견 → 테스트 파일 생성 필요

### Step 2: 설정 정합성 검증

**도구:** Read, Grep

**2a.** `vitest.config.ts`에 `include: ["tests/**/*.test.ts"]`와 `restoreMocks: true`가 설정되어 있는지 확인

```bash
grep -c 'tests/\*\*/\*.test.ts' vitest.config.ts
grep -c 'restoreMocks.*true' vitest.config.ts
```

**2b.** `package.json`에 test 스크립트 3개가 존재하는지 확인

```bash
grep -c '"test":' package.json
grep -c '"test:watch":' package.json
grep -c '"test:coverage":' package.json
```

**PASS:** 설정값 모두 존재
**FAIL:** 누락된 설정 발견 → vitest.config.ts 또는 package.json 수정 필요

### Step 3: 모킹 패턴 안전성 검증

**도구:** Grep

**3a.** fetch 모킹은 반드시 `vi.stubGlobal("fetch", ...)` 패턴 사용 (global fetch 직접 할당 금지)

```bash
grep -rn "global.*fetch\s*=" tests/ | grep -v "stubGlobal"
```

**PASS:** 결과 0줄
**FAIL:** stubGlobal 없이 fetch를 직접 할당하는 코드 발견 → vi.stubGlobal 패턴으로 변경

**3b.** 모듈 모킹은 `vi.doMock` + `vi.resetModules` 조합 사용 (vi.mock 대신)

```bash
grep -rn "vi\.mock(" tests/ | grep -v "doMock"
```

**PASS:** 결과 0줄 (vi.mock 미사용, 모두 vi.doMock 사용)
**FAIL:** vi.mock 사용 발견 → ESM 환경에서 vi.doMock + resetModules로 변경

**3c.** vi.doMock 사용 시 beforeEach에 vi.resetModules 호출 존재 확인

```bash
grep -l "vi\.doMock" tests/*.test.ts | while read f; do
  if ! grep -q "vi\.resetModules" "$f"; then echo "FAIL: $f uses doMock without resetModules"; fi
done
```

**PASS:** doMock 사용 파일 모두 resetModules 포함
**FAIL:** resetModules 누락 → beforeEach에 추가 필요

### Step 4: fake timer 정리 검증

**도구:** Grep

vi.useFakeTimers 사용 시 vi.useRealTimers로 정리하는지 확인합니다.

```bash
grep -l "useFakeTimers" tests/*.test.ts | while read f; do
  if ! grep -q "useRealTimers" "$f"; then echo "FAIL: $f uses fakeTimers without cleanup"; fi
done
```

**PASS:** useFakeTimers 사용 파일 모두 useRealTimers 포함
**FAIL:** useRealTimers 누락 → 테스트 또는 afterEach에 추가 필요

### Step 5: 팩토리 함수 타입 동기화 검증

**도구:** Grep, Read

test-helpers.ts의 createCompany/createData가 src/types.ts의 인터페이스 필드를 모두 포함하는지 확인합니다.

```bash
grep -c "EFinanceCompany" tests/fixtures/test-helpers.ts
grep -c "EFinanceData" tests/fixtures/test-helpers.ts
```

**PASS:** 두 타입 모두 import 및 사용
**FAIL:** 소스 타입 변경 후 팩토리 함수 미동기화 → 필드 추가/수정 필요

### Step 6: 테스트 실행 검증

**도구:** Bash

전체 테스트가 통과하는지 확인합니다.

```bash
npm test
```

**PASS:** 모든 테스트 통과 (exit code 0)
**FAIL:** 실패한 테스트 존재 → 실패 원인 분석 및 수정

## Output Format

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | 테스트-소스 매핑 | PASS/FAIL | 누락된 테스트 파일 목록 |
| 2a | vitest.config.ts 설정 | PASS/FAIL | 누락된 설정 |
| 2b | package.json 스크립트 | PASS/FAIL | 누락된 스크립트 |
| 3a | fetch 모킹 패턴 | PASS/FAIL | 위반 파일:라인 |
| 3b | 모듈 모킹 패턴 | PASS/FAIL | vi.mock 사용 위치 |
| 3c | resetModules 동반 | PASS/FAIL | 누락 파일 |
| 4 | fake timer 정리 | PASS/FAIL | 누락 파일 |
| 5 | 팩토리 타입 동기화 | PASS/FAIL | 불일치 필드 |
| 6 | 테스트 실행 | PASS/FAIL | 실패 테스트 수 |

## Exceptions

다음은 **위반이 아닙니다**:

1. **index.ts에 대한 테스트 부재** — MCP 서버 엔트리포인트는 통합 테스트 범위이며 현재 단위 테스트에서 의도적으로 제외
2. **console.error spyOn의 반복** — excel-parser.test.ts에서 각 parseExcelData 테스트마다 `vi.spyOn(console, "error")`를 호출하는 것은 restoreMocks: true에 의해 자동 정리되므로 문제없음
3. **test-helpers.ts의 미사용 함수** — assertMcpError/assertMcpErrorAsync가 현재 테스트에서 사용되지 않더라도, 향후 테스트 확장을 위한 유틸리티로 유지 가능
