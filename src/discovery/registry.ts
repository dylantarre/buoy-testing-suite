import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { Registry, DiscoveredRepo } from '../types.js';
import { RegistrySchema } from '../types.js';

const REGISTRY_VERSION = '1.0.0';

export class RegistryManager {
  private registryPath: string;
  private registry: Registry | null = null;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  /**
   * Load registry from disk
   */
  async load(): Promise<Registry> {
    if (this.registry) {
      return this.registry;
    }

    if (!existsSync(this.registryPath)) {
      this.registry = {
        version: REGISTRY_VERSION,
        lastUpdated: new Date(),
        repos: [],
      };
      return this.registry;
    }

    try {
      const content = await readFile(this.registryPath, 'utf-8');
      const data = JSON.parse(content, (key, value) => {
        // Convert date strings back to Date objects
        if (key.endsWith('At') || key === 'lastUpdated' || key === 'lastCommit') {
          return new Date(value);
        }
        return value;
      });

      this.registry = RegistrySchema.parse(data);
      return this.registry;
    } catch (error) {
      console.error('Failed to load registry, creating new one:', error);
      this.registry = {
        version: REGISTRY_VERSION,
        lastUpdated: new Date(),
        repos: [],
      };
      return this.registry;
    }
  }

  /**
   * Save registry to disk
   */
  async save(): Promise<void> {
    if (!this.registry) {
      throw new Error('No registry loaded');
    }

    this.registry.lastUpdated = new Date();

    const dir = dirname(this.registryPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(
      this.registryPath,
      JSON.stringify(this.registry, null, 2),
      'utf-8'
    );
  }

  /**
   * Add or update repos in registry
   */
  async addRepos(repos: DiscoveredRepo[]): Promise<{ added: number; updated: number }> {
    const registry = await this.load();
    let added = 0;
    let updated = 0;

    for (const repo of repos) {
      const existingIndex = registry.repos.findIndex((r) => r.url === repo.url);

      if (existingIndex >= 0) {
        registry.repos[existingIndex] = repo;
        updated++;
      } else {
        registry.repos.push(repo);
        added++;
      }
    }

    // Re-sort by score
    registry.repos.sort((a, b) => b.score.total - a.score.total);

    await this.save();

    return { added, updated };
  }

  /**
   * Remove repo from registry
   */
  async removeRepo(url: string): Promise<boolean> {
    const registry = await this.load();
    const index = registry.repos.findIndex((r) => r.url === url);

    if (index >= 0) {
      registry.repos.splice(index, 1);
      await this.save();
      return true;
    }

    return false;
  }

  /**
   * Get top N repos by score
   */
  async getTopRepos(n: number): Promise<DiscoveredRepo[]> {
    const registry = await this.load();
    return registry.repos.slice(0, n);
  }

  /**
   * Get repos with specific signal
   */
  async getReposWithSignal(signal: string): Promise<DiscoveredRepo[]> {
    const registry = await this.load();
    return registry.repos.filter(
      (r) =>
        r.designSystemSignals.includes(signal as never) ||
        r.activitySignals.includes(signal as never)
    );
  }

  /**
   * Get repos that haven't been tested
   */
  async getUntestedRepos(): Promise<DiscoveredRepo[]> {
    const registry = await this.load();
    return registry.repos.filter((r) => !r.lastTestedAt);
  }

  /**
   * Mark repo as tested
   */
  async markTested(url: string): Promise<void> {
    const registry = await this.load();
    const repo = registry.repos.find((r) => r.url === url);

    if (repo) {
      repo.lastTestedAt = new Date();
      await this.save();
    }
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<{
    totalRepos: number;
    testedRepos: number;
    avgScore: number;
    signalCounts: Record<string, number>;
  }> {
    const registry = await this.load();

    const signalCounts: Record<string, number> = {};
    let totalScore = 0;
    let testedCount = 0;

    for (const repo of registry.repos) {
      totalScore += repo.score.total;

      if (repo.lastTestedAt) {
        testedCount++;
      }

      for (const signal of repo.designSystemSignals) {
        signalCounts[signal] = (signalCounts[signal] ?? 0) + 1;
      }

      for (const signal of repo.activitySignals) {
        signalCounts[signal] = (signalCounts[signal] ?? 0) + 1;
      }
    }

    return {
      totalRepos: registry.repos.length,
      testedRepos: testedCount,
      avgScore:
        registry.repos.length > 0 ? totalScore / registry.repos.length : 0,
      signalCounts,
    };
  }

  /**
   * Get all repos
   */
  async getAllRepos(): Promise<DiscoveredRepo[]> {
    const registry = await this.load();
    return registry.repos;
  }

  /**
   * Filter repos by minimum score
   */
  async filterByScore(minScore: number): Promise<DiscoveredRepo[]> {
    const registry = await this.load();
    return registry.repos.filter((r) => r.score.total >= minScore);
  }
}
