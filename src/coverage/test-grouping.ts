#!/usr/bin/env node
import 'dotenv/config';
import { ReactComponentScanner } from '@ahoybuoy/scanners';

async function test() {
  const scanner = new ReactComponentScanner({
    projectRoot: './repos/Open-Dev-Society/OpenStock',
    overrideDefaultExcludes: true,
  });

  const result = await scanner.scan();

  // Find Select-related components
  const selectComps = result.items.filter(c => c.name.startsWith('Select'));

  console.log('Select components found:', selectComps.length);
  for (const c of selectComps) {
    console.log('  ' + c.name);
    console.log('    compoundGroup:', c.metadata.compoundGroup);
    console.log('    isCompoundRoot:', c.metadata.isCompoundRoot);
  }

  // Show summary of all compound groups
  const groups = new Map<string, string[]>();
  for (const c of result.items) {
    const group = c.metadata.compoundGroup;
    if (group) {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(c.name);
    }
  }

  console.log('\n\nAll compound groups detected:');
  for (const [group, members] of groups) {
    console.log(`  ${group}: ${members.length} members`);
    for (const m of members.slice(0, 5)) {
      console.log(`    - ${m}`);
    }
    if (members.length > 5) {
      console.log(`    ... and ${members.length - 5} more`);
    }
  }
}

test().catch(console.error);
