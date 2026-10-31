import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Kind, Review } from '../types';

export type RootStackParamList = {
  Main: undefined; Login: undefined; Register: undefined; Forgot: undefined; VerifyEmail: undefined;
  Detail: { kind: Kind; id: number }; Form: { kind: Kind; id?: number };
  ReviewForm: { kind: Kind; id: number; review?: Review }; Report: { targetType: string; targetId: number; label: string };
  Favorites: undefined; MyReviews: undefined; Activity: undefined; Submissions: undefined; Settings: undefined;
  Moderation: undefined; Admin: undefined; AdminUsers: undefined; AdminCatalog: undefined; AdminFeatured: undefined; AdminAudit: undefined; AdminSettings: undefined;
};
export type TabParamList = { Home: undefined; Places: undefined; Products: undefined; Videos: undefined; Profile: undefined };
export const useNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();
