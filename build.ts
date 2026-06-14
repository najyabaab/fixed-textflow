import * as esbuild from 'esbuild'

async function main() {
  // Bundle content script
  await esbuild.build({
    entryPoints: ['src/content/content.ts'],
    outfile: 'content-bundle.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    keepNames: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    alias: {
      '@': './src',
    },
  })

  // Bundle background service worker
  await esbuild.build({
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'background-bundle.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    keepNames: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    alias: {
      '@': './src',
    },
  })

  console.log('Build complete: content-bundle.js, background-bundle.js')
}

main().catch(e => {
  console.error('Build failed:', e)
  process.exit(1)
})
