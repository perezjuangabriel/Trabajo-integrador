export type Role = 'user' | 'moderator' | 'admin';
export type Kind = 'place' | 'product' | 'video';
export type ThemePref = 'system' | 'light' | 'dark';
export type Status = 'pending' | 'published' | 'rejected' | 'hidden';

export interface User {
  id: number; email: string; displayName: string; avatarUrl: string | null; bio: string | null; role: Role; status: string;
  themePreference: ThemePref; emailVerified: boolean; hasPassword: boolean; deletionScheduledFor?: string | null; createdAt: string;
}
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface Ref { id: number; name: string }
export interface Permissions { canEdit: boolean; canDelete: boolean }

export interface PlaceCard {
  id: number; name: string; slug: string; zone: string | null; status: Status; category: Ref; city: Ref; coverUrl: string | null;
  avgRating: number; reviewCount: number; publishedAt: string | null; rejectionReason?: string;
}
export interface ProductCard {
  id: number; name: string; slug: string; status: Status; brand: Ref; category: Ref; price: { amount: number; currency: string } | null;
  coverUrl: string | null; avgRating: number; reviewCount: number; publishedAt: string | null; rejectionReason?: string;
}
export interface VideoCard {
  id: number; title: string; url: string; provider: 'youtube' | 'vimeo' | 'other'; embedUrl: string | null; thumbnailUrl: string | null;
  category: Ref; status: Status; avgRating: number; reviewCount: number; publishedAt: string | null; rejectionReason?: string;
}
export type AnyCard = PlaceCard | ProductCard | VideoCard;
export interface Img { id: number; url: string; position?: number }

export interface PlaceDetail extends PlaceCard {
  description: string | null; extraCategories: Ref[]; address: string | null; latitude: number | null; longitude: number | null;
  surfaceType: Ref | null; obstacles: Ref[]; amenities: Ref[]; hours: { weekday: number; opensAt: string; closesAt: string }[];
  images: Img[]; city: Ref & { region?: string | null }; submittedBy: { id: number; displayName: string } | null; permissions: Permissions;
}
export interface ProductDetail extends ProductCard {
  description: string | null; specs: { key: string; value: string }[]; images: Img[]; submittedBy: { id: number; displayName: string } | null; permissions: Permissions;
}
export interface VideoDetail extends VideoCard {
  description: string | null; submittedBy: { id: number; displayName: string } | null; permissions: Permissions;
}

export interface Review {
  id: number; type: 'review' | 'video_review'; target: { kind: Kind; id: number; name?: string | null; slug?: string | null };
  rating: number; comment: string; status: 'visible' | 'pending' | 'hidden'; createdAt: string; updatedAt: string;
  author: { id: number; displayName: string; avatarUrl: string | null }; images: Img[]; isMine: boolean;
}
export interface ReviewsPage extends Page<Review> {
  summary: { avgRating: number; reviewCount: number; distribution: Record<string, number> }; myReview: Review | null;
}

export interface HomeData {
  featuredVideo: (VideoCard & { featured?: { selection: string } }) | null;
  featuredProduct: (ProductCard & { featured?: { selection: string } }) | null;
  featuredPlace: (PlaceCard & { featured?: { selection: string } }) | null;
  recentReviews: { target: { kind: Kind; id: number; name: string; slug: string | null }; rating: number; comment: string; author: string; createdAt: string }[];
  popularPlaces: PlaceCard[]; popularProducts: ProductCard[];
}
export interface Report {
  id: number; target: { type: string; id: number; label: string | null; status: string | null }; reason: string; details: string | null; status: string;
  createdAt: string; reporter: { id: number; displayName: string } | null; resolutionNote: string | null;
}
export interface LookupItem { id: number; name: string; type?: Kind; slug?: string; isActive?: boolean; region?: string | null }
export interface ActivityItem { type: 'review' | 'favorite' | 'submission'; target: { kind: Kind; id: number; name: string }; rating?: number; status?: string; at: string }
export interface FeaturedSlot {
  slot: Kind; settings: { mode: 'manual' | 'automatic'; periodHours: number; minReviews: number; recencyDays: number; preferredCategoryId: number | null };
  current: { targetId: number; label: string | null; selection: string; score: number | null; endsAt: string | null; status: 'valid' | 'expired' | 'unavailable' } | null;
}
export interface Stats {
  users: { total: number; byRole: Record<string, number>; new7d: number; new30d: number };
  content: Record<'places' | 'products' | 'videos', Record<string, number>>; reviews: { visible: number; pending: number; hidden: number };
  reviewsPerDay: { day: string; count: number }[]; reports: { open: number; total: number }; favorites: number;
  pendingModeration: { places: number; products: number; videos: number; reviews: number };
  topRated: Record<'places' | 'products' | 'videos', { id: number; name: string; avgRating: number; reviewCount: number }[]>;
}
export interface AuditItem { id: number; action: string; entityType: string; entityId: number | null; createdAt: string; actor: { id: number; displayName: string } | null; details: unknown }
