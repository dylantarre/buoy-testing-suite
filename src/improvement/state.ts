// src/improvement/state.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface ImprovementTask {
  id: string;
  title: string;
  description: string;
  priority: number;
  category: 'scanner' | 'token' | 'drift' | 'source';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metrics?: {
    before: { components: number; tokens: number; coverage: number };
    after?: { components: number; tokens: number; coverage: number };
  };
  commits?: string[];
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

export interface GapAnalysisState {
  timestamp: string;
  repo: string;
  taskId: string;
  gaps: {
    missingComponents: number;
    missingTokens: number;
    detectionRate: {
      components: number;
      tokens: number;
    };
  };
  rootCauses: string[];
  recommendations: string[];
  quirks: string[];
}

export interface ImprovementState {
  version: number;
  currentTask: string | null;
  tasks: ImprovementTask[];
  history: Array<{
    taskId: string;
    completedAt: string;
    improvement: string;
  }>;
  lastRun: string | null;
  totalCycles: number;
  consecutiveFailures: number;
  lastGapAnalysis?: GapAnalysisState;
}

const STATE_PATH = join(process.cwd(), '.improvement', 'state.json');

export function getStatePath(): string {
  return STATE_PATH;
}

export function loadState(): ImprovementState {
  if (!existsSync(STATE_PATH)) {
    return createInitialState();
  }

  try {
    const content = readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return createInitialState();
  }
}

export function saveState(state: ImprovementState): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function createInitialState(): ImprovementState {
  return {
    version: 1,
    currentTask: null,
    tasks: getTasksFromRoadmap(),
    history: [],
    lastRun: null,
    totalCycles: 0,
    consecutiveFailures: 0,
  };
}

export function getNextTask(state: ImprovementState): ImprovementTask | null {
  // Find highest priority pending task
  const pending = state.tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => a.priority - b.priority);

  return pending[0] || null;
}

export function markTaskInProgress(state: ImprovementState, taskId: string): void {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'in_progress';
    task.attempts++;
    task.lastAttempt = new Date().toISOString();
    state.currentTask = taskId;
  }
}

export function markTaskCompleted(
  state: ImprovementState,
  taskId: string,
  metrics: { before: any; after: any },
  commits: string[]
): void {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'completed';
    task.metrics = metrics;
    task.commits = commits;

    state.history.push({
      taskId,
      completedAt: new Date().toISOString(),
      improvement: `${metrics.before.components} → ${metrics.after.components} components`,
    });

    state.currentTask = null;
    state.consecutiveFailures = 0;
  }
}

export function markTaskFailed(state: ImprovementState, taskId: string, error: string): void {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = task.attempts >= 3 ? 'failed' : 'pending';
    task.error = error;
    state.currentTask = null;
    state.consecutiveFailures++;
  }
}

function getTasksFromRoadmap(): ImprovementTask[] {
  // These come from BUOY_ROADMAP.md - the identified improvements
  return [
    {
      id: 'monorepo-detection',
      title: 'Monorepo Structure Detection',
      description: 'Auto-detect monorepo patterns (pnpm-workspace.yaml, lerna.json) and expand include patterns to packages/*/src/**/*.tsx',
      priority: 1,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'polymorphic-factory',
      title: 'Mantine polymorphicFactory Pattern',
      description: 'Detect polymorphicFactory<T>() pattern used in Mantine components',
      priority: 2,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'cva-pattern',
      title: 'CVA (class-variance-authority) Pattern',
      description: 'Detect cva() patterns used in shadcn/ui and similar libraries',
      priority: 3,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'chakra-recipe-context',
      title: 'Chakra createRecipeContext Pattern',
      description: 'Detect createRecipeContext() and createSlotRecipeContext() patterns',
      priority: 4,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'ark-ui-wrappers',
      title: 'Ark UI Wrapper Detection',
      description: 'Detect components that wrap @ark-ui/react primitives',
      priority: 5,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'radix-wrappers',
      title: 'Radix Primitive Wrapper Detection',
      description: 'Detect components that wrap @radix-ui/react-* primitives',
      priority: 6,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'ts-token-objects',
      title: 'TypeScript Token Object Detection',
      description: 'Detect design tokens defined as TypeScript/JavaScript objects (not just CSS)',
      priority: 7,
      category: 'token',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'style-props-tokens',
      title: 'Style Props Token Detection',
      description: 'Detect tokens used in style prop systems like Chakra/Mantine',
      priority: 8,
      category: 'token',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'compound-components',
      title: 'Compound Component Detection',
      description: 'Detect compound component patterns (Menu.Item, Dialog.Content)',
      priority: 9,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
    {
      id: 'forward-ref-displayname',
      title: 'forwardRef with displayName',
      description: 'Detect React.forwardRef components with displayName assignments',
      priority: 10,
      category: 'scanner',
      status: 'pending',
      attempts: 0,
    },
  ];
}

export function shouldContinue(state: ImprovementState): boolean {
  // Stop if too many consecutive failures
  if (state.consecutiveFailures >= 3) {
    return false;
  }

  // Stop if no more tasks
  const nextTask = getNextTask(state);
  if (!nextTask) {
    return false;
  }

  return true;
}

export function getStateReport(state: ImprovementState): string {
  const completed = state.tasks.filter(t => t.status === 'completed').length;
  const pending = state.tasks.filter(t => t.status === 'pending').length;
  const failed = state.tasks.filter(t => t.status === 'failed').length;

  // Handle both old format (cycle/task/result) and new format (taskId/improvement)
  const formatHistoryEntry = (h: any): string => {
    const taskName = h.taskId || h.task || 'unknown';
    const detail = h.improvement || h.result || h.notes || '';
    return `  - ${taskName}: ${detail}`;
  };

  const historyLines = state.history.slice(-5).map(formatHistoryEntry);

  return `
Improvement State Report
========================
Total cycles: ${state.totalCycles}
Tasks: ${completed} completed, ${pending} pending, ${failed} failed
Current: ${state.currentTask || 'none'}
Last run: ${state.lastRun || 'never'}
Consecutive failures: ${state.consecutiveFailures}

Recent History:
${historyLines.length > 0 ? historyLines.join('\n') : '  (none)'}
`.trim();
}
