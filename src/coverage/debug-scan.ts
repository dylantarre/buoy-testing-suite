#!/usr/bin/env node
import 'dotenv/config';
import {
  ReactComponentScanner,
} from '@buoy-design/scanners';

const repoPath = './repos/shadcn-ui/ui';
const excludePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__tests__/**', '**/__mocks__/**', '**/.turbo/**', '**/.cache/**'];

async function scan() {
  const reactScanner = new ReactComponentScanner({
    projectRoot: repoPath,
    exclude: excludePatterns,
  });
  
  const result = await reactScanner.scan();
  
  // Find any component from the data-table-column-header file
  const dtHeaderComponents = result.items.filter(c =>
    c.source.type === 'react' && (
      c.source.path.includes('data-table-column-header') ||
      c.name.includes('DataTableColumnHeader')
    )
  );

  console.log('Components from data-table-column-header files:', dtHeaderComponents.length);
  dtHeaderComponents.forEach(c => {
    const path = c.source.type === 'react' ? c.source.path : 'unknown';
    console.log('  -', c.name, '@', path);
  });

  // Check total components from the tasks folder
  const taskComponents = result.items.filter(c =>
    c.source.type === 'react' && c.source.path.includes('/tasks/components/')
  );
  console.log('\nAll components from tasks/components folders:', taskComponents.length);
  taskComponents.forEach(c => {
    const path = c.source.type === 'react' ? c.source.path : 'unknown';
    console.log('  -', c.name, '@', path);
  });
}

scan().catch(console.error);
