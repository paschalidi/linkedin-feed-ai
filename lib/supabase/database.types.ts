export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      newsletter_sources: {
        Row: {
          id: string;
          name: string;
          type: "rss" | "manual";
          url: string | null;
          last_fetched_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: "rss" | "manual";
          url?: string | null;
          last_fetched_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: "rss" | "manual";
          url?: string | null;
          last_fetched_at?: string | null;
          created_at?: string;
        };
      };
      articles: {
        Row: {
          id: string;
          source_id: string | null;
          title: string;
          url: string;
          content: string;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id?: string | null;
          title: string;
          url: string;
          content: string;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string | null;
          title?: string;
          url?: string;
          content?: string;
          embedding?: string | null;
          created_at?: string;
        };
      };
      style_profiles: {
        Row: {
          id: string;
          name: string;
          prompt_text: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          prompt_text: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          prompt_text?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      linkedin_profiles: {
        Row: {
          id: string;
          profile_url: string;
          display_name: string | null;
          posts_json: Json | null;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_url: string;
          display_name?: string | null;
          posts_json?: Json | null;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_url?: string;
          display_name?: string | null;
          posts_json?: Json | null;
          embedding?: string | null;
          created_at?: string;
        };
      };
      daily_ideas: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          source_article_id: string | null;
          status: "draft" | "used" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          source_article_id?: string | null;
          status?: "draft" | "used" | "archived";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          source_article_id?: string | null;
          status?: "draft" | "used" | "archived";
          created_at?: string;
        };
      };
      generated_posts: {
        Row: {
          id: string;
          idea_id: string | null;
          draft_content: string;
          final_content: string | null;
          status: "draft" | "approved" | "posted";
          created_at: string;
        };
        Insert: {
          id?: string;
          idea_id?: string | null;
          draft_content: string;
          final_content?: string | null;
          status?: "draft" | "approved" | "posted";
          created_at?: string;
        };
        Update: {
          id?: string;
          idea_id?: string | null;
          draft_content?: string;
          final_content?: string | null;
          status?: "draft" | "approved" | "posted";
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
