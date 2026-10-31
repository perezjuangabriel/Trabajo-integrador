import { z } from 'zod';
import { posInt, ids, text, refine1, baseListQuery, refParam } from './catalog.common.js';
import { idParam } from './common.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (HH:MM)');
const full = (t) => (t.length === 5 ? `${t}:00` : t);
const hour = z.object({ weekday: z.number().int().min(0).max(6), opensAt: hhmm, closesAt: hhmm })
  .refine((h) => full(h.closesAt) > full(h.opensAt), 'El cierre debe ser posterior a la apertura');
const hours = z.array(hour).max(7).refine((a) => new Set(a.map((h) => h.weekday)).size === a.length, 'Un horario por día');
const newCity = z.object({ name: z.string().trim().min(2).max(100), region: text(100).optional(), country: z.string().length(2).toUpperCase().optional() }).strict();

const fields = {
  name: z.string().trim().min(3).max(120),
  description: text(5000).nullable().optional(),
  categoryId: posInt,
  categoryIds: ids(5).optional(),                       // categorías secundarias (etiquetas)
  cityId: posInt.optional(),
  newCity: newCity.optional(),                          // si la ciudad no existe todavía
  zone: text(100).nullable().optional(),
  address: text(255).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  surfaceTypeId: posInt.nullable().optional(),
  obstacleIds: ids().optional(),
  amenityIds: ids().optional(),
  hours: hours.optional(),
};
const coords = (v) => (v.latitude == null) === (v.longitude == null);
const cityRule = (v) => !(v.cityId && v.newCity);

export const createPlaceSchema = {
  body: z.object(fields).strict()
    .refine((v) => Boolean(v.cityId) !== Boolean(v.newCity), { message: 'Indicá cityId o newCity (uno solo)', path: ['cityId'] })
    .refine(coords, { message: 'Enviá latitud y longitud juntas', path: ['latitude'] }),
};
export const updatePlaceSchema = {
  params: idParam,
  body: refine1(z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]))).strict()
    .refine(cityRule, { message: 'Indicá cityId o newCity, no ambos', path: ['cityId'] })
    .refine((v) => (v.latitude === undefined) === (v.longitude === undefined) && coords(v), { message: 'Enviá latitud y longitud juntas', path: ['latitude'] })),
};
export const listPlacesSchema = {
  query: baseListQuery.extend({
    cityId: z.coerce.number().int().positive().optional(),
    zone: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(['newest', 'rating', 'reviews', 'name']).default('newest'),
  }),
};
export const placeRefSchema = { params: refParam };
