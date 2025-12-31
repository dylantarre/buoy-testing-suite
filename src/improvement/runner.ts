#!/usr/bin/env node
// src/improvement/runner.ts
// Autonomous improvement loop runner with regression prevention

import { spawn, SpawnOptions } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import {
  loadState,
  saveState,
  getNextTask,
  shouldContinue,
  getStateReport,
  createInitialState,
  type ImprovementState,
  type ImprovementTask,
} from './state.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SKILL_PROMPT_PATH = join(dirname(import.meta.url.replace('file://', '')), 'skill-prompt.md');
const IMPROVEMENT_DIR = join(process.cwd(), '.improvement');
const LOG_DIR = join(IMPROVEMENT_DIR, 'logs');
const CHANGELOG_PATH = join(IMPROVEMENT_DIR, 'CHANGELOG.md');
const METRICS_HISTORY_PATH = join(LOG_DIR, 'metrics-history.json');
const BUOY_REPO = '/Users/dylantarre/dev/buoy';
const TESTING_SUITE = '/Users/dylantarre/dev/buoy-testing-suite';

interface RunnerConfig {
  maxCycles: number;
  cooldownMs: number;
  dryRun: boolean;
  verbose: boolean;
  requireImprovement: boolean;
  minImprovementThreshold: number; // Minimum improvement in any metric to count as "meaningful"
}

const defaultConfig: RunnerConfig = {
  maxCycles: 10,
  cooldownMs: 5000,
  dryRun: false,
  verbose: true,
  requireImprovement: true,
  minImprovementThreshold: 1, // At least 1 more component/token or 1% coverage
};

interface Metrics {
  components: number;
  tokens: number;
  coverage: number;
}

interface CycleResult {
  success: boolean;
  improved: boolean;
  output: string;
  metrics?: {
    before: Metrics;
    after: Metrics;
  };
  commitHash?: string;
  version?: string;
  error?: string;
}

interface MetricsHistoryEntry {
  cycle: number;
  timestamp: string;
  task: string;
  before: Metrics;
  after: Metrics;
  committed: boolean;
  version: string;
  improvement: {
    components: number;
    tokens: number;
    coverage: number;
  };
}

interface MetricsHistory {
  cycles: MetricsHistoryEntry[];
}

// ============================================================================
// DIRECTORY & FILE SETUP
// ============================================================================

async function ensureDirectories(): Promise<void> {
  if (!existsSync(IMPROVEMENT_DIR)) {
    mkdirSync(IMPROVEMENT_DIR, { recursive: true });
  }
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  // Initialize changelog if it doesn't exist
  if (!existsSync(CHANGELOG_PATH)) {
    const header = `# Buoy Improvement Changelog

This file tracks every autonomous improvement cycle, what changed, and why.

---

`;
    writeFileSync(CHANGELOG_PATH, header);
  }

  // Initialize metrics history if it doesn't exist
  if (!existsSync(METRICS_HISTORY_PATH)) {
    writeFileSync(METRICS_HISTORY_PATH, JSON.stringify({ cycles: [] }, null, 2));
  }
}

// ============================================================================
// LOGGING
// ============================================================================

function getRunnerLogPath(): string {
  return join(LOG_DIR, `runner-${new Date().toISOString().split('T')[0]}.log`);
}

function getCycleLogPath(cycleNumber: number, taskId: string): string {
  return join(LOG_DIR, `cycle-${cycleNumber}-${taskId}.log`);
}

function log(message: string, verbose = false): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);

  // Also append to runner log file
  appendFileSync(getRunnerLogPath(), line + '\n');
}

function logToFile(filePath: string, content: string): void {
  appendFileSync(filePath, content);
}

// ============================================================================
// METRICS TRACKING
// ============================================================================

function loadMetricsHistory(): MetricsHistory {
  try {
    const content = readFileSync(METRICS_HISTORY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { cycles: [] };
  }
}

function saveMetricsHistory(history: MetricsHistory): void {
  writeFileSync(METRICS_HISTORY_PATH, JSON.stringify(history, null, 2));
}

function appendMetricsHistory(entry: MetricsHistoryEntry): void {
  const history = loadMetricsHistory();
  history.cycles.push(entry);
  saveMetricsHistory(history);
}

function getLastMetrics(): Metrics | null {
  const history = loadMetricsHistory();
  if (history.cycles.length === 0) return null;
  return history.cycles[history.cycles.length - 1].after;
}

// ============================================================================
// CHANGELOG
// ============================================================================

function appendChangelog(
  cycleNumber: number,
  task: ImprovementTask,
  metrics: { before: Metrics; after: Metrics },
  filesModified: string[],
  commitHash: string,
  version: string
): void {
  const timestamp = new Date().toISOString();
  const improvement = {
    components: metrics.after.components - metrics.before.components,
    tokens: metrics.after.tokens - metrics.before.tokens,
    coverage: metrics.after.coverage - metrics.before.coverage,
  };

  const entry = `
## Cycle ${cycleNumber} - ${timestamp}

### Task: ${task.id} - ${task.title}

**Description:** ${task.description}

**Changes:**
- ${task.description}

**Metrics:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Components | ${metrics.before.components} | ${metrics.after.components} | ${improvement.components >= 0 ? '+' : ''}${improvement.components} |
| Tokens | ${metrics.before.tokens} | ${metrics.after.tokens} | ${improvement.tokens >= 0 ? '+' : ''}${improvement.tokens} |
| Coverage | ${metrics.before.coverage}% | ${metrics.after.coverage}% | ${improvement.coverage >= 0 ? '+' : ''}${improvement.coverage}% |

**Files Modified:**
${filesModified.map(f => `- ${f}`).join('\n')}

**Version:** ${version}
**Commit:** \`${commitHash}\`

---
`;

  appendFileSync(CHANGELOG_PATH, entry);
}

// ============================================================================
// REGRESSION CHECKING
// ============================================================================

function checkRegression(before: Metrics, after: Metrics): { regressed: boolean; details: string } {
  const regressions: string[] = [];

  if (after.components < before.components) {
    regressions.push(`Components regressed: ${before.components} → ${after.components}`);
  }
  if (after.tokens < before.tokens) {
    regressions.push(`Tokens regressed: ${before.tokens} → ${after.tokens}`);
  }
  if (after.coverage < before.coverage) {
    regressions.push(`Coverage regressed: ${before.coverage}% → ${after.coverage}%`);
  }

  return {
    regressed: regressions.length > 0,
    details: regressions.join('; '),
  };
}

function checkMeaningfulImprovement(
  before: Metrics,
  after: Metrics,
  threshold: number
): { improved: boolean; details: string } {
  const improvements: string[] = [];

  const componentImprovement = after.components - before.components;
  const tokenImprovement = after.tokens - before.tokens;
  const coverageImprovement = after.coverage - before.coverage;

  if (componentImprovement >= threshold) {
    improvements.push(`Components: +${componentImprovement}`);
  }
  if (tokenImprovement >= threshold) {
    improvements.push(`Tokens: +${tokenImprovement}`);
  }
  if (coverageImprovement >= threshold) {
    improvements.push(`Coverage: +${coverageImprovement}%`);
  }

  return {
    improved: improvements.length > 0,
    details: improvements.length > 0
      ? `Improvements: ${improvements.join(', ')}`
      : 'No meaningful improvement detected',
  };
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function buildPrompt(state: ImprovementState, config: RunnerConfig): string {
  const skillPrompt = readFileSync(SKILL_PROMPT_PATH, 'utf-8');
  const nextTask = getNextTask(state);
  const lastMetrics = getLastMetrics();

  return `
${skillPrompt}

---

## Current State

\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

## Previous Metrics Baseline
${lastMetrics ? `
Components: ${lastMetrics.components}
Tokens: ${lastMetrics.tokens}
Coverage: ${lastMetrics.coverage}%

**Your changes must NOT regress any of these metrics.**
` : 'No previous metrics - this is the first cycle.'}

## Your Task This Cycle

${nextTask ? `
**Task ID**: ${nextTask.id}
**Title**: ${nextTask.title}
**Description**: ${nextTask.description}
**Priority**: ${nextTask.priority}
**Category**: ${nextTask.category}
**Attempts so far**: ${nextTask.attempts}

## Requirements

1. Run baseline tests FIRST and record metrics
2. Implement the improvement
3. Run tests AGAIN and compare
4. ONLY commit if:
   - All tests pass
   - No metric regressed
   - At least one metric improved by ${config.minImprovementThreshold}+
5. Update changelog with EXACTLY what changed
6. Bump version: \`npm version patch --no-git-tag-version\`

If the improvement doesn't help, revert and exit with status indicating no improvement.
` : 'No pending tasks. Report completion and exit.'}

## Log Locations (for your reference)

- Runner log: ${getRunnerLogPath()}
- Cycle log: ${getCycleLogPath(state.totalCycles + 1, nextTask?.id || 'unknown')}
- Changelog: ${CHANGELOG_PATH}
- Metrics history: ${METRICS_HISTORY_PATH}

Begin the improvement cycle now.
`.trim();
}

// ============================================================================
// CLAUDE EXECUTION
// ============================================================================

async function runClaudeCode(prompt: string, config: RunnerConfig): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const args = [
      '--print',  // Non-interactive mode
      '--prompt', prompt,
      '--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep',
      '--max-turns', '50',
    ];

    if (config.verbose) {
      log(`Spawning claude with prompt length: ${prompt.length}`);
    }

    const spawnOptions: SpawnOptions = {
      cwd: BUOY_REPO,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    };

    const child = spawn('claude', args, spawnOptions);

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (config.verbose) {
        process.stdout.write(text);
      }
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (config.verbose) {
        process.stderr.write(text);
      }
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout + stderr,
      });
    });

    child.on('error', (err) => {
      log(`Claude spawn error: ${err.message}`);
      resolve({
        success: false,
        output: err.message,
      });
    });
  });
}

// ============================================================================
// CYCLE EXECUTION
// ============================================================================

async function runCycle(config: RunnerConfig): Promise<CycleResult> {
  const state = loadState();

  if (!shouldContinue(state)) {
    log('No more tasks or too many failures. Stopping.');
    return { success: false, improved: false, output: 'No more tasks' };
  }

  const nextTask = getNextTask(state);
  if (!nextTask) {
    log('No pending tasks.');
    return { success: false, improved: false, output: 'No pending tasks' };
  }

  const cycleNumber = state.totalCycles + 1;
  const cycleLogPath = getCycleLogPath(cycleNumber, nextTask.id);

  log('='.repeat(60));
  log(`CYCLE ${cycleNumber}: ${nextTask.id}`);
  log('='.repeat(60));
  log(`Task: ${nextTask.title}`);
  log(`Log: ${cycleLogPath}`);

  // Build the prompt
  const prompt = buildPrompt(state, config);

  if (config.dryRun) {
    log('DRY RUN - Would execute Claude with prompt:');
    console.log(prompt.slice(0, 1000) + '...');
    return { success: false, improved: false, output: 'Dry run' };
  }

  // Run Claude Code
  const result = await runClaudeCode(prompt, config);

  // Log the full output
  writeFileSync(cycleLogPath, `
CYCLE ${cycleNumber}
Task: ${nextTask.id} - ${nextTask.title}
Started: ${new Date().toISOString()}
===================================

${result.output}

===================================
Completed: ${new Date().toISOString()}
Exit code: ${result.success ? 0 : 1}
`);

  // Update state
  state.totalCycles++;
  state.lastRun = new Date().toISOString();

  // Parse output for metrics and commit info
  // (Claude should print structured output that we can parse)
  const metricsMatch = result.output.match(/Before:\s*(\d+)\s*components,\s*(\d+)\s*tokens,\s*(\d+)%\s*coverage[\s\S]*?After:\s*(\d+)\s*components,\s*(\d+)\s*tokens,\s*(\d+)%\s*coverage/);
  const commitMatch = result.output.match(/Commit:\s*([a-f0-9]+)/i);
  const versionMatch = result.output.match(/Version:\s*([\d.]+)\s*→\s*([\d.]+)/);

  let cycleResult: CycleResult = {
    success: result.success,
    improved: false,
    output: result.output,
  };

  if (metricsMatch) {
    const before: Metrics = {
      components: parseInt(metricsMatch[1]),
      tokens: parseInt(metricsMatch[2]),
      coverage: parseInt(metricsMatch[3]),
    };
    const after: Metrics = {
      components: parseInt(metricsMatch[4]),
      tokens: parseInt(metricsMatch[5]),
      coverage: parseInt(metricsMatch[6]),
    };

    cycleResult.metrics = { before, after };

    // Check for regression
    const regression = checkRegression(before, after);
    if (regression.regressed) {
      log(`REGRESSION DETECTED: ${regression.details}`);
      cycleResult.success = false;
    }

    // Check for meaningful improvement
    const improvement = checkMeaningfulImprovement(before, after, config.minImprovementThreshold);
    cycleResult.improved = improvement.improved;

    if (!improvement.improved && config.requireImprovement) {
      log(`NO MEANINGFUL IMPROVEMENT: ${improvement.details}`);
    } else if (improvement.improved) {
      log(`IMPROVEMENT DETECTED: ${improvement.details}`);
    }

    // Record metrics history
    if (commitMatch) {
      cycleResult.commitHash = commitMatch[1];
    }
    if (versionMatch) {
      cycleResult.version = versionMatch[2];
    }

    const historyEntry: MetricsHistoryEntry = {
      cycle: cycleNumber,
      timestamp: new Date().toISOString(),
      task: nextTask.id,
      before,
      after,
      committed: cycleResult.success && cycleResult.improved,
      version: cycleResult.version || 'unknown',
      improvement: {
        components: after.components - before.components,
        tokens: after.tokens - before.tokens,
        coverage: after.coverage - before.coverage,
      },
    };

    appendMetricsHistory(historyEntry);
  }

  saveState(state);

  log(`Cycle complete. Success: ${result.success}. Improved: ${cycleResult.improved}`);
  log(`Full log: ${cycleLogPath}`);

  return cycleResult;
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function runLoop(config: RunnerConfig): Promise<void> {
  await ensureDirectories();

  log('');
  log('='.repeat(60));
  log('BUOY AUTONOMOUS IMPROVEMENT LOOP');
  log('='.repeat(60));
  log('');
  log('Configuration:');
  log(`  Max cycles: ${config.maxCycles}`);
  log(`  Cooldown: ${config.cooldownMs}ms`);
  log(`  Dry run: ${config.dryRun}`);
  log(`  Require improvement: ${config.requireImprovement}`);
  log(`  Min improvement threshold: ${config.minImprovementThreshold}`);
  log('');
  log('Logging:');
  log(`  Runner log: ${getRunnerLogPath()}`);
  log(`  Cycle logs: ${LOG_DIR}/cycle-N-taskid.log`);
  log(`  Changelog: ${CHANGELOG_PATH}`);
  log(`  Metrics history: ${METRICS_HISTORY_PATH}`);
  log('');
  log('='.repeat(60));

  let cyclesRun = 0;
  let successfulCycles = 0;
  let improvedCycles = 0;

  while (cyclesRun < config.maxCycles) {
    const state = loadState();

    if (!shouldContinue(state)) {
      log('Stopping: no more tasks or too many failures');
      break;
    }

    const result = await runCycle(config);
    cyclesRun++;

    if (result.success) {
      successfulCycles++;
    }
    if (result.improved) {
      improvedCycles++;
    }

    if (!result.success) {
      log('Cycle failed. Continuing to next task after cooldown...');
    }

    // Cooldown between cycles
    if (cyclesRun < config.maxCycles && shouldContinue(loadState())) {
      log(`Cooling down for ${config.cooldownMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, config.cooldownMs));
    }
  }

  // Final report
  const finalState = loadState();
  log('');
  log('='.repeat(60));
  log('FINAL REPORT');
  log('='.repeat(60));
  log('');
  log(`Cycles run: ${cyclesRun}`);
  log(`Successful: ${successfulCycles}`);
  log(`Improved: ${improvedCycles}`);
  log('');
  log(getStateReport(finalState));
  log('');
  log('Logs and documentation:');
  log(`  Runner log: ${getRunnerLogPath()}`);
  log(`  Changelog: ${CHANGELOG_PATH}`);
  log(`  Metrics history: ${METRICS_HISTORY_PATH}`);
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const config = { ...defaultConfig };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-cycles':
        config.maxCycles = parseInt(args[++i], 10);
        break;
      case '--cooldown':
        config.cooldownMs = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--quiet':
        config.verbose = false;
        break;
      case '--no-require-improvement':
        config.requireImprovement = false;
        break;
      case '--min-improvement':
        config.minImprovementThreshold = parseInt(args[++i], 10);
        break;
      case '--init':
        await ensureDirectories();
        const state = createInitialState();
        saveState(state);
        console.log('Initialized improvement state');
        console.log('');
        console.log('Locations:');
        console.log(`  State: ${join(IMPROVEMENT_DIR, 'state.json')}`);
        console.log(`  Logs: ${LOG_DIR}/`);
        console.log(`  Changelog: ${CHANGELOG_PATH}`);
        console.log(`  Metrics: ${METRICS_HISTORY_PATH}`);
        console.log('');
        console.log(getStateReport(state));
        return;
      case '--status':
        console.log(getStateReport(loadState()));
        console.log('');
        console.log('Recent metrics:');
        const history = loadMetricsHistory();
        const recent = history.cycles.slice(-5);
        for (const entry of recent) {
          const sign = (n: number) => n >= 0 ? '+' : '';
          console.log(`  Cycle ${entry.cycle}: ${entry.task}`);
          console.log(`    Components: ${sign(entry.improvement.components)}${entry.improvement.components}`);
          console.log(`    Tokens: ${sign(entry.improvement.tokens)}${entry.improvement.tokens}`);
          console.log(`    Coverage: ${sign(entry.improvement.coverage)}${entry.improvement.coverage}%`);
          console.log(`    Committed: ${entry.committed ? 'yes' : 'no'}`);
        }
        return;
      case '--help':
        console.log(`
Buoy Autonomous Improvement Runner

Usage: runner.js [options]

Options:
  --max-cycles <n>         Maximum cycles to run (default: 10)
  --cooldown <ms>          Cooldown between cycles (default: 5000)
  --dry-run                Print prompts without running Claude
  --quiet                  Less verbose output
  --no-require-improvement Allow commits that don't improve metrics
  --min-improvement <n>    Minimum improvement threshold (default: 1)
  --init                   Initialize state and directories
  --status                 Show current state and recent metrics
  --help                   Show this help

Logging Locations:
  Runner log:     .improvement/logs/runner-YYYY-MM-DD.log
  Cycle logs:     .improvement/logs/cycle-N-taskid.log
  Changelog:      .improvement/CHANGELOG.md
  Metrics:        .improvement/logs/metrics-history.json
  State:          .improvement/state.json

Regression Prevention:
  - Never commits if any metric regresses
  - Only commits if at least one metric improves
  - Tracks all metrics over time for trend analysis
  - Changelog documents exactly what changed and why
`);
        return;
    }
  }

  await runLoop(config);
}

main().catch(err => {
  console.error('Runner failed:', err);
  process.exit(1);
});
