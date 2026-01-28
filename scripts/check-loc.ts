/**
 * LOC (Lines of Code) Enforcement Script
 *
 * Checks that no source file exceeds the maximum line count.
 * Used to maintain code quality and prevent files from becoming too large.
 */

import { glob } from 'glob';
import { readFileSync } from 'fs';
import { relative } from 'path';

const MAX_LOC = 400;

const PATTERNS = [
  'packages/**/*.ts',
  'apps/**/*.ts',
  'server/src/**/*.ts',
  'src/**/*.ts',
  'src/**/*.tsx',
  'src-tauri/src/**/*.rs',
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/target/**',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.d.ts',
];

interface Violation {
  file: string;
  lines: number;
  excess: number;
}

async function main(): Promise<void> {
  console.log(`\nChecking files for LOC violations (max: ${MAX_LOC} lines)\n`);

  const files = await glob(PATTERNS, {
    ignore: IGNORE_PATTERNS,
    nodir: true,
  });

  const violations: Violation[] = [];
  let totalFiles = 0;

  for (const file of files) {
    totalFiles++;
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;

    if (lines > MAX_LOC) {
      violations.push({
        file: relative(process.cwd(), file),
        lines,
        excess: lines - MAX_LOC,
      });
    }
  }

  if (violations.length === 0) {
    console.log(`✓ All ${totalFiles} files are within the ${MAX_LOC} line limit\n`);
    process.exit(0);
  }

  console.log(`✗ Found ${violations.length} file(s) exceeding ${MAX_LOC} lines:\n`);

  // Sort by excess lines descending
  violations.sort((a, b) => b.excess - a.excess);

  for (const violation of violations) {
    console.log(
      `  ${violation.file}: ${violation.lines} lines (+${violation.excess} over limit)`
    );
  }

  console.log(`\nPlease split these files to improve maintainability.\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
