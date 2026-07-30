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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      collection: {
        Row: {
          added_at: string
          image_url: string | null
          marque: string | null
          nom: string | null
          parfum_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          image_url?: string | null
          marque?: string | null
          nom?: string | null
          parfum_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          image_url?: string | null
          marque?: string | null
          nom?: string | null
          parfum_id?: string
          user_id?: string
        }
        Relationships: []
      }
      favoris: {
        Row: {
          added_at: string
          annee: number | null
          best_price: number | null
          famille_olfactive: string | null
          image_url: string | null
          longevity: string | null
          marque: string | null
          nom: string | null
          notes: string[] | null
          parfum_id: string
          reference_price: number | null
          season_scores: Json | null
          sillage: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          annee?: number | null
          best_price?: number | null
          famille_olfactive?: string | null
          image_url?: string | null
          longevity?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string[] | null
          parfum_id: string
          reference_price?: number | null
          season_scores?: Json | null
          sillage?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          annee?: number | null
          best_price?: number | null
          famille_olfactive?: string | null
          image_url?: string | null
          longevity?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string[] | null
          parfum_id?: string
          reference_price?: number | null
          season_scores?: Json | null
          sillage?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_runs: {
        Row: {
          created_at: string
          run_id: string
          sent_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          run_id: string
          sent_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          run_id?: string
          sent_count?: number
          user_id?: string
        }
        Relationships: []
      }
      parfums: {
        Row: {
          annee: number | null
          best_price: number | null
          cached_at: string | null
          confidence: string | null
          country: string | null
          created_at: string
          famille_olfactive: string | null
          gender: string | null
          general_notes: string[]
          id: string
          image_url: string | null
          image_url_2x: string | null
          image_verified: boolean | null
          longevity: string | null
          main_accords: string[]
          main_accords_percentage: Json | null
          marque: string
          nom: string
          notes_coeur: string[]
          notes_fond: string[]
          notes_tete: string[]
          occasion_ranking: Json | null
          offers: Json
          perfumers: string[]
          popularity: string | null
          popularity_score: number | null
          price_value: string | null
          purchase_url: string | null
          rating: string | null
          rating_count: number
          rating_score: number | null
          reference_price: number | null
          review_count: number
          search_text: string | null
          search_vector: unknown
          season_ranking: Json | null
          sillage: string | null
          similar_ids: string[]
          similar_ids_cached_at: string | null
          source: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum: string | null
          updated_at: string
        }
        Insert: {
          annee?: number | null
          best_price?: number | null
          cached_at?: string | null
          confidence?: string | null
          country?: string | null
          created_at?: string
          famille_olfactive?: string | null
          gender?: string | null
          general_notes?: string[]
          id: string
          image_url?: string | null
          image_url_2x?: string | null
          image_verified?: boolean | null
          longevity?: string | null
          main_accords?: string[]
          main_accords_percentage?: Json | null
          marque: string
          nom: string
          notes_coeur?: string[]
          notes_fond?: string[]
          notes_tete?: string[]
          occasion_ranking?: Json | null
          offers?: Json
          perfumers?: string[]
          popularity?: string | null
          popularity_score?: number | null
          price_value?: string | null
          purchase_url?: string | null
          rating?: string | null
          rating_count?: number
          rating_score?: number | null
          reference_price?: number | null
          review_count?: number
          search_text?: string | null
          search_vector?: unknown
          season_ranking?: Json | null
          sillage?: string | null
          similar_ids?: string[]
          similar_ids_cached_at?: string | null
          source?: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum?: string | null
          updated_at?: string
        }
        Update: {
          annee?: number | null
          best_price?: number | null
          cached_at?: string | null
          confidence?: string | null
          country?: string | null
          created_at?: string
          famille_olfactive?: string | null
          gender?: string | null
          general_notes?: string[]
          id?: string
          image_url?: string | null
          image_url_2x?: string | null
          image_verified?: boolean | null
          longevity?: string | null
          main_accords?: string[]
          main_accords_percentage?: Json | null
          marque?: string
          nom?: string
          notes_coeur?: string[]
          notes_fond?: string[]
          notes_tete?: string[]
          occasion_ranking?: Json | null
          offers?: Json
          perfumers?: string[]
          popularity?: string | null
          popularity_score?: number | null
          price_value?: string | null
          purchase_url?: string | null
          rating?: string | null
          rating_count?: number
          rating_score?: number | null
          reference_price?: number | null
          review_count?: number
          search_text?: string | null
          search_vector?: unknown
          season_ranking?: Json | null
          sillage?: string | null
          similar_ids?: string[]
          similar_ids_cached_at?: string | null
          source?: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      possessions: {
        Row: {
          added_at: string
          for_sale: boolean
          id: string
          notes: string | null
          parfum_id: string
          quantity: number
          size_ml: number | null
          type: Database["public"]["Enums"]["possession_type"]
          user_id: string
        }
        Insert: {
          added_at?: string
          for_sale?: boolean
          id?: string
          notes?: string | null
          parfum_id: string
          quantity?: number
          size_ml?: number | null
          type?: Database["public"]["Enums"]["possession_type"]
          user_id: string
        }
        Update: {
          added_at?: string
          for_sale?: boolean
          id?: string
          notes?: string | null
          parfum_id?: string
          quantity?: number
          size_ml?: number | null
          type?: Database["public"]["Enums"]["possession_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_parfum"
            columns: ["user_id", "parfum_id"]
            isOneToOne: false
            referencedRelation: "user_parfum"
            referencedColumns: ["user_id", "parfum_id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          added_at: string
          initial_price: number | null
          last_checked: string | null
          last_price: number | null
          parfum_id: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          added_at?: string
          initial_price?: number | null
          last_checked?: string | null
          last_price?: number | null
          parfum_id: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          added_at?: string
          initial_price?: number | null
          last_checked?: string | null
          last_price?: number | null
          parfum_id?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          best_price: number
          captured_on: string
          parfum_id: string
        }
        Insert: {
          best_price: number
          captured_on?: string
          parfum_id: string
        }
        Update: {
          best_price?: number
          captured_on?: string
          parfum_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          is_public: boolean
          pseudo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          is_public?: boolean
          pseudo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          is_public?: boolean
          pseudo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          day: string
          scan_count: number
          user_id: string
          voice_count: number
        }
        Insert: {
          day: string
          scan_count?: number
          user_id: string
          voice_count?: number
        }
        Update: {
          day?: string
          scan_count?: number
          user_id?: string
          voice_count?: number
        }
        Relationships: []
      }
      scans: {
        Row: {
          annee: number | null
          best_price: number | null
          famille_olfactive: string | null
          id: string
          image_url: string | null
          marque: string | null
          nom: string | null
          parfum_id: string | null
          raw_text: string | null
          scanned_at: string
          status: Database["public"]["Enums"]["scan_status"] | null
          type_parfum: string | null
          user_id: string
          volume_ml: number | null
        }
        Insert: {
          annee?: number | null
          best_price?: number | null
          famille_olfactive?: string | null
          id?: string
          image_url?: string | null
          marque?: string | null
          nom?: string | null
          parfum_id?: string | null
          raw_text?: string | null
          scanned_at?: string
          status?: Database["public"]["Enums"]["scan_status"] | null
          type_parfum?: string | null
          user_id: string
          volume_ml?: number | null
        }
        Update: {
          annee?: number | null
          best_price?: number | null
          famille_olfactive?: string | null
          id?: string
          image_url?: string | null
          marque?: string | null
          nom?: string | null
          parfum_id?: string | null
          raw_text?: string | null
          scanned_at?: string
          status?: Database["public"]["Enums"]["scan_status"] | null
          type_parfum?: string | null
          user_id?: string
          volume_ml?: number | null
        }
        Relationships: []
      }
      scentlist: {
        Row: {
          added_at: string
          best_price: number | null
          famille_olfactive: string | null
          image_url: string | null
          marque: string | null
          nom: string | null
          notes: string | null
          parfum_id: string
          rating: number | null
          reference_price: number | null
          status: Database["public"]["Enums"]["scent_status"]
          tried_at: string | null
          updated_at: string
          user_id: string
          verdict: Database["public"]["Enums"]["scent_verdict"] | null
        }
        Insert: {
          added_at?: string
          best_price?: number | null
          famille_olfactive?: string | null
          image_url?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string | null
          parfum_id: string
          rating?: number | null
          reference_price?: number | null
          status?: Database["public"]["Enums"]["scent_status"]
          tried_at?: string | null
          updated_at?: string
          user_id: string
          verdict?: Database["public"]["Enums"]["scent_verdict"] | null
        }
        Update: {
          added_at?: string
          best_price?: number | null
          famille_olfactive?: string | null
          image_url?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string | null
          parfum_id?: string
          rating?: number | null
          reference_price?: number | null
          status?: Database["public"]["Enums"]["scent_status"]
          tried_at?: string | null
          updated_at?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["scent_verdict"] | null
        }
        Relationships: []
      }
      search_stop_words: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
      shelves: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_public: boolean
          name: string
          order: number
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          name: string
          order?: number
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          name?: string
          order?: number
          user_id?: string
        }
        Relationships: []
      }
      shelf_items: {
        Row: {
          added_at: string
          parfum_id: string
          pinned: boolean
          position: number
          shelf_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          parfum_id: string
          pinned?: boolean
          position: number
          shelf_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          parfum_id?: string
          pinned?: boolean
          position?: number
          shelf_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sotd: {
        Row: {
          day: string
          image_url: string | null
          marque: string
          nom: string
          parfum_id: string
          user_id: string
        }
        Insert: {
          day: string
          image_url?: string | null
          marque: string
          nom: string
          parfum_id: string
          user_id: string
        }
        Update: {
          day?: string
          image_url?: string | null
          marque?: string
          nom?: string
          parfum_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_parfum: {
        Row: {
          added_at: string
          all_notes: string[] | null
          best_price: number | null
          famille_olfactive: string | null
          image_url: string | null
          is_signature: boolean
          longevity: string | null
          marque: string | null
          nom: string | null
          notes: string | null
          parfum_id: string
          rating: number | null
          reference_price: number | null
          season_scores: Json | null
          shelf_ids: string[]
          sillage: string | null
          sotd_count: number
          status: Database["public"]["Enums"]["user_parfum_status"]
          tried_at: string | null
          updated_at: string
          user_id: string
          verdict: Database["public"]["Enums"]["scent_verdict"] | null
        }
        Insert: {
          added_at?: string
          all_notes?: string[] | null
          best_price?: number | null
          famille_olfactive?: string | null
          image_url?: string | null
          is_signature?: boolean
          longevity?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string | null
          parfum_id: string
          rating?: number | null
          reference_price?: number | null
          season_scores?: Json | null
          shelf_ids?: string[]
          sillage?: string | null
          sotd_count?: number
          status?: Database["public"]["Enums"]["user_parfum_status"]
          tried_at?: string | null
          updated_at?: string
          user_id: string
          verdict?: Database["public"]["Enums"]["scent_verdict"] | null
        }
        Update: {
          added_at?: string
          all_notes?: string[] | null
          best_price?: number | null
          famille_olfactive?: string | null
          image_url?: string | null
          is_signature?: boolean
          longevity?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string | null
          parfum_id?: string
          rating?: number | null
          reference_price?: number | null
          season_scores?: Json | null
          shelf_ids?: string[]
          sillage?: string | null
          sotd_count?: number
          status?: Database["public"]["Enums"]["user_parfum_status"]
          tried_at?: string | null
          updated_at?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["scent_verdict"] | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          price_alerts: boolean
          push_notifs: boolean
          user_id: string
          weather_lat: number | null
          weather_lon: number | null
          weather_notifs: boolean
        }
        Insert: {
          price_alerts?: boolean
          push_notifs?: boolean
          user_id: string
          weather_lat?: number | null
          weather_lon?: number | null
          weather_notifs?: boolean
        }
        Update: {
          price_alerts?: boolean
          push_notifs?: boolean
          user_id?: string
          weather_lat?: number | null
          weather_lon?: number | null
          weather_notifs?: boolean
        }
        Relationships: []
      }
      wardrobe: {
        Row: {
          added_at: string
          all_notes: string[] | null
          famille_olfactive: string | null
          image_url: string | null
          is_signature: boolean
          longevity: string | null
          marque: string | null
          nom: string | null
          notes: string | null
          ownership: Database["public"]["Enums"]["ownership_type"]
          parfum_id: string
          rating: number | null
          season_scores: Json | null
          shelf_ids: string[]
          sillage: string | null
          size_ml: number | null
          sotd_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          all_notes?: string[] | null
          famille_olfactive?: string | null
          image_url?: string | null
          is_signature?: boolean
          longevity?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string | null
          ownership?: Database["public"]["Enums"]["ownership_type"]
          parfum_id: string
          rating?: number | null
          season_scores?: Json | null
          shelf_ids?: string[]
          sillage?: string | null
          size_ml?: number | null
          sotd_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          all_notes?: string[] | null
          famille_olfactive?: string | null
          image_url?: string | null
          is_signature?: boolean
          longevity?: string | null
          marque?: string | null
          nom?: string | null
          notes?: string | null
          ownership?: Database["public"]["Enums"]["ownership_type"]
          parfum_id?: string
          rating?: number | null
          season_scores?: Json | null
          shelf_ids?: string[]
          sillage?: string | null
          size_ml?: number | null
          sotd_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_quota: {
        Args: { p_kind: string; p_max: number }
        Returns: undefined
      }
      community_highlights: { Args: never; Returns: Json }
      delete_shelf: { Args: { p_shelf_id: string }; Returns: undefined }
      reorder_shelves: { Args: { p_items: Json }; Returns: undefined }
      add_to_shelf: { Args: { p_parfum_id: string; p_shelf_id: string }; Returns: undefined }
      remove_from_shelf: { Args: { p_parfum_id: string; p_shelf_id: string }; Returns: undefined }
      pin_shelf_item: { Args: { p_pinned: boolean; p_parfum_id: string; p_shelf_id: string }; Returns: undefined }
      reorder_shelf_items: { Args: { p_items: Json; p_shelf_id: string }; Returns: undefined }
      submit_runner_score: {
        Args: { p_score: number; p_distance?: number; p_max_combo?: number; p_skin?: string }
        Returns: number
      }
      runner_leaderboard: {
        Args: { lim?: number }
        Returns: {
          rank: number
          is_me: boolean
          pseudo: string | null
          avatar_url: string | null
          score: number
          distance: number
          max_combo: number
          skin: string
          created_at: string
        }[]
      }
      public_shelf: {
        Args: { p_pseudo: string; p_shelf_id: string }
        Returns: {
          shelf_id: string
          name: string
          description: string | null
          color: string | null
          icon: string | null
          item_count: number
          pseudo: string
          avatar_url: string | null
          bio: string | null
        }[]
      }
      public_shelf_items: {
        Args: { p_pseudo: string; p_shelf_id: string }
        Returns: {
          parfum_id: string
          nom: string | null
          marque: string | null
          image_url: string | null
          famille_olfactive: string | null
          status: Database["public"]["Enums"]["user_parfum_status"] | null
          verdict: Database["public"]["Enums"]["scent_verdict"] | null
          rating: number | null
          best_price: number | null
        }[]
      }
      parfum_verdicts: {
        Args: { p_parfum_id: string }
        Returns: {
          pseudo: string
          avatar_url: string
          verdict: Database["public"]["Enums"]["scent_verdict"]
        }[]
      }
      export_user_data: { Args: never; Returns: Json }
      family_overviews: {
        Args: { p_buckets: Json; p_top?: number }
        Returns: {
          bucket_key: string
          idx: number
          image_url: string
          parfum_id: string
          popularity_score: number
          total: number
        }[]
      }
      immutable_array_to_string: {
        Args: { arr: string[]; sep: string }
        Returns: string
      }
      immutable_unaccent: { Args: { t: string }; Returns: string }
      norm_txt: { Args: { t: string }; Returns: string }
      personalized_suggestions: {
        Args: { lim?: number }
        Returns: {
          annee: number | null
          best_price: number | null
          cached_at: string | null
          confidence: string | null
          country: string | null
          created_at: string
          famille_olfactive: string | null
          gender: string | null
          general_notes: string[]
          id: string
          image_url: string | null
          image_url_2x: string | null
          image_verified: boolean | null
          longevity: string | null
          main_accords: string[]
          main_accords_percentage: Json | null
          marque: string
          nom: string
          notes_coeur: string[]
          notes_fond: string[]
          notes_tete: string[]
          occasion_ranking: Json | null
          offers: Json
          perfumers: string[]
          popularity: string | null
          popularity_score: number | null
          price_value: string | null
          purchase_url: string | null
          rating: string | null
          rating_count: number
          rating_score: number | null
          reference_price: number | null
          review_count: number
          search_text: string | null
          search_vector: unknown
          season_ranking: Json | null
          sillage: string | null
          similar_ids: string[]
          similar_ids_cached_at: string | null
          source: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "parfums"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_collection: {
        Args: { p_pseudo: string }
        Returns: {
          added_at: string
          best_price: number
          famille_olfactive: string
          image_url: string
          marque: string
          nom: string
          parfum_id: string
          rating: number
          status: Database["public"]["Enums"]["user_parfum_status"]
          verdict: Database["public"]["Enums"]["scent_verdict"]
        }[]
      }
      public_profile: {
        Args: { p_pseudo: string }
        Returns: {
          avatar_url: string
          bio: string
          collection_count: number
          created_at: string
          follower_count: number
          following_count: number
          pseudo: string
        }[]
      }
      follow_by_pseudo: { Args: { p_pseudo: string }; Returns: undefined }
      followed_highlights: { Args: never; Returns: Json }
      unfollow_by_pseudo: { Args: { p_pseudo: string }; Returns: undefined }
      is_following: { Args: { p_pseudo: string }; Returns: boolean }
      public_followers: {
        Args: { p_pseudo: string; lim?: number }
        Returns: { pseudo: string; avatar_url: string }[]
      }
      public_following: {
        Args: { p_pseudo: string; lim?: number }
        Returns: { pseudo: string; avatar_url: string }[]
      }
      search_profiles: {
        Args: { p_prefix: string; lim?: number }
        Returns: { pseudo: string; avatar_url: string; collection_count: number }[]
      }
      search_parfums: {
        Args: { max_results?: number; q: string }
        Returns: {
          annee: number | null
          best_price: number | null
          cached_at: string | null
          confidence: string | null
          country: string | null
          created_at: string
          famille_olfactive: string | null
          gender: string | null
          general_notes: string[]
          id: string
          image_url: string | null
          image_url_2x: string | null
          image_verified: boolean | null
          longevity: string | null
          main_accords: string[]
          main_accords_percentage: Json | null
          marque: string
          nom: string
          notes_coeur: string[]
          notes_fond: string[]
          notes_tete: string[]
          occasion_ranking: Json | null
          offers: Json
          perfumers: string[]
          popularity: string | null
          popularity_score: number | null
          price_value: string | null
          purchase_url: string | null
          rating: string | null
          rating_count: number
          rating_score: number | null
          reference_price: number | null
          review_count: number
          search_text: string | null
          search_vector: unknown
          season_ranking: Json | null
          sillage: string | null
          similar_ids: string[]
          similar_ids_cached_at: string | null
          source: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "parfums"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seasonal_parfums: {
        Args: { lim?: number; season: string }
        Returns: {
          annee: number | null
          best_price: number | null
          cached_at: string | null
          confidence: string | null
          country: string | null
          created_at: string
          famille_olfactive: string | null
          gender: string | null
          general_notes: string[]
          id: string
          image_url: string | null
          image_url_2x: string | null
          image_verified: boolean | null
          longevity: string | null
          main_accords: string[]
          main_accords_percentage: Json | null
          marque: string
          nom: string
          notes_coeur: string[]
          notes_fond: string[]
          notes_tete: string[]
          occasion_ranking: Json | null
          offers: Json
          perfumers: string[]
          popularity: string | null
          popularity_score: number | null
          price_value: string | null
          purchase_url: string | null
          rating: string | null
          rating_count: number
          rating_score: number | null
          reference_price: number | null
          review_count: number
          search_text: string | null
          search_vector: unknown
          season_ranking: Json | null
          sillage: string | null
          similar_ids: string[]
          similar_ids_cached_at: string | null
          source: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "parfums"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_sotd: {
        Args: {
          p_image_url?: string
          p_marque: string
          p_nom: string
          p_parfum_id: string
        }
        Returns: undefined
      }
      similar_parfums: {
        Args: { accords: string[]; exclude_id: string; lim?: number }
        Returns: {
          annee: number | null
          best_price: number | null
          cached_at: string | null
          confidence: string | null
          country: string | null
          created_at: string
          famille_olfactive: string | null
          gender: string | null
          general_notes: string[]
          id: string
          image_url: string | null
          image_url_2x: string | null
          image_verified: boolean | null
          longevity: string | null
          main_accords: string[]
          main_accords_percentage: Json | null
          marque: string
          nom: string
          notes_coeur: string[]
          notes_fond: string[]
          notes_tete: string[]
          occasion_ranking: Json | null
          offers: Json
          perfumers: string[]
          popularity: string | null
          popularity_score: number | null
          price_value: string | null
          purchase_url: string | null
          rating: string | null
          rating_count: number
          rating_score: number | null
          reference_price: number | null
          review_count: number
          search_text: string | null
          search_vector: unknown
          season_ranking: Json | null
          sillage: string | null
          similar_ids: string[]
          similar_ids_cached_at: string | null
          source: Database["public"]["Enums"]["parfum_source"] | null
          type_parfum: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "parfums"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      ownership_type: "have" | "want" | "had" | "sample" | "decant"
      parfum_source: "seed" | "manual"
      possession_type: "bottle" | "decant" | "sample"
      scan_status: "success" | "no-result" | "error"
      scent_status: "to_try" | "tried"
      scent_verdict: "love" | "like" | "meh" | "dislike"
      user_parfum_status: "to_try" | "tried" | "want" | "have" | "had"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ownership_type: ["have", "want", "had", "sample", "decant"],
      parfum_source: ["seed", "manual"],
      possession_type: ["bottle", "decant", "sample"],
      scan_status: ["success", "no-result", "error"],
      scent_status: ["to_try", "tried"],
      scent_verdict: ["love", "like", "meh", "dislike"],
      user_parfum_status: ["to_try", "tried", "want", "have", "had"],
    },
  },
} as const
