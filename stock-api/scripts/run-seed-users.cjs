#!/usr/bin/env node
/** Runs compiled seed-users in Docker/prod, or ts-node locally. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distEntry = path.join(root, 'dist', 'seed-users.js');
const isWin = process.platform === 'win32';

const result = fs.existsSync(distEntry)
  ? spawnSync(process.execPath, [distEntry], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
  : spawnSync(
      isWin ? 'npx.cmd' : 'npx',
      ['ts-node', path.join('src', 'seed-users.ts')],
      {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        shell: isWin,
      },
    );

process.exit(result.status ?? 1);
