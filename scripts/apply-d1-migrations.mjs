#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(repoRoot, 'db', 'migrations');
const apiDir = join(repoRoot, 'apps', 'api');

const args = process.argv.slice(2);
const databaseName = args.find((arg) => arg.startsWith('--database='))?.split('=')[1] ?? 'escalation-db';
const remote = args.includes('--remote');
const local = !remote;
const dryRun = args.includes('--dry-run');

const migrations = readdirSync(migrationsDir)
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();

if (migrations.length === 0) {
  console.error(`No D1 migrations found in ${migrationsDir}`);
  process.exit(1);
}

for (const migration of migrations) {
  const migrationPath = join(migrationsDir, migration);
  const wranglerArgs = [
    'wrangler',
    'd1',
    'execute',
    databaseName,
    ...(local ? ['--local'] : []),
    `--file=${migrationPath}`
  ];

  if (dryRun) {
    console.log(`Would apply ${migration}${local ? ' locally' : ' remotely'}: npx ${wranglerArgs.join(' ')}`);
    continue;
  }

  console.log(`Applying ${migration}${local ? ' locally' : ' remotely'}...`);
  const result = spawnSync('npx', wranglerArgs, {
    cwd: apiDir,
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
