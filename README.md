# SPOTCHECK

App móvil de reseñas de skate: spots, skateparks, productos y videos. Monorepo:
`/backend` (Node + Express + MySQL), `/mobile` (Expo SDK 58, aún no creado), `/database`, `/docs`.

> Estado: Etapa 1 de 7 completa (base de datos). Ver `docs/PROGRESS.md`.

## Base de datos local (XAMPP o MySQL/MariaDB)
```bash
cd backend
cp .env.example .env        # completar DB_* y JWT_ACCESS_SECRET
npm install
npm run db:seed             # crea la base `spotcheck`, tablas y datos de prueba (DESTRUCTIVO)
npm test                    # 16 pruebas de integridad
```
Cuentas demo (solo desarrollo): `admin@spotcheck.test`, `mod@spotcheck.test`, `lucia@spotcheck.test` … contraseña `Demo1234!`.
Sin Node: importar a mano en phpMyAdmin `database/00_create_database.sql`, luego `schema.sql` y `seed.sql`.
