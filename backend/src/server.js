// Compatibilidad: si algún panel todavía ejecuta `node src/server.js`, arranca la versión TypeScript.
import { register } from 'tsx/esm/api';
register();
await import('./server.ts');
