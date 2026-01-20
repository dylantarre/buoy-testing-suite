# Buoy Self-Improvement Cycle

You are running an autonomous improvement cycle for Buoy, a design drift detection tool.

## CRITICAL CONSTRAINTS

❌ **DO NOT** add new features or framework support
❌ **DO NOT** refactor "for improvement"
❌ **DO NOT** expand scope beyond the task
✅ **ONLY** fix bugs in existing detection
✅ **ONLY** improve accuracy of existing scanners
✅ **ALWAYS** write tests BEFORE fixing code
✅ **ALWAYS** ensure ALL tests pass before committing

## Your Mission

1. Read the current improvement state
2. Pick the next task (a BUG to fix, not a feature to add)
3. Run baseline tests against real design system repos
4. **Write a failing test** that captures the bug
5. Fix the bug to make the test pass
6. Run ALL tests - every test must pass
7. **ONLY commit if tests pass AND metrics improved**
8. Update changelog with exactly what changed
9. Update state and exit

## Context

- **Buoy repo**: /Users/dylantarre/dev/buoy
- **Buoy Lab**: /Users/dylantarre/dev/buoy-lab
- **State file**: /Users/dylantarre/dev/buoy-lab/.improvement/state.json
- **Changelog**: /Users/dylantarre/dev/buoy-lab/.improvement/CHANGELOG.md
- **Logs**: /Users/dylantarre/dev/buoy-lab/.improvement/logs/

## Logging Structure

All logs go to `/Users/dylantarre/dev/buoy-lab/.improvement/logs/`:

```
logs/
├── runner-YYYY-MM-DD.log     # Runner activity log
├── cycle-N-task-id.log       # Individual cycle output
└── metrics-history.json      # Historical metrics for trend analysis
```

## Step-by-Step Process

### Step 1: Load State

Read `.improvement/state.json` to understand:
- What task is current (if any)
- What's next in the queue
- How many cycles have run
- Previous metrics for regression comparison

### Step 2: Select Task

If no current task, pick the highest priority pending task from the state.

### Step 3: Get Baseline Metrics (FAST MODE)

**Use cached results when available** to avoid redundant scans:

```bash
cd /Users/dylantarre/dev/buoy-lab

# Check for recent cached results (less than 1 hour old)
if [ -f results/chakra-ui/chakra-ui/test-run.json ]; then
  # Use cached metrics
  cat results/chakra-ui/chakra-ui/test-run.json | jq '.buoyOutput.scan'
else
  # Only scan ONE repo for quick iteration
  ./dist/cli.js run single chakra-ui/chakra-ui
fi
```

Record baseline:
- Components detected
- Tokens detected

**DO NOT re-scan unless you changed scanner code.**

### Step 4: Write a FAILING Test First (MANDATORY)

**You MUST write a test before writing any fix code.**

1. Find an existing test file for the area you're fixing
2. Add a new test case that captures the bug
3. Run the test - it MUST fail (proving the bug exists)
4. Save the test file

Example:
```typescript
// In packages/scanners/src/__tests__/react-scanner.test.ts
it('detects forwardRef with displayName assignment', () => {
  const code = `
    const Button = React.forwardRef((props, ref) => <button ref={ref} />);
    Button.displayName = 'Button';
  `;
  const result = scanComponents(code);
  expect(result).toContainEqual(expect.objectContaining({ name: 'Button' }));
});
```

Run the test to confirm it fails:
```bash
cd /Users/dylantarre/dev/buoy
pnpm test -- --grep "forwardRef with displayName"
```

### Step 5: Fix the Bug

Now fix the code to make your test pass:
- Scanner improvements: `/Users/dylantarre/dev/buoy/packages/scanners/src/`
- Token detection: `/Users/dylantarre/dev/buoy/packages/core/src/`
- CLI changes: `/Users/dylantarre/dev/buoy/apps/cli/src/`

After fixing, run ALL tests:
```bash
cd /Users/dylantarre/dev/buoy
pnpm build
pnpm test
```

**ALL tests must pass. If any test fails, fix it before proceeding.**

### Step 6: Verify Improvement (Single Repo)

```bash
cd /Users/dylantarre/dev/buoy-lab
# Use the SAME repo as baseline for fair comparison
./dist/cli.js run single chakra-ui/chakra-ui
```

### Step 7: Compare Metrics (CRITICAL)

Compare to baseline:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Components | X | Y | +/- Z |
| Tokens | X | Y | +/- Z |
| Coverage | X% | Y% | +/- Z% |

**DECISION GATE:**

```
IF after.components >= before.components
   AND after.tokens >= before.tokens
   AND after.coverage >= before.coverage
   AND (after.components > before.components
        OR after.tokens > before.tokens
        OR after.coverage > before.coverage)
THEN proceed to commit
ELSE abort and try different approach
```

In plain English:
- **NEVER regress** any metric
- **MUST improve** at least one metric
- If no improvement, do NOT commit - revise approach

### Step 8: Commit if Improved

Only if metrics improved and tests pass:

```bash
cd /Users/dylantarre/dev/buoy

# Bump patch version
npm version patch --no-git-tag-version

git add -A
git commit -m "feat(scanners): [task-id] - description

Before: X components, Y tokens, Z% coverage
After: X components, Y tokens, Z% coverage
Improvement: +N components, +M tokens

Tested against: chakra-ui, shadcn-ui, mantine

🤖 Generated by autonomous improvement loop
Cycle: #N"

# Push to GitHub after successful commit
git push origin main
```

### Step 9: Update Changelog

Append to `.improvement/CHANGELOG.md`:

```markdown
## Cycle N - YYYY-MM-DD HH:MM

### Task: [task-id] - [title]

**Changes:**
- [List of specific code changes]

**Metrics:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Components | X | Y | +Z |
| Tokens | X | Y | +Z |
| Coverage | X% | Y% | +Z% |

**Files Modified:**
- packages/scanners/src/git/react-scanner.ts
- (other files)

**Commit:** [short hash]

---
```

### Step 10: Update State

Update `.improvement/state.json`:
- Mark task completed (or failed)
- Record metrics (before AND after)
- Record commit hash
- Increment cycle count
- Update version number

### Step 11: Exit with Status

Print a summary:
```
IMPROVEMENT CYCLE COMPLETE
==========================
Task: [task-id]
Result: SUCCESS/FAILED/NO_IMPROVEMENT
Before: X components, Y tokens, Z% coverage
After: X components, Y tokens, Z% coverage
Version: 0.1.X → 0.1.Y
Commit: [hash]
Next: [next-task-id]

Logs: .improvement/logs/cycle-N-task-id.log
```

## Important Rules

1. **One task per cycle** - Do one thing well, then exit
2. **Measure everything** - Always capture before/after metrics
3. **NEVER regress** - If any metric goes down, don't commit
4. **Require improvement** - Must improve at least one metric to commit
5. **Document everything** - Changelog must explain what and why
6. **Bump version** - Every successful commit bumps patch version
7. **Leave state clean** - Always update state.json before exiting

## Error Handling

If something fails:
- Log the error to state.json with full details
- Log to `.improvement/logs/cycle-N-task-id.log`
- Increment attempt counter
- If 3 attempts fail, mark task as failed and move on
- Exit with non-zero code

If improvement doesn't work:
- Log what was tried and why it didn't help
- Revert changes: `git checkout .`
- Mark attempt, try different approach next cycle
- DO NOT commit non-improvements

## Regression Prevention Checklist

Before committing, verify ALL of these:

- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes
- [ ] Components detected >= baseline
- [ ] Tokens detected >= baseline
- [ ] Coverage >= baseline
- [ ] At least one metric improved
- [ ] No new TypeScript errors
- [ ] Changelog updated

If ANY check fails, abort the commit.

## Test Repos Strategy

**Goal: 100% detection on each repo before moving on.**

### How It Works

1. **Focus on ONE repo** until Buoy detects all its components/tokens
2. **Compare against ground truth** - manually count or use AST to verify
3. **Mark repo complete** when detection matches reality
4. **Move to next repo** in the registry
5. **Discover new repos** only when registry is exhausted

### Current Registry

Check `/Users/dylantarre/dev/buoy-lab/registry/repos.json` for all available repos.

```bash
# List all repos in registry
./dist/cli.js registry list --top 50

# See which are tested vs untested
./dist/cli.js registry stats
```

### Completion Tracking

Track in `.improvement/repo-progress.json`:
```json
{
  "repos": {
    "chakra-ui/chakra-ui": {
      "status": "complete",
      "expected": { "components": 2087, "tokens": 340 },
      "detected": { "components": 2087, "tokens": 340 },
      "completedAt": "2026-01-01"
    },
    "shadcn-ui/ui": {
      "status": "in_progress",
      "expected": { "components": 2500, "tokens": 50 },
      "detected": { "components": 2305, "tokens": 0 },
      "gaps": ["tokens not detected - uses CSS variables"]
    }
  }
}
```

### When to Discover New Repos

Only run discovery when ALL registry repos are complete:
```bash
# Check if we need more repos
./dist/cli.js registry stats

# If all tested and complete, discover more
./dist/cli.js discover search --min-stars 100
```

## Metrics History

Append each cycle's metrics to `.improvement/logs/metrics-history.json`:

```json
{
  "cycles": [
    {
      "cycle": 1,
      "timestamp": "2025-12-30T...",
      "task": "monorepo-detection",
      "before": { "components": 45, "tokens": 120, "coverage": 67 },
      "after": { "components": 52, "tokens": 120, "coverage": 71 },
      "committed": true,
      "version": "0.1.1"
    }
  ]
}
```

This enables trend analysis over time.

## Completion Criteria - When Is Work "Done"?

A scanner/feature is considered **COMPLETE** when:

### Per-Repo Completion
A repo is complete when:
```
detected.components >= expected.components  (100% detection)
AND detected.tokens >= expected.tokens
```

Track in `.improvement/repo-progress.json`:
```json
{
  "chakra-ui/chakra-ui": {
    "status": "complete",
    "expected": { "components": 100, "tokens": 50 },
    "detected": { "components": 100, "tokens": 50 },
    "coverage": 1.0
  }
}
```

### Per-Scanner Completion
A scanner is complete when:
1. All test repos for that scanner reach 100% detection
2. All unit tests pass
3. No regressions on other repos

### Focus Area Completion (for parallel daemon)
A focus area (e.g., "react-scanner") is done for THIS ROUND when:
1. One meaningful improvement was made AND committed
2. OR no improvement possible after 3 attempts
3. Move to next focus area

### Overall Project Completion
The improvement loop should STOP when:
1. All repos in registry are at 100% detection
2. No tasks remain with priority > 0
3. 3 consecutive cycles with no improvements

When complete, the agent should:
1. Update state.json with `status: "complete"`
2. Log final metrics to changelog
3. Exit with message: "Improvement target reached"

## Quick Mode vs Full Mode

**Quick Mode** (default for iteration):
- Single repo scan
- Use cached baseline
- Skip if no scanner changes
- ~2-3 minutes per cycle

**Full Mode** (for validation):
- All registry repos
- Fresh scans
- Full regression test
- ~15-30 minutes

Use `--quick` flag or set in state.json:
```json
{
  "mode": "quick",
  "quickModeRepo": "chakra-ui/chakra-ui"
}
```
