#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'path';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { GitHubSearcher, RegistryManager } from './discovery/index.js';
import { BuoyRunner, RepoCache } from './execution/index.js';
import { JsonReporter, MarkdownReporter, PromptBuilder, PublicStatsGenerator } from './reporting/index.js';
import { Assessor } from './assessment/index.js';
import { GroundTruthScanner } from './assessment/ground-truth.js';
import { MIN_SCORE_THRESHOLD } from './types.js';
import type { TestRun } from './types.js';

const program = new Command();

// Common paths
const getReposDir = () => join(process.cwd(), 'repos');
const getResultsDir = () => join(process.cwd(), 'results');
const getRegistryPath = () => join(process.cwd(), 'registry', 'repos.json');

program
  .name('buoy-lab')
  .description('Research platform for testing Buoy and gathering design system statistics')
  .version('0.1.0');

// ============================================================================
// Discovery Commands
// ============================================================================

const discoverCmd = program.command('discover').description('Discover repos with design systems');

discoverCmd
  .command('search')
  .description('Search GitHub for repos with design system indicators')
  .option('--min-score <n>', 'Minimum score threshold', String(MIN_SCORE_THRESHOLD))
  .option('--min-stars <n>', 'Minimum star count', '50')
  .option('--max-results <n>', 'Maximum repos to find', '100')
  .action(async (options) => {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error(chalk.red('Error: GITHUB_TOKEN environment variable required'));
      process.exit(1);
    }

    console.log(chalk.blue('Searching GitHub for repos with design systems...'));

    const searcher = new GitHubSearcher({
      token,
      minStars: parseInt(options.minStars, 10),
      maxResults: parseInt(options.maxResults, 10),
    });

    const repos = await searcher.searchForDesignSystemRepos();

    const minScore = parseInt(options.minScore, 10);
    const filtered = repos.filter((r) => r.score.total >= minScore);

    console.log(chalk.green(`\nFound ${filtered.length} repos (score >= ${minScore}):\n`));

    for (const repo of filtered.slice(0, 20)) {
      console.log(
        `  ${chalk.bold(repo.owner + '/' + repo.name)} ` +
          chalk.dim(`(score: ${repo.score.total}, stars: ${repo.stars})`)
      );
      console.log(
        `    Signals: ${[...repo.designSystemSignals, ...repo.activitySignals].join(', ')}`
      );
    }

    if (filtered.length > 20) {
      console.log(chalk.dim(`\n  ... and ${filtered.length - 20} more`));
    }

    // Save to registry
    const registry = new RegistryManager(getRegistryPath());
    const { added, updated } = await registry.addRepos(filtered);

    console.log(chalk.green(`\nRegistry updated: ${added} added, ${updated} updated`));
  });

discoverCmd
  .command('apps')
  .description('Search GitHub for apps (not libraries) that will have design drift')
  .option('--min-stars <n>', 'Minimum star count', '20')
  .option('--max-results <n>', 'Maximum repos to find', '100')
  .option('--page <n>', 'Search results page (for pagination)', '1')
  .action(async (options) => {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error(chalk.red('Error: GITHUB_TOKEN environment variable required'));
      process.exit(1);
    }

    const page = parseInt(options.page, 10);
    console.log(chalk.blue(`Searching GitHub for apps with potential design drift (page ${page})...`));
    console.log(chalk.dim('(Excluding design system libraries)\n'));

    const searcher = new GitHubSearcher({
      token,
      minStars: parseInt(options.minStars, 10),
      maxResults: parseInt(options.maxResults, 10),
    });

    const repos = await searcher.searchForApps({
      page,
      onProgress: (completed, total, phase) => {
        if (phase === 'search') {
          process.stdout.write(`\r  Searching: ${completed}/${total} queries`);
        } else {
          process.stdout.write(`\r  Enriching: ${completed}/${total} repos  `);
        }
      },
    });

    console.log(chalk.green(`\n\nFound ${repos.length} apps:\n`));

    for (const repo of repos.slice(0, 20)) {
      console.log(
        `  ${chalk.bold(repo.owner + '/' + repo.name)} ` +
          chalk.dim(`(score: ${repo.score.total}, stars: ${repo.stars})`)
      );
      console.log(
        `    Signals: ${[...repo.designSystemSignals, ...repo.activitySignals].join(', ')}`
      );
      if (repo.description) {
        console.log(chalk.dim(`    ${repo.description.slice(0, 80)}${repo.description.length > 80 ? '...' : ''}`));
      }
    }

    if (repos.length > 20) {
      console.log(chalk.dim(`\n  ... and ${repos.length - 20} more`));
    }

    // Save to registry
    const registry = new RegistryManager(getRegistryPath());
    const { added, updated } = await registry.addRepos(repos);

    console.log(chalk.green(`\nRegistry updated: ${added} added, ${updated} updated`));
  });

discoverCmd
  .command('add <repo>')
  .description('Analyze and add a specific repo (format: owner/name)')
  .action(async (repo) => {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error(chalk.red('Error: GITHUB_TOKEN environment variable required'));
      process.exit(1);
    }

    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      console.error(chalk.red('Error: Invalid repo format. Use owner/name'));
      process.exit(1);
    }

    console.log(chalk.blue(`Analyzing ${owner}/${name}...`));

    const searcher = new GitHubSearcher({ token });
    const discovered = await searcher.analyzeRepo(owner, name);

    if (!discovered) {
      console.error(chalk.red('Failed to analyze repo'));
      process.exit(1);
    }

    console.log(chalk.green(`\nRepo: ${discovered.owner}/${discovered.name}`));
    console.log(`  Score: ${discovered.score.total}`);
    console.log(`  Design System: ${discovered.designSystemSignals.join(', ') || 'none'}`);
    console.log(`  Activity: ${discovered.activitySignals.join(', ') || 'none'}`);
    console.log(`  Stars: ${discovered.stars}`);

    if (discovered.score.total < MIN_SCORE_THRESHOLD) {
      console.log(
        chalk.yellow(`\nScore below threshold (${MIN_SCORE_THRESHOLD}), not adding to registry`)
      );
      return;
    }

    const registry = new RegistryManager(getRegistryPath());
    await registry.addRepos([discovered]);

    console.log(chalk.green('\nAdded to registry'));
  });

// ============================================================================
// Registry Commands
// ============================================================================

const registryCmd = program.command('registry').description('Manage the repo registry');

registryCmd
  .command('list')
  .description('List repos in registry')
  .option('--top <n>', 'Show top N repos', '20')
  .option('--signal <signal>', 'Filter by signal')
  .action(async (options) => {
    const registry = new RegistryManager(getRegistryPath());

    let repos;
    if (options.signal) {
      repos = await registry.getReposWithSignal(options.signal);
    } else {
      repos = await registry.getTopRepos(parseInt(options.top, 10));
    }

    if (repos.length === 0) {
      console.log(chalk.yellow('No repos in registry. Run `buoy-test discover search` first.'));
      return;
    }

    console.log(chalk.bold(`\nRegistry (${repos.length} repos):\n`));

    for (const repo of repos) {
      const tested = repo.lastTestedAt
        ? chalk.green('tested')
        : chalk.dim('not tested');

      console.log(
        `  ${chalk.bold(repo.owner + '/' + repo.name)} ` +
          chalk.dim(`score:${repo.score.total}`) +
          ` [${tested}]`
      );
    }
  });

registryCmd
  .command('stats')
  .description('Show registry statistics')
  .action(async () => {
    const registry = new RegistryManager(getRegistryPath());
    const stats = await registry.getStats();

    console.log(chalk.bold('\nRegistry Statistics:\n'));
    console.log(`  Total repos: ${stats.totalRepos}`);
    console.log(`  Tested repos: ${stats.testedRepos}`);
    console.log(`  Average score: ${stats.avgScore.toFixed(1)}`);
    console.log('\n  Signal counts:');

    for (const [signal, count] of Object.entries(stats.signalCounts)) {
      console.log(`    ${signal}: ${count}`);
    }
  });

registryCmd
  .command('remove <repo>')
  .description('Remove a repo from registry (format: owner/name or URL)')
  .action(async (repo) => {
    const registry = new RegistryManager(getRegistryPath());

    // Handle both owner/name and URL formats
    const url = repo.includes('github.com')
      ? repo
      : `https://github.com/${repo}`;

    const removed = await registry.removeRepo(url);

    if (removed) {
      console.log(chalk.green(`Removed ${repo} from registry`));
    } else {
      console.log(chalk.yellow(`Repo not found in registry`));
    }
  });

// ============================================================================
// Run Commands
// ============================================================================

const runCmd = program.command('run').description('Run Buoy tests on repos');

runCmd
  .command('single <repo>')
  .description('Test a single repo (format: owner/name)')
  .option('--buoy-path <path>', 'Path to Buoy CLI', 'buoy')
  .option('--timeout <ms>', 'Timeout per repo in ms', '300000')
  .option('--no-ground-truth', 'Skip AI-based ground truth establishment (faster, no API needed)')
  .action(async (repo, options) => {
    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      console.error(chalk.red('Error: Invalid repo format. Use owner/name'));
      process.exit(1);
    }

    // Get repo from registry
    const registry = new RegistryManager(getRegistryPath());
    const repos = await registry.getAllRepos();
    const repoData = repos.find((r) => r.owner === owner && r.name === name);

    if (!repoData) {
      console.error(chalk.red(`Repo ${repo} not found in registry. Run 'buoy-test discover add ${repo}' first.`));
      process.exit(1);
    }

    console.log(chalk.blue(`\nTesting ${owner}/${name}...\n`));

    const runner = new BuoyRunner({
      reposDir: getReposDir(),
      resultsDir: getResultsDir(),
      buoyPath: options.buoyPath,
      timeoutMs: parseInt(options.timeout, 10),
      autoGroundTruth: options.groundTruth !== false,
    });

    const { testRun, outputPath, groundTruth, coverage } = await runner.runOnRepo(repoData);

    // Generate reports
    const jsonReporter = new JsonReporter({ resultsDir: getResultsDir() });
    const mdReporter = new MarkdownReporter({ resultsDir: getResultsDir() });
    const promptBuilder = new PromptBuilder({
      resultsDir: getResultsDir(),
      reposDir: getReposDir(),
    });

    await jsonReporter.saveReport(testRun);
    await mdReporter.saveReport(testRun);
    await promptBuilder.savePrompt(testRun);

    // Mark as tested in registry
    await registry.markTested(repoData.url);

    // Show coverage if available
    if (coverage && groundTruth) {
      console.log('');
      console.log(chalk.bold('Coverage vs Ground Truth:'));
      console.log(`  Components: ${testRun.buoyOutput?.scan?.components ?? 0}/${groundTruth.components.total} (${(coverage.components * 100).toFixed(0)}%)`);
      console.log(`  Tokens: ${testRun.buoyOutput?.scan?.tokens ?? 0}/${groundTruth.tokens.total} (${(coverage.tokens * 100).toFixed(0)}%)`);

      if (coverage.isComplete) {
        console.log(chalk.green.bold('\n✓ COMPLETE - 100% coverage reached!'));
      } else {
        const compGap = groundTruth.components.total - (testRun.buoyOutput?.scan?.components ?? 0);
        const tokGap = groundTruth.tokens.total - (testRun.buoyOutput?.scan?.tokens ?? 0);
        console.log(chalk.yellow(`\n○ Gaps: ${compGap} components, ${tokGap} tokens to reach 100%`));
      }
    }

    // Print summary
    console.log(chalk.green(`\nTest completed: ${testRun.status}`));
    console.log(`  Duration: ${((testRun.durationMs ?? 0) / 1000).toFixed(1)}s`);
    console.log(`  Components: ${testRun.buoyOutput?.scan?.components ?? 0}`);
    console.log(`  Tokens: ${testRun.buoyOutput?.scan?.tokens ?? 0}`);
    console.log(`  Drift signals: ${testRun.buoyOutput?.drift?.total ?? 0}`);
    console.log(`\nResults saved to: ${outputPath}`);
  });

runCmd
  .command('batch')
  .description('Test multiple repos from registry')
  .option('--top <n>', 'Test top N repos by score', '10')
  .option('--untested', 'Only test repos that haven\'t been tested')
  .option('--buoy-path <path>', 'Path to Buoy CLI', 'buoy')
  .option('--timeout <ms>', 'Timeout per repo in ms', '300000')
  .option('--concurrency <n>', 'Number of repos to test in parallel', '3')
  .option('--no-ground-truth', 'Skip AI-based ground truth establishment (faster, no API needed)')
  .action(async (options) => {
    const registry = new RegistryManager(getRegistryPath());

    let repos;
    if (options.untested) {
      repos = await registry.getUntestedRepos();
      repos = repos.slice(0, parseInt(options.top, 10));
    } else {
      repos = await registry.getTopRepos(parseInt(options.top, 10));
    }

    if (repos.length === 0) {
      console.log(chalk.yellow('No repos to test.'));
      return;
    }

    console.log(chalk.blue(`\nTesting ${repos.length} repos...\n`));

    const runner = new BuoyRunner({
      reposDir: getReposDir(),
      resultsDir: getResultsDir(),
      buoyPath: options.buoyPath,
      timeoutMs: parseInt(options.timeout, 10),
      autoGroundTruth: options.groundTruth !== false,  // --no-ground-truth sets this to false
    });

    const jsonReporter = new JsonReporter({ resultsDir: getResultsDir() });
    const mdReporter = new MarkdownReporter({ resultsDir: getResultsDir() });
    const promptBuilder = new PromptBuilder({
      resultsDir: getResultsDir(),
      reposDir: getReposDir(),
    });

    const concurrency = parseInt(options.concurrency, 10);
    const activeRepos = new Set<string>();

    console.log(chalk.cyan(`\nRunning with concurrency: ${concurrency}`));

    const results = await runner.runOnRepos(repos, {
      concurrency,
      onStart: (repo, index, total) => {
        const repoName = `${repo.owner}/${repo.name}`;
        activeRepos.add(repoName);
        if (concurrency > 1) {
          console.log(chalk.blue(`[${index}/${total}] Starting: ${repoName}`));
        } else {
          console.log(chalk.blue(`\n[${index}/${total}] Scanning ${repoName}...`));
        }
      },
      onProgress: (completed, total) => {
        console.log(chalk.green(`✓ ${completed}/${total} complete`));
      },
    });

    // Generate reports for each
    for (const { testRun } of results) {
      await jsonReporter.saveReport(testRun);
      await mdReporter.saveReport(testRun);
      await promptBuilder.savePrompt(testRun);
      await registry.markTested(testRun.repo.url);
    }

    // Summary
    const successful = results.filter((r) => r.testRun.status === 'completed').length;
    const failed = results.filter((r) => r.testRun.status === 'failed' || r.testRun.status === 'timeout').length;
    const totalDrift = results.reduce((sum, r) => sum + (r.testRun.buoyOutput?.drift?.total ?? 0), 0);

    console.log(chalk.green(`\nBatch complete:`));
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total drift signals: ${totalDrift}`);
    console.log(`\nResults saved to: ${getResultsDir()}`);
  });

// ============================================================================
// Cache Commands
// ============================================================================

const cacheCmd = program.command('cache').description('Manage cloned repo cache');

cacheCmd
  .command('status')
  .description('Show cache statistics')
  .action(async () => {
    const cache = new RepoCache({ reposDir: getReposDir() });
    const stats = await cache.getStats();

    console.log(chalk.bold('\nCache Statistics:\n'));
    console.log(`  Total repos: ${stats.totalRepos}`);
    console.log(`  Total size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(1)} MB`);

    if (stats.oldestRepo) {
      console.log(`  Oldest: ${stats.oldestRepo.toISOString().split('T')[0]}`);
    }
    if (stats.newestRepo) {
      console.log(`  Newest: ${stats.newestRepo.toISOString().split('T')[0]}`);
    }
  });

cacheCmd
  .command('clean')
  .description('Clean cached repos')
  .option('--all', 'Remove all cached repos')
  .option('--older-than <days>', 'Remove repos older than N days', '7')
  .action(async (options) => {
    const cache = new RepoCache({
      reposDir: getReposDir(),
      maxAgeDays: parseInt(options.olderThan, 10),
    });

    let removed: number;
    if (options.all) {
      removed = await cache.cleanAll();
    } else {
      removed = await cache.cleanOld();
    }

    console.log(chalk.green(`Removed ${removed} repos from cache`));
  });

// ============================================================================
// Report Commands
// ============================================================================

program
  .command('aggregate')
  .description('Aggregate results across all tested repos')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const resultsDir = getResultsDir();

    if (!existsSync(resultsDir)) {
      console.log(chalk.yellow('No results found. Run some tests first.'));
      return;
    }

    // Collect all test runs
    const testRuns: TestRun[] = [];

    const owners = await readdir(resultsDir);
    for (const owner of owners) {
      const ownerPath = join(resultsDir, owner);
      try {
        const repos = await readdir(ownerPath);
        for (const repo of repos) {
          const testRunPath = join(ownerPath, repo, 'test-run.json');
          if (existsSync(testRunPath)) {
            const { readFile } = await import('fs/promises');
            const content = await readFile(testRunPath, 'utf-8');
            testRuns.push(JSON.parse(content));
          }
        }
      } catch {
        // Skip non-directories
      }
    }

    if (testRuns.length === 0) {
      console.log(chalk.yellow('No test results found.'));
      return;
    }

    const jsonReporter = new JsonReporter({ resultsDir });
    const mdReporter = new MarkdownReporter({ resultsDir });

    if (options.json) {
      const aggregate = jsonReporter.generateAggregateReport(testRuns);
      console.log(JSON.stringify(aggregate, null, 2));
    } else {
      const aggregate = jsonReporter.generateAggregateReport(testRuns);
      await jsonReporter.saveAggregateReport(testRuns);
      await mdReporter.saveAggregateReport(testRuns);

      console.log(chalk.bold('\nAggregate Results:\n'));
      console.log(`  Repos tested: ${aggregate.summary.totalRepos}`);
      console.log(`  Successful: ${aggregate.summary.successfulRuns}`);
      console.log(`  Failed: ${aggregate.summary.failedRuns}`);
      console.log(`  Total components: ${aggregate.summary.totalComponents}`);
      console.log(`  Total tokens: ${aggregate.summary.totalTokens}`);
      console.log(`  Total drift signals: ${aggregate.summary.totalDriftSignals}`);

      console.log('\n  Top drift types:');
      for (const { type, count, percentage } of aggregate.topDriftTypes.slice(0, 5)) {
        console.log(`    ${type}: ${count} (${percentage.toFixed(1)}%)`);
      }

      console.log(`\nReports saved to: ${resultsDir}`);
    }
  });

// ============================================================================
// Assess Commands - Claude-powered analysis
// ============================================================================

const assessCmd = program.command('assess').description('Run Claude assessment on test results');

assessCmd
  .command('single <repo>')
  .description('Assess a single tested repo')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .option('--max-tokens <n>', 'Max response tokens', '8000')
  .option('--dry-run', 'Show prompt without calling API')
  .option('--force', 'Re-assess even if already assessed')
  .action(async (repo, options) => {
    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      console.error(chalk.red('Error: Invalid repo format. Use owner/name'));
      process.exit(1);
    }

    const testRunPath = join(getResultsDir(), owner, name, 'test-run.json');
    if (!existsSync(testRunPath)) {
      console.error(chalk.red(`No test results for ${repo}. Run 'buoy-test run single ${repo}' first.`));
      process.exit(1);
    }

    // Check if already assessed
    const assessmentPath = join(getResultsDir(), owner, name, 'assessment.json');
    if (existsSync(assessmentPath) && !options.force && !options.dryRun) {
      console.log(chalk.yellow(`${repo} already assessed. Use --force to re-assess.`));
      return;
    }

    // Load test run
    const { readFile } = await import('fs/promises');
    const testRun: TestRun = JSON.parse(await readFile(testRunPath, 'utf-8'));

    const assessor = new Assessor({
      reposDir: getReposDir(),
      resultsDir: getResultsDir(),
      model: options.model,
      maxTokens: parseInt(options.maxTokens, 10),
    });

    if (options.dryRun) {
      console.log(chalk.blue(`\nDry run - prompt for ${repo}:\n`));
      const prompt = await assessor.dryRun(testRun);
      console.log(prompt);
      console.log(chalk.dim(`\n--- End of prompt (${prompt.length} chars) ---`));
      return;
    }

    console.log(chalk.blue(`\nAssessing ${repo} with Claude...`));
    console.log(chalk.dim(`Model: ${options.model}`));

    try {
      const { assessment, outputPath, tokensUsed } = await assessor.assessTestRun(testRun);

      console.log(chalk.green(`\nAssessment complete!`));
      console.log(`  Mode: ${assessment.mode}`);
      console.log(`  Tokens used: ${tokensUsed}`);
      console.log(`  Missed patterns: ${assessment.missedPatterns.length}`);
      console.log(`  Improvements: ${assessment.improvements.length}`);

      if (assessment.missedPatterns.length > 0) {
        console.log(chalk.bold('\nTop missed patterns:'));
        for (const pattern of assessment.missedPatterns.slice(0, 5)) {
          console.log(`  - [${pattern.severity}] ${pattern.category}: ${pattern.description}`);
          console.log(chalk.dim(`    File: ${pattern.evidence.file}`));
        }
      }

      if (assessment.improvements.length > 0) {
        console.log(chalk.bold('\nSuggested improvements:'));
        for (const imp of assessment.improvements.slice(0, 3)) {
          console.log(`  - [${imp.area}] ${imp.title}`);
          console.log(chalk.dim(`    ${imp.estimatedImpact}`));
        }
      }

      console.log(chalk.green(`\nResults saved to: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('\nAssessment failed:'), error);
      process.exit(1);
    }
  });

assessCmd
  .command('batch')
  .alias('all')
  .description('Assess all tested repos')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .option('--max-tokens <n>', 'Max response tokens', '8000')
  .option('--skip-existing', 'Skip repos already assessed', true)
  .action(async (options) => {
    const resultsDir = getResultsDir();

    if (!existsSync(resultsDir)) {
      console.log(chalk.yellow('No results found. Run some tests first.'));
      return;
    }

    // Collect all test runs
    const testRuns: TestRun[] = [];
    const { readFile: rf } = await import('fs/promises');

    const owners = await readdir(resultsDir);
    for (const owner of owners) {
      const ownerPath = join(resultsDir, owner);
      try {
        const repos = await readdir(ownerPath);
        for (const repo of repos) {
          const testRunPath = join(ownerPath, repo, 'test-run.json');
          if (existsSync(testRunPath)) {
            const content = await rf(testRunPath, 'utf-8');
            testRuns.push(JSON.parse(content));
          }
        }
      } catch {
        // Skip non-directories
      }
    }

    if (testRuns.length === 0) {
      console.log(chalk.yellow('No test results found.'));
      return;
    }

    console.log(chalk.blue(`\nAssessing ${testRuns.length} repos with Claude...\n`));

    const assessor = new Assessor({
      reposDir: getReposDir(),
      resultsDir: getResultsDir(),
      model: options.model,
      maxTokens: parseInt(options.maxTokens, 10),
    });

    const results = await assessor.assessBatch(testRuns, {
      skipExisting: options.skipExisting,
      onProgress: (completed, total) => {
        console.log(chalk.dim(`  Progress: ${completed}/${total}`));
      },
    });

    // Summary
    const totalMissed = results.reduce((sum, r) => sum + r.assessment.missedPatterns.length, 0);
    const totalImprovements = results.reduce((sum, r) => sum + r.assessment.improvements.length, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);

    console.log(chalk.green(`\nBatch assessment complete!`));
    console.log(`  Repos assessed: ${results.length}`);
    console.log(`  Total missed patterns: ${totalMissed}`);
    console.log(`  Total improvements: ${totalImprovements}`);
    console.log(`  Total tokens used: ${totalTokens}`);
    console.log(`\nResults saved to: ${resultsDir}`);
  });

// ============================================================================
// Ground Truth / Baseline Commands
// ============================================================================

const baselineCmd = program.command('baseline').description('Establish ground truth for repos');

baselineCmd
  .command('<repo>')
  .description('Establish ground truth for a repo using AI consensus')
  .option('-n, --scans <n>', 'Number of parallel scans for consensus', '3')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .action(async (repo: string, options: { scans: string; model: string }) => {
    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      console.error(chalk.red('Error: Repo must be in format owner/name'));
      process.exit(1);
    }

    const scanner = new GroundTruthScanner({
      reposDir: getReposDir(),
      resultsDir: getResultsDir(),
      scanCount: parseInt(options.scans, 10),
      model: options.model,
    });

    console.log(chalk.blue(`Establishing ground truth for ${repo}...`));
    console.log(chalk.dim(`Using ${options.scans} parallel scans for consensus`));

    try {
      const groundTruth = await scanner.scan(owner, name);

      console.log(chalk.green('\nGround Truth Established:'));
      console.log(`  Components: ${groundTruth.components.total} (range: ${groundTruth.components.min}-${groundTruth.components.max})`);
      console.log(`  Tokens: ${groundTruth.tokens.total} (range: ${groundTruth.tokens.min}-${groundTruth.tokens.max})`);
      console.log(`  Consensus: ${(groundTruth.consensus * 100).toFixed(1)}%`);
      console.log(`  Confidence: ${(groundTruth.confidence * 100).toFixed(1)}%`);
      console.log(`  Patterns: ${groundTruth.patterns.join(', ')}`);
      console.log(chalk.dim(`\nSaved to results/${owner}/${name}/ground-truth.json`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

baselineCmd
  .command('all')
  .description('Establish ground truth for all repos in registry')
  .option('-n, --scans <n>', 'Number of parallel scans for consensus', '3')
  .option('--top <n>', 'Only process top N repos', '10')
  .action(async (options: { scans: string; top: string }) => {
    const registry = new RegistryManager(getRegistryPath());
    const repos = await registry.getTopRepos(parseInt(options.top, 10));

    console.log(chalk.blue(`Establishing ground truth for ${repos.length} repos...`));

    const scanner = new GroundTruthScanner({
      reposDir: getReposDir(),
      resultsDir: getResultsDir(),
      scanCount: parseInt(options.scans, 10),
    });

    for (const repo of repos) {
      try {
        console.log(chalk.dim(`\n${repo.owner}/${repo.name}...`));
        await scanner.scan(repo.owner, repo.name);
      } catch (error) {
        console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : error}`));
      }
    }

    console.log(chalk.green('\nGround truth established for all repos.'));
  });

// ============================================================================
// Progress / Completion Commands
// ============================================================================

program
  .command('progress')
  .description('Show progress towards completion')
  .option('--check-complete', 'Check if testing suite is complete')
  .action(async (options: { checkComplete?: boolean }) => {
    const resultsDir = getResultsDir();
    const { readFile: rf } = await import('fs/promises');

    // Collect all results
    const results: Array<{
      repo: string;
      detected: { components: number; tokens: number };
      groundTruth: { components: number; tokens: number } | null;
      coverage: { components: number; tokens: number };
      isComplete: boolean;
    }> = [];

    const owners = await readdir(resultsDir);
    for (const owner of owners) {
      const ownerPath = join(resultsDir, owner);
      try {
        const repos = await readdir(ownerPath);
        for (const repo of repos) {
          const testRunPath = join(ownerPath, repo, 'test-run.json');
          const groundTruthPath = join(ownerPath, repo, 'ground-truth.json');

          if (existsSync(testRunPath)) {
            const testRun = JSON.parse(await rf(testRunPath, 'utf-8'));
            const detected = {
              components: testRun.buoyOutput?.scan?.components ?? 0,
              tokens: testRun.buoyOutput?.scan?.tokens ?? 0,
            };

            let groundTruth = null;
            let coverage = { components: 0, tokens: 0 };
            let isComplete = false;

            if (existsSync(groundTruthPath)) {
              const gt = JSON.parse(await rf(groundTruthPath, 'utf-8'));
              groundTruth = {
                components: gt.components.total,
                tokens: gt.tokens.total,
              };
              coverage = {
                components: groundTruth.components > 0 ? detected.components / groundTruth.components : 1,
                tokens: groundTruth.tokens > 0 ? detected.tokens / groundTruth.tokens : 1,
              };
              isComplete = coverage.components >= 1.0 && coverage.tokens >= 1.0;
            }

            results.push({
              repo: `${owner}/${repo}`,
              detected,
              groundTruth,
              coverage,
              isComplete,
            });
          }
        }
      } catch {
        // Skip non-directories
      }
    }

    // Display results
    console.log(chalk.bold('\nProgress Report\n'));

    const complete = results.filter(r => r.isComplete);
    const incomplete = results.filter(r => !r.isComplete && r.groundTruth);
    const noGroundTruth = results.filter(r => !r.groundTruth);

    console.log(`Total repos: ${results.length}`);
    console.log(`  ${chalk.green('✓')} Complete (100%): ${complete.length}`);
    console.log(`  ${chalk.yellow('◐')} In progress: ${incomplete.length}`);
    console.log(`  ${chalk.dim('○')} No ground truth: ${noGroundTruth.length}`);

    if (incomplete.length > 0) {
      console.log(chalk.bold('\nIn Progress:'));
      for (const r of incomplete) {
        const compPct = (r.coverage.components * 100).toFixed(0);
        const tokPct = (r.coverage.tokens * 100).toFixed(0);
        console.log(`  ${r.repo}: ${compPct}% components, ${tokPct}% tokens`);
      }
    }

    if (noGroundTruth.length > 0 && noGroundTruth.length <= 10) {
      console.log(chalk.bold('\nNeed Ground Truth:'));
      for (const r of noGroundTruth) {
        console.log(`  ${r.repo}: ${r.detected.components} components, ${r.detected.tokens} tokens detected`);
      }
      console.log(chalk.dim('\nRun: ./dist/cli.js baseline <repo> to establish ground truth'));
    }

    // Check if complete
    if (options.checkComplete) {
      const allComplete = results.length > 0 &&
        noGroundTruth.length === 0 &&
        complete.length === results.length;

      if (allComplete) {
        console.log(chalk.green.bold('\n✓ TESTING SUITE COMPLETE'));
        console.log('All repos have reached 100% detection coverage.');
        process.exit(0);
      } else {
        console.log(chalk.yellow('\n○ NOT COMPLETE'));
        if (noGroundTruth.length > 0) {
          console.log(`  ${noGroundTruth.length} repos need ground truth`);
        }
        if (incomplete.length > 0) {
          console.log(`  ${incomplete.length} repos below 100% coverage`);
        }
        process.exit(1);
      }
    }
  });

// ============================================================================
// Assessment Commands (continued)
// ============================================================================

assessCmd
  .command('summary')
  .description('Generate aggregate assessment summary')
  .action(async () => {
    const resultsDir = getResultsDir();

    if (!existsSync(resultsDir)) {
      console.log(chalk.yellow('No results found.'));
      return;
    }

    // Collect all assessments
    const { readFile: rf } = await import('fs/promises');
    const allMissed: Array<{ repo: string; pattern: unknown }> = [];
    const allImprovements: Array<{ repo: string; improvement: unknown }> = [];
    const improvementCounts: Record<string, number> = {};

    const owners = await readdir(resultsDir);
    for (const owner of owners) {
      const ownerPath = join(resultsDir, owner);
      try {
        const repos = await readdir(ownerPath);
        for (const repo of repos) {
          const assessmentPath = join(ownerPath, repo, 'assessment.json');
          if (existsSync(assessmentPath)) {
            const content = await rf(assessmentPath, 'utf-8');
            const assessment = JSON.parse(content);

            for (const pattern of assessment.missedPatterns ?? []) {
              allMissed.push({ repo: `${owner}/${repo}`, pattern });
            }

            for (const improvement of assessment.improvements ?? []) {
              allImprovements.push({ repo: `${owner}/${repo}`, improvement });
              const area = improvement.area ?? 'unknown';
              improvementCounts[area] = (improvementCounts[area] ?? 0) + 1;
            }
          }
        }
      } catch {
        // Skip non-directories
      }
    }

    if (allMissed.length === 0 && allImprovements.length === 0) {
      console.log(chalk.yellow('No assessments found. Run `assess batch` first.'));
      return;
    }

    console.log(chalk.bold('\nAssessment Summary\n'));
    console.log(`Total missed patterns: ${allMissed.length}`);
    console.log(`Total improvements: ${allImprovements.length}`);

    console.log(chalk.bold('\nImprovement areas:'));
    const sorted = Object.entries(improvementCounts).sort((a, b) => b[1] - a[1]);
    for (const [area, count] of sorted) {
      console.log(`  ${area}: ${count}`);
    }

    console.log(chalk.bold('\nMissed by category:'));
    const byCategory: Record<string, number> = {};
    for (const { pattern } of allMissed) {
      const p = pattern as Record<string, unknown>;
      const cat = String(p['category'] ?? 'unknown');
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
    for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
  });

// ============================================================================
// Stats Commands - Public statistics for State of Design Systems
// ============================================================================

const statsCmd = program.command('stats').description('Generate public statistics for State of Design Systems report');

statsCmd
  .command('generate')
  .description('Generate public statistics from test results')
  .option('--output <path>', 'Output path for JSON file')
  .option('--json', 'Output raw JSON to stdout')
  .option('--markdown', 'Output markdown summary')
  .action(async (options) => {
    const generator = new PublicStatsGenerator({
      resultsDir: getResultsDir(),
      reposDir: getReposDir(),
    });

    if (options.json) {
      const stats = await generator.generateStats();
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    if (options.markdown) {
      const markdown = await generator.generateMarkdownSummary();
      console.log(markdown);
      return;
    }

    console.log(chalk.blue('Generating public statistics...'));

    const outputPath = await generator.saveStats(options.output);
    const stats = await generator.generateStats();

    console.log(chalk.green(`\nStatistics generated!`));

    // Scan status breakdown
    console.log(chalk.bold('\nScan Status:'));
    console.log(`  Total attempted: ${stats.scanStatus.total}`);
    console.log(`  ${chalk.green('Successful:')} ${stats.scanStatus.successful} (${Math.round(stats.scanStatus.successful / stats.scanStatus.total * 100)}%)`);
    console.log(`  ${chalk.red('Failed:')} ${stats.scanStatus.failed} (${Math.round(stats.scanStatus.failed / stats.scanStatus.total * 100)}%)`);
    if (Object.keys(stats.scanStatus.failureReasons).length > 0) {
      console.log(chalk.dim('  Failure reasons:'));
      for (const [reason, count] of Object.entries(stats.scanStatus.failureReasons)) {
        console.log(chalk.dim(`    ${reason}: ${count}`));
      }
    }

    console.log(chalk.bold('\nDrift Statistics (from successful scans):'));
    console.log(`  Repos analyzed: ${stats.reposScanned}`);
    console.log(`  Mean drift: ${stats.stats.hardcodedColors.mean}`);
    console.log(`  Median drift: ${stats.stats.hardcodedColors.median}`);
    console.log(`  10th percentile: ${stats.stats.hardcodedColors.p10}`);
    console.log(`  90th percentile: ${stats.stats.hardcodedColors.p90}`);

    console.log(chalk.bold('\nToken adoption impact:'));
    console.log(`  With tokens: ${Math.round(stats.stats.tokenAdoption.withTokens)} avg drift`);
    console.log(`  Without tokens: ${Math.round(stats.stats.tokenAdoption.withoutTokens)} avg drift`);

    console.log(chalk.bold('\nBy framework:'));
    const frameworks = Object.entries(stats.stats.byFramework)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    for (const [framework, data] of frameworks) {
      console.log(`  ${framework}: ${data.count} repos, ${data.avgDrift} avg drift`);
    }

    console.log(chalk.green(`\nSaved to: ${outputPath}`));
  });

statsCmd
  .command('export')
  .description('Export statistics for buoy.design')
  .option('--format <format>', 'Output format (json, markdown)', 'json')
  .option('--output <path>', 'Output file path')
  .action(async (options) => {
    const generator = new PublicStatsGenerator({
      resultsDir: getResultsDir(),
      reposDir: getReposDir(),
    });

    if (options.format === 'markdown') {
      const markdown = await generator.generateMarkdownSummary();
      if (options.output) {
        const { writeFile: wf } = await import('fs/promises');
        await wf(options.output, markdown);
        console.log(chalk.green(`Markdown exported to: ${options.output}`));
      } else {
        console.log(markdown);
      }
    } else {
      const stats = await generator.generateStats();
      if (options.output) {
        const { writeFile: wf } = await import('fs/promises');
        await wf(options.output, JSON.stringify(stats, null, 2));
        console.log(chalk.green(`JSON exported to: ${options.output}`));
      } else {
        console.log(JSON.stringify(stats, null, 2));
      }
    }
  });

program.parse();
