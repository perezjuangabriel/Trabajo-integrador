# Manual de usuario — SPOTCHECK

SPOTCHECK es una app para descubrir y reseñar spots, skateparks, productos y videos de skate. **No es una tienda**: no hay carrito ni pagos.

## Para todos (sin cuenta)
- **Inicio**: destacados del momento (video, producto y spot), idénticos para todos mientras dure su vigencia.
- **Lugares / Productos / Videos**: listas con búsqueda, filtros y orden. Toca un elemento para ver detalle, fotos, promedio y reseñas.
- **Tema**: Perfil → Ajustes → claro, oscuro o del sistema.

## Usuario (con cuenta)
- **Registro**: correo + contraseña (mín. 8, letras y números). Recibes un código de 6 dígitos por correo para verificar; vence en pocos minutos y tiene intentos limitados.
- **Iniciar sesión**: con correo o con Google / GitHub / Discord. La sesión persiste; se renueva sola y se cierra desde Perfil. Tras 5 contraseñas erróneas la cuenta se bloquea un rato.
- **Recuperar contraseña**: "Olvidé mi contraseña" → código por correo → nueva contraseña (cierra las demás sesiones).
- **Reseñar**: 1 a 5 estrellas + texto (una reseña por elemento; puedes editarla o borrarla). Los videos admiten reseña sin fotos. Pueden pasar por moderación antes de verse.
- **Favoritos**, **Mis reseñas**, **Mi actividad** y **Mis propuestas** desde Perfil.
- **Proponer** un spot, producto o video (botón "+"): queda *pendiente* hasta que lo revise un moderador. Puedes editarlo o borrarlo mientras no esté publicado.
- **Reportar** contenido o reseñas inapropiadas.
- **Eliminar cuenta**: pide confirmación con código; se borran tus reseñas y datos personales.

## Moderador (incluye todo lo anterior)
Perfil → **Moderación**, con cuatro pestañas:
- **Propuestas**: aprobar (publica), rechazar (con motivo) u ocultar.
- **Reseñas**: ocultar o restaurar reseñas.
- **Reportes**: resolver o descartar.
- **Historial**: registro de lo moderado.
Puede editar y dar de baja contenido; **no** administra usuarios, destacados ni ajustes.

## Administrador (incluye todo lo anterior)
Perfil → **Administración**:
- **Panel**: estadísticas generales.
- **Usuarios**: buscar, cambiar rol (usuario/moderador/admin), suspender o reactivar. Las acciones sensibles piden un código por correo (válido 5 min).
- **Catálogo**: gestión completa, bajas y restauración.
- **Destacados**: por ranura (video, producto, spot) modo **manual** (eliges el contenido) o **automático** (algoritmo ponderado, ver `FEATURED_ALGORITHM.md`) y su duración.
- **Ajustes**: p. ej. premoderación de reseñas.
- **Auditoría**: quién hizo qué y cuándo.

Los permisos se validan siempre en el servidor; ocultar un botón en la app no es una protección.
