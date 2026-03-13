/**
 * esbuild config for React Native plugin bundle.
 *
 * Produces rn-bundle/index.bundle.js in CommonJS format.
 * Core auto-runs "npm run build" during deployment.
 * Mobile app downloads and evaluates this bundle at runtime.
 *
 * CRITICAL:
 * - format: 'cjs' — mobile app evaluates via module.exports
 * - external: react, react-native, @adas/plugin-sdk — host app provides these
 * - jsx: 'transform' — classic React.createElement for max compatibility
 * - platform: 'neutral' — not node, not browser
 */
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['rn-src/index.tsx'],
  bundle: true,
  outfile: 'rn-bundle/index.bundle.js',
  format: 'cjs',
  platform: 'neutral',
  target: 'es2020',
  external: ['react', 'react-native', '@adas/plugin-sdk'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: false,
});

console.log('✓ Built rn-bundle/index.bundle.js');
