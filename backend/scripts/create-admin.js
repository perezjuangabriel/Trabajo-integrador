// Crea (o promueve) el administrador general. Uso:
//   ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='Clave-Segura-123' ADMIN_NAME='Tu Nombre' npm run create-admin
// Es la ÚNICA vía para obtener rol admin: el registro público siempre crea rol "user".
import { pool } from '../src/config/db.js';
import * as users from '../src/repositories/users.repo.js';
import { hashPassword } from '../src/utils/password.js';
import { newPassword, email as emailSchema } from '../src/validators/common.js';

const name = process.env.ADMIN_NAME || 'Administrador';

try {
  const parsedEmail = emailSchema.safeParse(process.env.ADMIN_EMAIL ?? '');
  if (!parsedEmail.success) throw new Error('ADMIN_EMAIL inválido o ausente');
  const parsedPass = newPassword.safeParse(process.env.ADMIN_PASSWORD ?? '');
  if (!parsedPass.success) throw new Error(`ADMIN_PASSWORD no cumple la política: ${parsedPass.error.issues.map((i) => i.message).join('; ')}`);
  const email = parsedEmail.data;
  const password = parsedPass.data;
  let user = await users.findByEmail(email);
  if (user) {
    await pool.query("UPDATE users SET role = 'admin', status = 'active', password_hash = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [await hashPassword(password), user.id]);
    console.log(`✔ Usuario existente promovido a admin: ${email}`);
  } else {
    user = await users.create({ email, passwordHash: await hashPassword(password), displayName: name, emailVerified: true });
    await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
    console.log(`✔ Administrador creado: ${email}`);
  }
} catch (err) {
  console.error('✖ Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
