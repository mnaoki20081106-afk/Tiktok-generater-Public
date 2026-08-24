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
  /**
   * クッションページ(遅延リダイレクト画面)を挟むか。
   * true(既定) … 遷移先URLを加工せずそのまま使う(従来どおりの挙動)。
   * false       … 保存時にジェネレーター(展開＋サニタイズ)を通したURLを tiktokUrl に保存する。
   * 未設定の既存サイトは true(=加工しない)として扱う。
   */
  useCushionPage?: boolean;
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
  /** このサイトを作成した端末のdvid Cookie値。サプライズ抽選で作成者本人を除外するために使う */
  creator_device_id: string | null;
  /** このサイトを作成した端末のブラウザフィンガープリント。dvid Cookie削除時の補助判定に使う */
  creator_fingerprint: string | null;
  created_at: string;
}

export type SiteUpdate = Partial<Omit<Site, 'id' | 'user_id' | 'created_at'>>;

/** ログイン中ユーザーが利用した端末の記録(サプライズ抽選で「同一アカウントの端末」を判定するために使う) */
export interface KnownDevice {
  [key: string]: unknown;
  id: string;
  user_id: string;
  device_id: string;
  created_at: string;
}

/** サプライズ抽選のグローバル設定(id=1固定のシングルトン行)。管理者のみが読み書きする */
export interface SurpriseConfig {
  [key: string]: unknown;
  id: number;
  enabled: boolean;
  probability: number;
  /** 管理者が入力した当たりURL。クッションページONのサイトではこの値をそのまま使う */
  prize_url: string | null;
  /**
   * prize_url にリンクジェネレーター(展開＋サニタイズ)を適用した結果。
   * クッションページOFFのサイトではこちらを使う。保存時に一度だけ変換して持っておくので、
   * 訪問者を待たせずに済む。未設定(既存行・変換前)の場合は prize_url にフォールバックする。
   */
  prize_url_optimized: string | null;
  updated_at: string;
}

export type SurpriseConfigUpdate = Partial<Omit<SurpriseConfig, 'id'>>;

/** ログイン中ユーザーが利用した端末のブラウザフィンガープリント記録(known_devicesのフィンガープリント版) */
export interface KnownFingerprint {
  [key: string]: unknown;
  id: string;
  user_id: string;
  fingerprint: string;
  created_at: string;
}

/** 公開ページの閲覧記録(PV/UU分析に使う) */
export interface PageView {
  [key: string]: unknown;
  id: number;
  site_id: string;
  device_id: string;
  viewed_at: string;
}

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
      known_devices: {
        Row: KnownDevice;
        Insert: Partial<KnownDevice> & { user_id: string; device_id: string };
        Update: Partial<KnownDevice>;
        Relationships: [];
      };
      known_fingerprints: {
        Row: KnownFingerprint;
        Insert: Partial<KnownFingerprint> & { user_id: string; fingerprint: string };
        Update: Partial<KnownFingerprint>;
        Relationships: [];
      };
      surprise_config: {
        Row: SurpriseConfig;
        Insert: Partial<SurpriseConfig> & { id: number };
        Update: SurpriseConfigUpdate;
        Relationships: [];
      };
      page_views: {
        Row: PageView;
        Insert: Partial<PageView> & { site_id: string; device_id: string };
        Update: Partial<PageView>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
