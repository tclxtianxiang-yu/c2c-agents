# Fix Plan: shared <-> config Circular Dependency (Full Plan)

## Goal
Remove the package cycle between `@c2c-agents/shared` and `@c2c-agents/config` while keeping all chain and business logic correct.

## Root Cause
- `@c2c-agents/shared` imports constants from `@c2c-agents/config/constants`.
- `@c2c-agents/config` depends on `@c2c-agents/shared` by design.
- This creates a package cycle, which breaks the base-layer rule from `docs/CONTEXT.md`.

## Scope and Constraints
- Affected area: `packages/shared/src/chain/**` and `packages/config/src/constants.ts`.
- Restricted paths (Owner #1 only): `packages/shared/**`, `packages/config/**`.
- No behavior change expected; this is a refactor to fix package layering.

## Change Plan (Detailed)

### 1) Audit current imports
- Find all imports of `@c2c-agents/config` inside `packages/shared/src/**`.
- List each constant and where it is used.

### 2) Decide new ownership of constants
Use these rules:
- If a constant is used by core chain logic, move it into `@c2c-agents/shared`.
- If a constant is more about deployment or environment, pass it as a function parameter and keep it in `@c2c-agents/config`.

Candidate constants today:
- `DEFAULT_SEPOLIA_RPC_URL` (used by chain provider setup)
- `MIN_CONFIRMATIONS` (used by payment verification)
- `GAS_LIMITS`, `GAS_PRICE_MULTIPLIER`, `USDT_DECIMALS`, `ONE_USDT`, etc. (if referenced inside `shared`)

### 3) Refactor shared chain helpers
- Update `packages/shared/src/chain/contracts.ts`:
  - Remove `@c2c-agents/config/constants` import.
  - Use local defaults (in shared) or accept `rpcUrl` in options.
- Update `packages/shared/src/chain/payment-verification.ts`:
  - Remove `MIN_CONFIRMATIONS` import.
  - Accept `minConfirmations` as a parameter with a safe default in shared.
- Update `packages/shared/src/chain/settlement.ts`:
  - Remove config imports.
  - Accept any gas or fee related values as params, or use shared constants.

### 4) Update config package (if needed)
- If a constant is moved to `shared`, re-export or import it from `@c2c-agents/shared` in `packages/config/src/constants.ts`.
- Keep public usage stable so other modules do not break.

### 5) Update internal docs and public docs
- Update `docs/INTERFACE.md` and `docs/owner1/INTERFACE.md` to show the new source of constants.
- If function signatures change, update call examples to include new parameters.

## Change List (Planned)
- `packages/shared/src/chain/contracts.ts`
- `packages/shared/src/chain/payment-verification.ts`
- `packages/shared/src/chain/settlement.ts`
- `packages/shared/src/index.ts` (if new exports are added)
- `packages/config/src/constants.ts` (if re-export is needed)
- `docs/INTERFACE.md`
- `docs/owner1/INTERFACE.md`

## Impact Analysis
### Direct impact
- `apps/api/src/modules/core/chain.service.ts` may need to pass new params if signatures change.
- Any module using `@c2c-agents/shared/chain` may need updates.

### Indirect impact
- Dev docs and examples must match new import paths.
- Build graph will become acyclic, which matches the base-layer rule.

## Test Plan
### Pre-check (before change)
- Confirm current cycle exists in imports.

### Verification checks (after change)
- Ensure no `@c2c-agents/config` imports remain in `packages/shared/src/**`:
  - `rg -n "@c2c-agents/config" packages/shared/src -S`
- Confirm package graph is acyclic:
  - run a scan script that checks package.json deps and source imports
  - the script must ignore comments to avoid false positives

### Scan Script Update (Comment-Safe)
- Update the internal scan script to strip comments before matching imports.
- Support both line comments (`// ...`) and block comments (`/* ... */`).
- Re-run the scan to confirm no self-cycle on `@c2c-agents/config`.

### Runtime and unit tests
- `pnpm --filter @c2c-agents/shared test` (chain tests)
- `pnpm --filter @c2c-agents/config test`
- `pnpm --filter @c2c-agents/api test` (if ChainService signature changes)

## Regression Plan
- Focus on payment verification, payout, refund, recordEscrow flows.
- Run the chain tests listed in `docs/owner1/PLAN.md` (Phase 3).
- Re-run any API core tests that call `@c2c-agents/shared/chain`.

## External Docs Updates
- `docs/INTERFACE.md`: update constants import source and usage examples.
- `docs/owner1/INTERFACE.md`: update ChainService usage notes if params change.
- If needed, add a short note in `docs/CONTEXT.md` to restate the base-layer rule.

## Rollout and Safety
- No data migration.
- No schema change.
- No contract change.
- Ship as a refactor with clear changelog entry.

## Risks and Mitigation
- Risk: callers miss new params.
  - Mitigation: keep defaults in shared and update docs/examples.
- Risk: tests do not cover all chain paths.
  - Mitigation: add or run core chain tests and API core tests.

## Owner Actions
- Owner #1 will implement and merge changes in restricted paths.
- Other owners only update their module code if signatures change.
