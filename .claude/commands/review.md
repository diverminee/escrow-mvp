Run a pre-commit review on all staged or recent changes.

Scope detection — check once at the start:
- `HAS_SOLIDITY` = diff contains files in `src/`, `test/`, or `script/`
- `HAS_FRONTEND` = `web/` directory exists AND has `package.json`
- `HAS_WEB_CHANGES` = diff contains files in `web/`
Skip any section that doesn't apply. Only report sections that were checked.

Steps:
1. Run `git diff` (or `git diff --cached` if staged) to see all changes
2. Read `.claude/lessons.md` — check every rule against the current diff (lessons check)
3. If `HAS_SOLIDITY`: Run `forge build --sizes` — confirm zero errors AND no contract exceeds 24KB (EIP-170)
4. If `HAS_SOLIDITY`: Run `forge test` — confirm all tests pass
5. If `HAS_SOLIDITY`: Run `forge fmt --check` — confirm code is formatted (fail if not, don't auto-fix)
6. If `HAS_WEB_CHANGES`: Run `cd web && pnpm lint` — confirm zero lint errors
7. Review each changed file against the applicable checklist sections below:

---

**1. Lessons Compliance** _(always run)_
- [ ] Read `.claude/lessons.md` and verify EVERY rule against the current changes
- [ ] If a rule is violated, flag as critical and cite the rule number
- [ ] If no rules exist yet, note "No accumulated rules — lessons.md is empty"

**2. Solidity Security** _(skip if not HAS_SOLIDITY)_
- [ ] `nonReentrant` on all external state-changing functions
- [ ] `whenNotPaused` on all external functions that handle user funds or state transitions
- [ ] Checks-effects-interactions pattern followed
- [ ] SafeERC20 used for all token transfers
- [ ] Custom errors used (not require strings)
- [ ] Events emitted for every state change
- [ ] No unchecked external calls without error handling
- [ ] Access control on admin functions (onlyOwner / modifiers)
- [ ] No dangerous patterns introduced: `delegatecall`, `selfdestruct`, `tx.origin`, `assembly`
  (the codebase uses none of these — any introduction requires explicit justification)

**3. Smart Contract Logic** _(skip if not HAS_SOLIDITY)_
- [ ] State machine transitions are valid (no impossible paths)
- [ ] ETH and ERC20 paths both handled where applicable
- [ ] Edge cases: zero amounts, zero addresses, self-referential parties (buyer == seller)
- [ ] Fee calculations use snapshotted rates, not live rates
- [ ] Contract sizes within 24KB limit (`forge build --sizes` output)

**4. Test Coverage** _(skip if not HAS_SOLIDITY)_
- [ ] Every NEW public/external function has at least one test
- [ ] Positive path tested (happy path works)
- [ ] Negative path tested (invalid inputs revert with correct custom error)
- [ ] Boundary conditions tested (e.g., exact tolerance limit, maturity edge, zero amount)
- [ ] If state transitions changed: tests cover all valid entry states AND all invalid entry states revert

**5. Code Quality** _(always run)_
- [ ] Changes are minimal — only what was asked
- [ ] No leftover debug code, `console.log`, or commented-out blocks
- [ ] If `HAS_SOLIDITY`: `forge fmt --check` passes (matches CI)
- [ ] If `HAS_WEB_CHANGES`: `pnpm lint` passes (matches CI)
- [ ] Function/variable naming follows existing codebase conventions

**6. Documentation Consistency** _(always run)_
If `HAS_SOLIDITY`, check for stale references in:
- [ ] `CLAUDE.md` — state lists, enum values, architecture descriptions, build commands
- [ ] `TRADE_FINANCE_ANALYSIS.md` — coverage percentages, code references (Appendix A), product status
If `HAS_FRONTEND`:
- [ ] `types/escrow.ts` — TypeScript enums and interfaces still mirror `EscrowTypes.sol`
- [ ] `web/src/lib/constants.ts` — domain constants (states, tiers, fees, timelocks) still match Solidity
Always:
- [ ] `.claude/todo.md` — completed items accurate, backlog reflects current state
If any doc is stale, update it or flag as a warning.

**7. Frontend Sync** _(skip if not HAS_FRONTEND)_
If `HAS_WEB_CHANGES`:
- [ ] `cd web && pnpm lint` — zero lint errors
- [ ] `cd web && pnpm typecheck` — zero type errors
- [ ] `cd web && pnpm build` — compiles successfully
If `HAS_SOLIDITY` (cross-domain sync):
- [ ] ABIs are up to date (`make sync-abi` or manual sync has been run)
- [ ] `types/escrow.ts` reflects any struct/enum changes
- [ ] `web/src/lib/constants.ts` reflects any new enum values or constant changes

**8. Git Hygiene** _(always run)_
Check `git status` for files that should NOT be committed:
- [ ] No build artifacts (`.next/`, `out/`, `cache/`, `broadcast/`)
- [ ] No environment files with secrets (`.env.local`, `.env` with private keys)
- [ ] No OS/editor artifacts (`.DS_Store`, `.vscode/settings.json` with local paths)
- [ ] No temporary files (`tsconfig.tsbuildinfo`, `*.log`, `.pnpm-debug.log`)
- [ ] New files are intentional — not accidentally created by tools or debugging
If new ignorable patterns found, add them to `.gitignore` before committing.

---

Report format:
```
Pre-Commit Review
=================
Scope: HAS_SOLIDITY=true/false, HAS_FRONTEND=true/false, HAS_WEB_CHANGES=true/false
Lessons: X rules checked, Y violations found

Section 1: Lessons Compliance     [PASS/FAIL]
Section 2: Solidity Security      [PASS/FAIL/SKIP]
Section 3: Smart Contract Logic   [PASS/FAIL/SKIP]
Section 4: Test Coverage          [PASS/FAIL/SKIP]
Section 5: Code Quality           [PASS/FAIL]
Section 6: Documentation          [PASS/FAIL]
Section 7: Frontend Sync          [PASS/FAIL/SKIP]
Section 8: Git Hygiene            [PASS/FAIL]

Issues:
  [CRITICAL] ...
  [WARNING] ...
  [NIT] ...

Verdict: READY TO COMMIT / DO NOT COMMIT (fix N critical issues first)
```

Severity guide:
- **CRITICAL**: Security vulnerability, missing tests for new code, broken state transitions, lessons.md violation — blocks commit
- **WARNING**: Stale documentation, missing edge case test, style inconsistency — should fix, doesn't block
- **NIT**: Minor naming preference, optional improvement — note for awareness, doesn't block
