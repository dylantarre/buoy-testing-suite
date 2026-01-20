/**
 * Focused Ground Truth Scan for Mantine
 *
 * Scans only packages/@mantine/core/src/components to get accurate ground truth
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, readdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';

const MANTINE_REPO = '/tmp/mantine-check';
const CORE_COMPONENTS_PATH = 'packages/@mantine/core/src/components';
const OUTPUT_PATH = '/Users/dylantarre/dev/buoy-lab/results/mantinedev/mantine/ground-truth.json';

const client = new Anthropic();

async function collectComponentFiles(baseDir: string): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  const componentsDir = join(baseDir, CORE_COMPONENTS_PATH);

  if (!existsSync(componentsDir)) {
    throw new Error(`Components directory not found: ${componentsDir}`);
  }

  const walk = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        // Only .tsx files, skip tests and stories
        if (ext === '.tsx' && !entry.name.includes('.test.') && !entry.name.includes('.story.')) {
          try {
            const content = await readFile(fullPath, 'utf-8');
            files.push({
              path: fullPath.replace(baseDir + '/', ''),
              content,
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
    }
  };

  await walk(componentsDir);
  return files;
}

async function scanWithClaude(files: Array<{ path: string; content: string }>, scanId: number): Promise<any> {
  console.log(`  Agent ${scanId} analyzing ${files.length} component files...`);

  // Build a summary of exports per file
  const fileSummaries = files.map(f => {
    const exports = f.content.match(/export\s+(const|function)\s+\w+/g) || [];
    const factoryPatterns = (f.content.match(/polymorphicFactory|factory</g) || []).length;
    return `${f.path}: ${exports.length} exports, ${factoryPatterns} factory patterns`;
  }).join('\n');

  // Sample actual component code (first 30 files)
  const samples = files.slice(0, 30).map(f =>
    `--- ${f.path} ---\n${f.content.slice(0, 1500)}`
  ).join('\n\n');

  const prompt = `You are analyzing Mantine UI's core component library to establish accurate ground truth.

## IMPORTANT CONTEXT
- This is ONLY the packages/@mantine/core/src/components directory
- These are the ACTUAL Mantine library components (Button, Modal, etc.)
- NOT docs site components, NOT demo components

## Component Files Summary (${files.length} files)
${fileSummaries}

## Sample Component Code
${samples}

## Your Task

Count the distinct components in Mantine's core library:

1. **Components**: Count each component that is:
   - Exported with polymorphicFactory<T>() or factory<T>() patterns
   - A compound component part (Drawer.Root, Drawer.Body count individually)
   - Do NOT count type definitions, interfaces, or non-component exports

2. **Component Patterns Used**

Respond in this exact JSON format:
{
  "components": {
    "total": <number>,
    "byType": {
      "function": <number>,
      "forwardRef": <number>,
      "polymorphicFactory": <number>,
      "factory": <number>,
      "compound": <number>
    },
    "names": ["Button", "Modal", "Drawer", "DrawerRoot", "DrawerBody", "...all component names"]
  },
  "patterns": ["polymorphicFactory", "factory", "compound components", "..."],
  "confidence": <0.0-1.0>,
  "notes": "Brief notes on what you found"
}

Be thorough - list ALL component names you can identify. This will be used as the target for automated detection testing.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0] && 'text' in response.content[0] ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error(`Agent ${scanId} failed to return valid JSON`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  console.log(`  Agent ${scanId} found: ${parsed.components.total} components`);

  return {
    scanId,
    ...parsed,
  };
}

function buildConsensus(scans: any[]): any {
  const totals = scans.map(s => s.components.total);
  const median = [...totals].sort((a, b) => a - b)[Math.floor(totals.length / 2)];

  // Collect all component names across scans
  const allNames = new Set<string>();
  for (const scan of scans) {
    for (const name of scan.components.names || []) {
      allNames.add(name);
    }
  }

  // Collect all patterns
  const allPatterns = new Set<string>();
  for (const scan of scans) {
    for (const pattern of scan.patterns || []) {
      allPatterns.add(pattern);
    }
  }

  // Merge byType
  const mergedByType: Record<string, number> = {};
  const typeKeys = new Set<string>();
  for (const scan of scans) {
    for (const key of Object.keys(scan.components.byType || {})) {
      typeKeys.add(key);
    }
  }
  for (const key of typeKeys) {
    const values = scans.map(s => s.components.byType?.[key] ?? 0);
    mergedByType[key] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  const avgConfidence = scans.reduce((sum, s) => sum + (s.confidence || 0.8), 0) / scans.length;

  return {
    repo: 'mantinedev/mantine',
    scannedAt: new Date().toISOString(),
    model: 'claude-sonnet-4-20250514',
    scanCount: scans.length,
    scope: 'packages/@mantine/core/src/components',
    components: {
      total: median,
      min: Math.min(...totals),
      max: Math.max(...totals),
      stdDev: Math.sqrt(totals.reduce((sum, t) => sum + Math.pow(t - median, 2), 0) / totals.length),
      byType: mergedByType,
      names: Array.from(allNames).sort(),
    },
    tokens: {
      total: 287,  // Keep existing token count - tokens weren't the issue
      min: 127,
      max: 450,
      stdDev: 131.87,
      byCategory: {
        color: 134,
        spacing: 52,
        typography: 29,
        shadow: 14,
        border: 22,
        other: 37,
      },
      samples: {
        color: ['--mantine-color-blue-6', '--mantine-color-red-filled'],
        spacing: ['--mantine-spacing-md', '--mantine-spacing-xl'],
      },
    },
    patterns: Array.from(allPatterns),
    confidence: avgConfidence,
    consensus: 1 - (Math.sqrt(totals.reduce((sum, t) => sum + Math.pow(t - median, 2), 0) / totals.length) / median),
    individualScans: scans,
    notes: `Scoped scan of ${CORE_COMPONENTS_PATH} only. Previous scan incorrectly included docs site components.`,
  };
}

async function main() {
  console.log('=== Mantine Ground Truth Rescan ===');
  console.log(`Scanning: ${MANTINE_REPO}/${CORE_COMPONENTS_PATH}`);
  console.log('');

  // Collect component files from core package only
  const files = await collectComponentFiles(MANTINE_REPO);
  console.log(`Found ${files.length} component files in core package\n`);

  // Run 3 parallel scans for consensus
  console.log('Running 3 agents for consensus...');
  const scanPromises = [1, 2, 3].map(id => scanWithClaude(files, id));
  const scans = await Promise.all(scanPromises);

  // Build consensus
  console.log('\nBuilding consensus...');
  const groundTruth = buildConsensus(scans);

  console.log(`\n=== Results ===`);
  console.log(`Components: ${groundTruth.components.total} (range: ${groundTruth.components.min}-${groundTruth.components.max})`);
  console.log(`Consensus: ${(groundTruth.consensus * 100).toFixed(1)}%`);
  console.log(`Component names found: ${groundTruth.components.names.length}`);

  // Save
  await writeFile(OUTPUT_PATH, JSON.stringify(groundTruth, null, 2));
  console.log(`\nSaved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);
