#!/usr/bin/env node
/**
 * Parallel Improvement Daemon
 *
 * Runs multiple Claude agents simultaneously, each working on a different
 * SCANNER in an isolated git worktree. Each focus area owns specific files
 * to prevent merge conflicts.
 *
 * Focus Areas (19 total):
 *   Component Scanners (6):
 *     React, Vue, Angular, Svelte, Web Component, Template
 *   Token Scanners (1):
 *     Token Scanner
 *   Tailwind (3):
 *     Scanner, Config Parser, Arbitrary Detector
 *   Style Extractors (4):
 *     HTML, JSX, Directive, Class Pattern
 *   Figma (2):
 *     Component Scanner, Client
 *   Storybook (1):
 *     Extractor
 *   Infrastructure (2):
 *     Base Scanner, Parser Utils
 *
 * Usage:
 *   npx tsx src/improvement/parallel-daemon.ts start 6
 *   npx tsx src/improvement/parallel-daemon.ts status
 *   npx tsx src/improvement/parallel-daemon.ts cleanup
 */

import { spawn, ChildProcess } from 'child_process';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync, appendFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { StatusDisplay, TodoItem } from './status-display.js';
import { analyzeGap, formatGapAnalysisForPrompt, type GapAnalysis } from './gap-analyzer.js';
import {
  takeCoverageSnapshot,
  appendCoverageSnapshot,
  loadCoverageHistory,
  checkStopCondition,
  formatCoverageDisplay,
  getQuickCoverageStatus,
  type FocusAreaConfig,
} from './coverage-tracker.js';

const BUOY_MAIN = '/Users/dylantarre/dev/buoy';
const TESTING_SUITE = '/Users/dylantarre/dev/buoy-lab';
const STATE_PATH = join(TESTING_SUITE, '.improvement/parallel-daemon-state.json');
const LOG_PATH = join(TESTING_SUITE, '.improvement/logs/parallel-daemon.log');

// Focus areas - each agent works on ONE scanner to avoid conflicts
interface FocusArea {
  id: string;
  name: string;
  files: string[];  // Files this area owns (relative to Buoy root)
  description: string;
  testRepos: string[];  // Repos good for testing this area
}

const FOCUS_AREAS: FocusArea[] = [
  // === COMPONENT SCANNERS ===
  {
    id: 'react-scanner',
    name: 'React Scanner',
    files: ['packages/scanners/src/git/react-scanner.ts'],
    description: 'React components: forwardRef, memo, polymorphicFactory, cva, compound components, Chakra/Mantine patterns',
    testRepos: ['chakra-ui/chakra-ui', 'mantinedev/mantine', 'shadcn-ui/ui', 'radix-ui/primitives'],
  },
  {
    id: 'vue-scanner',
    name: 'Vue Scanner',
    files: ['packages/scanners/src/git/vue-scanner.ts'],
    description: 'Vue components: defineProps, Options API props, script setup, nested types',
    testRepos: ['vuetifyjs/vuetify', 'primefaces/primevue', 'element-plus/element-plus'],
  },
  {
    id: 'angular-scanner',
    name: 'Angular Scanner',
    files: ['packages/scanners/src/git/angular-scanner.ts'],
    description: 'Angular components: @Component, @Input, @Output, signal inputs (Angular 17+)',
    testRepos: ['angular/components', 'primefaces/primeng'],
  },
  {
    id: 'svelte-scanner',
    name: 'Svelte Scanner',
    files: ['packages/scanners/src/git/svelte-scanner.ts'],
    description: 'Svelte components: export let props, $props() runes (Svelte 5), type annotations',
    testRepos: ['huntabyte/shadcn-svelte', 'skeletonlabs/skeleton'],
  },
  {
    id: 'webcomponent-scanner',
    name: 'Web Component Scanner',
    files: ['packages/scanners/src/git/webcomponent-scanner.ts'],
    description: 'Web Components: Lit (@customElement, @property), Stencil (@Component, @Prop)',
    testRepos: ['AojaLabs/buoy', 'AojaLabs/buoy'],  // TODO: find web component repos
  },
  {
    id: 'template-scanner',
    name: 'Template Scanner',
    files: ['packages/scanners/src/git/template-scanner.ts'],
    description: '40+ template languages: Blade, ERB, Twig, Nunjucks, Astro, Solid, Qwik, etc.',
    testRepos: ['withastro/astro', 'solidjs/solid'],
  },

  // === TOKEN SCANNERS ===
  {
    id: 'token-scanner',
    name: 'Token Scanner',
    files: ['packages/scanners/src/git/token-scanner.ts'],
    description: 'Design tokens: JSON tokens, CSS variables, SCSS variables, TypeScript token objects',
    testRepos: ['chakra-ui/chakra-ui', 'mantinedev/mantine', 'adobe/spectrum-tokens'],
  },

  // === TAILWIND (3 files) ===
  {
    id: 'tailwind-scanner',
    name: 'Tailwind Scanner',
    files: ['packages/scanners/src/tailwind/scanner.ts'],
    description: 'Tailwind: main scanner orchestration, theme extraction coordination',
    testRepos: ['shadcn-ui/ui', 'tailwindlabs/headlessui'],
  },
  {
    id: 'tailwind-config',
    name: 'Tailwind Config Parser',
    files: ['packages/scanners/src/tailwind/config-parser.ts'],
    description: 'Tailwind config parsing: theme object extraction, custom colors/spacing/fonts',
    testRepos: ['shadcn-ui/ui', 'tailwindlabs/headlessui'],
  },
  {
    id: 'tailwind-arbitrary',
    name: 'Tailwind Arbitrary Detector',
    files: ['packages/scanners/src/tailwind/arbitrary-detector.ts'],
    description: 'Detect arbitrary Tailwind values: w-[123px], bg-[#abc], text-[14px] drift signals',
    testRepos: ['shadcn-ui/ui', 'tailwindlabs/headlessui'],
  },

  // === STYLE EXTRACTORS (4 files) ===
  {
    id: 'extractor-html',
    name: 'HTML Style Extractor',
    files: ['packages/scanners/src/extractors/html-style.ts'],
    description: 'Extract style="" attributes and <style> blocks from HTML',
    testRepos: ['chakra-ui/chakra-ui', 'vuetifyjs/vuetify'],
  },
  {
    id: 'extractor-jsx',
    name: 'JSX Style Extractor',
    files: ['packages/scanners/src/extractors/jsx-style.ts'],
    description: 'Extract style={{}} objects and inline styles from JSX/TSX',
    testRepos: ['chakra-ui/chakra-ui', 'mantinedev/mantine'],
  },
  {
    id: 'extractor-directive',
    name: 'Directive Style Extractor',
    files: ['packages/scanners/src/extractors/directive-style.ts'],
    description: 'Vue :style, v-bind:style, Angular [style.x], [ngStyle] bindings',
    testRepos: ['vuetifyjs/vuetify', 'angular/components'],
  },
  {
    id: 'extractor-class',
    name: 'Class Pattern Extractor',
    files: ['packages/scanners/src/extractors/class-pattern.ts'],
    description: 'Extract and analyze class names for design system patterns',
    testRepos: ['shadcn-ui/ui', 'tailwindlabs/headlessui'],
  },

  // === FIGMA (2 files) ===
  {
    id: 'figma-scanner',
    name: 'Figma Scanner',
    files: ['packages/scanners/src/figma/component-scanner.ts'],
    description: 'Figma API: COMPONENT_SET, COMPONENT, variants, properties, naming conventions',
    testRepos: [],  // Requires Figma API access
  },
  {
    id: 'figma-client',
    name: 'Figma Client',
    files: ['packages/scanners/src/figma/client.ts'],
    description: 'Figma API client: authentication, rate limiting, file/node fetching',
    testRepos: [],  // Requires Figma API access
  },

  // === STORYBOOK ===
  {
    id: 'storybook-scanner',
    name: 'Storybook Scanner',
    files: ['packages/scanners/src/storybook/extractor.ts'],
    description: 'Storybook: index.json/stories.json parsing, story hierarchy, component metadata',
    testRepos: ['storybookjs/storybook', 'chakra-ui/chakra-ui'],
  },

  // === BASE INFRASTRUCTURE ===
  {
    id: 'base-scanner',
    name: 'Base Scanner Infrastructure',
    files: ['packages/scanners/src/base/scanner.ts'],
    description: 'Base scanner class: file discovery, glob patterns, parallel processing, error handling',
    testRepos: ['chakra-ui/chakra-ui'],  // Any repo works for infrastructure
  },

  // === UTILS ===
  {
    id: 'parser-utils',
    name: 'Parser Utils',
    files: ['packages/scanners/src/utils/parser-utils.ts'],
    description: 'Shared parsing utilities: AST helpers, regex patterns, type extraction',
    testRepos: ['chakra-ui/chakra-ui'],
  },
];

interface AgentTask {
  id: string;
  focusArea: FocusArea;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  metrics?: {
    before: { components: number; tokens: number };
    after: { components: number; tokens: number };
  };
  commitHash?: string;
  error?: string;
  gapAnalysis?: GapAnalysis;
  attempts?: number;
}

interface Agent {
  id: string;
  worktreePath: string;
  branch: string;
  task?: AgentTask;
  pid?: number;
  logFile?: string;
}

interface MergeResult {
  taskId: string;
  focusAreaId: string;
  focusAreaName: string;
  commitHash: string;
  status: 'merged' | 'conflict' | 'skipped';
  reason?: string;
}

interface DaemonState {
  status: 'idle' | 'running' | 'stopped';
  agents: Agent[];
  pendingTasks: AgentTask[];
  completedTasks: AgentTask[];
  mergeResults: MergeResult[];
  mergedFiles: string[];  // Track files already merged to main
  startedAt?: string;
  stoppedAt?: string;
}

function log(msg: string) {
  console.log(msg);
  try {
    // Timestamps only in log file
    const ts = new Date().toISOString();
    appendFileSync(LOG_PATH, `[${ts}] ${msg}\n`);
  } catch { /* ignore */ }
}

export class ParallelDaemon {
  private state: DaemonState;
  private processes: Map<string, ChildProcess> = new Map();
  private concurrency: number;
  private anthropic: Anthropic;
  private agentActivity: Map<string, string[]> = new Map();  // Recent tool calls per agent
  private agentSummary: Map<string, string> = new Map();     // Haiku-generated summaries
  private agentLastSummarized: Map<string, number> = new Map();  // Activity count when last summarized
  private improvements: Array<{ scanner: string; summary: string; commit: string }> = [];
  private display: StatusDisplay;

  constructor(concurrency: number) {
    // Limit concurrency to available focus areas
    this.concurrency = Math.min(concurrency, FOCUS_AREAS.length);
    this.anthropic = new Anthropic();
    this.display = new StatusDisplay();
    this.state = {
      status: 'idle',
      agents: [],
      pendingTasks: [],
      completedTasks: [],
      mergeResults: [],
      mergedFiles: [],
    };
  }

  /**
   * Initialize agents using git worktrees
   * Each agent gets its own branch and working directory
   */
  async initialize(): Promise<void> {
    log(`\n${'='.repeat(60)}`);
    log('PARALLEL IMPROVEMENT DAEMON - INITIALIZATION');
    log(`${'='.repeat(60)}\n`);

    await mkdir(dirname(STATE_PATH), { recursive: true });
    await mkdir(dirname(LOG_PATH), { recursive: true });

    // Create worktrees for each agent
    for (let i = 0; i < this.concurrency; i++) {
      const agentId = `agent-${i + 1}`;
      const branch = `improvement/${agentId}`;
      const worktreePath = join(dirname(BUOY_MAIN), `buoy-${agentId}`);

      log(`[${agentId}] Setting up...`);

      // Remove existing worktree if present
      if (existsSync(worktreePath)) {
        log(`[${agentId}] Removing existing worktree...`);
        await this.exec(BUOY_MAIN, `git worktree remove "${worktreePath}" --force`).catch(() => {});
      }

      // Delete branch if it exists
      await this.exec(BUOY_MAIN, `git branch -D ${branch}`).catch(() => {});

      // Create fresh worktree with new branch
      log(`[${agentId}] Creating worktree at ${worktreePath}`);
      await this.exec(BUOY_MAIN, `git worktree add -b ${branch} "${worktreePath}" main`);

      // Build in the worktree
      log(`[${agentId}] Installing dependencies...`);
      await this.exec(worktreePath, 'pnpm install');
      log(`[${agentId}] Building...`);
      await this.exec(worktreePath, 'pnpm build');

      this.state.agents.push({
        id: agentId,
        worktreePath,
        branch,
      });

      log(`[${agentId}] Ready\n`);
    }

    // Create tasks for ALL focus areas - agents will pick them up as they finish
    for (const focusArea of FOCUS_AREAS) {
      this.state.pendingTasks.push({
        id: `${focusArea.id}-${Date.now()}`,
        focusArea,
        status: 'pending',
      });
    }

    await this.saveState();
    log(`Initialized ${this.state.agents.length} agents to work through ${this.state.pendingTasks.length} focus areas:\n`);
    for (const task of this.state.pendingTasks) {
      log(`  ○ ${task.focusArea.name}`);
    }
    log('');
  }

  /**
   * Start the parallel daemon
   */
  async start(): Promise<void> {
    this.state.status = 'running';
    this.state.startedAt = new Date().toISOString();
    await this.saveState();

    log(`PARALLEL DAEMON STARTED - ${this.concurrency} agents, ${this.state.pendingTasks.length} tasks`);

    // Start the status display
    this.display.start();
    this.display.setStatus({
      title: `Parallel Daemon R${this.roundNumber}`,
      status: 'initializing',
      interruptHint: 'ctrl+c to stop',
    });

    // Initial task assignment
    await this.assignTasks();

    // Main loop
    while (this.state.status === 'running') {
      await this.tick();
      await this.sleep(5000);
    }
  }

  /**
   * Main loop tick
   */
  private async tick(): Promise<void> {
    // Check for completed agents
    for (const agent of this.state.agents) {
      if (agent.task?.status === 'running') {
        const proc = this.processes.get(agent.id);
        if (!proc || proc.exitCode !== null) {
          await this.handleComplete(agent, proc?.exitCode ?? 1);
        }
      }
    }

    // Assign new tasks
    await this.assignTasks();

    // Check if round complete
    const running = this.state.agents.filter((a) => a.task?.status === 'running');
    if (this.state.pendingTasks.length === 0 && running.length === 0) {
      // Round complete - start another round through all focus areas
      await this.startNewRound();
    }

    // Status update
    await this.printStatus();
  }

  private roundNumber = 1;
  private daemonStartTime = Date.now();

  /**
   * Start a new round through all focus areas
   */
  private async startNewRound(): Promise<void> {
    // Take coverage snapshot before starting new round
    log('');
    log('Taking coverage snapshot...');

    const focusAreaConfigs: FocusAreaConfig[] = FOCUS_AREAS.map(fa => ({
      id: fa.id,
      name: fa.name,
      testRepos: fa.testRepos,
    }));

    const snapshot = takeCoverageSnapshot(
      this.roundNumber,
      focusAreaConfigs,
      this.daemonStartTime
    );

    const history = appendCoverageSnapshot(snapshot);

    // Display coverage report
    console.log(formatCoverageDisplay(snapshot, history));

    // Check stop conditions
    const stopCondition = checkStopCondition(history);

    if (stopCondition.shouldStop) {
      log('');
      log('═'.repeat(60));
      if (stopCondition.reason === 'complete') {
        log('🎉 COMPLETE: ' + stopCondition.message);
        log('All scanners have reached 100% coverage!');
      } else {
        log('⚠️  STALLED: ' + stopCondition.message);
        log('Manual intervention may be needed.');
      }
      log('═'.repeat(60));
      log('');
      log('Coverage history saved to: .improvement/coverage-history.json');
      this.display.stop();
      process.exit(stopCondition.reason === 'complete' ? 0 : 1);
    }

    // Continue to next round
    this.roundNumber++;

    // Reset for next round
    this.state.completedTasks = [];
    this.agentActivity.clear();
    this.agentSummary.clear();
    this.agentLastSummarized.clear();

    // Queue all focus areas again
    for (const focusArea of FOCUS_AREAS) {
      this.state.pendingTasks.push({
        id: `${focusArea.id}-r${this.roundNumber}-${Date.now()}`,
        focusArea,
        status: 'pending',
      });
    }

    log(`Starting Round ${this.roundNumber} - ${getQuickCoverageStatus(history)}`);

    await this.saveState();
  }

  /**
   * Assign pending tasks to idle agents
   */
  private async assignTasks(): Promise<void> {
    for (const agent of this.state.agents) {
      if (agent.task?.status === 'running') continue;
      if (this.state.pendingTasks.length === 0) break;

      const task = this.state.pendingTasks.shift()!;
      await this.startAgent(agent, task);
    }
    await this.saveState();
  }

  /**
   * Start a Claude agent for a task
   */
  private async startAgent(agent: Agent, task: AgentTask): Promise<void> {
    // Silent start - status line shows what's running

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    agent.task = task;

    // Reset worktree to main
    await this.exec(agent.worktreePath, 'git checkout . && git clean -fd');
    await this.exec(agent.worktreePath, 'git rebase main');

    // Create log file for this agent run
    const logFile = join(TESTING_SUITE, `.improvement/logs/${agent.id}-${task.focusArea.id}-${Date.now()}.log`);
    agent.logFile = logFile;

    // Create the prompt
    const prompt = this.createPrompt(agent, task);

    // Spawn Claude
    const proc = spawn('claude', [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
    ], {
      cwd: agent.worktreePath,
      shell: true,
    });

    proc.stdin?.write(prompt);
    proc.stdin?.end();

    // Capture and stream output
    let output = '';

    proc.stdout?.on('data', (d) => {
      const chunk = d.toString();
      output += chunk;

      // Parse stream-json lines for live updates
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          // Tool use - show what the agent is doing
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            const toolName = event.content_block.name;
            const toolId = event.content_block.id;
            // Store tool ID to match with input later
            (agent as any).currentToolId = toolId;
            (agent as any).currentToolName = toolName;
          }

          // Tool input - now we have the details
          if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
            const partial = event.delta.partial_json || '';
            // Accumulate partial JSON
            (agent as any).toolInput = ((agent as any).toolInput || '') + partial;
          }

          // Tool complete - track activity
          if (event.type === 'content_block_stop' && (agent as any).currentToolName) {
            const toolName = (agent as any).currentToolName;
            let detail = '';

            try {
              const input = JSON.parse((agent as any).toolInput || '{}');

              if (toolName === 'Read' && input.file_path) {
                detail = input.file_path.split('/').slice(-2).join('/');
              } else if (toolName === 'Write' && input.file_path) {
                detail = `writing ${input.file_path.split('/').slice(-2).join('/')}`;
              } else if (toolName === 'Edit' && input.file_path) {
                detail = `editing ${input.file_path.split('/').slice(-2).join('/')}`;
              } else if (toolName === 'Bash' && input.command) {
                detail = input.command.slice(0, 50);
              } else if (toolName === 'Grep' && input.pattern) {
                detail = `"${input.pattern.slice(0, 30)}"`;
              } else if (toolName === 'Glob' && input.pattern) {
                detail = input.pattern;
              } else if (toolName === 'Task') {
                detail = input.description || 'subagent';
              }
            } catch { /* ignore parse errors */ }

            // Track recent activity for this agent
            const activity = this.agentActivity.get(agent.id) || [];
            activity.push(`${toolName} ${detail}`);
            // Keep last 5
            if (activity.length > 5) activity.shift();
            this.agentActivity.set(agent.id, activity);

            // Reset for next tool
            (agent as any).currentToolName = null;
            (agent as any).toolInput = '';
          }

        } catch {
          // Not JSON or parse error, skip
        }
      }
    });

    proc.stderr?.on('data', (d) => {
      const chunk = d.toString();
      output += chunk;
      // Show errors
      if (chunk.includes('error') || chunk.includes('Error')) {
        process.stdout.write(`\r\x1b[K[${agent.id}] ⚠️ ${chunk.trim().slice(0, 80)}\n`);
      }
    });

    proc.on('close', async () => {
      await writeFile(logFile, output);
    });

    this.processes.set(agent.id, proc);
    agent.pid = proc.pid;
    await this.saveState();
  }

  /**
   * Handle agent completion - merge immediately if successful
   */
  private async handleComplete(agent: Agent, exitCode: number): Promise<void> {
    const task = agent.task!;
    const startTime = new Date(task.startedAt!).getTime();
    task.duration = Date.now() - startTime;

    // Check for commits
    const hasCommits = await this.hasNewCommits(agent);

    if (exitCode === 0 && hasCommits) {
      task.status = 'completed';
      task.commitHash = await this.getLatestCommit(agent.worktreePath);

      // Get commit message for improvement summary
      const commitMsg = await this.exec(agent.worktreePath, 'git log -1 --format=%s').catch(() => '');
      const summary = commitMsg.trim() || task.focusArea.name;

      // Add to improvements checklist
      this.improvements.push({
        scanner: task.focusArea.name,
        summary: summary.slice(0, 60),
        commit: task.commitHash,
      });

      // IMMEDIATE MERGE - don't wait for other agents
      await this.mergeImmediate(agent, task);

    } else if (exitCode === 0) {
      task.status = 'completed';
      // No output - status line shows progress
    } else {
      // Task failed - run gap analysis
      task.attempts = (task.attempts || 0) + 1;

      log(`[${agent.id}] Task failed, running gap analysis...`);

      try {
        // Get the test repo for this focus area
        const testRepo = task.focusArea.testRepos[0] || 'chakra-ui/chakra-ui';

        // Load ground truth if available
        const gtPath = join(TESTING_SUITE, 'results', ...testRepo.split('/'), 'ground-truth.json');
        let expected = { components: 100, tokens: 50 }; // defaults
        if (existsSync(gtPath)) {
          try {
            const gt = JSON.parse(readFileSync(gtPath, 'utf-8'));
            expected = {
              components: gt.components?.total ?? 100,
              tokens: gt.tokens?.total ?? 50,
            };
          } catch { /* use defaults */ }
        }

        // Run gap analysis with Haiku
        const gapAnalysis = await analyzeGap({
          repo: testRepo,
          taskId: task.id,
          detected: task.metrics?.after || { components: 0, tokens: 0 },
          expected,
          attemptedFix: `Focus area: ${task.focusArea.name}\nDescription: ${task.focusArea.description}\nError: Exit code ${exitCode}`,
        });

        task.gapAnalysis = gapAnalysis;

        log(`[${agent.id}] Gap analysis: ${gapAnalysis.recommendations.length} recommendations`);
        for (const rec of gapAnalysis.recommendations.slice(0, 2)) {
          log(`[${agent.id}]   - ${rec.slice(0, 70)}...`);
        }

        // If under 3 attempts, queue for retry with gap analysis context
        if (task.attempts < 3) {
          task.status = 'pending';
          this.state.pendingTasks.push(task);
          log(`[${agent.id}] Queued for retry (attempt ${task.attempts + 1}/3)`);
        } else {
          task.status = 'failed';
          task.error = `Failed after 3 attempts. Exit: ${exitCode}`;
          log(`[${agent.id}] Max attempts reached, marking as failed`);
        }
      } catch (err) {
        task.status = 'failed';
        task.error = `Exit: ${exitCode}, gap analysis failed: ${err}`;
      }
    }

    task.completedAt = new Date().toISOString();
    if (task.status !== 'pending') {
      this.state.completedTasks.push(task);
    }
    agent.task = undefined;
    agent.pid = undefined;
    this.processes.delete(agent.id);
    await this.saveState();
  }

  /**
   * Merge an agent's improvement immediately
   * First to finish wins - later agents with conflicting files get skipped
   */
  private async mergeImmediate(agent: Agent, task: AgentTask): Promise<void> {
    if (!task.commitHash) return;

    try {
      // Get files changed in this commit
      const changedFiles = await this.exec(
        agent.worktreePath,
        `git diff-tree --no-commit-id --name-only -r ${task.commitHash}`
      );
      const files = changedFiles.trim().split('\n').filter(Boolean);

      // Check for conflicts with already-merged files
      const conflicting = files.filter((f) => this.state.mergedFiles.includes(f));

      if (conflicting.length > 0) {
        this.state.mergeResults.push({
          taskId: task.id,
          focusAreaId: task.focusArea.id,
          focusAreaName: task.focusArea.name,
          commitHash: task.commitHash,
          status: 'skipped',
          reason: `Files already merged: ${conflicting.join(', ')}`,
        });
        return;
      }

      // Try to cherry-pick to main
      await this.exec(BUOY_MAIN, `git cherry-pick ${task.commitHash}`);

      // Success - track merged files
      this.state.mergedFiles.push(...files);

      this.state.mergeResults.push({
        taskId: task.id,
        focusAreaId: task.focusArea.id,
        focusAreaName: task.focusArea.name,
        commitHash: task.commitHash,
        status: 'merged',
      });

      // Push immediately (silent)
      try {
        await this.exec(BUOY_MAIN, 'git push origin main');
      } catch {
        // Will retry later
      }

    } catch (error) {
      // Cherry-pick failed
      await this.exec(BUOY_MAIN, 'git cherry-pick --abort').catch(() => {});

      const errMsg = error instanceof Error ? error.message : String(error);
      this.state.mergeResults.push({
        taskId: task.id,
        focusAreaId: task.focusArea.id,
        focusAreaName: task.focusArea.name,
        commitHash: task.commitHash,
        status: 'conflict',
        reason: errMsg.slice(0, 200),
      });
    }
  }

  /**
   * Create agent prompt
   */
  private createPrompt(agent: Agent, task: AgentTask): string {
    const area = task.focusArea;
    const testRepos = area.testRepos.join(', ');

    return `# Buoy Improvement Agent

You are **${agent.id}**, focused on: **${area.name}**

## Your Focus Area

**Task:** ${area.description}

**Your files (ONLY modify these):**
${area.files.map(f => `- \`${f}\``).join('\n')}

**Test against these repos:**
${area.testRepos.map(r => `- ${r}`).join('\n')}

## Environment
- Your Buoy clone: \`${agent.worktreePath}\`
- Your branch: \`${agent.branch}\`
- Testing suite: \`${TESTING_SUITE}\`

This is YOUR isolated workspace. Other agents are working on different areas.

## CRITICAL: File Boundaries

You may ONLY create or modify files in your focus area:
${area.files.map(f => `- ${f}`).join('\n')}

If the file doesn't exist, create it. Do NOT modify other scanner files.

## Mission

1. **Test current detection on your repos:**
   \`\`\`bash
   cd ${TESTING_SUITE}
   ./dist/cli.js run single ${area.testRepos[0]}
   \`\`\`

2. **Identify what's NOT detected** related to ${area.name}

3. **Write a failing test** in your focus area:
   \`\`\`bash
   cd ${agent.worktreePath}
   # Create/edit: ${area.files[0]?.replace('.ts', '.test.ts') || 'test file'}
   \`\`\`

4. **Implement the fix** in your assigned files ONLY

5. **Run ALL tests:**
   \`\`\`bash
   cd ${agent.worktreePath}
   pnpm build && pnpm test
   \`\`\`

6. **Re-test detection** to verify improvement

7. **Commit if improved:**
   \`\`\`bash
   git add -A
   git commit -m "feat(scanners): ${area.id} - [what you improved]

   ${area.description}

   Tested: ${testRepos}
   Agent: ${agent.id}
   Focus: ${area.name}"
   \`\`\`

## Rules
- ONLY modify files in your focus area: ${area.files.join(', ')}
- Write tests BEFORE fixing code
- ALL tests must pass
- ONLY commit if detection improved
- NEVER read .env, credentials, or API key files

${task.gapAnalysis ? `
## Previous Attempt Analysis (Attempt ${task.attempts || 1}/3)

Your previous attempt didn't improve detection. Here's what the gap analyzer found:

${formatGapAnalysisForPrompt(task.gapAnalysis)}

**IMPORTANT:** Try a DIFFERENT approach based on this analysis. Do not repeat the same fix.
` : ''}

Start by running the test suite on ${area.testRepos[0]}.`;
  }

  /**
   * Check for commits on agent's branch
   */
  private async hasNewCommits(agent: Agent): Promise<boolean> {
    try {
      const result = await this.exec(agent.worktreePath, 'git log --oneline main..HEAD');
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get latest commit hash
   */
  private async getLatestCommit(path: string): Promise<string> {
    const result = await this.exec(path, 'git rev-parse --short HEAD');
    return result.trim();
  }

  /**
   * Print running status using StatusDisplay
   */
  private async printStatus(): Promise<void> {
    const running = this.state.agents.filter((a) => a.task?.status === 'running');
    const completed = this.state.completedTasks.length;
    const improved = this.state.completedTasks.filter((t) => t.commitHash).length;

    // Update summaries only for agents with new activity
    await this.updateSummaries(running);

    // Build status title with agent summaries
    let statusParts: string[] = [];
    for (const agent of running) {
      const summary = this.agentSummary.get(agent.id) || agent.task?.focusArea.name || '...';
      const shortSummary = summary.length > 25 ? summary.slice(0, 25) + '..' : summary;
      statusParts.push(shortSummary);
    }

    const title = statusParts.length > 0
      ? statusParts.join(' | ')
      : 'Waiting for agents';

    // Get coverage info if available
    const history = loadCoverageHistory();
    const coverageStr = history.snapshots.length > 0
      ? ` · ${(history.summary.currentCoverage * 100).toFixed(0)}% cov`
      : '';

    const statusText = running.length > 0
      ? `${running.length} agents${improved > 0 ? ` · ✓${improved}` : ''}${coverageStr}`
      : 'idle';

    this.display.setStatus({
      title: `R${this.roundNumber} [${completed}/${FOCUS_AREAS.length}] ${title}`,
      status: statusText,
      interruptHint: 'ctrl+c to stop',
    });

    // Build todo list from focus areas
    const todos: TodoItem[] = [];

    // Add completed improvements first
    for (const imp of this.improvements) {
      todos.push({
        id: `imp-${imp.commit}`,
        text: `${imp.scanner}: ${imp.summary}`,
        status: 'completed',
      });
    }

    // Add running agents
    for (const agent of running) {
      const summary = this.agentSummary.get(agent.id) || 'working...';
      todos.push({
        id: agent.id,
        text: `${agent.task?.focusArea.name}: ${summary}`,
        status: 'in_progress',
      });
    }

    // Add pending tasks (limit to avoid clutter)
    const pendingToShow = this.state.pendingTasks.slice(0, 3);
    for (const task of pendingToShow) {
      todos.push({
        id: task.id,
        text: task.focusArea.name,
        status: 'pending',
      });
    }

    if (this.state.pendingTasks.length > 3) {
      todos.push({
        id: 'more',
        text: `+${this.state.pendingTasks.length - 3} more pending`,
        status: 'pending',
      });
    }

    this.display.setTodos(todos);
  }

  /**
   * Update agent summaries using Haiku - only when new activity
   */
  private async updateSummaries(agents: Agent[]): Promise<void> {
    const updates: Promise<void>[] = [];

    for (const agent of agents) {
      const activity = this.agentActivity.get(agent.id);
      if (!activity || activity.length === 0) continue;

      // Only summarize if there's new activity
      const lastCount = this.agentLastSummarized.get(agent.id) || 0;
      if (activity.length === lastCount) continue;

      updates.push((async () => {
        try {
          const response = await this.anthropic.messages.create({
            model: 'claude-haiku-4-20250414',
            max_tokens: 30,
            messages: [{
              role: 'user',
              content: `Summarize in 3-5 words. Actions:\n${activity.slice(-3).join('\n')}\n\nFocus: ${agent.task?.focusArea.name}\n\nRespond with ONLY the summary.`
            }]
          });

          const summary = (response.content[0] as any).text?.trim() || '';
          if (summary) {
            this.agentSummary.set(agent.id, summary);
            this.agentLastSummarized.set(agent.id, activity.length);
          }
        } catch {
          // Ignore errors, keep old summary
        }
      })());
    }

    await Promise.all(updates);
  }

  /**
   * Print final summary with merge instructions
   */
  private async printSummary(): Promise<void> {
    const successful = this.state.completedTasks.filter((t) => t.commitHash);
    const failed = this.state.completedTasks.filter((t) => t.status === 'failed');
    const noChange = this.state.completedTasks.filter((t) => t.status === 'completed' && !t.commitHash);
    const totalTime = this.state.stoppedAt && this.state.startedAt
      ? Math.round((new Date(this.state.stoppedAt).getTime() - new Date(this.state.startedAt).getTime()) / 1000)
      : 0;

    const merged = this.state.mergeResults.filter((r) => r.status === 'merged');
    const skipped = this.state.mergeResults.filter((r) => r.status === 'skipped');
    const conflicts = this.state.mergeResults.filter((r) => r.status === 'conflict');

    console.log(`\n\n${'='.repeat(60)}`);
    console.log('PARALLEL DAEMON COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
    console.log('');
    console.log('Agent Results:');
    console.log(`  Improved:   ${successful.length}`);
    console.log(`  No change:  ${noChange.length}`);
    console.log(`  Failed:     ${failed.length}`);
    console.log('');
    console.log('Merge Results:');
    console.log(`  ✓ Merged:   ${merged.length}`);
    console.log(`  ⊘ Skipped:  ${skipped.length} (conflicts with better improvement)`);
    console.log(`  ✗ Conflict: ${conflicts.length}`);

    if (merged.length > 0) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log('MERGED TO MAIN');
      console.log(`${'─'.repeat(60)}`);
      for (const r of merged) {
        console.log(`  ✓ ${r.focusAreaName}: ${r.commitHash}`);
      }
    }

    if (skipped.length > 0) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log('SKIPPED (files already modified)');
      console.log(`${'─'.repeat(60)}`);
      for (const r of skipped) {
        console.log(`  ⊘ ${r.focusAreaName}: ${r.commitHash}`);
        if (r.reason) console.log(`    ${r.reason}`);
      }
    }

    if (conflicts.length > 0) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log('CONFLICTS (manual merge needed)');
      console.log(`${'─'.repeat(60)}`);
      for (const r of conflicts) {
        console.log(`  ✗ ${r.focusAreaName}: ${r.commitHash}`);
        console.log(`    To merge manually:`);
        console.log(`    cd ${BUOY_MAIN} && git cherry-pick ${r.commitHash}`);
      }
    }

    console.log(`\n${'='.repeat(60)}\n`);
  }

  /**
   * Execute command in directory
   */
  private exec(cwd: string, cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', cmd], { cwd });
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (d) => { stdout += d; });
      proc.stderr?.on('data', (d) => { stderr += d; });

      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`${cmd} failed (${code}): ${stderr}`));
      });
    });
  }

  private async saveState(): Promise<void> {
    await writeFile(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Stop all agents
   */
  async stop(): Promise<void> {
    log('Stopping daemon...');
    this.state.status = 'stopped';
    this.state.stoppedAt = new Date().toISOString();

    // Stop the display first
    this.display.stop();

    for (const [id, proc] of this.processes) {
      log(`Killing ${id}...`);
      proc.kill('SIGTERM');
    }

    await this.saveState();
    await this.printSummary();
  }

  /**
   * Cleanup worktrees
   */
  async cleanup(): Promise<void> {
    log('Cleaning up worktrees...');

    for (const agent of this.state.agents) {
      try {
        await this.exec(BUOY_MAIN, `git worktree remove "${agent.worktreePath}" --force`);
        await this.exec(BUOY_MAIN, `git branch -D ${agent.branch}`);
        log(`Removed ${agent.id}`);
      } catch (e) {
        log(`Failed to remove ${agent.id}: ${e}`);
      }
    }

    log('Cleanup complete');
  }
}

// CLI
async function main() {
  const [, , command, ...args] = process.argv;

  if (command === 'start') {
    const concurrency = parseInt(args[0] || '3', 10);

    const daemon = new ParallelDaemon(concurrency);

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      await daemon.stop();
      process.exit(0);
    });

    await daemon.initialize();
    await daemon.start();

  } else if (command === 'status') {
    try {
      const state: DaemonState = JSON.parse(await readFile(STATE_PATH, 'utf-8'));
      console.log('\nParallel Daemon Status');
      console.log('='.repeat(40));
      console.log(`Status:    ${state.status}`);
      console.log(`Started:   ${state.startedAt || 'never'}`);
      console.log(`Agents:    ${state.agents.length}`);
      console.log(`Pending:   ${state.pendingTasks.length}`);
      console.log(`Completed: ${state.completedTasks.length}`);

      const running = state.agents.filter((a) => a.task?.status === 'running');
      if (running.length > 0) {
        console.log('\nActive agents:');
        for (const a of running) {
          console.log(`  ${a.id}: ${a.task?.focusArea.name}`);
        }
      }

      const improved = state.completedTasks.filter((t) => t.commitHash);
      if (improved.length > 0) {
        console.log('\nImprovements:');
        for (const t of improved) {
          console.log(`  ${t.focusArea.name}: ${t.commitHash}`);
        }
      }
    } catch {
      console.log('No parallel daemon state found.');
    }

  } else if (command === 'cleanup') {
    try {
      const state: DaemonState = JSON.parse(await readFile(STATE_PATH, 'utf-8'));
      const daemon = new ParallelDaemon(0);
      (daemon as any).state = state;
      await daemon.cleanup();
    } catch {
      console.log('No state to cleanup.');
    }

  } else if (command === 'improvements') {
    const count = parseInt(args[0] || '20', 10);
    console.log('\n' + '═'.repeat(60));
    console.log('SCANNER IMPROVEMENTS');
    console.log('═'.repeat(60) + '\n');

    const { execSync } = await import('child_process');
    const log = execSync(
      `git log --oneline --grep="feat(scanners)" -${count}`,
      { cwd: BUOY_MAIN, encoding: 'utf-8' }
    );

    const commits = log.trim().split('\n').filter(Boolean);
    let currentScanner = '';

    for (const line of commits) {
      // Try scanner-specific format: feat(scanners): scanner-name - description
      let match = line.match(/^(\w+)\s+feat\(scanners\):\s+([a-z]+-[a-z]+)\s*-\s*(.*)/);
      if (match) {
        const hash = match[1]!;
        const scanner = match[2]!;
        const desc = match[3] || 'improvement';
        if (scanner !== currentScanner) {
          if (currentScanner) console.log('');
          console.log(`✓ ${scanner}`);
          currentScanner = scanner;
        }
        console.log(`  ${desc} (${hash})`);
      } else {
        // Generic format: feat(scanners): description
        match = line.match(/^(\w+)\s+feat\(scanners\):\s+(.*)/);
        if (match) {
          const hash = match[1]!;
          const desc = match[2]!;
          if (currentScanner !== 'other') {
            if (currentScanner) console.log('');
            console.log(`✓ other`);
            currentScanner = 'other';
          }
          console.log(`  ${desc} (${hash})`);
        }
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`Total: ${commits.length} improvements`);
    console.log('═'.repeat(60) + '\n');

  } else {
    console.log(`
Parallel Improvement Daemon
===========================

Run multiple Claude agents simultaneously, each working on
a different focus area in isolated git worktrees.

Focus Areas (${FOCUS_AREAS.length} total):
${FOCUS_AREAS.map(a => `  • ${a.name}`).join('\n')}

Usage:
  npx tsx src/improvement/parallel-daemon.ts <command> [args]

Commands:
  start [n]       Start n agents (default: 3, max: ${FOCUS_AREAS.length})
  status          Show current status
  improvements    List all scanner improvements made
  cleanup         Remove worktrees and branches

Examples:
  start 3         # Run 3 agents on 3 focus areas in parallel
  improvements    # Show what was improved
`);
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
