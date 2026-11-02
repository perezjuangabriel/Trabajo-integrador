# SPOTCHECK — Manual de usuario

SPOTCHECK es una app móvil para descubrir y reseñar **spots y skateparks**, **productos** (tablas, ruedas, trucks…) y **videos** de skate. Es una app de reseñas y recomendaciones: **no hay tienda, carrito ni pagos**.

**Contenido**
1. [Primeros pasos](#1-primeros-pasos)
2. [Crear cuenta e iniciar sesión](#2-crear-cuenta-e-iniciar-sesión)
3. [Moverse por la app](#3-moverse-por-la-app)
4. [Explorar: spots, productos y videos](#4-explorar-spots-productos-y-videos)
5. [Reseñar, guardar favoritos y reportar](#5-reseñar-guardar-favoritos-y-reportar)
6. [Proponer contenido nuevo](#6-proponer-contenido-nuevo)
7. [Tu perfil y tus ajustes](#7-tu-perfil-y-tus-ajustes)
8. [Guía para moderadores](#8-guía-para-moderadores)
9. [Guía para administradores](#9-guía-para-administradores)
10. [Preguntas frecuentes y solución de problemas](#10-preguntas-frecuentes-y-solución-de-problemas)

---

## 1. Primeros pasos
Al abrir la app llegás a **Inicio**. No necesitás cuenta para mirar: spots, productos, videos y reseñas son públicos. La cuenta se pide cuando querés **reseñar, guardar favoritos, proponer contenido o reportar**.

Cuando intentás algo que requiere cuenta, la app te lleva a la pantalla de inicio de sesión; al terminar volvés a donde estabas.

## 2. Crear cuenta e iniciar sesión

### 2.1 Crear una cuenta con correo
1. Andá a la pestaña **Perfil** → **Crear cuenta**.
2. Completá **Nombre**, **Correo** y **Contraseña** (mínimo 8 caracteres, con letras y números) y repetila.
3. Tocá **Registrarme**. Te enviamos un **código de 6 dígitos** al correo.
4. En **Verificar correo** escribí el código y tocá **Verificar**. Si no llegó, **Reenviar código** (podés pedir uno nuevo cada 60 segundos; el código vale 15 minutos y tiene 5 intentos).

> Podés entrar a la app sin verificar el correo, pero **para reseñar, proponer contenido, reportar o eliminar tu cuenta tu correo debe estar verificado**. Si no lo está, el Perfil muestra un aviso.

### 2.2 Iniciar sesión
- **Con correo:** Perfil → **Iniciar sesión** → correo y contraseña → **Entrar**.
- **Con Google, GitHub o Discord:** tocá el botón del proveedor; se abre su página de acceso y volvés a la app con la sesión iniciada. Si tu correo ya existe y el proveedor lo tiene verificado, las cuentas se vinculan.
- **Seguir sin cuenta:** cierra la pantalla y podés seguir explorando.

La sesión **se mantiene** aunque cierres la app y se renueva sola. Tras **5 contraseñas incorrectas** la cuenta se bloquea unos minutos por seguridad.

### 2.3 Olvidé mi contraseña
1. Iniciar sesión → **Olvidé mi contraseña**.
2. Escribí tu correo → **Enviar código**.
3. Ingresá el código y tu **contraseña nueva** → **Cambiar contraseña**. Se cierran las sesiones abiertas en otros dispositivos.

Por privacidad, la app responde igual exista o no la cuenta.

### 2.4 Cerrar sesión
Perfil → **Ajustes** → **Cerrar sesión**. La sesión también se revoca en el servidor.

## 3. Moverse por la app
La barra inferior tiene cinco pestañas:

| Pestaña | Para qué sirve |
|---|---|
| **Inicio** | Destacados y novedades |
| **Spots** | Spots y skateparks |
| **Productos** | Catálogo de productos |
| **Videos** | Videos de skate |
| **Perfil** | Tu cuenta, actividad y ajustes |

- Tocá una tarjeta para abrir su **detalle**; volvé con la flecha del encabezado o el gesto "atrás" del teléfono.
- Deslizá hacia abajo en una lista para **actualizarla**; al llegar al final se cargan más resultados.
- *Reseña*, *Reportar*, *Iniciar sesión* y *Crear cuenta* se abren como ventanas modales.
- **Tema:** Perfil → **Ajustes y apariencia** → **Apariencia**: *Sistema*, *Claro* u *Oscuro*. Se recuerda en el teléfono y, si tenés sesión, en tu cuenta.

## 4. Explorar: spots, productos y videos

### 4.1 Inicio
- **Video de la semana**, **Producto destacado** y **Spot destacado**: son iguales para todos los usuarios mientras dura su vigencia. Los elige un administrador o el algoritmo automático (ver `FEATURED_ALGORITHM.md`).
- **Spots populares**, **Productos populares** y **Reseñas recientes**.

### 4.2 Listas, búsqueda y filtros
En **Spots**, **Productos** y **Videos**:
- Escribí en la barra de búsqueda (no distingue tildes ni mayúsculas).
- Usá los filtros: *Categoría*, *Ciudad*, *Zona o barrio*, *Marca*, *Precio mínimo/máximo*, *Cantidad de reseñas* y puntuación mínima.
- **Ordenar por:** más nuevos, mejor puntuados, más reseñados, nombre y (productos) precio.
- **Aplicar** confirma; **Limpiar todo** borra los filtros. Sin coincidencias verás "No encontramos resultados".

### 4.3 Detalle
- **Spot:** fotos, ubicación (**Ver en el mapa**), horarios, superficie, obstáculos, servicios y reseñas.
- **Producto:** fotos, marca, precio orientativo y especificaciones. El precio es solo informativo: no se vende nada en la app.
- **Video:** reproductor o enlace al sitio original (algunos proveedores no permiten reproducir dentro de la app) y reseñas.
- Todos muestran el **promedio de estrellas**, la distribución por puntuación y las reseñas (**Ver más reseñas** carga más).

## 5. Reseñar, guardar favoritos y reportar

### 5.1 Escribir una reseña
1. En el detalle, tocá el botón de reseña (requiere sesión y correo verificado).
2. Elegí la **Puntuación** (1 a 5 estrellas) y escribí el **Comentario** (entre 3 y 2000 caracteres).
3. Podés **Agregar fotos** (hasta 4; JPEG, PNG o WebP de hasta 5 MB). Las reseñas de videos no llevan fotos.
4. Enviá. Tenés **una reseña por elemento**; podés **Editarla** o **Eliminarla** y volver a reseñar.

Si la moderación previa de reseñas está activa, tu reseña queda **pendiente** hasta que un moderador la apruebe. Solo las reseñas visibles cuentan en el promedio.

### 5.2 Favoritos
Tocá el corazón de un spot, producto o video para guardarlo. Lo encontrás en Perfil → **Mis favoritos**. Si un contenido se oculta, deja de listarse pero tu favorito se conserva.

### 5.3 Reportar contenido
En un contenido o reseña inapropiada: **Reportar** → elegí el **Motivo** (spam, ofensivo, inexacto, duplicado, ilegal u otro), agregá **Detalles (opcional)** y **Enviar reporte**. No podés reportar lo tuyo ni reportar dos veces lo mismo. Un moderador lo revisa.

## 6. Proponer contenido nuevo
Desde las pestañas **Spots**, **Productos** o **Videos**, el botón de agregar abre el formulario de propuesta (requiere correo verificado):

- **Spot:** nombre, categoría, ciudad (existente u otra nueva), zona, dirección, latitud/longitud, superficie, obstáculos, servicios, horarios y descripción.
- **Producto:** nombre, marca, categoría, precio orientativo (opcional), especificaciones (**Agregar especificación**) y descripción.
- **Video:** título, enlace (YouTube, Vimeo u otro `http(s)`), categoría y descripción.

Después podés **Agregar fotos** (spots y productos).
Tu propuesta queda **pendiente** hasta que la revise un moderador. Seguila en Perfil → **Mis propuestas**, donde ves su estado: *pendiente*, *publicada*, *rechazada* (con el motivo) u *oculta*. Podés editarla o eliminarla mientras no esté publicada; si corregís una rechazada vuelve a revisión. Hay un máximo de 10 propuestas pendientes por tipo.

## 7. Tu perfil y tus ajustes
**Perfil** muestra tu nombre, rol y estado del correo, y accesos a:
- **Mis favoritos** · **Mis reseñas** · **Mis propuestas** · **Actividad reciente**
- **Ajustes** (y, según tu rol, *Moderación* o *Panel de administración*).

En **Ajustes**:

| Sección | Qué podés hacer |
|---|---|
| **Apariencia** | Sistema / Claro / Oscuro |
| **Perfil** | Cambiar *Nombre* y *Sobre vos* → **Guardar perfil** |
| **Métodos de acceso** | Ver proveedores vinculados, **Vincular** Google/GitHub/Discord o **Quitar** uno (pide un código por correo; no podés quitar tu último método de acceso) |
| **Cambiar contraseña** | Contraseña actual + nueva. Cierra las demás sesiones |
| **Zona de peligro** | **Eliminar mi cuenta** o, si ya la pediste, **Cancelar la eliminación** |
| **Conexión** | Muestra el servidor al que está conectada la app y **Probar conexión** |

### Eliminar tu cuenta
Ajustes → **Eliminar mi cuenta** → confirmá, ingresá el código que llega por correo y tu contraseña. Tenés un **período de gracia (14 días por defecto)** para arrepentirte con *Cancelar la eliminación*. Pasado ese plazo se **eliminan tus reseñas, fotos, favoritos y vínculos**, y tus datos personales se anonimizan. No se puede deshacer. Los administradores no pueden eliminar su cuenta desde la app.

## 8. Guía para moderadores
Los moderadores pueden hacer todo lo del usuario y, además, entrar a Perfil → **Moderación**, con cuatro pestañas:

| Pestaña | Función |
|---|---|
| **Propuestas** | Cola de spots, productos y videos pendientes (los más antiguos primero). **Aprobar** (publica), **Rechazar** (el motivo es obligatorio y lo ve el autor) u **Ocultar** |
| **Reseñas** | Reseñas pendientes u ocultas: aprobar, ocultar o restaurar |
| **Reportes** | Reportes abiertos: resolver (opcionalmente **ocultando** el contenido, lo que cierra los demás reportes sobre él) o descartar |
| **Historial** | Registro de tus acciones de moderación |

Además pueden **editar** contenido de cualquier usuario (cada cambio queda registrado). Los moderadores **ocultan, no eliminan**, y no acceden a usuarios, destacados ni ajustes. Lo que publican ellos mismos no pasa por revisión.

## 9. Guía para administradores
Los administradores tienen todo lo anterior y Perfil → **Panel de administración**:

| Sección | Función |
|---|---|
| **Panel** | Estadísticas: usuarios, contenido por estado, reseñas, reportes abiertos, pendientes y actividad de los últimos 14 días |
| **Usuarios y roles** | Buscar usuarios; asignar rol *usuario* o *moderador*; **suspender** (con motivo; cierra sus sesiones al instante) y **reactivar** |
| **Catálogos** | Gestionar categorías, marcas, ciudades, superficies, obstáculos y servicios; baja y restauración de contenido |
| **Destacados** | Para cada ranura (video, producto, spot): modo **manual** (elegís el contenido exacto) o **automático** (elige el algoritmo cada cierto período); períodos, mínimo de reseñas y recencia; refrescar |
| **Configuración** | Moderación previa de propuestas y de reseñas, días de gracia para bajas de cuenta |
| **Auditoría** | Quién hizo qué, sobre qué y cuándo (con IP) |

Notas de seguridad:
- Las acciones sensibles pueden pedir un **código de verificación por correo** válido 5 minutos.
- **El rol de administrador no se asigna desde la app.** Se crea por consola en el servidor (`npm run create-admin`, ver `GUIA_INSTALACION.md`).
- Un administrador no puede cambiar su propio rol ni el de otro administrador.
- Si un contenido destacado deja de ser público, el panel lo marca como *no disponible* y la Home lo omite; elegí otro.

## 10. Preguntas frecuentes y solución de problemas

| Problema | Qué hacer |
|---|---|
| "Sin conexión: no pudimos restaurar tu sesión" | Revisá tu internet. En Ajustes → *Conexión* podés ver el servidor y **Probar conexión** |
| No me llega el código | Revisá spam; esperá 60 s y usá **Reenviar código**. Si el servidor no tiene el correo configurado, no se envían mensajes (avisale al administrador) |
| "Necesitás verificar tu correo para publicar" | Verificá tu correo desde el aviso del Perfil e ingresá el código |
| Cuenta bloqueada | Esperá unos minutos (se desbloquea sola) o usá *Olvidé mi contraseña* |
| Cuenta suspendida | Un administrador la suspendió; contactalo |
| No puedo subir una foto | Debe ser JPEG, PNG o WebP de hasta 5 MB (máx. 4 en reseñas) |
| No veo mi propuesta en la lista pública | Sigue *pendiente*; mirá su estado en **Mis propuestas** |
| "Demasiadas solicitudes" | Esperá unos minutos y reintentá |
| El video no se reproduce dentro de la app | El proveedor no permite embeberlo; abrilo con el enlace al sitio original |
