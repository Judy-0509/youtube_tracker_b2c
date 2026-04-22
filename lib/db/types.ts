export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_keywords: {
        Row: {
          active: boolean
          category: string
          created_at: string | null
          id: number
          notes: string | null
          pattern: string
          weight: number
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string | null
          id?: number
          notes?: string | null
          pattern: string
          weight?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string | null
          id?: number
          notes?: string | null
          pattern?: string
          weight?: number
        }
        Relationships: []
      }
      beta_signups: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          aliases: string[] | null
          created_at: string | null
          id: string
          name: string
          name_en: string | null
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          name: string
          name_en?: string | null
        }
        Update: {
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          name?: string
          name_en?: string | null
        }
        Relationships: []
      }
      discovery_candidates: {
        Row: {
          candidate_type: string
          created_at: string | null
          external_data: Json | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_signal: string
          status: string
        }
        Insert: {
          candidate_type: string
          created_at?: string | null
          external_data?: Json | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_signal: string
          status?: string
        }
        Update: {
          candidate_type?: string
          created_at?: string | null
          external_data?: Json | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_signal?: string
          status?: string
        }
        Relationships: []
      }
      product_search_keywords: {
        Row: {
          alias_keywords: string[] | null
          exclude_keywords: string[] | null
          primary_keyword: string
          product_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          alias_keywords?: string[] | null
          exclude_keywords?: string[] | null
          primary_keyword: string
          product_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          alias_keywords?: string[] | null
          exclude_keywords?: string[] | null
          primary_keyword?: string
          product_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_search_keywords_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sources: {
        Row: {
          external_id: string
          first_seen_at: string | null
          id: string
          product_id: string
          source: string
          url: string | null
        }
        Insert: {
          external_id: string
          first_seen_at?: string | null
          id?: string
          product_id: string
          source: string
          url?: string | null
        }
        Update: {
          external_id?: string
          first_seen_at?: string | null
          id?: string
          product_id?: string
          source?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sources_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          category: string
          first_seen_at: string | null
          id: string
          image_url: string | null
          name: string
          normalized_name: string
          subcategory: string | null
          variant: string
        }
        Insert: {
          brand_id: string
          category: string
          first_seen_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          normalized_name: string
          subcategory?: string | null
          variant?: string
        }
        Update: {
          brand_id?: string
          category?: string
          first_seen_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          normalized_name?: string
          subcategory?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          plan: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          plan?: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          plan?: string
        }
        Relationships: []
      }
      search_trends: {
        Row: {
          date: string
          fetched_at: string | null
          id: string
          keyword: string
          product_id: string
          ratio: number
        }
        Insert: {
          date: string
          fetched_at?: string | null
          id?: string
          keyword: string
          product_id: string
          ratio: number
        }
        Update: {
          date?: string
          fetched_at?: string | null
          id?: string
          keyword?: string
          product_id?: string
          ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "search_trends_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_validations: {
        Row: {
          avg_price: number | null
          date: string
          fetched_at: string | null
          product_id: string
          review_count: number | null
        }
        Insert: {
          avg_price?: number | null
          date: string
          fetched_at?: string | null
          product_id: string
          review_count?: number | null
        }
        Update: {
          avg_price?: number | null
          date?: string
          fetched_at?: string | null
          product_id?: string
          review_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_validations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      source_rankings: {
        Row: {
          category: string
          id: string
          price: number | null
          product_source_id: string
          rank: number
          review_count: number | null
          scrape_date: string
          scraped_at: string | null
          source: string
        }
        Insert: {
          category: string
          id?: string
          price?: number | null
          product_source_id: string
          rank: number
          review_count?: number | null
          scrape_date: string
          scraped_at?: string | null
          source: string
        }
        Update: {
          category?: string
          id?: string
          price?: number | null
          product_source_id?: string
          rank?: number
          review_count?: number | null
          scrape_date?: string
          scraped_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_rankings_product_source_id_fkey"
            columns: ["product_source_id"]
            isOneToOne: false
            referencedRelation: "product_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_scores: {
        Row: {
          composite_score: number
          computed_at: string | null
          date: string
          is_provisional: boolean
          organic_buzz_ratio: number | null
          product_id: string
          rank_change_7d: number | null
          search_growth_score: number | null
          sponsored_ratio: number | null
          tier: string
          youtube_buzz_score: number | null
        }
        Insert: {
          composite_score: number
          computed_at?: string | null
          date: string
          is_provisional?: boolean
          organic_buzz_ratio?: number | null
          product_id: string
          rank_change_7d?: number | null
          search_growth_score?: number | null
          sponsored_ratio?: number | null
          tier: string
          youtube_buzz_score?: number | null
        }
        Update: {
          composite_score?: number
          computed_at?: string | null
          date?: string
          is_provisional?: boolean
          organic_buzz_ratio?: number | null
          product_id?: string
          rank_change_7d?: number | null
          search_growth_score?: number | null
          sponsored_ratio?: number | null
          tier?: string
          youtube_buzz_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trending_scores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_mentions: {
        Row: {
          id: string
          matched_at: string | null
          matched_text: string | null
          product_id: string
          video_id: string
        }
        Insert: {
          id?: string
          matched_at?: string | null
          matched_text?: string | null
          product_id: string
          video_id: string
        }
        Update: {
          id?: string
          matched_at?: string | null
          matched_text?: string | null
          product_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_mentions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_mentions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["video_id"]
          },
        ]
      }
      youtube_owner_comments: {
        Row: {
          comment_id: string
          fetched_at: string | null
          published_at: string | null
          text: string
          video_id: string
        }
        Insert: {
          comment_id: string
          fetched_at?: string | null
          published_at?: string | null
          text: string
          video_id: string
        }
        Update: {
          comment_id?: string
          fetched_at?: string | null
          published_at?: string | null
          text?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_owner_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["video_id"]
          },
        ]
      }
      youtube_video_ad_status: {
        Row: {
          classified_at: string | null
          confidence: number
          signals: Json | null
          status: string
          video_id: string
        }
        Insert: {
          classified_at?: string | null
          confidence: number
          signals?: Json | null
          status: string
          video_id: string
        }
        Update: {
          classified_at?: string | null
          confidence?: number
          signals?: Json | null
          status?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_video_ad_status_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "youtube_videos"
            referencedColumns: ["video_id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          channel_id: string
          channel_title: string | null
          description: string | null
          duration_sec: number | null
          fetched_at: string | null
          hashtags: string[] | null
          is_short: boolean | null
          published_at: string | null
          title: string
          video_id: string
          view_count: number | null
        }
        Insert: {
          channel_id: string
          channel_title?: string | null
          description?: string | null
          duration_sec?: number | null
          fetched_at?: string | null
          hashtags?: string[] | null
          is_short?: boolean | null
          published_at?: string | null
          title: string
          video_id: string
          view_count?: number | null
        }
        Update: {
          channel_id?: string
          channel_title?: string | null
          description?: string | null
          duration_sec?: number | null
          fetched_at?: string | null
          hashtags?: string[] | null
          is_short?: boolean | null
          published_at?: string | null
          title?: string
          video_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
