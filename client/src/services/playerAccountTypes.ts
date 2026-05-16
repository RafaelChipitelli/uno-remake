import type { User } from 'firebase/auth';

export type UserStats = {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  karma: number;
};

export type UserProfile = {
  uid: string;
  nickname: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  stats: UserStats;
  equippedCosmetic: string;
};

export type MatchSummary = {
  playedAt: number | null;
  didWin: boolean;
  opponents: string[];
  durationMs: number;
  turns: number;
  playerCount: number;
};

export type AuthSession = {
  firebaseReady: boolean;
  isLoading: boolean;
  user: User | null;
  profile: UserProfile | null;
};

export const DEFAULT_STATS: UserStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  karma: 0,
};
