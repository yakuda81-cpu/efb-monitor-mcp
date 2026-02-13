# efb-monitor-mcp Coding Conventions

> Starter Level - TypeScript ESM MCP Server

---

## 1. Core Principles

- **Minimal Dependencies**: `@modelcontextprotocol/sdk` + `xlsx` only
- **TypeScript Strict**: `strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- **ESM**: `"type": "module"` in package.json, `import`/`export` syntax
- **Node 18+**: Native `fetch`, `AbortController` available

## 2. Naming

| Target | Convention | Example |
|--------|-----------|---------|
| Interfaces | PascalCase | `EFinanceCompany`, `EFinanceData` |
| Type aliases | PascalCase | `BusinessType` |
| Constants | UPPER_SNAKE_CASE | `FINE_BASE_URL`, `CACHE_TTL_MS` |
| Const objects | UPPER_SNAKE_CASE | `REG_COL`, `CAN_COL` |
| Functions | camelCase | `getEFinanceData`, `parseRegisteredSheet` |
| Variables | camelCase | `cachedData`, `dataDate` |
| Files | kebab-case | `fine-portal.ts`, `excel-parser.ts` |
| Env vars | UPPER_SNAKE_CASE | `FINE_PAGE_NTT_ID` |

## 3. Code Style

- Indentation: **2 spaces**
- Quotes: **double quotes** (`"`) - aligned with TypeScript/JSON conventions
- Semicolons: **required**
- Trailing commas: **yes**
- Line length: soft limit **100 chars**
- `as const` for literal arrays and objects
- `console.error` for logging (MCP uses stdout for protocol)

## 4. TypeScript Rules

- Prefer `interface` over `type` for object shapes
- Use `as const` for constant arrays/objects
- Use `Set<string>` for validation lookups
- Explicit return types on exported functions
- `unknown` over `any` for untyped data
- Non-null assertion (`!`) only after null check pattern

## 5. Project Structure

```
efb-monitor-mcp/
├── src/
│   ├── types.ts          # Constants, types, interfaces (shared leaf)
│   ├── fine-portal.ts    # FINE portal HTML fetch, Excel URL extraction
│   ├── excel-parser.ts   # Excel file download & sheet parsing
│   ├── cache.ts          # In-memory cache with TTL
│   ├── validation.ts     # Input validation for MCP tools
│   ├── formatters.ts     # Search result & statistics formatters
│   └── index.ts          # MCP server setup, tool handlers, main
├── docs/
│   ├── 01-plan/          # Glossary, schema
│   └── archive/          # Archived PDCA reports
├── .env.example          # Environment variable template
├── package.json
├── tsconfig.json
└── CONVENTIONS.md
```

## 6. Module Rules

### Dependency Direction
```
src/types.ts        ← leaf node (no src/ imports)
    ↑
src/fine-portal.ts  ← imports types only
src/excel-parser.ts ← imports types only
src/cache.ts        ← imports types only
src/validation.ts   ← imports types only
src/formatters.ts   ← imports types only

src/index.ts        ← imports all modules (entrypoint)
```

- `src/types.ts` is the **only shared module**
- No circular dependencies between modules
- Each module has a single responsibility

### Export Pattern
```typescript
// Named exports only (no default exports)
export function parseRegisteredSheet(...) { ... }
export function parseCancelledSheet(...) { ... }
```

### Import Pattern
```typescript
// External packages first
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as XLSX from "xlsx";

// Internal modules after blank line
import { FINE_BASE_URL, type EFinanceData } from "./types.js";
import { getEFinanceData } from "./cache.js";
```

**ESM Note**: Always use `.js` extension in import paths (TypeScript compiles `.ts` → `.js`).

## 7. Error Handling

- MCP errors: `throw new McpError(ErrorCode.*, message)`
- Internal errors: `console.error("[EFB] ...")` then wrap in McpError
- Never expose internal details in user-facing error messages
- Validation errors: `ErrorCode.InvalidParams`
- Server errors: `ErrorCode.InternalError`

## 8. Security

- **SSRF defense**: `FINE_ALLOWED_PATH_PREFIX` whitelist for download URLs
- **Input validation**: `MAX_COMPANY_NAME_LENGTH`, `VALID_BUSINESS_TYPES`, `VALID_STATUSES`
- **NTT ID validation**: `/^\d{1,10}$/` regex
- **Fetch redirect**: `redirect: "error"` (no automatic redirects)
- **Timeout**: `AbortController` with `FETCH_TIMEOUT_MS`
- **Logging**: `console.error` only (stdout reserved for MCP protocol)
