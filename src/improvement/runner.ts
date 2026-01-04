#!/usr/bin/env node
// src/improvement/runner.ts
// Autonomous improvement loop runner with regression prevention

import { spawn, spawnSync, SpawnOptions } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';

// Ground truth loader
function loadGroundTruth(repo: string): { components: number; tokens: number } | null {
  const parts = repo.split('/');
  const owner = parts[0];
  const name = parts[1];
  if (!owner || !name) return null;
  const gtPath = join(process.cwd(), 'results', owner, name, 'ground-truth.json');

  if (!existsSync(gtPath)) {
    return null;
  }

  try {
    const gt = JSON.parse(readFileSync(gtPath, 'utf-8'));
    return {
      components: gt.components?.total ?? 0,
      tokens: gt.tokens?.total ?? 0,
    };
  } catch {
    return null;
  }
}
import {
  loadState,
  saveState,
  getNextTask,
  shouldContinue,
  getStateReport,
  createInitialState,
  type ImprovementState,
} from './state.js';
import { analyzeGap, formatGapAnalysisForPrompt } from './gap-analyzer.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SKILL_PROMPT_PATH = join(dirname(import.meta.url.replace('file://', '')), 'skill-prompt.md');
const IMPROVEMENT_DIR = join(process.cwd(), '.improvement');
const LOG_DIR = join(IMPROVEMENT_DIR, 'logs');
const CHANGELOG_PATH = join(IMPROVEMENT_DIR, 'CHANGELOG.md');
const METRICS_HISTORY_PATH = join(LOG_DIR, 'metrics-history.json');
const BUOY_REPO = '/Users/dylantarre/dev/buoy';

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

let clearStatusLine = () => {};  // Will be set by runClaudeCode

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;

  // Clear status line before printing
  clearStatusLine();
  console.log(line);

  // Also append to runner log file
  appendFileSync(getRunnerLogPath(), line + '\n');
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
  const lastCycle = history.cycles[history.cycles.length - 1];
  return lastCycle ? lastCycle.after : null;
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

${state.lastGapAnalysis ? formatGapAnalysisForPrompt(state.lastGapAnalysis) : ''}

Begin the improvement cycle now.
`.trim();
}

// ============================================================================
// CLAUDE EXECUTION
// ============================================================================

async function runClaudeCode(prompt: string, _config: RunnerConfig): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const args = [
      '--print',  // Non-interactive mode
      '--verbose',  // Required for stream-json output format
      '--output-format', 'stream-json',  // Stream output as it happens
      '--allowed-tools', 'Read,Write,Edit,Bash,Glob,Grep',
      '--dangerously-skip-permissions',  // Skip permission prompts for autonomous operation
    ];

    log(`Spawning claude with prompt length: ${prompt.length}`);
    log(`Working directory: ${BUOY_REPO}`);
    log('');
    log('📡 Live status (updates every 30s while Claude works):');
    log('─'.repeat(60));

    const spawnOptions: SpawnOptions = {
      cwd: BUOY_REPO,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    };

    const child = spawn('claude', args, spawnOptions);
    const startTime = Date.now();
    let toolCallCount = 0;
    let lastToolName = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    // Write prompt to stdin
    if (child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    // Heartbeat timer - single-line status that overwrites itself
    let lastStatusLength = 0;

    // Set up status line clearing for log messages
    clearStatusLine = () => {
      if (lastStatusLength > 0) {
        process.stdout.write('\r' + ' '.repeat(lastStatusLength) + '\r');
        lastStatusLength = 0;
      }
    };

    const updateStatus = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;

      // Check for file changes in Buoy repo
      const gitStatus = spawnSync('git', ['status', '--short'], { cwd: BUOY_REPO });
      const changes = gitStatus.stdout?.toString().trim() || '';
      const fileCount = changes ? changes.split('\n').length : 0;

      const tokenInfo = totalInputTokens + totalOutputTokens > 0
        ? ` | ${((totalInputTokens + totalOutputTokens) / 1000).toFixed(1)}k tokens`
        : '';

      const status = `⏱️  ${mins}m ${secs}s | ${toolCallCount} tools | ${fileCount} files${tokenInfo}${lastToolName ? ` | ${lastToolName}` : ''}`;

      // Clear previous line and write new status
      process.stdout.write('\r' + ' '.repeat(lastStatusLength) + '\r' + status);
      lastStatusLength = status.length;
    };

    const heartbeat = setInterval(updateStatus, 5000);  // Update every 5 seconds for smoother feel

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      // Parse stream-json output to show tool usage
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === 'assistant' && event.message?.content) {
            // Parse tool uses from assistant message
            for (const block of event.message.content) {
              if (block.type === 'tool_use') {
                toolCallCount++;
                lastToolName = block.name || 'unknown';
                log(`🔧 ${lastToolName}`);

                // Show relevant input details
                if (block.input) {
                  if (block.name === 'Read' && block.input.file_path) {
                    log(`   📄 ${block.input.file_path}`);
                  } else if (block.name === 'Write' && block.input.file_path) {
                    log(`   📝 ${block.input.file_path}`);
                  } else if (block.name === 'Edit' && block.input.file_path) {
                    log(`   ✏️  ${block.input.file_path}`);
                  } else if (block.name === 'Bash' && block.input.command) {
                    const cmd = block.input.command.substring(0, 60);
                    log(`   $ ${cmd}${block.input.command.length > 60 ? '...' : ''}`);
                  } else if (block.name === 'Grep' && block.input.pattern) {
                    log(`   🔍 "${block.input.pattern}"`);
                  } else if (block.name === 'Glob' && block.input.pattern) {
                    log(`   📂 ${block.input.pattern}`);
                  } else if (block.name === 'TodoWrite' && block.input.todos) {
                    const inProgress = block.input.todos.find((t: { status: string }) => t.status === 'in_progress');
                    if (inProgress) {
                      log(`   📋 ${inProgress.activeForm || inProgress.content}`);
                    }
                  }
                }
              } else if (block.type === 'text' && block.text) {
                // Show assistant thinking/text (first 120 chars)
                const text = block.text.trim().replace(/\n/g, ' ').substring(0, 120);
                if (text.length > 0) {
                  log(`💭 ${text}${block.text.length > 120 ? '...' : ''}`);
                }
              }
            }
          } else if (event.type === 'result') {
            if (event.subtype === 'success') {
              // Don't log every success, too noisy
            } else if (event.subtype === 'error') {
              log(`❌ Error: ${event.error || 'unknown error'}`);
            }
          }

          // Track token usage from assistant messages
          if (event.type === 'assistant' && event.message?.usage) {
            const usage = event.message.usage;
            totalInputTokens += usage.input_tokens || 0;
            totalOutputTokens += usage.output_tokens || 0;
            cacheReadTokens += usage.cache_read_input_tokens || 0;
            cacheWriteTokens += usage.cache_creation_input_tokens || 0;
          }

          // Show Bash command output, especially Buoy scans
          if (event.type === 'user' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_result' && block.content) {
                const content = typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content);

                // Check if this looks like Buoy output or test results
                const isBuoyOutput = content.includes('components') ||
                                     content.includes('tokens') ||
                                     content.includes('Scanning') ||
                                     content.includes('Coverage') ||
                                     content.includes('PASS') ||
                                     content.includes('FAIL') ||
                                     content.includes('test');

                if (isBuoyOutput && content.length < 5000) {
                  log('');
                  log('📋 Command Output:');
                  // Show the output, limiting to first 40 lines
                  const lines = content.split('\n').slice(0, 40);
                  for (const line of lines) {
                    if (line.trim()) {
                      log(`   ${line}`);
                    }
                  }
                  if (content.split('\n').length > 40) {
                    log(`   ... (${content.split('\n').length - 40} more lines)`);
                  }
                  log('');
                }
              }
            }
          }
        } catch {
          // Not valid JSON, ignore partial lines
        }
      }
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (text.includes('Error') || text.includes('error')) {
        log(`❌ Error: ${text.trim()}`);
      }
    });

    child.on('close', (code) => {
      clearInterval(heartbeat);
      clearStatusLine();  // Clear the status line
      clearStatusLine = () => {};  // Reset to no-op

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;

      log('─'.repeat(60));
      log(`🏁 Claude finished in ${mins}m ${secs}s with ${toolCallCount} tool calls`);
      log(`   Exit code: ${code}`);

      // Show token usage summary
      if (totalInputTokens + totalOutputTokens > 0) {
        log('');
        log('📊 Token Usage:');
        log(`   Input:  ${totalInputTokens.toLocaleString()} tokens`);
        log(`   Output: ${totalOutputTokens.toLocaleString()} tokens`);
        log(`   Total:  ${(totalInputTokens + totalOutputTokens).toLocaleString()} tokens`);
        if (cacheReadTokens > 0 || cacheWriteTokens > 0) {
          log(`   Cache read:  ${cacheReadTokens.toLocaleString()} tokens`);
          log(`   Cache write: ${cacheWriteTokens.toLocaleString()} tokens`);
        }
      }

      resolve({
        success: code === 0,
        output: stdout + stderr,
      });
    });

    child.on('error', (err) => {
      clearInterval(heartbeat);
      log(`❌ Claude spawn error: ${err.message}`);
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
  if (nextTask.description) {
    log(`What: ${nextTask.description}`);
  }
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
What: ${nextTask.description || 'No description'}
Started: ${new Date().toISOString()}
===================================

${result.output}

===================================
Completed: ${new Date().toISOString()}
Exit code: ${result.success ? 0 : 1}
`);

  // Reload state in case Claude updated it
  const updatedState = loadState();
  updatedState.totalCycles++;
  updatedState.lastRun = new Date().toISOString();

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
      components: parseInt(metricsMatch[1] || '0', 10),
      tokens: parseInt(metricsMatch[2] || '0', 10),
      coverage: parseInt(metricsMatch[3] || '0', 10),
    };
    const after: Metrics = {
      components: parseInt(metricsMatch[4] || '0', 10),
      tokens: parseInt(metricsMatch[5] || '0', 10),
      coverage: parseInt(metricsMatch[6] || '0', 10),
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

    // Run gap analysis if cycle didn't improve
    if (regression.regressed || !improvement.improved) {
      log('');
      log('Running gap analysis with Haiku...');
      try {
        // Use the default test repo - could be made configurable
        const testRepo = 'chakra-ui/chakra-ui';
        const groundTruth = loadGroundTruth(testRepo);
        const expected = groundTruth || { components: after.components, tokens: after.tokens };

        const gapAnalysis = await analyzeGap({
          repo: testRepo,
          taskId: nextTask.id,
          detected: { components: after.components, tokens: after.tokens },
          expected,
          attemptedFix: result.output.slice(-5000), // Last 5k chars of what Claude tried
        });

        // Store for next cycle
        updatedState.lastGapAnalysis = {
          timestamp: gapAnalysis.timestamp,
          repo: gapAnalysis.repo,
          taskId: gapAnalysis.taskId,
          gaps: gapAnalysis.gaps,
          rootCauses: gapAnalysis.rootCauses,
          recommendations: gapAnalysis.recommendations,
          quirks: gapAnalysis.quirks,
        };

        log(`Gap analysis complete:`);
        log(`  Root causes: ${gapAnalysis.rootCauses.length}`);
        log(`  Recommendations: ${gapAnalysis.recommendations.length}`);
        log(`  Quirks: ${gapAnalysis.quirks.length}`);
        for (const rec of gapAnalysis.recommendations.slice(0, 3)) {
          log(`  - ${rec.slice(0, 80)}${rec.length > 80 ? '...' : ''}`);
        }
        log('');
      } catch (err) {
        log(`Gap analysis failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      // Clear gap analysis on success
      updatedState.lastGapAnalysis = undefined;
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

  saveState(updatedState);

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
        config.maxCycles = parseInt(args[++i] || '10', 10);
        break;
      case '--cooldown':
        config.cooldownMs = parseInt(args[++i] || '5000', 10);
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
        config.minImprovementThreshold = parseInt(args[++i] || '1', 10);
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
          if (!entry?.improvement) {
            console.log(`  Cycle ${entry?.cycle ?? '?'}: ${entry?.task ?? 'unknown'} (no metrics)`);
            continue;
          }
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
