// Versiones por tema para que la app sepa cuándo recargar sin pedir todos los datos.
// En memoria (una sola instancia, como el plan gratis de Render): `boot` hace que un reinicio también cuente como cambio.
// shortcut: con varias instancias del servidor cada una tendría su contador; en ese caso mover esto a la base o a Redis.
export type Topic = 'content' | 'reviews';
const boot = Date.now().toString(36);
const counters: Record<Topic, number> = { content: 0, reviews: 0 };

export const bump = (topic: Topic) => { counters[topic]++; };
export const snapshot = () => ({ content: `${boot}.${counters.content}`, reviews: `${boot}.${counters.reviews}` });
