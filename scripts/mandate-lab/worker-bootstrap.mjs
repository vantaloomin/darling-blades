import { tsImport } from 'tsx/esm/api';
import { URL } from 'node:url';

await tsImport(new URL('./worker.ts', import.meta.url).href, {
  parentURL: import.meta.url,
});
