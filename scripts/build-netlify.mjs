import './build-payments.mjs';
import fs from 'node:fs/promises';
import {build} from 'esbuild';

// dist contains server-only format writers as well as editable frontend source.
// Publish a separate allowlist so these writers never reach the public CDN.
await fs.rm('build',{recursive:true,force:true});
await fs.mkdir('build/client',{recursive:true});
await fs.mkdir('build/functions',{recursive:true});
for (const name of await fs.readdir('dist')) {
  if (!/\.(html|css|mjs|txt)$/.test(name) || name==='formats.mjs') continue;
  await fs.copyFile('dist/'+name,'build/client/'+name);
}
await build({entryPoints:['netlify/pix.mjs'],outfile:'build/functions/pix.mjs',bundle:true,format:'esm',platform:'node',target:'node22',minify:true});
console.log('Netlify: public assets in build/client; Pix API in build/functions. No secrets included.');
