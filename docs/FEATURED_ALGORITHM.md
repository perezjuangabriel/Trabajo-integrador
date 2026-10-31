# Destacados de Home: algoritmo y reglas

Ranuras independientes: **video**, **producto** y **spot**. Cada una tiene su configuración (`featured_settings`) y su historial persistido (`featured_content`). El destacado vigente es la fila con `is_current = 1` cuyo `ends_at` no venció: **todos los usuarios ven lo mismo** durante la vigencia.

## Modos
| Modo | Comportamiento |
|---|---|
| **manual** | El admin elige el contenido exacto (`PUT /admin/featured/:slot`). Dura hasta reemplazarlo (o hasta `endsAt` si se indica). Si el contenido deja de ser público (oculto/baja) la Home omite la ranura y el panel muestra `unavailable`: **no se inventa un reemplazo** |
| **automatic** | El backend elige según los criterios de abajo cada `periodHours` (24 h por defecto para producto y spot, 168 h para video). Un reemplazo manual en este modo vence a las `periodHours` (o `endsAt`) y vuelve la selección automática |

## Criterios (producto, spot y video)
Entran solo elementos **publicados y no dados de baja** (excluye pendientes, rechazados, ocultos e inactivos). Si hay `preferredCategoryId`, compiten solo los de esa categoría (si no tiene ningún publicado, se ignora). Puntuación:

```
bayes = v/(v+m) · R  +  m/(v+m) · C
bonus = 0.5 · r/(r+2)
score = bayes + bonus
```
- `R` promedio del elemento · `v` reseñas **válidas** (visibles) · `m` = `minReviews` (configurable) · `C` promedio global de reseñas visibles del tipo (3 si no hay).
- `r` reseñas visibles en los últimos `recencyDays` (30 por defecto). El bonus está acotado a < 0,5: premia la actividad reciente sin imponerse a la calidad.
- **Efecto del promedio bayesiano:** con pocas reseñas el puntaje se acerca a `C`; un 5,0 con 1 reseña no supera a un 4,6 con 30.
- **Mínimo de reseñas:** solo son elegibles los que tienen `v ≥ minReviews`. Si **nadie** cumple, se relaja la condición (gana el mayor `score`) para que la Home no quede vacía.
- **Rotación:** en un refresco forzado no se repite el anterior si hay alternativa.
- **Desempate determinista:** mayor `score`, luego más reseñas, luego id mayor.
- **Video:** mismo criterio sobre `video_reviews`, período semanal por defecto. Por defecto está en **manual** (el video de la semana lo elige el admin); puede pasarse a automático.

## Actualización controlada
- Un job cada hora (`5 * * * *`) renueva las ranuras vencidas; además `GET /home` garantiza un vigente.
- La selección es **atómica**: la fila de `featured_settings` se bloquea (`SELECT … FOR UPDATE`), así que pedidos simultáneos crean **una sola** selección (probado con 8 pedidos paralelos; sin el bloqueo la prueba falla).
- Todos los cambios del admin (reemplazo, configuración, refresco) quedan en `audit_logs`.

## Configurable sin tocar código
`PATCH /admin/featured/:slot/settings`: `mode`, `periodHours` (1–2160), `minReviews` (0–1000), `recencyDays` (1–365), `preferredCategoryId` (de la categoría del tipo correcto).
