#!/usr/bin/env node
import { main } from '../src/cli.js';

main().catch(err => {
  console.error(`claude-code-hours failed: ${err.message}`);
  process.exitCode = 1;
});
