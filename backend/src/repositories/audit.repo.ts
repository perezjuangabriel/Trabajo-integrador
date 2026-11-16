import { pool } from '../config/db.js';

// Registro de auditoría de acciones administrativas sensibles.
export const record = ({ actorId, action, entityType, entityId = null, details = null, ip = null }, db = pool) =>
  db.query(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [actorId, action, entityType, entityId, details ? JSON.stringify(details) : null, ip],
  );
