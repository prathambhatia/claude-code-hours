import { build } from 'esbuild';

// One minified file is all that ships to npm (see "files" in package.json).
await build({
  entryPoints: ['bin/claude-code-hours.js'],
  outfile: 'dist/claude-code-hours.js',
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  legalComments: 'none',
});
