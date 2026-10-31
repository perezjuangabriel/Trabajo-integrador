import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

// Borra archivos subidos (rutas relativas a UPLOADS_DIR). Bloquea path traversal e ignora los ya inexistentes.
export async function deleteStoredFiles(relativePaths) {
  const root = path.resolve(env.UPLOADS_DIR);
  for (const rel of relativePaths.filter(Boolean)) {
    const full = path.resolve(root, rel);
    if (!full.startsWith(root + path.sep)) continue;
    await fs.unlink(full).catch((e) => { if (e.code !== 'ENOENT') console.error('[storage]', e.message); });
  }
}
