/**
 * Supabaseの `sites` テーブルに対応する型定義。
 * content_data は将来のリンク集・レイアウト設定などを自由に追加できるよう JSONB で保持する。
 *
 * - sites.title       -> OGPタイトル / ページタイトル
 * - sites.description -> 動画説明キャプション(ハッシュタグ含む)
 * - sites.image_url   -> プロフィールアバター画像
 */
export interface SiteContentData {
  links?: { label: string; url: string }[];
  theme?: string;
  username?: string;
  tiktokUrl?: string;
  musicName?: string;
  likeCount?: string;
  commentCount?: string;
  shareCount?: string;
  showPageIndicator?: boolean;
  pageIndicatorCount?: string;
  images?: {
    background?: string;
    ogpImage?: string;
    appIcon?: string;
  };
  [key: string]: unknown;
}

export interface Site {
  [key: string]: unknown;
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  content_data: SiteContentData;
  created_at: string;
}

export type SiteUpdate = Partial<Omit<Site, 'id' | 'user_id' | 'created_at'>>;

/** Supabaseクライアントに渡すDBスキーマ型 */
export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Partial<Site> & { user_id: string; slug: string };
        Update: SiteUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
