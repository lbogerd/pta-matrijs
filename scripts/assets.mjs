import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public', {recursive:true});
await copyFile('node_modules/pagedjs/dist/paged.polyfill.js','public/paged.polyfill.js');
