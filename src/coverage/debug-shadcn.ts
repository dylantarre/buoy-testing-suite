#!/usr/bin/env node
import 'dotenv/config';
import {
  ReactComponentScanner,
} from '@buoy-design/scanners';

const repoPath = './repos/shadcn-ui/ui';
const excludePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__tests__/**', '**/__mocks__/**', '**/.turbo/**', '**/.cache/**'];

async function scan() {
  // React Scanner
  const reactScanner = new ReactComponentScanner({
    projectRoot: repoPath,
    exclude: excludePatterns,
  });
  const reactResult = await reactScanner.scan();
  
  console.log('Total React components:', reactResult.items.length);
  
  // Check for DataTable
  const dtComponents = reactResult.items.filter(c => c.name.toLowerCase().includes('datatable'));
  console.log('\nDataTable components:', dtComponents.length);
  dtComponents.forEach(c => console.log(' ', c.name, '@', c.source.type === 'react' ? c.source.path : 'unknown'));

  // Check for CodeViewer
  const codeViewer = reactResult.items.filter(c => c.name.toLowerCase().includes('codeviewer'));
  console.log('\nCodeViewer components:', codeViewer.length);
  codeViewer.forEach(c => console.log(' ', c.name, '@', c.source.type === 'react' ? c.source.path : 'unknown'));

  // Check for UserAuthForm
  const authForm = reactResult.items.filter(c => c.name.toLowerCase().includes('auth'));
  console.log('\nAuth components:', authForm.length);
  authForm.forEach(c => console.log(' ', c.name, '@', c.source.type === 'react' ? c.source.path : 'unknown'));
}

scan().catch(console.error);
