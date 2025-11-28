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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ab_test_offers: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          start_date: string | null
          test_name: string
          variant_a: Json
          variant_b: Json
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          test_name: string
          variant_a: Json
          variant_b: Json
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          test_name?: string
          variant_a?: Json
          variant_b?: Json
        }
        Relationships: []
      }
      ab_test_results: {
        Row: {
          client_id: string | null
          converted: boolean | null
          converted_at: string | null
          id: string
          shown_at: string | null
          test_id: string | null
          variant_shown: string
        }
        Insert: {
          client_id?: string | null
          converted?: boolean | null
          converted_at?: string | null
          id?: string
          shown_at?: string | null
          test_id?: string | null
          variant_shown: string
        }
        Update: {
          client_id?: string | null
          converted?: boolean | null
          converted_at?: string | null
          id?: string
          shown_at?: string | null
          test_id?: string | null
          variant_shown?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_results_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_results_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_test_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_keys: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action_description: string
          action_type: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_badge_notifications: {
        Row: {
          admin_id: string
          badge_id: string
          badge_name: string
          badge_rarity: string
          created_at: string | null
          earned_at: string | null
          id: string
          read_at: string | null
        }
        Insert: {
          admin_id: string
          badge_id: string
          badge_name: string
          badge_rarity: string
          created_at?: string | null
          earned_at?: string | null
          id?: string
          read_at?: string | null
        }
        Update: {
          admin_id?: string
          badge_id?: string
          badge_name?: string
          badge_rarity?: string
          created_at?: string | null
          earned_at?: string | null
          id?: string
          read_at?: string | null
        }
        Relationships: []
      }
      admin_leaderboard_history: {
        Row: {
          admin_id: string
          admin_name: string
          admin_phone: string
          avg_response_time_minutes: number | null
          badges_earned: Json
          confirmation_rate: number
          created_at: string | null
          id: string
          level: number
          month_year: string
          rank: number
          score: number
          total_alerts: number
        }
        Insert: {
          admin_id: string
          admin_name: string
          admin_phone: string
          avg_response_time_minutes?: number | null
          badges_earned?: Json
          confirmation_rate: number
          created_at?: string | null
          id?: string
          level: number
          month_year: string
          rank: number
          score: number
          total_alerts: number
        }
        Update: {
          admin_id?: string
          admin_name?: string
          admin_phone?: string
          avg_response_time_minutes?: number | null
          badges_earned?: Json
          confirmation_rate?: number
          created_at?: string | null
          id?: string
          level?: number
          month_year?: string
          rank?: number
          score?: number
          total_alerts?: number
        }
        Relationships: []
      }
      admin_phones: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          notification_channels: Json | null
          phone: string
          phone_sms: string | null
          schedule_config: Json | null
          schedule_enabled: boolean | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          notification_channels?: Json | null
          phone: string
          phone_sms?: string | null
          schedule_config?: Json | null
          schedule_enabled?: boolean | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          notification_channels?: Json | null
          phone?: string
          phone_sms?: string | null
          schedule_config?: Json | null
          schedule_enabled?: boolean | null
        }
        Relationships: []
      }
      admin_shortcuts: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string
          id: string
          order_index: number | null
          path: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon: string
          id?: string
          order_index?: number | null
          path: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          order_index?: number | null
          path?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_sessions_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_notification_config: {
        Row: {
          created_at: string | null
          days_to_notify: number[] | null
          enabled: boolean | null
          id: string
          send_hour: number | null
          test_phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_to_notify?: number[] | null
          enabled?: boolean | null
          id?: string
          send_hour?: number | null
          test_phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_to_notify?: number[] | null
          enabled?: boolean | null
          id?: string
          send_hour?: number | null
          test_phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automatic_notification_rules: {
        Row: {
          active: boolean | null
          created_at: string | null
          days_before: number | null
          description: string | null
          event_type: string
          id: string
          name: string
          priority: number | null
          target_audience: string
          template_reference: string | null
          trigger_condition: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          days_before?: number | null
          description?: string | null
          event_type: string
          id?: string
          name: string
          priority?: number | null
          target_audience?: string
          template_reference?: string | null
          trigger_condition: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          days_before?: number | null
          description?: string | null
          event_type?: string
          id?: string
          name?: string
          priority?: number | null
          target_audience?: string
          template_reference?: string | null
          trigger_condition?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      channel_usage_stats: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          last_watched_at: string | null
          profile_id: string
          total_watch_time_seconds: number | null
          view_count: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          profile_id: string
          total_watch_time_seconds?: number | null
          view_count?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          profile_id?: string
          total_watch_time_seconds?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_usage_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_m3u_custom_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          cliente_id: string
          custom_list_id: string
          id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          cliente_id: string
          custom_list_id: string
          id?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          cliente_id?: string
          custom_list_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_m3u_custom_assignments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_m3u_custom_assignments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_m3u_custom_assignments_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_custom_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      client_m3u_lists: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          client_id: string
          id: string
          is_active: boolean | null
          m3u_list_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_id: string
          id?: string
          is_active?: boolean | null
          m3u_list_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_id?: string
          id?: string
          is_active?: boolean | null
          m3u_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_m3u_lists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_m3u_lists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_m3u_lists_m3u_list_id_fkey"
            columns: ["m3u_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cliente_ativo: boolean | null
          data_cadastro: string | null
          data_contratacao: string | null
          data_ultima_edicao: string | null
          data_ultimo_pagamento: string | null
          data_vencimento: string | null
          dispositivo_contratado:
            | Database["public"]["Enums"]["dispositivo_tipo"]
            | null
          email: string | null
          forma_ultimo_pagamento: string | null
          id: string
          is_recorrente: boolean | null
          mac_smart_one: string | null
          nome: string
          origem_cadastro: Database["public"]["Enums"]["origem_cadastro"] | null
          plano: Database["public"]["Enums"]["plano_cliente"] | null
          senha_m3u: string | null
          situacao: Database["public"]["Enums"]["situacao_cliente"] | null
          smartone_last_sync_at: string | null
          smartone_playlist_id: string | null
          smartone_raw_response: string | null
          smartone_status: Database["public"]["Enums"]["smartone_status"] | null
          telefone: string
          user_id: string | null
          usuario_m3u: string | null
          valor_pago: number | null
        }
        Insert: {
          cliente_ativo?: boolean | null
          data_cadastro?: string | null
          data_contratacao?: string | null
          data_ultima_edicao?: string | null
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          dispositivo_contratado?:
            | Database["public"]["Enums"]["dispositivo_tipo"]
            | null
          email?: string | null
          forma_ultimo_pagamento?: string | null
          id?: string
          is_recorrente?: boolean | null
          mac_smart_one?: string | null
          nome: string
          origem_cadastro?:
            | Database["public"]["Enums"]["origem_cadastro"]
            | null
          plano?: Database["public"]["Enums"]["plano_cliente"] | null
          senha_m3u?: string | null
          situacao?: Database["public"]["Enums"]["situacao_cliente"] | null
          smartone_last_sync_at?: string | null
          smartone_playlist_id?: string | null
          smartone_raw_response?: string | null
          smartone_status?:
            | Database["public"]["Enums"]["smartone_status"]
            | null
          telefone: string
          user_id?: string | null
          usuario_m3u?: string | null
          valor_pago?: number | null
        }
        Update: {
          cliente_ativo?: boolean | null
          data_cadastro?: string | null
          data_contratacao?: string | null
          data_ultima_edicao?: string | null
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          dispositivo_contratado?:
            | Database["public"]["Enums"]["dispositivo_tipo"]
            | null
          email?: string | null
          forma_ultimo_pagamento?: string | null
          id?: string
          is_recorrente?: boolean | null
          mac_smart_one?: string | null
          nome?: string
          origem_cadastro?:
            | Database["public"]["Enums"]["origem_cadastro"]
            | null
          plano?: Database["public"]["Enums"]["plano_cliente"] | null
          senha_m3u?: string | null
          situacao?: Database["public"]["Enums"]["situacao_cliente"] | null
          smartone_last_sync_at?: string | null
          smartone_playlist_id?: string | null
          smartone_raw_response?: string | null
          smartone_status?:
            | Database["public"]["Enums"]["smartone_status"]
            | null
          telefone?: string
          user_id?: string | null
          usuario_m3u?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      code_snippets: {
        Row: {
          content: string
          created_at: string | null
          name: string
        }
        Insert: {
          content: string
          created_at?: string | null
          name: string
        }
        Update: {
          content?: string
          created_at?: string | null
          name?: string
        }
        Relationships: []
      }
      content_metadata: {
        Row: {
          backdrop_url: string | null
          cast_members: Json | null
          content_id: string
          content_type: string
          country: string | null
          created_at: string | null
          description: string | null
          director: string | null
          duration_minutes: number | null
          fetched_at: string | null
          genres: string[] | null
          id: string
          imdb_id: string | null
          imdb_rating: number | null
          language: string | null
          metadata: Json | null
          original_title: string | null
          poster_url: string | null
          title: string
          tmdb_id: string | null
          tmdb_rating: number | null
          trailer_url: string | null
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          cast_members?: Json | null
          content_id: string
          content_type: string
          country?: string | null
          created_at?: string | null
          description?: string | null
          director?: string | null
          duration_minutes?: number | null
          fetched_at?: string | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          imdb_rating?: number | null
          language?: string | null
          metadata?: Json | null
          original_title?: string | null
          poster_url?: string | null
          title: string
          tmdb_id?: string | null
          tmdb_rating?: number | null
          trailer_url?: string | null
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          cast_members?: Json | null
          content_id?: string
          content_type?: string
          country?: string | null
          created_at?: string | null
          description?: string | null
          director?: string | null
          duration_minutes?: number | null
          fetched_at?: string | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          imdb_rating?: number | null
          language?: string | null
          metadata?: Json | null
          original_title?: string | null
          poster_url?: string | null
          title?: string
          tmdb_id?: string | null
          tmdb_rating?: number | null
          trailer_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      conversion_metrics: {
        Row: {
          client_id: string | null
          conversion_date: string | null
          converted: boolean | null
          converted_to_plan: string | null
          coupon_used: string | null
          created_at: string | null
          days_to_convert: number | null
          id: string
          touchpoints: Json | null
          trial_end_date: string
          trial_start_date: string
        }
        Insert: {
          client_id?: string | null
          conversion_date?: string | null
          converted?: boolean | null
          converted_to_plan?: string | null
          coupon_used?: string | null
          created_at?: string | null
          days_to_convert?: number | null
          id?: string
          touchpoints?: Json | null
          trial_end_date: string
          trial_start_date: string
        }
        Update: {
          client_id?: string | null
          conversion_date?: string | null
          converted?: boolean | null
          converted_to_plan?: string | null
          coupon_used?: string | null
          created_at?: string | null
          days_to_convert?: number | null
          id?: string
          touchpoints?: Json | null
          trial_end_date?: string
          trial_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_metrics_coupon_used_fkey"
            columns: ["coupon_used"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          client_id: string | null
          coupon_id: string | null
          discount_applied: number | null
          id: string
          order_value: number | null
          used_at: string | null
        }
        Insert: {
          client_id?: string | null
          coupon_id?: string | null
          discount_applied?: number | null
          id?: string
          order_value?: number | null
          used_at?: string | null
        }
        Update: {
          client_id?: string | null
          coupon_id?: string | null
          discount_applied?: number | null
          id?: string
          order_value?: number | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_status_badges: {
        Row: {
          color: string
          created_at: string | null
          created_by: string | null
          description: string | null
          icon_name: string | null
          id: string
          is_critical: boolean | null
          label: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_critical?: boolean | null
          label: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_critical?: boolean | null
          label?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      discount_coupons: {
        Row: {
          active: boolean | null
          auto_generated: boolean | null
          code: string
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          target_plan: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          active?: boolean | null
          auto_generated?: boolean | null
          code: string
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          target_plan?: string | null
          valid_from?: string
          valid_until: string
        }
        Update: {
          active?: boolean | null
          auto_generated?: boolean | null
          code?: string
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          target_plan?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      epg_data: {
        Row: {
          category: string | null
          channel_id: string
          created_at: string | null
          end_time: string
          id: string
          is_live: boolean | null
          is_new: boolean | null
          metadata: Json | null
          poster_url: string | null
          program_description: string | null
          program_title: string
          rating: string | null
          start_time: string
        }
        Insert: {
          category?: string | null
          channel_id: string
          created_at?: string | null
          end_time: string
          id?: string
          is_live?: boolean | null
          is_new?: boolean | null
          metadata?: Json | null
          poster_url?: string | null
          program_description?: string | null
          program_title: string
          rating?: string | null
          start_time: string
        }
        Update: {
          category?: string | null
          channel_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          is_live?: boolean | null
          is_new?: boolean | null
          metadata?: Json | null
          poster_url?: string | null
          program_description?: string | null
          program_title?: string
          rating?: string | null
          start_time?: string
        }
        Relationships: []
      }
      health_snapshots: {
        Row: {
          id: string
          overall_status: string | null
          smartone_error: string | null
          smartone_latency: number | null
          smartone_status: string | null
          supabase_error: string | null
          supabase_latency: number | null
          supabase_status: string | null
          timestamp: string | null
          websocket_error: string | null
          websocket_latency: number | null
          websocket_status: string | null
          whatsapp_error: string | null
          whatsapp_latency: number | null
          whatsapp_status: string | null
        }
        Insert: {
          id?: string
          overall_status?: string | null
          smartone_error?: string | null
          smartone_latency?: number | null
          smartone_status?: string | null
          supabase_error?: string | null
          supabase_latency?: number | null
          supabase_status?: string | null
          timestamp?: string | null
          websocket_error?: string | null
          websocket_latency?: number | null
          websocket_status?: string | null
          whatsapp_error?: string | null
          whatsapp_latency?: number | null
          whatsapp_status?: string | null
        }
        Update: {
          id?: string
          overall_status?: string | null
          smartone_error?: string | null
          smartone_latency?: number | null
          smartone_status?: string | null
          supabase_error?: string | null
          supabase_latency?: number | null
          supabase_status?: string | null
          timestamp?: string | null
          websocket_error?: string | null
          websocket_latency?: number | null
          websocket_status?: string | null
          whatsapp_error?: string | null
          whatsapp_latency?: number | null
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      homepage_content: {
        Row: {
          content: Json
          id: string
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      homepage_faqs: {
        Row: {
          answer: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      ip_blacklist: {
        Row: {
          auto_blocked: boolean | null
          blocked_at: string
          blocked_by: string | null
          expires_at: string | null
          failed_attempts: number | null
          id: string
          ip_address: string
          last_attempt_at: string | null
          notes: string | null
          reason: string
          severity: string
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          auto_blocked?: boolean | null
          blocked_at?: string
          blocked_by?: string | null
          expires_at?: string | null
          failed_attempts?: number | null
          id?: string
          ip_address: string
          last_attempt_at?: string | null
          notes?: string | null
          reason: string
          severity?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          auto_blocked?: boolean | null
          blocked_at?: string
          blocked_by?: string | null
          expires_at?: string | null
          failed_attempts?: number | null
          id?: string
          ip_address?: string
          last_attempt_at?: string | null
          notes?: string | null
          reason?: string
          severity?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: []
      }
      ip_whitelist: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          id: string
          ip_address: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      m3u_categories: {
        Row: {
          created_at: string | null
          custom_list_id: string
          display_name: string
          icon: string | null
          id: string
          name: string
          order_position: number | null
        }
        Insert: {
          created_at?: string | null
          custom_list_id: string
          display_name: string
          icon?: string | null
          id?: string
          name: string
          order_position?: number | null
        }
        Update: {
          created_at?: string | null
          custom_list_id?: string
          display_name?: string
          icon?: string | null
          id?: string
          name?: string
          order_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_categories_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_custom_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_channels: {
        Row: {
          category_id: string
          created_at: string | null
          group_title: string | null
          id: string
          metadata: Json | null
          name: string
          order_position: number | null
          stream_url: string
          tvg_id: string | null
          tvg_logo: string | null
          tvg_name: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          group_title?: string | null
          id?: string
          metadata?: Json | null
          name: string
          order_position?: number | null
          stream_url: string
          tvg_id?: string | null
          tvg_logo?: string | null
          tvg_name?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          group_title?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          order_position?: number | null
          stream_url?: string
          tvg_id?: string | null
          tvg_logo?: string | null
          tvg_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "m3u_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_custom_lists: {
        Row: {
          bucket_path: string | null
          cdn_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          last_generated_at: string | null
          name: string
          slug: string
          status: string | null
          total_categories: number | null
          total_channels: number | null
          updated_at: string | null
        }
        Insert: {
          bucket_path?: string | null
          cdn_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          last_generated_at?: string | null
          name: string
          slug: string
          status?: string | null
          total_categories?: number | null
          total_channels?: number | null
          updated_at?: string | null
        }
        Update: {
          bucket_path?: string | null
          cdn_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          last_generated_at?: string | null
          name?: string
          slug?: string
          status?: string | null
          total_categories?: number | null
          total_channels?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      m3u_generation_logs: {
        Row: {
          cdn_upload_status: string | null
          cdn_upload_time_ms: number | null
          channels_count: number | null
          created_at: string | null
          custom_list_id: string
          error_message: string | null
          file_size: number | null
          generation_time_ms: number | null
          id: string
        }
        Insert: {
          cdn_upload_status?: string | null
          cdn_upload_time_ms?: number | null
          channels_count?: number | null
          created_at?: string | null
          custom_list_id: string
          error_message?: string | null
          file_size?: number | null
          generation_time_ms?: number | null
          id?: string
        }
        Update: {
          cdn_upload_status?: string | null
          cdn_upload_time_ms?: number | null
          channels_count?: number | null
          created_at?: string | null
          custom_list_id?: string
          error_message?: string | null
          file_size?: number | null
          generation_time_ms?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m3u_generation_logs_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_custom_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_health_checks: {
        Row: {
          channel_count: number | null
          created_at: string | null
          error_message: string | null
          http_status_code: number | null
          id: string
          last_checked_at: string | null
          m3u_list_id: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          channel_count?: number | null
          created_at?: string | null
          error_message?: string | null
          http_status_code?: number | null
          id?: string
          last_checked_at?: string | null
          m3u_list_id: string
          response_time_ms?: number | null
          status?: string
        }
        Update: {
          channel_count?: number | null
          created_at?: string | null
          error_message?: string | null
          http_status_code?: number | null
          id?: string
          last_checked_at?: string | null
          m3u_list_id?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "m3u_health_checks_m3u_list_id_fkey"
            columns: ["m3u_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_import_cache: {
        Row: {
          categories_data: Json
          channel_count: number
          channels_data: Json
          created_at: string | null
          id: string
          last_used_at: string | null
          source_hash: string
          source_url: string | null
          use_count: number | null
        }
        Insert: {
          categories_data: Json
          channel_count: number
          channels_data: Json
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          source_hash: string
          source_url?: string | null
          use_count?: number | null
        }
        Update: {
          categories_data?: Json
          channel_count?: number
          channels_data?: Json
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          source_hash?: string
          source_url?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      m3u_import_changes: {
        Row: {
          change_type: string
          created_at: string | null
          custom_list_id: string | null
          entity_id: string | null
          entity_name: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          session_id: string | null
        }
        Insert: {
          change_type: string
          created_at?: string | null
          custom_list_id?: string | null
          entity_id?: string | null
          entity_name: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string | null
          custom_list_id?: string | null
          entity_id?: string | null
          entity_name?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_import_changes_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_custom_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m3u_import_changes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "m3u_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_import_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          max_retries: number | null
          priority: number | null
          retry_count: number | null
          session_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          retry_count?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          retry_count?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_import_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "m3u_import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_import_sessions: {
        Row: {
          auto_resolved: boolean | null
          batch_size: number | null
          completed_at: string | null
          conflict_resolution_mode: string | null
          conflicts_detected: number | null
          conflicts_resolved: number | null
          created_at: string | null
          created_by: string | null
          current_batch: number | null
          custom_list_id: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          processed_channels: number | null
          source_hash: string | null
          source_type: string
          source_url: string | null
          status: string | null
          total_channels: number | null
          updated_at: string | null
        }
        Insert: {
          auto_resolved?: boolean | null
          batch_size?: number | null
          completed_at?: string | null
          conflict_resolution_mode?: string | null
          conflicts_detected?: number | null
          conflicts_resolved?: number | null
          created_at?: string | null
          created_by?: string | null
          current_batch?: number | null
          custom_list_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processed_channels?: number | null
          source_hash?: string | null
          source_type: string
          source_url?: string | null
          status?: string | null
          total_channels?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_resolved?: boolean | null
          batch_size?: number | null
          completed_at?: string | null
          conflict_resolution_mode?: string | null
          conflicts_detected?: number | null
          conflicts_resolved?: number | null
          created_at?: string | null
          created_by?: string | null
          current_batch?: number | null
          custom_list_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processed_channels?: number | null
          source_hash?: string | null
          source_type?: string
          source_url?: string | null
          status?: string | null
          total_channels?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_import_sessions_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_custom_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_list_favorites: {
        Row: {
          admin_id: string
          created_at: string | null
          id: string
          m3u_list_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          id?: string
          m3u_list_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          id?: string
          m3u_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m3u_list_favorites_m3u_list_id_fkey"
            columns: ["m3u_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          file_url: string
          health_snoozed_until: string | null
          id: string
          is_default: boolean | null
          name: string
          plan_type: string[] | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_url: string
          health_snoozed_until?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          plan_type?: string[] | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_url?: string
          health_snoozed_until?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          plan_type?: string[] | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      m3u_lists_audit: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          id: string
          m3u_list_id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          change_type: string
          changed_by: string
          created_at?: string
          id?: string
          m3u_list_id: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string
          id?: string
          m3u_list_id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      m3u_view_history: {
        Row: {
          admin_id: string
          admin_name: string
          id: string
          m3u_list_id: string
          metadata: Json | null
          view_type: string | null
          viewed_at: string | null
        }
        Insert: {
          admin_id: string
          admin_name: string
          id?: string
          m3u_list_id: string
          metadata?: Json | null
          view_type?: string | null
          viewed_at?: string | null
        }
        Update: {
          admin_id?: string
          admin_name?: string
          id?: string
          m3u_list_id?: string
          metadata?: Json | null
          view_type?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_view_history_m3u_list_id_fkey"
            columns: ["m3u_list_id"]
            isOneToOne: false
            referencedRelation: "m3u_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_snapshots: {
        Row: {
          average_connection_time: number | null
          average_latency: number | null
          average_time_between_reconnections: number | null
          current_connection_attempt: number | null
          current_status: string | null
          events_failed: number | null
          events_received: number | null
          events_sent: number | null
          failed_connections: number | null
          fallback_mode_activations: number | null
          id: string
          last_connection_time: number | null
          latency_history: number[] | null
          longest_uptime_period: number | null
          max_latency: number | null
          metrics_type: string | null
          min_latency: number | null
          reconnection_rate: number | null
          successful_connections: number | null
          timestamp: string | null
          total_connections: number | null
          total_downtime: number | null
          total_events_received: number | null
          total_events_sent: number | null
          total_reconnections: number | null
          total_uptime: number | null
        }
        Insert: {
          average_connection_time?: number | null
          average_latency?: number | null
          average_time_between_reconnections?: number | null
          current_connection_attempt?: number | null
          current_status?: string | null
          events_failed?: number | null
          events_received?: number | null
          events_sent?: number | null
          failed_connections?: number | null
          fallback_mode_activations?: number | null
          id?: string
          last_connection_time?: number | null
          latency_history?: number[] | null
          longest_uptime_period?: number | null
          max_latency?: number | null
          metrics_type?: string | null
          min_latency?: number | null
          reconnection_rate?: number | null
          successful_connections?: number | null
          timestamp?: string | null
          total_connections?: number | null
          total_downtime?: number | null
          total_events_received?: number | null
          total_events_sent?: number | null
          total_reconnections?: number | null
          total_uptime?: number | null
        }
        Update: {
          average_connection_time?: number | null
          average_latency?: number | null
          average_time_between_reconnections?: number | null
          current_connection_attempt?: number | null
          current_status?: string | null
          events_failed?: number | null
          events_received?: number | null
          events_sent?: number | null
          failed_connections?: number | null
          fallback_mode_activations?: number | null
          id?: string
          last_connection_time?: number | null
          latency_history?: number[] | null
          longest_uptime_period?: number | null
          max_latency?: number | null
          metrics_type?: string | null
          min_latency?: number | null
          reconnection_rate?: number | null
          successful_connections?: number | null
          timestamp?: string | null
          total_connections?: number | null
          total_downtime?: number | null
          total_events_received?: number | null
          total_events_sent?: number | null
          total_reconnections?: number | null
          total_uptime?: number | null
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_vencimento_atual: string
          days_before_due: number
          id: string
          sent_at: string | null
          success: boolean | null
          template_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_vencimento_atual: string
          days_before_due: number
          id?: string
          sent_at?: string | null
          success?: boolean | null
          template_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_vencimento_atual?: string
          days_before_due?: number
          id?: string
          sent_at?: string | null
          success?: boolean | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          cliente_id: string | null
          error_message: string | null
          id: string
          message_content: string | null
          phone: string
          sent_at: string | null
          status: string
          template_name: string | null
        }
        Insert: {
          cliente_id?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          phone: string
          sent_at?: string | null
          status: string
          template_name?: string | null
        }
        Update: {
          cliente_id?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_retry_queue: {
        Row: {
          attempts: number
          client_id: string | null
          created_at: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number
          message_content: string
          metadata: Json | null
          next_retry_at: string
          recipient_name: string | null
          recipient_phone: string
          status: string
          template_name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          message_content: string
          metadata?: Json | null
          next_retry_at: string
          recipient_name?: string | null
          recipient_phone: string
          status?: string
          template_name?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          client_id?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          message_content?: string
          metadata?: Json | null
          next_retry_at?: string
          recipient_name?: string | null
          recipient_phone?: string
          status?: string
          template_name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_retry_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_retry_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_schedule: {
        Row: {
          attempts: number | null
          cliente_id: string
          created_at: string | null
          days_before_due: number | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          metadata: Json | null
          notification_type: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          cliente_id: string
          created_at?: string | null
          days_before_due?: number | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          metadata?: Json | null
          notification_type: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          cliente_id?: string
          created_at?: string | null
          days_before_due?: number | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          metadata?: Json | null
          notification_type?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_schedule_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_schedule_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          active: boolean | null
          content: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      permission_diagnostics: {
        Row: {
          auth_context_is_admin: boolean | null
          auth_context_is_client: boolean | null
          auth_context_is_super_admin: boolean | null
          created_at: string | null
          discrepancy_details: Json | null
          executed_at: string
          full_diagnostic_data: Json
          has_discrepancy: boolean
          id: string
          is_admin_rpc: boolean | null
          jwt_role: string | null
          roles_via_rpc: string[] | null
          roles_via_table: string[] | null
          session_active: boolean | null
          user_email: string
          user_id: string
        }
        Insert: {
          auth_context_is_admin?: boolean | null
          auth_context_is_client?: boolean | null
          auth_context_is_super_admin?: boolean | null
          created_at?: string | null
          discrepancy_details?: Json | null
          executed_at?: string
          full_diagnostic_data: Json
          has_discrepancy?: boolean
          id?: string
          is_admin_rpc?: boolean | null
          jwt_role?: string | null
          roles_via_rpc?: string[] | null
          roles_via_table?: string[] | null
          session_active?: boolean | null
          user_email: string
          user_id: string
        }
        Update: {
          auth_context_is_admin?: boolean | null
          auth_context_is_client?: boolean | null
          auth_context_is_super_admin?: boolean | null
          created_at?: string | null
          discrepancy_details?: Json | null
          executed_at?: string
          full_diagnostic_data?: Json
          has_discrepancy?: boolean
          id?: string
          is_admin_rpc?: boolean | null
          jwt_role?: string | null
          roles_via_rpc?: string[] | null
          roles_via_table?: string[] | null
          session_active?: boolean | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_discrepancy_alerts: {
        Row: {
          admins_notified: boolean | null
          created_at: string | null
          diagnostic_id: string | null
          discrepancy_description: string
          discrepancy_type: string
          id: string
          notified_at: string | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_email: string
          user_id: string
        }
        Insert: {
          admins_notified?: boolean | null
          created_at?: string | null
          diagnostic_id?: string | null
          discrepancy_description: string
          discrepancy_type: string
          id?: string
          notified_at?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_email: string
          user_id: string
        }
        Update: {
          admins_notified?: boolean | null
          created_at?: string | null
          diagnostic_id?: string | null
          discrepancy_description?: string
          discrepancy_type?: string
          id?: string
          notified_at?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_discrepancy_alerts_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "permission_diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      player_analytics: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          device_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          profile_id: string
          session_id: string | null
          watch_day: number | null
          watch_hour: number | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          device_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          profile_id: string
          session_id?: string | null
          watch_day?: number | null
          watch_hour?: number | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          device_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          profile_id?: string
          session_id?: string | null
          watch_day?: number | null
          watch_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_analytics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_health_checks: {
        Row: {
          client_id: string | null
          created_at: string | null
          error_message: string | null
          http_status_code: number | null
          id: string
          last_checked_at: string | null
          m3u_url: string
          playlist_id: string
          response_time_ms: number | null
          snoozed_until: string | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          http_status_code?: number | null
          id?: string
          last_checked_at?: string | null
          m3u_url: string
          playlist_id: string
          response_time_ms?: number | null
          snoozed_until?: string | null
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          http_status_code?: number | null
          id?: string
          last_checked_at?: string | null
          m3u_url?: string
          playlist_id?: string
          response_time_ms?: number | null
          snoozed_until?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_health_checks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_health_checks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          theme: string | null
          totp_enabled: boolean | null
          totp_secret: string | null
          totp_verified_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nome: string
          telefone?: string | null
          theme?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          theme?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limit_tracking: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      recommendations_cache: {
        Row: {
          created_at: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          profile_id: string
          recommendation_type: string
          recommended_items: Json
          source_content_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          profile_id: string
          recommendation_type: string
          recommended_items?: Json
          source_content_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          profile_id?: string
          recommendation_type?: string
          recommended_items?: Json
          source_content_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_cache_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rls_policy_backups: {
        Row: {
          created_at: string | null
          id: string
          policy_name: string | null
          policy_using: string | null
          policy_with_check: string | null
          schema_name: string | null
          table_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          policy_name?: string | null
          policy_using?: string | null
          policy_with_check?: string | null
          schema_name?: string | null
          table_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          policy_name?: string | null
          policy_using?: string | null
          policy_with_check?: string | null
          schema_name?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          changed_by: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      security_alert_config: {
        Row: {
          alert_name: string
          created_at: string
          enabled: boolean | null
          event_type: string
          id: string
          last_triggered_at: string | null
          notification_channels: Json | null
          recipient_admin_ids: string[] | null
          severity_level: string
          threshold: number
          time_window_minutes: number
          trigger_count: number | null
          updated_at: string
        }
        Insert: {
          alert_name: string
          created_at?: string
          enabled?: boolean | null
          event_type: string
          id?: string
          last_triggered_at?: string | null
          notification_channels?: Json | null
          recipient_admin_ids?: string[] | null
          severity_level?: string
          threshold?: number
          time_window_minutes?: number
          trigger_count?: number | null
          updated_at?: string
        }
        Update: {
          alert_name?: string
          created_at?: string
          enabled?: boolean | null
          event_type?: string
          id?: string
          last_triggered_at?: string | null
          notification_channels?: Json | null
          recipient_admin_ids?: string[] | null
          severity_level?: string
          threshold?: number
          time_window_minutes?: number
          trigger_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      security_alert_deliveries: {
        Row: {
          action_notes: string | null
          action_taken: string | null
          action_taken_at: string | null
          admin_phone_id: string
          confirmation_latency_ms: number | null
          confirmed_at: string | null
          created_at: string | null
          delivery_latency_ms: number | null
          delivery_status: string | null
          error_message: string | null
          escalated: boolean | null
          escalated_at: string | null
          id: string
          read_at: string | null
          read_latency_ms: number | null
          security_event_id: string
          sent_at: string
        }
        Insert: {
          action_notes?: string | null
          action_taken?: string | null
          action_taken_at?: string | null
          admin_phone_id: string
          confirmation_latency_ms?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          delivery_latency_ms?: number | null
          delivery_status?: string | null
          error_message?: string | null
          escalated?: boolean | null
          escalated_at?: string | null
          id?: string
          read_at?: string | null
          read_latency_ms?: number | null
          security_event_id: string
          sent_at?: string
        }
        Update: {
          action_notes?: string | null
          action_taken?: string | null
          action_taken_at?: string | null
          admin_phone_id?: string
          confirmation_latency_ms?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          delivery_latency_ms?: number | null
          delivery_status?: string | null
          error_message?: string | null
          escalated?: boolean | null
          escalated_at?: string | null
          id?: string
          read_at?: string | null
          read_latency_ms?: number | null
          security_event_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alert_deliveries_admin_phone_id_fkey"
            columns: ["admin_phone_id"]
            isOneToOne: false
            referencedRelation: "admin_phones"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alert_escalation_rules: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          escalation_action: string
          event_type: string
          id: string
          rule_name: string
          secondary_admin_ids: string[] | null
          severity_level: string
          time_window_minutes: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          escalation_action?: string
          event_type: string
          id?: string
          rule_name: string
          secondary_admin_ids?: string[] | null
          severity_level: string
          time_window_minutes?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          escalation_action?: string
          event_type?: string
          id?: string
          rule_name?: string
          secondary_admin_ids?: string[] | null
          severity_level?: string
          time_window_minutes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      security_alert_templates: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          event_type: string
          id: string
          message_template: string
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          event_type: string
          id?: string
          message_template: string
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          event_type?: string
          id?: string
          message_template?: string
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      series_episodes: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          episode_name: string | null
          episode_number: number
          id: string
          metadata: Json | null
          profile_id: string
          progress_seconds: number | null
          season_number: number
          series_id: string
          series_name: string
          watched: boolean | null
          watched_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          episode_name?: string | null
          episode_number: number
          id?: string
          metadata?: Json | null
          profile_id: string
          progress_seconds?: number | null
          season_number: number
          series_id: string
          series_name: string
          watched?: boolean | null
          watched_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          episode_name?: string | null
          episode_number?: number
          id?: string
          metadata?: Json | null
          profile_id?: string
          progress_seconds?: number | null
          season_number?: number
          series_id?: string
          series_name?: string
          watched?: boolean | null
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_episodes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smartone_sync_retry_queue: {
        Row: {
          attempt_count: number | null
          cliente_id: string
          created_at: string | null
          error_details: Json | null
          id: string
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          cliente_id: string
          created_at?: string | null
          error_details?: Json | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          cliente_id?: string
          created_at?: string | null
          error_details?: Json | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartone_sync_retry_queue_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartone_sync_retry_queue_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      status_change_history: {
        Row: {
          changed_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          new_status: string
          previous_status: string | null
          service_name: string
        }
        Insert: {
          changed_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          new_status: string
          previous_status?: string | null
          service_name: string
        }
        Update: {
          changed_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string
          previous_status?: string | null
          service_name?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          cta_text: string
          currency: string
          display_order: number
          features: string[]
          id: string
          is_active: boolean
          is_highlighted: boolean
          name: string
          period: string
          period_months: number
          price: number
          savings_amount: number | null
          savings_percent: number | null
          slug: string
          updated_at: string
          whatsapp_message: string | null
        }
        Insert: {
          created_at?: string
          cta_text?: string
          currency?: string
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          name: string
          period: string
          period_months?: number
          price: number
          savings_amount?: number | null
          savings_percent?: number | null
          slug: string
          updated_at?: string
          whatsapp_message?: string | null
        }
        Update: {
          created_at?: string
          cta_text?: string
          currency?: string
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          name?: string
          period?: string
          period_months?: number
          price?: number
          savings_amount?: number | null
          savings_percent?: number | null
          slug?: string
          updated_at?: string
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      suspicious_login_attempts: {
        Row: {
          alert_sent: boolean | null
          attempt_count: number | null
          attempted_email: string | null
          blocked: boolean | null
          created_at: string
          first_attempt_at: string
          id: string
          ip_address: string
          last_attempt_at: string
          metadata: Json | null
        }
        Insert: {
          alert_sent?: boolean | null
          attempt_count?: number | null
          attempted_email?: string | null
          blocked?: boolean | null
          created_at?: string
          first_attempt_at?: string
          id?: string
          ip_address: string
          last_attempt_at?: string
          metadata?: Json | null
        }
        Update: {
          alert_sent?: boolean | null
          attempt_count?: number | null
          attempted_email?: string | null
          blocked?: boolean | null
          created_at?: string
          first_attempt_at?: string
          id?: string
          ip_address?: string
          last_attempt_at?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      trending_rankings: {
        Row: {
          content_category: string | null
          content_id: string
          content_logo: string | null
          content_name: string
          content_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          rank_position: number
          ranking_date: string
          ranking_type: string
          score: number | null
          view_count: number | null
        }
        Insert: {
          content_category?: string | null
          content_id: string
          content_logo?: string | null
          content_name: string
          content_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          rank_position: number
          ranking_date?: string
          ranking_type: string
          score?: number | null
          view_count?: number | null
        }
        Update: {
          content_category?: string | null
          content_id?: string
          content_logo?: string | null
          content_name?: string
          content_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          rank_position?: number
          ranking_date?: string
          ranking_type?: string
          score?: number | null
          view_count?: number | null
        }
        Relationships: []
      }
      trial_behavior_tracking: {
        Row: {
          client_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          timestamp: string | null
        }
        Insert: {
          client_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          timestamp?: string | null
        }
        Update: {
          client_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_behavior_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_behavior_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_expiration_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          content_category: string | null
          content_id: string
          content_logo: string | null
          content_name: string
          content_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          profile_id: string
        }
        Insert: {
          content_category?: string | null
          content_id: string
          content_logo?: string | null
          content_name: string
          content_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id: string
        }
        Update: {
          content_category?: string | null
          content_id?: string
          content_logo?: string | null
          content_name?: string
          content_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          pin_code: string | null
          preferences: Json | null
          profile_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          pin_code?: string | null
          preferences?: Json | null
          profile_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          pin_code?: string | null
          preferences?: Json | null
          profile_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_watchlist: {
        Row: {
          content_category: string | null
          content_id: string
          content_logo: string | null
          content_name: string
          content_type: string
          created_at: string | null
          id: string
          imdb_rating: number | null
          metadata: Json | null
          profile_id: string
          tmdb_id: string | null
        }
        Insert: {
          content_category?: string | null
          content_id: string
          content_logo?: string | null
          content_name: string
          content_type: string
          created_at?: string | null
          id?: string
          imdb_rating?: number | null
          metadata?: Json | null
          profile_id: string
          tmdb_id?: string | null
        }
        Update: {
          content_category?: string | null
          content_id?: string
          content_logo?: string | null
          content_name?: string
          content_type?: string
          created_at?: string | null
          id?: string
          imdb_rating?: number | null
          metadata?: Json | null
          profile_id?: string
          tmdb_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_watchlist_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          content_category: string | null
          content_id: string
          content_logo: string | null
          content_name: string
          content_type: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          metadata: Json | null
          profile_id: string
          watched_at: string | null
        }
        Insert: {
          content_category?: string | null
          content_id: string
          content_logo?: string | null
          content_name: string
          content_type: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          profile_id: string
          watched_at?: string | null
        }
        Update: {
          content_category?: string | null
          content_id?: string
          content_logo?: string | null
          content_name?: string
          content_type?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          profile_id?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_progress: {
        Row: {
          completed: boolean | null
          content_category: string | null
          content_id: string
          content_logo: string | null
          content_name: string
          content_type: string
          created_at: string | null
          duration_seconds: number
          id: string
          metadata: Json | null
          profile_id: string
          progress_percent: number | null
          progress_seconds: number
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          content_category?: string | null
          content_id: string
          content_logo?: string | null
          content_name: string
          content_type: string
          created_at?: string | null
          duration_seconds?: number
          id?: string
          metadata?: Json | null
          profile_id: string
          progress_percent?: number | null
          progress_seconds?: number
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          content_category?: string | null
          content_id?: string
          content_logo?: string | null
          content_name?: string
          content_type?: string
          created_at?: string | null
          duration_seconds?: number
          id?: string
          metadata?: Json | null
          profile_id?: string
          progress_percent?: number | null
          progress_seconds?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          appkey: string
          authkey: string
          created_at: string | null
          created_by: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          appkey: string
          authkey: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          appkey?: string
          authkey?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          active: boolean | null
          arquivo: Json | null
          botbot_template_id: string | null
          created_at: string | null
          days_before_due: number | null
          event_type: string
          id: string
          message: string
          name: string
          type: string
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          active?: boolean | null
          arquivo?: Json | null
          botbot_template_id?: string | null
          created_at?: string | null
          days_before_due?: number | null
          event_type: string
          id?: string
          message: string
          name: string
          type?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          active?: boolean | null
          arquivo?: Json | null
          botbot_template_id?: string | null
          created_at?: string | null
          days_before_due?: number | null
          event_type?: string
          id?: string
          message?: string
          name?: string
          type?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_expiration_summary: {
        Row: {
          data_ultimo_pagamento: string | null
          data_vencimento: string | null
          dias_ate_vencimento: number | null
          email: string | null
          forma_ultimo_pagamento: string | null
          id: string | null
          is_recorrente: boolean | null
          nome: string | null
          origem_cadastro: Database["public"]["Enums"]["origem_cadastro"] | null
          pagamento_recente: boolean | null
          plano: Database["public"]["Enums"]["plano_cliente"] | null
          situacao: Database["public"]["Enums"]["situacao_cliente"] | null
          telefone: string | null
          valor_pago: number | null
        }
        Insert: {
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          dias_ate_vencimento?: never
          email?: string | null
          forma_ultimo_pagamento?: string | null
          id?: string | null
          is_recorrente?: boolean | null
          nome?: string | null
          origem_cadastro?:
            | Database["public"]["Enums"]["origem_cadastro"]
            | null
          pagamento_recente?: never
          plano?: Database["public"]["Enums"]["plano_cliente"] | null
          situacao?: Database["public"]["Enums"]["situacao_cliente"] | null
          telefone?: string | null
          valor_pago?: number | null
        }
        Update: {
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          dias_ate_vencimento?: never
          email?: string | null
          forma_ultimo_pagamento?: string | null
          id?: string | null
          is_recorrente?: boolean | null
          nome?: string | null
          origem_cadastro?:
            | Database["public"]["Enums"]["origem_cadastro"]
            | null
          pagamento_recente?: never
          plano?: Database["public"]["Enums"]["plano_cliente"] | null
          situacao?: Database["public"]["Enums"]["situacao_cliente"] | null
          telefone?: string | null
          valor_pago?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_and_block_ip: {
        Args: {
          _event_type: string
          _ip_address: string
          _threshold?: number
          _window_minutes?: number
        }
        Returns: boolean
      }
      check_suspicious_login: {
        Args: { _email?: string; _ip_address: string }
        Returns: Json
      }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      cleanup_old_auth_logs: { Args: never; Returns: undefined }
      cleanup_old_import_cache: { Args: never; Returns: undefined }
      cleanup_old_metrics: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      cleanup_old_suspicious_attempts: { Args: never; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      detect_permission_discrepancies: {
        Args: {
          _auth_context_is_admin: boolean
          _diagnostic_id: string
          _is_admin_rpc: boolean
          _roles_rpc: string[]
          _roles_table: string[]
          _user_email: string
          _user_id: string
        }
        Returns: undefined
      }
      get_active_sessions: {
        Args: never
        Returns: {
          ip_address: string
          last_login: string
          session_duration: unknown
          user_agent: string
          user_email: string
          user_id: string
        }[]
      }
      get_admin_performance_stats: {
        Args: { _days?: number }
        Returns: {
          admin_id: string
          admin_name: string
          admin_phone: string
          alerts_with_action: number
          avg_response_time_minutes: number
          confirmation_rate: number
          confirmed_alerts: number
          total_alerts: number
        }[]
      }
      get_alert_performance_stats: {
        Args: { _days?: number }
        Returns: {
          avg_confirmation_time_minutes: number
          avg_read_time_minutes: number
          confirmation_rate: number
          confirmed_alerts: number
          escalation_rate: number
          total_alerts: number
          total_escalations: number
        }[]
      }
      get_alert_timeline: {
        Args: { _hours?: number; _limit?: number }
        Returns: {
          action_taken: string
          action_taken_at: string
          admin_name: string
          admin_phone: string
          confirmed_at: string
          delivery_id: string
          delivery_status: string
          escalated: boolean
          escalated_at: string
          event_details: Json
          event_id: string
          event_type: string
          read_at: string
          sent_at: string
          severity: string
        }[]
      }
      get_auth_statistics: {
        Args: { _days?: number }
        Returns: {
          access_denied: number
          date: string
          session_refreshes: number
          total_logins: number
          unique_users: number
        }[]
      }
      get_auth_uid: { Args: never; Returns: string }
      get_continue_watching: {
        Args: { p_limit?: number; p_profile_id: string }
        Returns: {
          content_category: string
          content_id: string
          content_logo: string
          content_name: string
          content_type: string
          duration_seconds: number
          metadata: Json
          progress_percent: number
          progress_seconds: number
          updated_at: string
        }[]
      }
      get_conversion_rate: {
        Args: { days_period?: number }
        Returns: {
          avg_days_to_convert: number
          conversion_rate: number
          total_conversions: number
          total_trials: number
        }[]
      }
      get_import_statistics: {
        Args: never
        Returns: {
          avg_channels_per_import: number
          cache_hits: number
          completed_imports: number
          failed_imports: number
          pending_imports: number
          processing_imports: number
          total_imports: number
        }[]
      }
      get_m3u_for_client_plan: {
        Args: { cliente_plano: string; cliente_situacao: string }
        Returns: string
      }
      get_notification_retry_stats: { Args: never; Returns: Json }
      get_security_analytics: {
        Args: { _days?: number }
        Returns: {
          critical_count: number
          date: string
          failed_logins: number
          permission_changes: number
          rate_limit_exceeded: number
          suspicious_activities: number
          total_events: number
          unauthorized_access: number
          warning_count: number
        }[]
      }
      get_top_threat_ips: {
        Args: { _limit?: number }
        Returns: {
          event_count: number
          failed_logins: number
          ip_address: string
          is_blocked: boolean
          last_event: string
          suspicious_activities: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      log_activity: {
        Args: {
          _action_description: string
          _action_type: string
          _entity_id?: string
          _entity_type?: string
          _metadata?: Json
          _user_id: string
        }
        Returns: string
      }
      log_status_change: {
        Args: {
          p_metadata?: Json
          p_new_status: string
          p_previous_status: string
          p_service_name: string
        }
        Returns: string
      }
      make_user_admin: { Args: { user_email: string }; Returns: undefined }
      record_channel_view: {
        Args: {
          p_channel_id: string
          p_profile_id: string
          p_watch_seconds?: number
        }
        Returns: undefined
      }
      save_monthly_leaderboard: { Args: never; Returns: undefined }
      update_watch_progress: {
        Args: {
          p_content_category: string
          p_content_id: string
          p_content_logo: string
          p_content_name: string
          p_content_type: string
          p_duration_seconds: number
          p_metadata?: Json
          p_profile_id: string
          p_progress_seconds: number
        }
        Returns: {
          completed: boolean | null
          content_category: string | null
          content_id: string
          content_logo: string | null
          content_name: string
          content_type: string
          created_at: string | null
          duration_seconds: number
          id: string
          metadata: Json | null
          profile_id: string
          progress_percent: number | null
          progress_seconds: number
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "watch_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "client" | "admin" | "super_admin"
      dispositivo_tipo:
        | "smart_tv"
        | "roku_tv"
        | "fire_stick"
        | "android_tv"
        | "celular_android"
        | "celular_ios"
        | "computador"
        | "mac"
        | "tablet_android"
        | "tablet_ios"
        | "chromecast"
        | "apple_tv"
        | "xbox"
        | "playstation"
      origem_cadastro:
        | "Google Ads"
        | "Facebook"
        | "Instagram"
        | "Indicação"
        | "Website"
        | "Outro"
      plano_cliente: "Mensal" | "Trimestral" | "Semestral" | "Anual"
      situacao_cliente: "Testando" | "Ativo" | "Devendo" | "Inativo" | "Lead"
      smartone_status: "nao_enviado" | "pendente" | "criado" | "erro"
    }
    CompositeTypes: {
      activation_key_type: {
        id: string | null
      }
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
    Enums: {
      app_role: ["client", "admin", "super_admin"],
      dispositivo_tipo: [
        "smart_tv",
        "roku_tv",
        "fire_stick",
        "android_tv",
        "celular_android",
        "celular_ios",
        "computador",
        "mac",
        "tablet_android",
        "tablet_ios",
        "chromecast",
        "apple_tv",
        "xbox",
        "playstation",
      ],
      origem_cadastro: [
        "Google Ads",
        "Facebook",
        "Instagram",
        "Indicação",
        "Website",
        "Outro",
      ],
      plano_cliente: ["Mensal", "Trimestral", "Semestral", "Anual"],
      situacao_cliente: ["Testando", "Ativo", "Devendo", "Inativo", "Lead"],
      smartone_status: ["nao_enviado", "pendente", "criado", "erro"],
    },
  },
} as const
