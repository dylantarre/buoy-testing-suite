#!/usr/bin/env node
/**
 * Compare Deterministic Scanner with Ground Truth
 *
 * Uses existing ground truth files (from AI scans) to identify
 * components/tokens that the deterministic scanner misses.
 *
 * Goal: Scanner should find EVERYTHING the AI found (and more).
 */

import 'dotenv/config';
import {
  ReactComponentScanner,
  VueComponentScanner,
  SvelteComponentScanner,
  AngularComponentScanner,
  TokenScanner,
  TailwindScanner,
} from '@ahoybuoy/scanners';
import type { Component, DesignToken } from '@ahoybuoy/core';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

interface GroundTruth {
  repo: string;
  components: {
    total: number;
    names: string[];
    byType: Record<string, number>;
  };
  tokens: {
    total: number;
    samples: Record<string, string[]>;
    byCategory: Record<string, number>;
  };
  patterns: string[];
}

interface ComparisonResult {
  repo: string;
  scanner: {
    components: number;
    componentNames: string[];
    tokens: number;
    tokenNames: string[];
  };
  groundTruth: {
    components: number;
    componentNames: string[];
    tokens: number;
    tokenSamples: string[];
  };
  missing: {
    components: string[];  // AI found, scanner missed
    tokens: string[];      // AI found, scanner missed
  };
  coverage: {
    components: number;
    tokens: number;
  };
}

interface AggregateStats {
  totalRepos: number;
  perfectCoverage: number;
  missingComponents: Map<string, string[]>; // Component name -> repos where missed
  missingTokens: Map<string, string[]>;     // Token name -> repos where missed
  avgComponentCoverage: number;
  avgTokenCoverage: number;
}

const REPOS_DIR = './repos';
const RESULTS_DIR = './results';
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__tests__', '__mocks__', '.turbo', '.cache'];

async function runDeterministicScanner(repoPath: string): Promise<{ components: Component[]; tokens: DesignToken[] }> {
  const components: Component[] = [];
  const tokens: DesignToken[] = [];
  const excludePatterns = IGNORE_DIRS.map(d => `**/${d}/**`);

  // React Scanner
  try {
    const reactScanner = new ReactComponentScanner({
      projectRoot: repoPath,
      exclude: excludePatterns,
      overrideDefaultExcludes: true, // Don't merge CORE_EXCLUDES - we want to scan examples too
    });
    const reactResult = await reactScanner.scan();
    components.push(...reactResult.items);
  } catch (err) {
    // Scanner failed, continue
  }

  // Vue Scanner
  try {
    const vueScanner = new VueComponentScanner({
      projectRoot: repoPath,
      exclude: excludePatterns,
      overrideDefaultExcludes: true, // Don't merge CORE_EXCLUDES - we want to scan examples too
    });
    const vueResult = await vueScanner.scan();
    components.push(...vueResult.items);
  } catch (err) {
    // Scanner failed, continue
  }

  // Svelte Scanner
  try {
    const svelteScanner = new SvelteComponentScanner({
      projectRoot: repoPath,
      exclude: excludePatterns,
      overrideDefaultExcludes: true, // Don't merge CORE_EXCLUDES - we want to scan examples too
    });
    const svelteResult = await svelteScanner.scan();
    components.push(...svelteResult.items);
  } catch (err) {
    // Scanner failed, continue
  }

  // Angular Scanner
  try {
    const angularScanner = new AngularComponentScanner({
      projectRoot: repoPath,
      exclude: excludePatterns,
      overrideDefaultExcludes: true, // Don't merge CORE_EXCLUDES - we want to scan examples too
    });
    const angularResult = await angularScanner.scan();
    components.push(...angularResult.items);
  } catch (err) {
    // Scanner failed, continue
  }

  // Token Scanner
  try {
    const tokenScanner = new TokenScanner({
      projectRoot: repoPath,
      exclude: excludePatterns,
      overrideDefaultExcludes: true, // Don't merge CORE_EXCLUDES - we want to scan examples too
    });
    const tokenResult = await tokenScanner.scan();
    tokens.push(...tokenResult.items);
  } catch (err) {
    // Scanner failed, continue
  }

  // Tailwind Scanner
  try {
    const tailwindScanner = new TailwindScanner({
      projectRoot: repoPath,
    });
    const tailwindResult = await tailwindScanner.scan();
    if (tailwindResult.configPath) {
      tokens.push(...tailwindResult.tokens);
    }
  } catch (err) {
    // Tailwind scanner failing is common
  }

  return { components, tokens };
}

async function loadGroundTruth(owner: string, name: string): Promise<GroundTruth | null> {
  const groundTruthPath = join(RESULTS_DIR, owner, name, 'ground-truth.json');

  if (!existsSync(groundTruthPath)) {
    return null;
  }

  try {
    const content = await readFile(groundTruthPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function normalizeComponentName(name: string): string {
  // Normalize to lowercase, remove non-alphanumeric
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeTokenName(name: string): string {
  // Normalize CSS variable names
  return name.toLowerCase().replace(/^--/, '').replace(/[^a-z0-9-]/g, '');
}

function compareResults(
  owner: string,
  name: string,
  scanner: { components: Component[]; tokens: DesignToken[] },
  groundTruth: GroundTruth
): ComparisonResult {
  // Build set of found component names (normalized)
  const foundComponentNames = new Set(
    scanner.components.map(c => normalizeComponentName(c.name))
  );

  // Build set of found token names (normalized)
  const foundTokenNames = new Set(
    scanner.tokens.map(t => normalizeTokenName(t.name))
  );

  // Find missing components
  const missingComponents: string[] = [];
  for (const name of groundTruth.components.names) {
    const normalized = normalizeComponentName(name);
    if (!foundComponentNames.has(normalized)) {
      missingComponents.push(name);
    }
  }

  // Flatten all token samples into a list
  const allGroundTruthTokens: string[] = [];
  for (const samples of Object.values(groundTruth.tokens.samples)) {
    allGroundTruthTokens.push(...samples);
  }

  // Find missing tokens
  const missingTokens: string[] = [];
  for (const tokenName of allGroundTruthTokens) {
    const normalized = normalizeTokenName(tokenName);
    if (!foundTokenNames.has(normalized)) {
      missingTokens.push(tokenName);
    }
  }

  // Calculate coverage
  const componentCoverage = groundTruth.components.names.length > 0
    ? (groundTruth.components.names.length - missingComponents.length) / groundTruth.components.names.length
    : 1;

  const tokenCoverage = allGroundTruthTokens.length > 0
    ? (allGroundTruthTokens.length - missingTokens.length) / allGroundTruthTokens.length
    : 1;

  return {
    repo: `${owner}/${name}`,
    scanner: {
      components: scanner.components.length,
      componentNames: scanner.components.map(c => c.name).slice(0, 50),
      tokens: scanner.tokens.length,
      tokenNames: scanner.tokens.map(t => t.name).slice(0, 50),
    },
    groundTruth: {
      components: groundTruth.components.total,
      componentNames: groundTruth.components.names,
      tokens: groundTruth.tokens.total,
      tokenSamples: allGroundTruthTokens,
    },
    missing: {
      components: missingComponents,
      tokens: missingTokens,
    },
    coverage: {
      components: Math.round(componentCoverage * 100),
      tokens: Math.round(tokenCoverage * 100),
    },
  };
}

async function findAllReposWithGroundTruth(): Promise<Array<{ owner: string; name: string }>> {
  const repos: Array<{ owner: string; name: string }> = [];

  const owners = await readdir(RESULTS_DIR, { withFileTypes: true });
  for (const owner of owners) {
    if (!owner.isDirectory()) continue;
    if (owner.name.startsWith('.')) continue;

    const ownerPath = join(RESULTS_DIR, owner.name);
    const repoNames = await readdir(ownerPath, { withFileTypes: true });

    for (const repo of repoNames) {
      if (!repo.isDirectory()) continue;

      const groundTruthPath = join(ownerPath, repo.name, 'ground-truth.json');
      if (existsSync(groundTruthPath)) {
        repos.push({ owner: owner.name, name: repo.name });
      }
    }
  }

  return repos;
}

async function main() {
  console.log('🔍 Scanner Coverage Analysis');
  console.log('============================');
  console.log('Comparing deterministic scanner with AI ground truth\n');

  // Find all repos with ground truth
  const repos = await findAllReposWithGroundTruth();
  console.log(`Found ${repos.length} repos with ground truth files\n`);

  const results: ComparisonResult[] = [];
  const stats: AggregateStats = {
    totalRepos: repos.length,
    perfectCoverage: 0,
    missingComponents: new Map(),
    missingTokens: new Map(),
    avgComponentCoverage: 0,
    avgTokenCoverage: 0,
  };

  let totalComponentCoverage = 0;
  let totalTokenCoverage = 0;
  let processedCount = 0;

  for (const { owner, name } of repos) {
    const repoPath = join(REPOS_DIR, owner, name);

    if (!existsSync(repoPath)) {
      console.log(`⏭️  Skipping ${owner}/${name} - repo not cloned`);
      continue;
    }

    console.log(`\n[${processedCount + 1}/${repos.length}] Analyzing ${owner}/${name}...`);

    // Load ground truth
    const groundTruth = await loadGroundTruth(owner, name);
    if (!groundTruth) {
      console.log(`  ⚠️  No ground truth found`);
      continue;
    }

    // Run deterministic scanner
    console.log(`  📊 Running scanner...`);
    const scannerResult = await runDeterministicScanner(repoPath);
    console.log(`     Found ${scannerResult.components.length} components, ${scannerResult.tokens.length} tokens`);

    // Compare
    const comparison = compareResults(owner, name, scannerResult, groundTruth);
    results.push(comparison);

    // Update stats
    totalComponentCoverage += comparison.coverage.components;
    totalTokenCoverage += comparison.coverage.tokens;

    if (comparison.coverage.components === 100 && comparison.coverage.tokens === 100) {
      stats.perfectCoverage++;
      console.log(`  ✅ 100% COVERAGE!`);
    } else {
      console.log(`  📈 Coverage: Components ${comparison.coverage.components}% | Tokens ${comparison.coverage.tokens}%`);

      if (comparison.missing.components.length > 0) {
        console.log(`  ❌ Missing components: ${comparison.missing.components.slice(0, 5).join(', ')}${comparison.missing.components.length > 5 ? '...' : ''}`);

        // Track missing components
        for (const comp of comparison.missing.components) {
          if (!stats.missingComponents.has(comp)) {
            stats.missingComponents.set(comp, []);
          }
          stats.missingComponents.get(comp)!.push(`${owner}/${name}`);
        }
      }

      if (comparison.missing.tokens.length > 0) {
        console.log(`  ❌ Missing tokens: ${comparison.missing.tokens.slice(0, 5).join(', ')}${comparison.missing.tokens.length > 5 ? '...' : ''}`);

        // Track missing tokens
        for (const token of comparison.missing.tokens) {
          if (!stats.missingTokens.has(token)) {
            stats.missingTokens.set(token, []);
          }
          stats.missingTokens.get(token)!.push(`${owner}/${name}`);
        }
      }
    }

    processedCount++;
  }

  // Calculate averages
  if (processedCount > 0) {
    stats.avgComponentCoverage = totalComponentCoverage / processedCount;
    stats.avgTokenCoverage = totalTokenCoverage / processedCount;
  }

  // Print summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Repos analyzed: ${processedCount}`);
  console.log(`Perfect coverage (100%): ${stats.perfectCoverage}/${processedCount} (${Math.round(stats.perfectCoverage / processedCount * 100)}%)`);
  console.log(`Average component coverage: ${stats.avgComponentCoverage.toFixed(1)}%`);
  console.log(`Average token coverage: ${stats.avgTokenCoverage.toFixed(1)}%`);

  // Print most commonly missed components
  if (stats.missingComponents.size > 0) {
    console.log('\n📊 Most Commonly Missed Components:');
    const sortedComponents = [...stats.missingComponents.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 20);

    for (const [comp, repos] of sortedComponents) {
      console.log(`  - ${comp}: missed in ${repos.length} repos`);
    }
  }

  // Print most commonly missed tokens
  if (stats.missingTokens.size > 0) {
    console.log('\n📊 Most Commonly Missed Tokens:');
    const sortedTokens = [...stats.missingTokens.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 20);

    for (const [token, repos] of sortedTokens) {
      console.log(`  - ${token}: missed in ${repos.length} repos`);
    }
  }

  // Save detailed results
  const outputDir = join(RESULTS_DIR, '_coverage-analysis');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    join(outputDir, 'comparison-results.json'),
    JSON.stringify(results, null, 2)
  );

  await writeFile(
    join(outputDir, 'missing-components.json'),
    JSON.stringify(Object.fromEntries(stats.missingComponents), null, 2)
  );

  await writeFile(
    join(outputDir, 'missing-tokens.json'),
    JSON.stringify(Object.fromEntries(stats.missingTokens), null, 2)
  );

  console.log(`\n💾 Results saved to ${outputDir}`);
}

main().catch(console.error);
