import { api } from './index';
import type { ActivityItem, AuditItem, FeaturedSlot, HomeData, Kind, LookupItem, Page, Report, Review, ReviewsPage, Stats, User, AnyCard, PlaceDetail, ProductDetail, VideoDetail } from '../types';

type Q = Record<string, string | number | boolean | null | undefined>;
const ROUTE: Record<Kind, string> = { place: '/places', product: '/products', video: '/videos' };
const KEY: Record<Kind, string> = { place: 'place', product: 'product', video: 'video' };
type Session = { user: User; accessToken: string; refreshToken: string };

export const authApi = {
  login: (email: string, password: string) => api.post<Session>('/auth/login', { email, password }, { auth: 'none' }),
  register: (email: string, password: string, displayName: string) => api.post<Session & { verificationEmailSent: boolean }>('/auth/register', { email, password, displayName }, { auth: 'none' }),
  me: () => api.get<{ user: User }>('/auth/me'),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }, { auth: 'none' }),
  verifyEmail: (email: string, code: string) => api.post<void>('/auth/verify-email', { email, code }, { auth: 'none' }),
  resendVerification: () => api.post<{ emailSent: boolean }>('/auth/resend-verification'),
  forgot: (email: string) => api.post<void>('/auth/forgot-password', { email }, { auth: 'none' }),
  reset: (email: string, code: string, newPassword: string) => api.post<void>('/auth/reset-password', { email, code, newPassword }, { auth: 'none' }),
  changePassword: (currentPassword: string, newPassword: string) => api.post<Session>('/auth/change-password', { currentPassword, newPassword }),
  sensitiveRequest: () => api.post<{ emailSent: boolean }>('/auth/sensitive/request'),
  sensitiveConfirm: (code: string) => api.post<{ sensitiveToken: string }>('/auth/sensitive/confirm', { code }),
  oauthExchange: (code: string, codeVerifier: string) => api.post<Session>('/auth/oauth/exchange', { code, codeVerifier }, { auth: 'none' }),
  linkStart: (provider: string, appRedirect: string) => api.post<{ url: string }>(`/auth/oauth/${provider}/link`, { appRedirect }),
  unlink: (provider: string, sensitiveToken: string) => api.del<void>(`/auth/oauth/${provider}`, { headers: { 'X-Sensitive-Token': sensitiveToken } }),
};

export const meApi = {
  update: (b: { displayName?: string; bio?: string | null; themePreference?: string }) => api.patch<{ user: User }>('/users/me', b),
  linked: () => api.get<{ accounts: { provider: string; email: string | null }[] }>('/users/me/linked-accounts'),
  requestDeletion: (password: string | undefined, sensitiveToken: string) =>
    api.post<{ deletionScheduledFor: string; graceDays: number }>('/users/me/deletion-request', { password }, { headers: { 'X-Sensitive-Token': sensitiveToken } }),
  cancelDeletion: () => api.post<void>('/users/me/deletion-cancel'),
  reviews: (kind: Kind, page: number) => api.get<Page<Review>>('/users/me/reviews', { kind, page, pageSize: 20 }),
  submissions: (kind: Kind, page: number) => api.get<Page<AnyCard>>('/users/me/submissions', { kind, page, pageSize: 20, status: 'all' }),
  activity: (page: number) => api.get<Page<ActivityItem>>('/users/me/activity', { page, pageSize: 20 }),
};

export const catalogApi = {
  home: () => api.get<HomeData>('/home', undefined, { auth: 'optional' }),
  list: (kind: Kind, q: Q) => api.get<Page<AnyCard>>(ROUTE[kind], q, { auth: 'optional' }),
  get: async (kind: Kind, id: number) => (await api.get<Record<string, unknown>>(`${ROUTE[kind]}/${id}`, undefined, { auth: 'optional' }))[KEY[kind]] as PlaceDetail | ProductDetail | VideoDetail,
  create: async (kind: Kind, body: unknown) => (await api.post<Record<string, { id: number }>>(ROUTE[kind], body))[KEY[kind]],
  update: async (kind: Kind, id: number, body: unknown) => (await api.patch<Record<string, { id: number }>>(`${ROUTE[kind]}/${id}`, body))[KEY[kind]],
  remove: (kind: Kind, id: number) => api.del<void>(`${ROUTE[kind]}/${id}`),
  uploadImage: (kind: Kind, id: number, form: FormData) => api.upload<{ image: { id: number; url: string } }>(`${ROUTE[kind]}/${id}/images`, form),
  deleteImage: (kind: Kind, id: number, imageId: number) => api.del<void>(`${ROUTE[kind]}/${id}/images/${imageId}`),
  categories: (type: Kind) => api.get<Page<LookupItem>>('/categories', { type, pageSize: 100 }, { auth: 'optional' }),
  brands: () => api.get<Page<LookupItem>>('/brands', { pageSize: 200 }, { auth: 'optional' }),
  cities: () => api.get<Page<LookupItem>>('/cities', { pageSize: 200 }, { auth: 'optional' }),
  options: () => api.get<{ surfaceTypes: LookupItem[]; obstacleTypes: LookupItem[]; amenities: LookupItem[] }>('/catalog/options', undefined, { auth: 'optional' }),
};

export const reviewsApi = {
  list: (kind: Kind, id: number, q: Q) => api.get<ReviewsPage>(`${ROUTE[kind]}/${id}/reviews`, q, { auth: 'optional' }),
  create: (kind: Kind, id: number, b: { rating: number; comment: string }) => api.post<{ review: Review }>(`${ROUTE[kind]}/${id}/reviews`, b),
  update: (r: Review, b: { rating?: number; comment?: string }) => api.patch<{ review: Review }>(`${r.type === 'video_review' ? '/video-reviews' : '/reviews'}/${r.id}`, b),
  remove: (r: Review) => api.del<void>(`${r.type === 'video_review' ? '/video-reviews' : '/reviews'}/${r.id}`),
  uploadImage: (id: number, form: FormData) => api.upload<{ image: { id: number; url: string } }>(`/reviews/${id}/images`, form),
};

export const socialApi = {
  favIds: () => api.get<Record<Kind, number[]>>('/favorites/ids'),
  favAdd: (kind: Kind, id: number) => api.post<{ favorited: boolean }>('/favorites', { kind, id }),
  favRemove: (kind: Kind, id: number) => api.del<void>(`/favorites/${kind}/${id}`),
  favList: (kind: Kind, page: number) => api.get<Page<AnyCard & { favoritedAt: string }>>('/favorites', { kind, page, pageSize: 20 }),
  report: (b: { targetType: string; targetId: number; reason: string; details?: string }) => api.post<{ report: Report }>('/reports', b),
};

export const staffApi = {
  queue: (kind: Kind, page: number) => api.get<Page<AnyCard>>('/moderation/queue', { kind, page, pageSize: 20 }),
  act: (kind: string, id: number, action: string, note?: string) => api.post<{ status: string }>(`/moderation/${kind}/${id}/${action}`, note ? { note } : {}),
  pendingReviews: (type: 'review' | 'video_review', page: number) =>
    api.get<Page<{ id: number; type: string; rating: number; comment: string; author: { displayName: string }; target: { kind: Kind; name: string } }>>('/moderation/reviews', { type, page, pageSize: 20 }),
  reports: (page: number) => api.get<Page<Report>>('/moderation/reports', { status: 'open', page, pageSize: 20 }),
  resolve: (id: number, hideTarget: boolean, note?: string) => api.post<{ report: Report }>(`/moderation/reports/${id}/resolve`, { hideTarget, note }),
  dismiss: (id: number, note?: string) => api.post<{ report: Report }>(`/moderation/reports/${id}/dismiss`, note ? { note } : {}),
  logs: (page: number) => api.get<Page<{ id: number; action: string; targetType: string; targetId: number; note: string | null; createdAt: string }>>('/moderation/logs', { page, pageSize: 30 }),
};

export const adminApi = {
  stats: () => api.get<Stats>('/admin/stats'),
  users: (q: Q) => api.get<Page<User>>('/admin/users', q),
  setRole: (id: number, role: 'user' | 'moderator') => api.patch<{ user: User }>(`/admin/users/${id}/role`, { role }),
  suspend: (id: number, reason: string) => api.post<{ user: User }>(`/admin/users/${id}/suspend`, { reason }),
  reactivate: (id: number) => api.post<{ user: User }>(`/admin/users/${id}/reactivate`),
  featured: () => api.get<{ featured: Record<Kind, FeaturedSlot> }>('/admin/featured'),
  setFeatured: (slot: Kind, id: number) => api.put<{ slot: FeaturedSlot }>(`/admin/featured/${slot}`, { id }),
  featuredSettings: (slot: Kind, b: Partial<FeaturedSlot['settings']>) => api.patch<{ slot: FeaturedSlot }>(`/admin/featured/${slot}/settings`, b),
  refreshFeatured: (slot: Kind) => api.post<{ slot: FeaturedSlot }>(`/admin/featured/${slot}/refresh`),
  audit: (page: number) => api.get<Page<AuditItem>>('/admin/audit', { page, pageSize: 30 }),
  settings: () => api.get<{ settings: { key: string; value: string }[] }>('/admin/settings'),
  updateSettings: (b: Record<string, boolean | number>) => api.patch<{ settings: { key: string; value: string }[] }>('/admin/settings', b),
  lookupCreate: (group: 'categories' | 'brands' | 'cities', b: Record<string, unknown>) => api.post<{ item: LookupItem }>(`/${group}`, b),
  lookupUpdate: (group: 'categories' | 'brands' | 'cities', id: number, b: Record<string, unknown>) => api.patch<{ item: LookupItem }>(`/${group}/${id}`, b),
  lookupDelete: (group: 'categories' | 'brands' | 'cities', id: number) => api.del<{ result: string }>(`/${group}/${id}`),
  lookupList: (group: 'categories' | 'brands' | 'cities', q: Q) => api.get<Page<LookupItem>>(`/${group}`, { ...q, pageSize: 100, includeInactive: true }),
};
