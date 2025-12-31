import { spawn } from 'child_process';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { DiscoveredRepo, TestRun, BuoyOutput } from '../types.js';
import { RepoCache } from './cache.js';

export interface RunnerOptions {
  reposDir: string;
  resultsDir: string;
  buoyPath?: string;
  timeoutMs?: number;
}

export interface RunResult {
  testRun: TestRun;
  outputPath: string;
}

export class BuoyRunner {
  private cache: RepoCache;
  private resultsDir: string;
  private buoyPath: string;
  private timeoutMs: number;

  constructor(options: RunnerOptions) {
    this.cache = new RepoCache({ reposDir: options.reposDir });
    this.resultsDir = options.resultsDir;
    this.buoyPath = options.buoyPath ?? 'buoy';
    this.timeoutMs = options.timeoutMs ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Run Buoy on a single repo
   */
  async runOnRepo(repo: DiscoveredRepo): Promise<RunResult> {
    const startedAt = new Date();
    const id = `${repo.owner}-${repo.name}-${Date.now()}`;

    const testRun: TestRun = {
      id,
      repo,
      status: 'running',
      startedAt,
      buoyVersion: await this.getBuoyVersion(),
      configGenerated: false,
    };

    try {
      // Clone/update repo
      const repoPath = await this.cache.ensureRepo(repo);

      // Initialize Buoy config if needed
      const configGenerated = await this.ensureBuoyConfig(repoPath);
      testRun.configGenerated = configGenerated;

      // Run Buoy commands
      const buoyOutput = await this.executeBuoyCommands(repoPath);
      testRun.buoyOutput = buoyOutput;
      testRun.status = 'completed';
    } catch (error) {
      testRun.status = error instanceof TimeoutError ? 'timeout' : 'failed';
      testRun.error = error instanceof Error ? error.message : String(error);
    }

    testRun.completedAt = new Date();
    testRun.durationMs = testRun.completedAt.getTime() - startedAt.getTime();

    // Save results
    const outputPath = await this.saveResults(repo, testRun);

    return { testRun, outputPath };
  }

  /**
   * Run Buoy on multiple repos
   */
  async runOnRepos(
    repos: DiscoveredRepo[],
    options: { concurrency?: number; onProgress?: (completed: number, total: number) => void } = {}
  ): Promise<RunResult[]> {
    const results: RunResult[] = [];
    const concurrency = options.concurrency ?? 1;
    let completed = 0;

    // Process in batches
    for (let i = 0; i < repos.length; i += concurrency) {
      const batch = repos.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((repo) => this.runOnRepo(repo))
      );

      results.push(...batchResults);
      completed += batch.length;

      if (options.onProgress) {
        options.onProgress(completed, repos.length);
      }
    }

    return results;
  }

  /**
   * Ensure Buoy config exists
   */
  private async ensureBuoyConfig(repoPath: string): Promise<boolean> {
    const configPath = join(repoPath, 'buoy.config.mjs');

    if (existsSync(configPath)) {
      return false;
    }

    // Run buoy init --auto
    try {
      await this.execCommand(this.buoyPath, ['init', '--yes'], repoPath);
      return true;
    } catch {
      // If init fails, create config with comprehensive monorepo patterns
      const repoName = repoPath.split('/').pop() || 'unknown';
      const fallbackConfig = `export default {
  project: { name: '${repoName}' },
  sources: {
    react: {
      enabled: true,
      include: [
        // Standard locations
        'src/**/*.tsx',
        'src/**/*.jsx',
        'app/**/*.tsx',
        'components/**/*.tsx',
        'lib/**/*.tsx',
        // Monorepo packages
        'packages/*/src/**/*.tsx',
        'packages/*/*/src/**/*.tsx',
        'packages/@*/src/**/*.tsx',
        'packages/@*/*/src/**/*.tsx',
        // Apps directory
        'apps/*/src/**/*.tsx',
        'apps/*/**/*.tsx',
        // Registry patterns (shadcn-ui)
        'apps/*/registry/**/*.tsx',
        // Libs (Nx)
        'libs/*/src/**/*.tsx',
      ],
      exclude: ['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/node_modules/**'],
    },
  },
};
`;
      await writeFile(configPath, fallbackConfig);
      return true;
    }
  }

  /**
   * Execute Buoy commands and collect output
   */
  private async executeBuoyCommands(repoPath: string): Promise<BuoyOutput> {
    const output: BuoyOutput = {};

    // Run buoy scan
    try {
      const scanResult = await this.execCommand(
        this.buoyPath,
        ['scan', '--json'],
        repoPath
      );
      output.scan = this.parseScanOutput(scanResult);
    } catch (error) {
      console.warn('Scan failed:', error);
    }

    // Run buoy status
    try {
      const statusResult = await this.execCommand(
        this.buoyPath,
        ['status', '--json'],
        repoPath
      );
      output.status = this.parseStatusOutput(statusResult);
    } catch (error) {
      console.warn('Status failed:', error);
    }

    // Run buoy drift check
    try {
      const driftResult = await this.execCommand(
        this.buoyPath,
        ['drift', 'check', '--json'],
        repoPath
      );
      output.drift = this.parseDriftOutput(driftResult);
    } catch (error) {
      console.warn('Drift check failed:', error);
    }

    return output;
  }

  /**
   * Execute a command with timeout
   */
  private execCommand(
    command: string,
    args: string[],
    cwd: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd,
        shell: true,
        timeout: this.timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        if (error.message.includes('ETIMEDOUT')) {
          reject(new TimeoutError(`Command timed out after ${this.timeoutMs}ms`));
        } else {
          reject(error);
        }
      });

      // Handle timeout
      setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new TimeoutError(`Command timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
  }

  /**
   * Parse scan output
   */
  private parseScanOutput(output: string): BuoyOutput['scan'] {
    try {
      const data = JSON.parse(output);
      return {
        components: data.components?.length ?? 0,
        tokens: data.tokens?.length ?? 0,
        sources: data.sources ?? [],
      };
    } catch {
      return { components: 0, tokens: 0, sources: [] };
    }
  }

  /**
   * Parse status output
   */
  private parseStatusOutput(output: string): BuoyOutput['status'] {
    try {
      const data = JSON.parse(output);
      return {
        coverage: data.coverage ?? {},
      };
    } catch {
      return { coverage: {} };
    }
  }

  /**
   * Parse drift output
   */
  private parseDriftOutput(output: string): BuoyOutput['drift'] {
    try {
      const data = JSON.parse(output);
      const signals = data.signals ?? data.driftSignals ?? [];

      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};

      for (const signal of signals) {
        const type = signal.type ?? 'unknown';
        const severity = signal.severity ?? 'info';

        byType[type] = (byType[type] ?? 0) + 1;
        bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
      }

      return {
        total: signals.length,
        byType,
        bySeverity,
        signals,
      };
    } catch {
      return { total: 0, byType: {}, bySeverity: {}, signals: [] };
    }
  }

  /**
   * Get Buoy version
   */
  private async getBuoyVersion(): Promise<string> {
    try {
      const output = await this.execCommand(this.buoyPath, ['--version'], process.cwd());
      return output.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Save test results
   */
  private async saveResults(repo: DiscoveredRepo, testRun: TestRun): Promise<string> {
    const resultDir = join(this.resultsDir, repo.owner, repo.name);
    await mkdir(resultDir, { recursive: true });

    const resultPath = join(resultDir, 'test-run.json');
    await writeFile(resultPath, JSON.stringify(testRun, null, 2));

    return resultDir;
  }

  /**
   * Load previous test run
   */
  async loadTestRun(owner: string, name: string): Promise<TestRun | null> {
    const resultPath = join(this.resultsDir, owner, name, 'test-run.json');

    if (!existsSync(resultPath)) {
      return null;
    }

    try {
      const content = await readFile(resultPath, 'utf-8');
      return JSON.parse(content, (key, value) => {
        if (key.endsWith('At') || key === 'lastCommit') {
          return new Date(value);
        }
        return value;
      });
    } catch {
      return null;
    }
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
