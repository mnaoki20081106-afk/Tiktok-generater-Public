/**
 * Supabaseの `sites` テーブルに対応する型定義。
 * content_data は将来のリンク集・レイアウト設定などを自由に追加できるよう JSONB で保持する。
 *
 * このアプリはログイン機能を持たない。サイトごとに発行される edit_token(推測不可能な
 * UUID)を知っている人だけが編集できる「秘密の編集リンク」方式。
 * edit_token はDB側の列権限でanon/authenticatedロールから読めないようにしてあるため、
 * サーバー(service_roleキー)経由のコードでのみ扱うこと。ブラウザに渡してはいけない。
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

/** 公開ページ・一般クエリで扱う、秘密情報を含まないサイトの型 */
export interface PublicSite {
  [key: string]: unknown;
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  content_data: SiteContentData;
  created_at: string;
}

/** service_role経由でのみ扱う、edit_tokenを含む完全なサイトの型 */
export interface Site extends PublicSite {
  edit_token: string;
}

export type SiteUpdate = Partial<Omit<Site, 'id' | 'edit_token' | 'created_at'>>;

/** Supabaseクライアントに渡すDBスキーマ型 */
export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Partial<Site> & { slug: string };
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
