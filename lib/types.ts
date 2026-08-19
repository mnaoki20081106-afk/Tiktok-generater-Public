/**
 * Supabaseの `sites` テーブルに対応する型定義。
 * content_data は将来のリンク集・レイアウト設定などを自由に追加できるよう JSONB で保持する。
 */
export interface SiteContentData {
  links?: { label: string; url: string }[];
  theme?: string;
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

export type SiteInsert = Omit<Site, 'id' | 'created_at'>;
export type SiteUpdate = Partial<Omit<Site, 'id' | 'user_id' | 'created_at'>>;

/** Supabaseクライアントに渡すDBスキーマ型 */
export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Partial<Site> & { user_id: string; slug: string; title: string };
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
