import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/settings.repo.js';
import * as audit from '../repositories/audit.repo.js';

export const list = () => repo.getAll();

/** Actualiza solo claves permitidas (validadas en el esquema). Cada cambio queda auditado. */
export async function update(actor, changes, ip) {
  await withTransaction(async (conn) => {
    for (const [key, value] of Object.entries(changes)) await repo.upsert(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value), actor.id, conn);
    await audit.record({ actorId: actor.id, action: 'settings.updated', entityType: 'settings', details: changes, ip }, conn);
  });
  return repo.getAll();
}
