/**
 * Scanner Coverage Analyzer
 *
 * Compares Buoy's deterministic scanner output against AI ground truth
 * to identify gaps and patterns of what's being missed.
 * Goal: 100% coverage - scanner should catch everything AI finds.
 */

import {
  ReactComponentScanner,
  TokenScanner,
  TailwindScanner,
  CssScanner,
} from '@ahoybuoy/scanners';
import type { Component, DesignToken } from '@ahoybuoy/core';
import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, relative } from 'path';

export interface ScannerResult {
  components: Component[];
  tokens: DesignToken[];
  patterns: string[];
  errors: string[];
}

export interface AIFindings {
  components: AIComponent[];
  tokens: AIToken[];
  patterns: string[];
  confidence: number;
}

export interface AIComponent {
  name: string;
  type: 'function' | 'forwardRef' | 'memo' | 'class' | 'factory' | 'compound' | 'other';
  path: string;
  line?: number;
  exportType: 'named' | 'default' | 'property';
  pattern?: string; // e.g., "forwardRef", "memo", "cva", etc.
}

export interface AIToken {
  name: string;
  category: 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'sizing' | 'motion' | 'other';
  source: 'css' | 'json' | 'typescript' | 'tailwind';
  path: string;
  value?: string;
}

export interface CoverageGap {
  type: 'component' | 'token';
  item: AIComponent | AIToken;
  reason: string; // Why scanner missed it
  suggestedFix?: string; // How to fix the scanner
}

export interface CoverageReport {
  repo: string;
  scannedAt: string;
  scanner: ScannerResult;
  ai: AIFindings;
  coverage: {
    components: {
      found: number;
      total: number;
      percentage: number;
    };
    tokens: {
      found: number;
      total: number;
      percentage: number;
    };
  };
  gaps: CoverageGap[];
  patterns: {
    missedPatterns: Record<string, number>; // Pattern -> count of misses
    missedPaths: Record<string, number>; // Path pattern -> count of misses
  };
}

export interface CoverageAnalyzerOptions {
  reposDir: string;
  resultsDir: string;
  buoyDir: string; // Path to buoy scanner source for fixes
  model?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const COMPONENT_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte'];
const TOKEN_EXTENSIONS = ['.ts', '.js', '.json', '.css', '.scss'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__tests__', '__mocks__', '.turbo', '.cache'];

export class ScannerCoverageAnalyzer {
  private client: Anthropic;
  private options: Required<CoverageAnalyzerOptions>;

  // Track gaps across all repos for pattern detection
  private allGaps: CoverageGap[] = [];
  private gapPatterns: Map<string, CoverageGap[]> = new Map();

  constructor(options: CoverageAnalyzerOptions) {
    this.client = new Anthropic();
    this.options = {
      reposDir: options.reposDir,
      resultsDir: options.resultsDir,
      buoyDir: options.buoyDir,
      model: options.model ?? DEFAULT_MODEL,
    };
  }

  /**
   * Analyze coverage for a single repo
   */
  async analyzeRepo(owner: string, name: string): Promise<CoverageReport> {
    const repoPath = join(this.options.reposDir, owner, name);

    if (!existsSync(repoPath)) {
      throw new Error(`Repo not found: ${repoPath}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Analyzing ${owner}/${name}`);
    console.log(`${'='.repeat(60)}`);

    // Step 1: Run deterministic scanners
    console.log('\n📊 Running deterministic scanners...');
    const scannerResult = await this.runDeterministicScanners(repoPath);
    console.log(`  Found ${scannerResult.components.length} components, ${scannerResult.tokens.length} tokens`);

    // Step 2: Run AI analysis for ground truth
    console.log('\n🤖 Running AI analysis...');
    const aiFindings = await this.runAIAnalysis(repoPath, owner, name);
    console.log(`  AI found ${aiFindings.components.length} components, ${aiFindings.tokens.length} tokens`);

    // Step 3: Compare and identify gaps
    console.log('\n🔍 Comparing results...');
    const gaps = this.identifyGaps(scannerResult, aiFindings);
    console.log(`  Found ${gaps.length} gaps`);

    // Step 4: Build coverage report
    const report = this.buildReport(owner, name, scannerResult, aiFindings, gaps);

    // Step 5: Save report
    await this.saveReport(owner, name, report);

    // Track gaps for pattern detection
    this.allGaps.push(...gaps);
    this.categorizeGaps(gaps);

    return report;
  }

  /**
   * Run all deterministic scanners on a repo
   */
  private async runDeterministicScanners(repoPath: string): Promise<ScannerResult> {
    const components: Component[] = [];
    const tokens: DesignToken[] = [];
    const patterns: string[] = [];
    const errors: string[] = [];

    // React Scanner (covers .tsx and .jsx files)
    try {
      const reactScanner = new ReactComponentScanner({
        projectRoot: repoPath,
        exclude: IGNORE_DIRS.map(d => `**/${d}/**`),
      });
      const reactResult = await reactScanner.scan();
      components.push(...reactResult.items);
      if (reactResult.items.length > 0) patterns.push('react');
      errors.push(...reactResult.errors.map(e => `React: ${e.message}`));
    } catch (err: unknown) {
      errors.push(`React scanner failed: ${err}`);
    }

    // Token Scanner (covers JSON, CSS, TypeScript token files)
    try {
      const tokenScanner = new TokenScanner({
        projectRoot: repoPath,
        exclude: IGNORE_DIRS.map(d => `**/${d}/**`),
      });
      const tokenResult = await tokenScanner.scan();
      tokens.push(...tokenResult.items);
      errors.push(...tokenResult.errors.map(e => `Token: ${e.message}`));
    } catch (err: unknown) {
      errors.push(`Token scanner failed: ${err}`);
    }

    // CSS Scanner (for hardcoded value detection)
    try {
      const cssScanner = new CssScanner({
        projectRoot: repoPath,
        exclude: IGNORE_DIRS.map(d => `**/${d}/**`),
      });
      const cssResult = await cssScanner.scan();
      // CSS scanner returns analysis with color/spacing/font values as Maps
      if (cssResult.analysis) {
        if (cssResult.analysis.colors && cssResult.analysis.colors.size > 0) {
          patterns.push('css-colors');
        }
        if (cssResult.analysis.stats && cssResult.analysis.stats.cssVariableUsage > 0) {
          patterns.push('css-variables');
        }
      }
    } catch (err: unknown) {
      errors.push(`CSS scanner failed: ${err}`);
    }

    // Tailwind Scanner
    try {
      const tailwindScanner = new TailwindScanner({
        projectRoot: repoPath,
      });
      const tailwindResult = await tailwindScanner.scan();
      if (tailwindResult.configPath) {
        patterns.push('tailwind');
        // Add Tailwind tokens to our tokens list
        tokens.push(...tailwindResult.tokens);
      }
    } catch (_err: unknown) {
      // Tailwind scanner failing is common for non-tailwind repos - don't report
    }

    return {
      components,
      tokens,
      patterns: [...new Set(patterns)],
      errors,
    };
  }

  /**
   * Run AI analysis to find all components and tokens
   */
  private async runAIAnalysis(repoPath: string, owner: string, name: string): Promise<AIFindings> {
    // Collect files for analysis
    const componentFiles = await this.collectFiles(repoPath, COMPONENT_EXTENSIONS);
    const tokenFiles = await this.collectFiles(repoPath, TOKEN_EXTENSIONS, [
      'theme', 'token', 'color', 'spacing', 'typography', 'style', 'config', 'css', 'scss'
    ]);

    // Read file contents
    const componentContents = await this.readFiles(repoPath, componentFiles.slice(0, 100));
    const tokenContents = await this.readFiles(repoPath, tokenFiles.slice(0, 50));

    // Build detailed file analysis for AI
    const fileAnalysis = this.buildFileAnalysis(componentContents, tokenContents);

    const prompt = `You are analyzing the ${owner}/${name} codebase to find ALL components and design tokens.
Your findings will be compared against a deterministic scanner, so be EXHAUSTIVE and PRECISE.

## Files to Analyze

${fileAnalysis}

## Task

List EVERY component and EVERY design token you can find. For each, provide:

### Components
- name: The component name (e.g., "Button", "Card.Header")
- type: function | forwardRef | memo | class | factory | compound | other
- path: File path relative to repo root
- line: Line number where defined (if visible)
- exportType: named | default | property
- pattern: The pattern used (e.g., "forwardRef", "React.memo", "cva", "styled-components")

### Tokens
- name: Token name (e.g., "--color-primary", "colors.blue.500")
- category: color | spacing | typography | shadow | border | sizing | motion | other
- source: css | json | typescript | tailwind
- path: File path
- value: The actual value if visible

## Important Detection Rules

1. **Factory Components**: Functions like polymorphicFactory(), factory(), createComponent() create components
2. **HOC Wrappers**: forwardRef(), memo(), withStyles(), styled() wrap components
3. **Compound Components**: Menu.Item, Dialog.Title are separate components
4. **CSS Variables**: --var-name in :root or component styles are tokens
5. **Theme Objects**: colors: { primary: {...} } in theme files are tokens
6. **Tailwind Config**: theme.extend values are tokens
7. **Style Props**: When components accept color/size props, the prop values may come from tokens

Respond in this exact JSON format:
{
  "components": [
    {
      "name": "Button",
      "type": "forwardRef",
      "path": "src/components/Button.tsx",
      "line": 15,
      "exportType": "named",
      "pattern": "forwardRef"
    }
  ],
  "tokens": [
    {
      "name": "--color-primary",
      "category": "color",
      "source": "css",
      "path": "src/styles/tokens.css",
      "value": "#3b82f6"
    }
  ],
  "patterns": ["forwardRef", "compound-components", "css-variables"],
  "confidence": 0.95
}

Be THOROUGH - list every component and token you find. Don't summarize or abbreviate.`;

    const response = await this.client.messages.create({
      model: this.options.model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0] && 'text' in response.content[0] ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('Failed to parse AI response, returning empty findings');
      return { components: [], tokens: [], patterns: [], confidence: 0 };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        components: parsed.components || [],
        tokens: parsed.tokens || [],
        patterns: parsed.patterns || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch (e) {
      console.warn('Failed to parse AI JSON:', e);
      return { components: [], tokens: [], patterns: [], confidence: 0 };
    }
  }

  /**
   * Build detailed file analysis for AI prompt
   */
  private buildFileAnalysis(
    componentContents: Array<{ path: string; content: string }>,
    tokenContents: Array<{ path: string; content: string }>
  ): string {
    const parts: string[] = [];

    parts.push('### Component Files\n');
    for (const file of componentContents.slice(0, 30)) {
      parts.push(`\n--- ${file.path} ---`);
      parts.push(file.content.slice(0, 4000));
    }

    parts.push('\n\n### Token/Theme Files\n');
    for (const file of tokenContents.slice(0, 20)) {
      parts.push(`\n--- ${file.path} ---`);
      parts.push(file.content.slice(0, 5000));
    }

    return parts.join('\n');
  }

  /**
   * Identify gaps between scanner results and AI findings
   */
  private identifyGaps(scanner: ScannerResult, ai: AIFindings): CoverageGap[] {
    const gaps: CoverageGap[] = [];

    // Build set of found component names (normalized)
    const foundComponents = new Set(
      scanner.components.map(c => this.normalizeComponentName(c.name))
    );

    // Check each AI-found component
    for (const aiComp of ai.components) {
      const normalized = this.normalizeComponentName(aiComp.name);
      if (!foundComponents.has(normalized)) {
        const reason = this.diagnoseComponentGap(aiComp, scanner);
        gaps.push({
          type: 'component',
          item: aiComp,
          reason,
          suggestedFix: this.suggestComponentFix(aiComp, reason),
        });
      }
    }

    // Build set of found token names (normalized)
    const foundTokens = new Set(
      scanner.tokens.map(t => this.normalizeTokenName(t.name))
    );

    // Check each AI-found token
    for (const aiToken of ai.tokens) {
      const normalized = this.normalizeTokenName(aiToken.name);
      if (!foundTokens.has(normalized)) {
        const reason = this.diagnoseTokenGap(aiToken, scanner);
        gaps.push({
          type: 'token',
          item: aiToken,
          reason,
          suggestedFix: this.suggestTokenFix(aiToken, reason),
        });
      }
    }

    return gaps;
  }

  /**
   * Normalize component name for comparison
   */
  private normalizeComponentName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Normalize token name for comparison
   */
  private normalizeTokenName(name: string): string {
    return name.toLowerCase().replace(/^(--|$)/, '').replace(/[^a-z0-9]/g, '');
  }

  /**
   * Diagnose why a component was missed
   */
  private diagnoseComponentGap(comp: AIComponent, _scanner: ScannerResult): string {
    // Check if it's a pattern we don't detect
    if (comp.pattern) {
      const knownPatterns = ['forwardRef', 'memo', 'React.memo', 'React.forwardRef'];
      if (!knownPatterns.includes(comp.pattern)) {
        return `Unhandled pattern: ${comp.pattern}`;
      }
    }

    // Check if it's a factory function
    if (comp.type === 'factory') {
      return `Factory function not detected: ${comp.pattern || 'unknown factory'}`;
    }

    // Check if it's a compound component
    if (comp.type === 'compound' || comp.name.includes('.')) {
      return `Compound component pattern not fully detected`;
    }

    // Check file extension
    const ext = extname(comp.path);
    if (!['.tsx', '.jsx', '.vue', '.svelte'].includes(ext)) {
      return `File extension not scanned: ${ext}`;
    }

    // Check if path might be excluded
    for (const ignored of IGNORE_DIRS) {
      if (comp.path.includes(`/${ignored}/`) || comp.path.includes(`\\${ignored}\\`)) {
        return `Path excluded by ignore pattern: ${ignored}`;
      }
    }

    // Check export type
    if (comp.exportType === 'property') {
      return `Property assignment pattern not detected (Component.SubComponent = ...)`;
    }

    return `Unknown reason - needs investigation at ${comp.path}:${comp.line || '?'}`;
  }

  /**
   * Diagnose why a token was missed
   */
  private diagnoseTokenGap(token: AIToken, _scanner: ScannerResult): string {
    // Check token source
    if (token.source === 'tailwind') {
      return `Tailwind theme token not extracted from config`;
    }

    if (token.source === 'typescript') {
      return `TypeScript token object not parsed: ${token.path}`;
    }

    if (token.source === 'json') {
      return `JSON token file not recognized: ${token.path}`;
    }

    if (token.source === 'css') {
      return `CSS variable not extracted: ${token.name}`;
    }

    // Check file patterns
    const fileName = token.path.split('/').pop() || '';
    if (!this.isTokenFileName(fileName)) {
      return `File name doesn't match token patterns: ${fileName}`;
    }

    return `Unknown reason - needs investigation at ${token.path}`;
  }

  /**
   * Check if filename looks like a token file
   */
  private isTokenFileName(name: string): boolean {
    const tokenPatterns = [
      'theme', 'token', 'color', 'spacing', 'typography',
      'style', 'config', 'variable', 'css', 'scss'
    ];
    const lower = name.toLowerCase();
    return tokenPatterns.some(p => lower.includes(p));
  }

  /**
   * Suggest a fix for a missed component
   */
  private suggestComponentFix(comp: AIComponent, reason: string): string {
    if (reason.includes('Unhandled pattern')) {
      return `Add pattern detection for "${comp.pattern}" in react-scanner.ts isReactComponentExpression()`;
    }

    if (reason.includes('Factory function')) {
      return `Add factory function detection for "${comp.pattern}" in react-scanner.ts`;
    }

    if (reason.includes('Compound component')) {
      return `Improve compound component detection in react-scanner.ts extractCompoundComponentFromObjectAssign()`;
    }

    if (reason.includes('Property assignment')) {
      return `Enhance property assignment detection for namespace.component patterns`;
    }

    if (reason.includes('File extension')) {
      return `Add scanner for ${extname(comp.path)} files`;
    }

    return `Investigate detection at ${comp.path}`;
  }

  /**
   * Suggest a fix for a missed token
   */
  private suggestTokenFix(token: AIToken, reason: string): string {
    if (reason.includes('Tailwind')) {
      return `Enhance TailwindScanner to extract theme tokens from tailwind.config`;
    }

    if (reason.includes('TypeScript')) {
      return `Add pattern to TokenScanner for: ${token.path}`;
    }

    if (reason.includes('JSON')) {
      return `Add JSON file pattern to TokenScanner: ${token.path}`;
    }

    if (reason.includes('CSS variable')) {
      return `Check CSS variable extraction in TokenScanner for: ${token.name}`;
    }

    if (reason.includes('File name')) {
      return `Add token file pattern for: ${token.path.split('/').pop()}`;
    }

    return `Investigate token detection at ${token.path}`;
  }

  /**
   * Build coverage report
   */
  private buildReport(
    owner: string,
    name: string,
    scanner: ScannerResult,
    ai: AIFindings,
    gaps: CoverageGap[]
  ): CoverageReport {
    // Count component gaps
    const componentGaps = gaps.filter(g => g.type === 'component');
    const tokenGaps = gaps.filter(g => g.type === 'token');

    // Group gaps by pattern
    const missedPatterns: Record<string, number> = {};
    const missedPaths: Record<string, number> = {};

    for (const gap of gaps) {
      const item = gap.item as AIComponent | AIToken;

      // Track pattern
      if ('pattern' in item && item.pattern) {
        missedPatterns[item.pattern] = (missedPatterns[item.pattern] || 0) + 1;
      }

      // Track path pattern
      const pathParts = item.path.split('/');
      if (pathParts.length > 1) {
        const pathPattern = pathParts.slice(0, -1).join('/');
        missedPaths[pathPattern] = (missedPaths[pathPattern] || 0) + 1;
      }
    }

    const componentCoverage = ai.components.length > 0
      ? (ai.components.length - componentGaps.length) / ai.components.length
      : 1;

    const tokenCoverage = ai.tokens.length > 0
      ? (ai.tokens.length - tokenGaps.length) / ai.tokens.length
      : 1;

    return {
      repo: `${owner}/${name}`,
      scannedAt: new Date().toISOString(),
      scanner,
      ai,
      coverage: {
        components: {
          found: ai.components.length - componentGaps.length,
          total: ai.components.length,
          percentage: Math.round(componentCoverage * 100),
        },
        tokens: {
          found: ai.tokens.length - tokenGaps.length,
          total: ai.tokens.length,
          percentage: Math.round(tokenCoverage * 100),
        },
      },
      gaps,
      patterns: {
        missedPatterns,
        missedPaths,
      },
    };
  }

  /**
   * Categorize gaps for pattern detection across repos
   */
  private categorizeGaps(gaps: CoverageGap[]): void {
    for (const gap of gaps) {
      // Group by reason
      if (!this.gapPatterns.has(gap.reason)) {
        this.gapPatterns.set(gap.reason, []);
      }
      this.gapPatterns.get(gap.reason)!.push(gap);
    }
  }

  /**
   * Get aggregated gap patterns across all analyzed repos
   */
  getGapPatterns(): Map<string, CoverageGap[]> {
    return this.gapPatterns;
  }

  /**
   * Get all gaps across all repos
   */
  getAllGaps(): CoverageGap[] {
    return this.allGaps;
  }

  /**
   * Generate summary of fixes needed
   */
  generateFixSummary(): string {
    const lines: string[] = [];
    lines.push('# Scanner Coverage Fix Summary');
    lines.push(`\nTotal gaps found: ${this.allGaps.length}`);
    lines.push(`\n## Gap Patterns (sorted by frequency)\n`);

    // Sort patterns by frequency
    const sorted = [...this.gapPatterns.entries()].sort((a, b) => b[1].length - a[1].length);

    for (const [pattern, gaps] of sorted) {
      lines.push(`### ${pattern} (${gaps.length} occurrences)`);

      // Get unique fixes
      const fixes = [...new Set(gaps.map(g => g.suggestedFix).filter(Boolean))];
      for (const fix of fixes) {
        lines.push(`- ${fix}`);
      }

      // Sample items
      lines.push(`\nExamples:`);
      for (const gap of gaps.slice(0, 3)) {
        const item = gap.item as AIComponent | AIToken;
        lines.push(`- ${item.name} in ${item.path}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Save coverage report
   */
  private async saveReport(owner: string, name: string, report: CoverageReport): Promise<void> {
    const resultDir = join(this.options.resultsDir, owner, name);
    await mkdir(resultDir, { recursive: true });

    const reportPath = join(resultDir, 'coverage-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`Saved report to ${reportPath}`);
  }

  /**
   * Collect files matching extensions
   */
  private async collectFiles(
    dir: string,
    extensions: string[],
    namePatterns?: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    const walk = async (currentDir: string) => {
      try {
        const entries = await readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentDir, entry.name);

          if (entry.isDirectory()) {
            if (!IGNORE_DIRS.includes(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              if (namePatterns) {
                const lowerName = entry.name.toLowerCase();
                if (namePatterns.some(p => lowerName.includes(p))) {
                  files.push(fullPath);
                }
              } else {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (e) {
        // Skip unreadable directories
      }
    };

    await walk(dir);
    return files;
  }

  /**
   * Read file contents with size limit
   */
  private async readFiles(
    repoPath: string,
    files: string[],
    maxSize: number = 50000
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];

    for (const file of files) {
      try {
        const fileStat = await stat(file);
        if (fileStat.size <= maxSize) {
          const content = await readFile(file, 'utf-8');
          results.push({
            path: relative(repoPath, file),
            content,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }
}
