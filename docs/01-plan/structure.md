# efb-monitor-mcp Structure Rules

> Module separation criteria and dependency rules

---

## 1. Module Separation Criteria

| Criteria | Rule |
|----------|------|
| Single Responsibility | Each module handles one concern |
| Size | Target: 30-120 lines per module |
| Shared state | Only `src/types.ts` provides shared constants/types |
| New module trigger | When a function group serves a distinct domain |

## 2. Target Modules

| Module | Responsibility | Dependencies |
|--------|---------------|-------------|
| `src/types.ts` | Constants, types, interfaces, env validation | (none) |
| `src/fine-portal.ts` | FINE portal HTML fetch, Excel URL extraction | types |
| `src/excel-parser.ts` | Excel download, sheet parsing (registered/cancelled) | types |
| `src/cache.ts` | In-memory cache with TTL, data orchestration | types, fine-portal, excel-parser |
| `src/validation.ts` | MCP tool input validation | types |
| `src/formatters.ts` | Search result and statistics text formatting | types |
| `src/index.ts` | MCP server setup, tool handlers, main() | all modules |

## 3. When to Create a New Module

- A new data source is added (e.g., another portal)
- A new MCP tool requires distinct business logic
- A module exceeds ~150 lines

## 4. When NOT to Create a New Module

- Single utility function → add to the relevant module
- Test helpers → keep in test files
- Type-only additions → add to types.ts
