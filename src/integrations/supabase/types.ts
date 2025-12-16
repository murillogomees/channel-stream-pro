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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
          variant_a?: Json
          variant_b?: Json
        }
        Relationships: []
      }
      ab_test_results: {
        Row: {
          converted: boolean | null
          created_at: string | null
          id: string
          session_id: string | null
          test_id: string | null
          user_id: string | null
          variant_shown: string
        }
        Insert: {
          converted?: boolean | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          test_id?: string | null
          user_id?: string | null
          variant_shown: string
        }
        Update: {
          converted?: boolean | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          test_id?: string | null
          user_id?: string | null
          variant_shown?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_test_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          confirmation_token: string | null
          created_at: string | null
          id: string
          reason: string | null
          scheduled_deletion_at: string | null
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          confirmation_token?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          scheduled_deletion_at?: string | null
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          confirmation_token?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          scheduled_deletion_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_badge_notifications: {
        Row: {
          admin_id: string | null
          badge_id: string | null
          badge_name: string
          badge_rarity: string | null
          created_at: string | null
          id: string
          message: string | null
          read_at: string | null
        }
        Insert: {
          admin_id?: string | null
          badge_id?: string | null
          badge_name: string
          badge_rarity?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
        }
        Update: {
          admin_id?: string | null
          badge_id?: string | null
          badge_name?: string
          badge_rarity?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
        }
        Relationships: []
      }
      admin_favorites: {
        Row: {
          admin_id: string | null
          created_at: string | null
          id: string
          item_id: string
          item_name: string | null
          item_type: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          item_id: string
          item_name?: string | null
          item_type: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string
          item_name?: string | null
          item_type?: string
        }
        Relationships: []
      }
      admin_phones: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          phone: string
          priority: number | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone: string
          priority?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone?: string
          priority?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_shortcuts: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          order_index: number | null
          path: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          path: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          path?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_analytics: {
        Row: {
          affiliate_id: string | null
          avg_order_value: number | null
          clicks: number | null
          commission_earned: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          earnings: number | null
          id: string
          period_end: string
          period_start: string
          referrals: number | null
          revenue_generated: number | null
        }
        Insert: {
          affiliate_id?: string | null
          avg_order_value?: number | null
          clicks?: number | null
          commission_earned?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          earnings?: number | null
          id?: string
          period_end: string
          period_start: string
          referrals?: number | null
          revenue_generated?: number | null
        }
        Update: {
          affiliate_id?: string | null
          avg_order_value?: number | null
          clicks?: number | null
          commission_earned?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          earnings?: number | null
          id?: string
          period_end?: string
          period_start?: string
          referrals?: number | null
          revenue_generated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_analytics_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_analytics_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_config: {
        Row: {
          config_key: string
          config_value: string | null
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_dashboard: {
        Row: {
          affiliate_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          widget_config: Json | null
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          widget_config?: Json | null
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          widget_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_dashboard_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_dashboard_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_fraud_logs: {
        Row: {
          affiliate_id: string | null
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          notes: string | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_fraud_logs_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_fraud_logs_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_link_clicks: {
        Row: {
          affiliate_id: string | null
          clicked_at: string | null
          converted: boolean | null
          converted_at: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          referer: string | null
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          affiliate_id?: string | null
          clicked_at?: string | null
          converted?: boolean | null
          converted_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referer?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          affiliate_id?: string | null
          clicked_at?: string | null
          converted?: boolean | null
          converted_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referer?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_link_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_link_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          affiliate_id: string | null
          clicks: number | null
          conversions: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string | null
          revenue: number | null
          short_code: string | null
          url: string
        }
        Insert: {
          affiliate_id?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          revenue?: number | null
          short_code?: string | null
          url: string
        }
        Update: {
          affiliate_id?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          revenue?: number | null
          short_code?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_marketing_materials: {
        Row: {
          active: boolean | null
          content_text: string | null
          content_url: string | null
          created_at: string | null
          description: string | null
          dimensions: string | null
          download_count: number | null
          downloads: number | null
          file_size: number | null
          id: string
          is_active: boolean | null
          thumbnail_url: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          content_text?: string | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: string | null
          download_count?: number | null
          downloads?: number | null
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          thumbnail_url?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          content_text?: string | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: string | null
          download_count?: number | null
          downloads?: number | null
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          thumbnail_url?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_onboarding: {
        Row: {
          affiliate_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          step_key: string
        }
        Insert: {
          affiliate_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          step_key: string
        }
        Update: {
          affiliate_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_onboarding_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_onboarding_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          status: string | null
          transaction_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          status?: string | null
          transaction_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          status?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_promotions: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          start_date: string | null
          title: string
          usage_count: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          start_date?: string | null
          title: string
          usage_count?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          start_date?: string | null
          title?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string | null
          commission_amount: number | null
          commission_earned: number | null
          commission_type: string | null
          commission_value: number | null
          converted_at: string | null
          created_at: string | null
          id: string
          plan_value: number | null
          referred_user_id: string | null
          status: string | null
        }
        Insert: {
          affiliate_id?: string | null
          commission_amount?: number | null
          commission_earned?: number | null
          commission_type?: string | null
          commission_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          plan_value?: number | null
          referred_user_id?: string | null
          status?: string | null
        }
        Update: {
          affiliate_id?: string | null
          commission_amount?: number | null
          commission_earned?: number | null
          commission_type?: string | null
          commission_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          plan_value?: number | null
          referred_user_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_reports: {
        Row: {
          affiliate_id: string | null
          data: Json | null
          generated_at: string | null
          id: string
          period_end: string | null
          period_start: string | null
          report_type: string
        }
        Insert: {
          affiliate_id?: string | null
          data?: Json | null
          generated_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_type: string
        }
        Update: {
          affiliate_id?: string | null
          data?: Json | null
          generated_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_reports_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_reports_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliate_tiers: {
        Row: {
          benefits: Json | null
          bonus_amount: number | null
          color: string | null
          commission_percentage: number | null
          commission_rate: number
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          min_referrals: number | null
          min_revenue: number | null
          name: string
        }
        Insert: {
          benefits?: Json | null
          bonus_amount?: number | null
          color?: string | null
          commission_percentage?: number | null
          commission_rate: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          min_referrals?: number | null
          min_revenue?: number | null
          name: string
        }
        Update: {
          benefits?: Json | null
          bonus_amount?: number | null
          color?: string | null
          commission_percentage?: number | null
          commission_rate?: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          min_referrals?: number | null
          min_revenue?: number | null
          name?: string
        }
        Relationships: []
      }
      affiliate_withdrawals: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_details: Json | null
          payment_method: string | null
          processed_at: string | null
          status: string | null
          withdrawal_type: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          processed_at?: string | null
          status?: string | null
          withdrawal_type?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          processed_at?: string | null
          status?: string | null
          withdrawal_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_performance"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      affiliates: {
        Row: {
          available_balance: number | null
          code: string
          commission_rate: number | null
          commission_type: string | null
          commission_value: number | null
          conversion_rate: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string | null
          status: string | null
          total_clicks: number | null
          total_earnings: number | null
          total_referrals: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          available_balance?: number | null
          code: string
          commission_rate?: number | null
          commission_type?: string | null
          commission_value?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          status?: string | null
          total_clicks?: number | null
          total_earnings?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          available_balance?: number | null
          code?: string
          commission_rate?: number | null
          commission_type?: string | null
          commission_value?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          status?: string | null
          total_clicks?: number | null
          total_earnings?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          method: string | null
          response_time_ms: number | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          method?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          method?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          created_at: string | null
          download_url: string | null
          id: string
          is_required: boolean | null
          min_version: string | null
          platform: string
          release_notes: string | null
          released_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          download_url?: string | null
          id?: string
          is_required?: boolean | null
          min_version?: string | null
          platform: string
          release_notes?: string | null
          released_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          download_url?: string | null
          id?: string
          is_required?: boolean | null
          min_version?: string | null
          platform?: string
          release_notes?: string | null
          released_at?: string | null
          version?: string
        }
        Relationships: []
      }
      auth_sessions_log: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auto_notifications: {
        Row: {
          conditions: Json | null
          created_at: string | null
          delay_hours: number | null
          description: string | null
          id: string
          is_active: boolean | null
          message_template: string | null
          name: string | null
          template_key: string | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string | null
          delay_hours?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string | null
          name?: string | null
          template_key?: string | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string | null
          delay_hours?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string | null
          name?: string | null
          template_key?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string | null
          display_order: number | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          position: string | null
          start_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          position?: string | null
          start_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          position?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string
          old_status: string | null
          profile_id: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          profile_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          profile_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_status_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_status_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_user_profile_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_status_badges: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          label: string
          order_index: number | null
          status_key: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          order_index?: number | null
          status_key: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          order_index?: number | null
          status_key?: string
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          position: number | null
          updated_at: string | null
          user_id: string | null
          widget_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number | null
          updated_at?: string | null
          user_id?: string | null
          widget_type: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number | null
          updated_at?: string | null
          user_id?: string | null
          widget_type?: string
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          browser: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          fingerprint_hash: string
          first_seen_at: string | null
          id: string
          is_trusted: boolean | null
          last_seen_at: string | null
          login_count: number | null
          os: string | null
          trust_expires_at: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          fingerprint_hash: string
          first_seen_at?: string | null
          id?: string
          is_trusted?: boolean | null
          last_seen_at?: string | null
          login_count?: number | null
          os?: string | null
          trust_expires_at?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          fingerprint_hash?: string
          first_seen_at?: string | null
          id?: string
          is_trusted?: boolean | null
          last_seen_at?: string | null
          login_count?: number | null
          os?: string | null
          trust_expires_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      discount_coupons: {
        Row: {
          active: boolean | null
          applies_to: string | null
          auto_generated: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          discount_type: string | null
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase_amount: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          applies_to?: string | null
          auto_generated?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_type?: string | null
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          applies_to?: string | null
          auto_generated?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase_amount?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      email_change_requests: {
        Row: {
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          new_email: string
          old_email: string
          token: string
          user_id: string
          verification_code: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          new_email: string
          old_email: string
          token: string
          user_id: string
          verification_code?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          new_email?: string
          old_email?: string
          token?: string
          user_id?: string
          verification_code?: string | null
        }
        Relationships: []
      }
      epg_programs: {
        Row: {
          category: string | null
          channel_id: string
          created_at: string
          description: string | null
          end_time: string
          episode_info: string | null
          icon_url: string | null
          id: string
          rating: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          channel_id: string
          created_at?: string
          description?: string | null
          end_time: string
          episode_info?: string | null
          icon_url?: string | null
          id?: string
          rating?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          channel_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          episode_info?: string | null
          icon_url?: string | null
          id?: string
          rating?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_flag_config: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          flag_name: string
          id: string
          percentage: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          flag_name: string
          id?: string
          percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          flag_name?: string
          id?: string
          percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      health_checks: {
        Row: {
          checked_at: string | null
          error_message: string | null
          id: string
          response_time_ms: number | null
          service_name: string
          status: string | null
        }
        Insert: {
          checked_at?: string | null
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_name: string
          status?: string | null
        }
        Update: {
          checked_at?: string | null
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_name?: string
          status?: string | null
        }
        Relationships: []
      }
      homepage_content: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          section_key: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          section_key: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          section_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      homepage_faqs: {
        Row: {
          answer: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ip_blacklist: {
        Row: {
          auto_blocked: boolean | null
          blocked_until: string | null
          created_at: string | null
          expires_at: string | null
          failed_attempts: number | null
          id: string
          ip_address: string
          is_permanent: boolean | null
          last_attempt_at: string | null
          reason: string | null
          severity: string | null
          unblocked_at: string | null
        }
        Insert: {
          auto_blocked?: boolean | null
          blocked_until?: string | null
          created_at?: string | null
          expires_at?: string | null
          failed_attempts?: number | null
          id?: string
          ip_address: string
          is_permanent?: boolean | null
          last_attempt_at?: string | null
          reason?: string | null
          severity?: string | null
          unblocked_at?: string | null
        }
        Update: {
          auto_blocked?: boolean | null
          blocked_until?: string | null
          created_at?: string | null
          expires_at?: string | null
          failed_attempts?: number | null
          id?: string
          ip_address?: string
          is_permanent?: boolean | null
          last_attempt_at?: string | null
          reason?: string | null
          severity?: string | null
          unblocked_at?: string | null
        }
        Relationships: []
      }
      ip_whitelist: {
        Row: {
          added_by: string | null
          created_at: string | null
          description: string | null
          id: string
          ip_address: string
          is_active: boolean | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address: string
          is_active?: boolean | null
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      iptv_cdn_cache: {
        Row: {
          cache_key: string
          cdn_provider: string | null
          channel_id: number | null
          created_at: string | null
          expires_at: string | null
          id: number
          is_warm: boolean | null
          last_access_at: string | null
          manifest_url: string | null
          segment_prefix: string | null
        }
        Insert: {
          cache_key: string
          cdn_provider?: string | null
          channel_id?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          is_warm?: boolean | null
          last_access_at?: string | null
          manifest_url?: string | null
          segment_prefix?: string | null
        }
        Update: {
          cache_key?: string
          cdn_provider?: string | null
          channel_id?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          is_warm?: boolean | null
          last_access_at?: string | null
          manifest_url?: string | null
          segment_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_cdn_cache_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_cdn_cache_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_channel_metrics: {
        Row: {
          channel_id: number | null
          id: number
          metric_type: string
          recorded_at: string | null
          value: number
        }
        Insert: {
          channel_id?: number | null
          id?: number
          metric_type: string
          recorded_at?: string | null
          value: number
        }
        Update: {
          channel_id?: number | null
          id?: number
          metric_type?: string
          recorded_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "iptv_channel_metrics_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_channel_metrics_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_channels: {
        Row: {
          bitrate_estimate: number | null
          category: string | null
          codec_hint: string | null
          content_type: string | null
          created_at: string | null
          episode_number: number | null
          episode_title: string | null
          fallback_channel_id: number | null
          health_score: number | null
          id: number
          is_healthy: boolean | null
          is_series: boolean | null
          last_probe_at: string | null
          logo_url: string | null
          metadata: Json | null
          name: string
          original_url: string
          priority: number | null
          probe_error: string | null
          resolution: string | null
          season_number: number | null
          series_name: string | null
          shard_id: number
          slug: string
          transcode_manifest_url: string | null
          transcode_status: string | null
          updated_at: string | null
        }
        Insert: {
          bitrate_estimate?: number | null
          category?: string | null
          codec_hint?: string | null
          content_type?: string | null
          created_at?: string | null
          episode_number?: number | null
          episode_title?: string | null
          fallback_channel_id?: number | null
          health_score?: number | null
          id?: number
          is_healthy?: boolean | null
          is_series?: boolean | null
          last_probe_at?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          original_url: string
          priority?: number | null
          probe_error?: string | null
          resolution?: string | null
          season_number?: number | null
          series_name?: string | null
          shard_id?: number
          slug: string
          transcode_manifest_url?: string | null
          transcode_status?: string | null
          updated_at?: string | null
        }
        Update: {
          bitrate_estimate?: number | null
          category?: string | null
          codec_hint?: string | null
          content_type?: string | null
          created_at?: string | null
          episode_number?: number | null
          episode_title?: string | null
          fallback_channel_id?: number | null
          health_score?: number | null
          id?: number
          is_healthy?: boolean | null
          is_series?: boolean | null
          last_probe_at?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          original_url?: string
          priority?: number | null
          probe_error?: string | null
          resolution?: string | null
          season_number?: number | null
          series_name?: string | null
          shard_id?: number
          slug?: string
          transcode_manifest_url?: string | null
          transcode_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_channels_fallback_channel_id_fkey"
            columns: ["fallback_channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_channels_fallback_channel_id_fkey"
            columns: ["fallback_channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_llhls_config: {
        Row: {
          can_skip_until: number | null
          channel_id: number | null
          created_at: string | null
          hold_back_multiplier: number | null
          id: string
          part_duration: number | null
          playlist_window: number | null
          prefetch_segments: number | null
          target_latency: number | null
          updated_at: string | null
        }
        Insert: {
          can_skip_until?: number | null
          channel_id?: number | null
          created_at?: string | null
          hold_back_multiplier?: number | null
          id?: string
          part_duration?: number | null
          playlist_window?: number | null
          prefetch_segments?: number | null
          target_latency?: number | null
          updated_at?: string | null
        }
        Update: {
          can_skip_until?: number | null
          channel_id?: number | null
          created_at?: string | null
          hold_back_multiplier?: number | null
          id?: string
          part_duration?: number | null
          playlist_window?: number | null
          prefetch_segments?: number | null
          target_latency?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_llhls_config_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_llhls_config_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_origin_servers: {
        Row: {
          bandwidth_mbps: number | null
          concurrent_streams: number | null
          created_at: string | null
          fail_count: number | null
          health_score: number | null
          id: string
          is_active: boolean | null
          is_healthy: boolean | null
          last_check_at: string | null
          latency_ms: number | null
          max_concurrent_streams: number | null
          origin_id: string
          region: string
          updated_at: string | null
          url: string
        }
        Insert: {
          bandwidth_mbps?: number | null
          concurrent_streams?: number | null
          created_at?: string | null
          fail_count?: number | null
          health_score?: number | null
          id?: string
          is_active?: boolean | null
          is_healthy?: boolean | null
          last_check_at?: string | null
          latency_ms?: number | null
          max_concurrent_streams?: number | null
          origin_id: string
          region?: string
          updated_at?: string | null
          url: string
        }
        Update: {
          bandwidth_mbps?: number | null
          concurrent_streams?: number | null
          created_at?: string | null
          fail_count?: number | null
          health_score?: number | null
          id?: string
          is_active?: boolean | null
          is_healthy?: boolean | null
          last_check_at?: string | null
          latency_ms?: number | null
          max_concurrent_streams?: number | null
          origin_id?: string
          region?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      iptv_playlist_channels: {
        Row: {
          added_at: string | null
          channel_id: number
          custom_logo: string | null
          custom_name: string | null
          is_hidden: boolean | null
          playlist_id: number
          position: number
        }
        Insert: {
          added_at?: string | null
          channel_id: number
          custom_logo?: string | null
          custom_name?: string | null
          is_hidden?: boolean | null
          playlist_id: number
          position?: number
        }
        Update: {
          added_at?: string | null
          channel_id?: number
          custom_logo?: string | null
          custom_name?: string | null
          is_hidden?: boolean | null
          playlist_id?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "iptv_playlist_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_playlist_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_playlist_channels_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "iptv_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_playlists: {
        Row: {
          channel_count: number | null
          created_at: string | null
          description: string | null
          id: number
          is_public: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          channel_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_public?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_public?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      iptv_probe_jobs: {
        Row: {
          channel_id: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: number
          result: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          channel_id?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          result?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          channel_id?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          result?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_probe_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_probe_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_routing_logs: {
        Row: {
          client_region: string
          created_at: string | null
          id: string
          latency_ms: number | null
          selected_cdn: string
          stream_path: string | null
        }
        Insert: {
          client_region: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          selected_cdn: string
          stream_path?: string | null
        }
        Update: {
          client_region?: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          selected_cdn?: string
          stream_path?: string | null
        }
        Relationships: []
      }
      iptv_stream_fingerprints: {
        Row: {
          channel_id: number | null
          created_at: string | null
          hash_algorithm: string | null
          id: string
          perceptual_hash: string
        }
        Insert: {
          channel_id?: number | null
          created_at?: string | null
          hash_algorithm?: string | null
          id?: string
          perceptual_hash: string
        }
        Update: {
          channel_id?: number | null
          created_at?: string | null
          hash_algorithm?: string | null
          id?: string
          perceptual_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "iptv_stream_fingerprints_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_stream_fingerprints_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_stream_groups: {
        Row: {
          canonical_channel_id: number | null
          created_at: string | null
          display_name: string | null
          id: string
          source_count: number | null
        }
        Insert: {
          canonical_channel_id?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          source_count?: number | null
        }
        Update: {
          canonical_channel_id?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          source_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_stream_groups_canonical_channel_id_fkey"
            columns: ["canonical_channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_stream_groups_canonical_channel_id_fkey"
            columns: ["canonical_channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_stream_tokens: {
        Row: {
          channel_id: number | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          token: string
          used_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          channel_id?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          token: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          channel_id?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          token?: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_stream_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_stream_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_transcode_jobs: {
        Row: {
          channel_id: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: number
          mode: string | null
          output_urls: Json | null
          progress: number | null
          started_at: string | null
          status: string | null
          target_resolutions: string[] | null
          worker_id: string | null
        }
        Insert: {
          channel_id?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          mode?: string | null
          output_urls?: Json | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          target_resolutions?: string[] | null
          worker_id?: string | null
        }
        Update: {
          channel_id?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          mode?: string | null
          output_urls?: Json | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          target_resolutions?: string[] | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iptv_transcode_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_transcode_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      login_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_sent_via: string[] | null
          alert_type: string | null
          created_at: string | null
          device_fingerprint_id: string | null
          id: string
          ip_address: string | null
          location_info: Json | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_sent_via?: string[] | null
          alert_type?: string | null
          created_at?: string | null
          device_fingerprint_id?: string | null
          id?: string
          ip_address?: string | null
          location_info?: Json | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_sent_via?: string[] | null
          alert_type?: string | null
          created_at?: string | null
          device_fingerprint_id?: string | null
          id?: string
          ip_address?: string | null
          location_info?: Json | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_alerts_device_fingerprint_id_fkey"
            columns: ["device_fingerprint_id"]
            isOneToOne: false
            referencedRelation: "device_fingerprints"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_sources: {
        Row: {
          created_at: string | null
          entry_count: number | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          source_type: string | null
          sync_status: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          entry_count?: number | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          source_type?: string | null
          sync_status?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          entry_count?: number | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          source_type?: string | null
          sync_status?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      mercado_pago_config: {
        Row: {
          created_at: string | null
          id: string
          production_access_token: string | null
          public_key: string | null
          sandbox_access_token: string | null
          updated_at: string | null
          use_sandbox: boolean | null
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          production_access_token?: string | null
          public_key?: string | null
          sandbox_access_token?: string | null
          updated_at?: string | null
          use_sandbox?: boolean | null
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          production_access_token?: string | null
          public_key?: string | null
          sandbox_access_token?: string | null
          updated_at?: string | null
          use_sandbox?: boolean | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      mercado_pago_webhooks: {
        Row: {
          action: string | null
          created_at: string | null
          data_id: string | null
          event_id: string | null
          event_type: string | null
          id: string
          processed: boolean | null
          raw_payload: Json | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          data_id?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          processed?: boolean | null
          raw_payload?: Json | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          data_id?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          processed?: boolean | null
          raw_payload?: Json | null
        }
        Relationships: []
      }
      migration_audit: {
        Row: {
          details: Json | null
          duration_ms: number | null
          error_message: string | null
          executed_at: string | null
          executed_by: string | null
          id: string
          migration_name: string
          rows_affected: number | null
          status: string | null
        }
        Insert: {
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          migration_name: string
          rows_affected?: number | null
          status?: string | null
        }
        Update: {
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          migration_name?: string
          rows_affected?: number | null
          status?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          message_content: string | null
          recipient_id: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string | null
          template_key: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_content?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_content?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          message_content: string
          metadata: Json | null
          recipient_name: string | null
          recipient_phone: string
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          template_key: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          message_content: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_phone: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          message_content?: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_phone?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          template_content: string
          template_key: string
          template_name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_content: string
          template_key: string
          template_name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_content?: string
          template_key?: string
          template_name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      observability_metrics_history: {
        Row: {
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
          tags: Json | null
        }
        Insert: {
          id?: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
          tags?: Json | null
        }
        Update: {
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
          tags?: Json | null
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          payment_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          payment_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          payment_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          external_id: string | null
          external_provider: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          receipt_url: string | null
          status: string | null
          subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_email_changes: {
        Row: {
          created_at: string | null
          current_email: string
          expires_at: string
          id: string
          new_email: string
          user_id: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_email: string
          expires_at: string
          id?: string
          new_email: string
          user_id: string
          verification_token: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_email?: string
          expires_at?: string
          id?: string
          new_email?: string
          user_id?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          id: number
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
          tags: Json | null
        }
        Insert: {
          id?: number
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
          tags?: Json | null
        }
        Update: {
          id?: number
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
          tags?: Json | null
        }
        Relationships: []
      }
      performance_metrics_current: {
        Row: {
          id: number
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
          tags: Json | null
        }
        Insert: {
          id?: number
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
          tags?: Json | null
        }
        Update: {
          id?: number
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
          tags?: Json | null
        }
        Relationships: []
      }
      performance_metrics_next: {
        Row: {
          id: number
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
          tags: Json | null
        }
        Insert: {
          id?: number
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
          tags?: Json | null
        }
        Update: {
          id?: number
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
          tags?: Json | null
        }
        Relationships: []
      }
      phone_verification_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone_number: string
          purpose: string | null
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone_number: string
          purpose?: string | null
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone_number?: string
          purpose?: string | null
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      playback_tokens: {
        Row: {
          content_id: string | null
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cliente_ativo: boolean | null
          contact_phone: string | null
          created_at: string | null
          data_contratacao: string | null
          data_ultimo_pagamento: string | null
          data_vencimento: string | null
          dispositivo_contratado: string | null
          email: string
          forma_ultimo_pagamento: string | null
          id: string
          is_recorrente: boolean | null
          login_alerts_email: boolean | null
          login_alerts_whatsapp: boolean | null
          nome: string | null
          origem_cadastro: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          plano: string | null
          situacao: string | null
          theme: string | null
          totp_enabled: boolean | null
          totp_secret: string | null
          totp_verified_at: string | null
          updated_at: string | null
          valor_pago: number | null
        }
        Insert: {
          cliente_ativo?: boolean | null
          contact_phone?: string | null
          created_at?: string | null
          data_contratacao?: string | null
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          dispositivo_contratado?: string | null
          email: string
          forma_ultimo_pagamento?: string | null
          id: string
          is_recorrente?: boolean | null
          login_alerts_email?: boolean | null
          login_alerts_whatsapp?: boolean | null
          nome?: string | null
          origem_cadastro?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          plano?: string | null
          situacao?: string | null
          theme?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string | null
          valor_pago?: number | null
        }
        Update: {
          cliente_ativo?: boolean | null
          contact_phone?: string | null
          created_at?: string | null
          data_contratacao?: string | null
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          dispositivo_contratado?: string | null
          email?: string
          forma_ultimo_pagamento?: string | null
          id?: string
          is_recorrente?: boolean | null
          login_alerts_email?: boolean | null
          login_alerts_whatsapp?: boolean | null
          nome?: string | null
          origem_cadastro?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          plano?: string | null
          situacao?: string | null
          theme?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string | null
          valor_pago?: number | null
        }
        Relationships: []
      }
      pwa_settings: {
        Row: {
          app_name: string
          background_color: string | null
          created_at: string | null
          description: string | null
          display: string | null
          icon_192: string | null
          icon_512: string | null
          id: string
          orientation: string | null
          screenshots: Json | null
          short_name: string | null
          theme_color: string | null
          updated_at: string | null
        }
        Insert: {
          app_name?: string
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          icon_192?: string | null
          icon_512?: string | null
          id?: string
          orientation?: string | null
          screenshots?: Json | null
          short_name?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Update: {
          app_name?: string
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          icon_192?: string | null
          icon_512?: string | null
          id?: string
          orientation?: string | null
          screenshots?: Json | null
          short_name?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limit_tracking: {
        Row: {
          created_at: string | null
          id: string
          identifier: string
          identifier_type: string
          last_request_at: string | null
          request_count: number | null
          window_duration_seconds: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identifier: string
          identifier_type?: string
          last_request_at?: string | null
          request_count?: number | null
          window_duration_seconds?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identifier?: string
          identifier_type?: string
          last_request_at?: string | null
          request_count?: number | null
          window_duration_seconds?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          family_id: string
          id: string
          ip_address: string | null
          is_revoked: boolean | null
          revoked_at: string | null
          revoked_reason: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          family_id: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean | null
          revoked_at?: string | null
          revoked_reason?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          family_id?: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean | null
          revoked_at?: string | null
          revoked_reason?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      remote_command_audit: {
        Row: {
          action: string
          audit_id: string
          backup_reference: string | null
          completed_at: string | null
          created_at: string
          details: Json | null
          environment: string
          error_message: string | null
          executed_by: string | null
          host: string
          id: string
          key_source: string | null
          status: string
          user_remote: string
        }
        Insert: {
          action: string
          audit_id: string
          backup_reference?: string | null
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          environment: string
          error_message?: string | null
          executed_by?: string | null
          host: string
          id?: string
          key_source?: string | null
          status?: string
          user_remote: string
        }
        Update: {
          action?: string
          audit_id?: string
          backup_reference?: string | null
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          environment?: string
          error_message?: string | null
          executed_by?: string | null
          host?: string
          id?: string
          key_source?: string | null
          status?: string
          user_remote?: string
        }
        Relationships: []
      }
      rls_fix_backups: {
        Row: {
          applied_at: string | null
          created_at: string
          fix_type: string | null
          id: string
          original_sql: string | null
          restore_sql: string | null
          table_name: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          fix_type?: string | null
          id?: string
          original_sql?: string | null
          restore_sql?: string | null
          table_name: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          fix_type?: string | null
          id?: string
          original_sql?: string | null
          restore_sql?: string | null
          table_name?: string
        }
        Relationships: []
      }
      rls_scan_results: {
        Row: {
          created_at: string
          has_rls: boolean | null
          id: string
          issues: Json | null
          policy_count: number | null
          scanned_at: string | null
          table_name: string
        }
        Insert: {
          created_at?: string
          has_rls?: boolean | null
          id?: string
          issues?: Json | null
          policy_count?: number | null
          scanned_at?: string | null
          table_name: string
        }
        Update: {
          created_at?: string
          has_rls?: boolean | null
          id?: string
          issues?: Json | null
          policy_count?: number | null
          scanned_at?: string | null
          table_name?: string
        }
        Relationships: []
      }
      security_alert_deliveries: {
        Row: {
          action_taken: string | null
          admin_id: string | null
          admin_phone: string | null
          alert_id: string | null
          confirmed_at: string | null
          created_at: string
          escalated: boolean | null
          id: string
          response_time_ms: number | null
          sent_at: string | null
        }
        Insert: {
          action_taken?: string | null
          admin_id?: string | null
          admin_phone?: string | null
          alert_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          escalated?: boolean | null
          id?: string
          response_time_ms?: number | null
          sent_at?: string | null
        }
        Update: {
          action_taken?: string | null
          admin_id?: string | null
          admin_phone?: string | null
          alert_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          escalated?: boolean | null
          id?: string
          response_time_ms?: number | null
          sent_at?: string | null
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          description: string | null
          id: string
          ip_address: string | null
          is_resolved: boolean | null
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string | null
          is_resolved?: boolean | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string | null
          is_resolved?: boolean | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          event_details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      status_change_history: {
        Row: {
          changed_at: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_status: string
          previous_status: string | null
          service_name: string
        }
        Insert: {
          changed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status: string
          previous_status?: string | null
          service_name: string
        }
        Update: {
          changed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string
          previous_status?: string | null
          service_name?: string
        }
        Relationships: []
      }
      streaming_metrics: {
        Row: {
          buffering_events: number | null
          content_type: string | null
          created_at: string | null
          device_type: string | null
          duration_seconds: number | null
          errors: number | null
          id: string
          quality: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          buffering_events?: number | null
          content_type?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          errors?: number | null
          id?: string
          quality?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          buffering_events?: number | null
          content_type?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          errors?: number | null
          id?: string
          quality?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          cta_text: string | null
          currency: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_highlighted: boolean | null
          name: string
          period: string
          period_months: number
          price: number
          savings_amount: number | null
          savings_percent: number | null
          slug: string
          updated_at: string | null
          whatsapp_message: string | null
        }
        Insert: {
          created_at?: string | null
          cta_text?: string | null
          currency?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          name: string
          period: string
          period_months: number
          price: number
          savings_amount?: number | null
          savings_percent?: number | null
          slug: string
          updated_at?: string | null
          whatsapp_message?: string | null
        }
        Update: {
          created_at?: string | null
          cta_text?: string | null
          currency?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          name?: string
          period?: string
          period_months?: number
          price?: number
          savings_amount?: number | null
          savings_percent?: number | null
          slug?: string
          updated_at?: string | null
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      supabase_instance_audit: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          instance_id: string | null
          ip_address: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          instance_id?: string | null
          ip_address?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          instance_id?: string | null
          ip_address?: string | null
          performed_by?: string | null
        }
        Relationships: []
      }
      supabase_instance_backups: {
        Row: {
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          instance_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          instance_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          instance_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          config_key: string
          config_value: Json | null
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      template_variables: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
          variable_key: string
          variable_value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          variable_key: string
          variable_value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          variable_key?: string
          variable_value?: string | null
        }
        Relationships: []
      }
      test_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      two_factor_auth: {
        Row: {
          backup_codes: Json | null
          created_at: string
          id: string
          is_enabled: boolean | null
          secret: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          backup_codes?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          secret: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          backup_codes?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          secret?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
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
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity: string | null
          refresh_token_id: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          refresh_token_id?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          refresh_token_id?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_refresh_token_id_fkey"
            columns: ["refresh_token_id"]
            isOneToOne: false
            referencedRelation: "refresh_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mercado_pago_subscription_id: string | null
          next_billing_date: string | null
          plan_id: string | null
          price: number | null
          status: string | null
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercado_pago_subscription_id?: string | null
          next_billing_date?: string | null
          plan_id?: string | null
          price?: number | null
          status?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercado_pago_subscription_id?: string | null
          next_billing_date?: string | null
          plan_id?: string | null
          price?: number | null
          status?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_viewing_history: {
        Row: {
          buffer_events: number | null
          category: string | null
          channel_id: number
          created_at: string
          device_type: string | null
          id: string
          quality_played: string | null
          user_id: string
          watch_duration: number | null
          watched_at: string
        }
        Insert: {
          buffer_events?: number | null
          category?: string | null
          channel_id: number
          created_at?: string
          device_type?: string | null
          id?: string
          quality_played?: string | null
          user_id: string
          watch_duration?: number | null
          watched_at?: string
        }
        Update: {
          buffer_events?: number | null
          category?: string | null
          channel_id?: number
          created_at?: string
          device_type?: string | null
          id?: string
          quality_played?: string | null
          user_id?: string
          watch_duration?: number | null
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_viewing_history_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "iptv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_viewing_history_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "mv_hot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_progress: {
        Row: {
          completed: boolean | null
          content_id: string
          content_type: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          last_watched_at: string | null
          progress_seconds: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          content_id: string
          content_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string | null
          progress_seconds?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          content_id?: string
          content_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string | null
          progress_seconds?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          app_key: string | null
          auth_key: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          app_key?: string | null
          auth_key?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          app_key?: string | null
          auth_key?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      mv_affiliate_performance: {
        Row: {
          affiliate_id: string | null
          code: string | null
          commission_rate: number | null
          conversion_rate: number | null
          conversions: number | null
          name: string | null
          total_clicks: number | null
          total_commission: number | null
          total_referrals: number | null
        }
        Relationships: []
      }
      mv_channel_health_summary: {
        Row: {
          avg_health_score: number | null
          category: string | null
          channel_count: number | null
          healthy_count: number | null
          series_count: number | null
          unhealthy_count: number | null
        }
        Relationships: []
      }
      mv_dashboard_summary: {
        Row: {
          active_users: number | null
          approved_payments: number | null
          expired_users: number | null
          expiring_soon: number | null
          healthy_channels: number | null
          last_refresh: string | null
          monthly_revenue: number | null
          total_categories: number | null
          total_channels: number | null
          total_series: number | null
          total_users: number | null
          trial_users: number | null
        }
        Relationships: []
      }
      mv_hot_channels: {
        Row: {
          category: string | null
          health_score: number | null
          id: number | null
          is_healthy: boolean | null
          logo_url: string | null
          name: string | null
          original_url: string | null
          slug: string | null
          total_duration: number | null
          view_count: number | null
        }
        Relationships: []
      }
      mv_payment_analytics: {
        Row: {
          approved: number | null
          avg_ticket: number | null
          date: string | null
          pending: number | null
          rejected: number | null
          revenue: number | null
          total_payments: number | null
        }
        Relationships: []
      }
      mv_user_activity_summary: {
        Row: {
          action_types: string[] | null
          active_days: number | null
          last_activity: string | null
          total_actions: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_channel_categories: {
        Row: {
          category: string | null
          healthy: number | null
          series: number | null
          total: number | null
        }
        Relationships: []
      }
      v_origin_statistics: {
        Row: {
          bandwidth_mbps: number | null
          concurrent_streams: number | null
          fail_count: number | null
          health_score: number | null
          health_status: string | null
          is_active: boolean | null
          is_healthy: boolean | null
          last_check_at: string | null
          latency_ms: number | null
          max_concurrent_streams: number | null
          origin_id: string | null
          region: string | null
          url: string | null
        }
        Insert: {
          bandwidth_mbps?: number | null
          concurrent_streams?: number | null
          fail_count?: number | null
          health_score?: number | null
          health_status?: never
          is_active?: boolean | null
          is_healthy?: boolean | null
          last_check_at?: string | null
          latency_ms?: number | null
          max_concurrent_streams?: number | null
          origin_id?: string | null
          region?: string | null
          url?: string | null
        }
        Update: {
          bandwidth_mbps?: number | null
          concurrent_streams?: number | null
          fail_count?: number | null
          health_score?: number | null
          health_status?: never
          is_active?: boolean | null
          is_healthy?: boolean | null
          last_check_at?: string | null
          latency_ms?: number | null
          max_concurrent_streams?: number | null
          origin_id?: string | null
          region?: string | null
          url?: string | null
        }
        Relationships: []
      }
      v_pending_notifications: {
        Row: {
          created_at: string | null
          id: string | null
          message_content: string | null
          recipient_name: string | null
          recipient_phone: string | null
          scheduled_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          message_content?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          message_content?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      v_user_profile_summary: {
        Row: {
          cliente_ativo: boolean | null
          contact_phone: string | null
          data_contratacao: string | null
          data_vencimento: string | null
          email: string | null
          id: string | null
          nome: string | null
          plano: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          situacao: string | null
          subscription_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_block_identifier: {
        Args: {
          p_failed_attempts: number
          p_identifier: string
          p_reason?: string
        }
        Returns: undefined
      }
      auto_organize_series_channels: {
        Args: never
        Returns: {
          organized_count: number
          series_found: number
        }[]
      }
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_identifier_type?: string
          p_limit?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      check_suspicious_login: {
        Args: { _email: string; _ip_address: string }
        Returns: Json
      }
      cleanup_fase8_old_data:
        | { Args: never; Returns: Json }
        | { Args: { p_dry_run?: boolean }; Returns: Json }
      cleanup_iptv_duplicates: { Args: never; Returns: number }
      cleanup_old_observability_metrics: { Args: never; Returns: number }
      cleanup_old_viewing_history: { Args: never; Returns: number }
      cleanup_rate_limits: { Args: never; Returns: number }
      create_next_partition: { Args: never; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      force_detect_series_by_pattern: {
        Args: never
        Returns: {
          organized_count: number
        }[]
      }
      generate_source_hash: {
        Args: { category: string; name: string; url: string }
        Returns: string
      }
      generate_stream_token: {
        Args: {
          p_channel_id: number
          p_ttl_seconds?: number
          p_user_id: string
        }
        Returns: string
      }
      get_active_sessions: {
        Args: never
        Returns: {
          last_activity: string
          user_email: string
          user_id: string
        }[]
      }
      get_auth_statistics: { Args: { days?: number }; Returns: Json }
      get_best_origin_for_region: {
        Args: { p_region?: string }
        Returns: {
          health_score: number
          latency_ms: number
          origin_id: string
          region: string
          url: string
        }[]
      }
      get_channel_shard: { Args: { channel_id: number }; Returns: number }
      get_channel_stats_by_category: {
        Args: never
        Returns: {
          avg_health_score: number
          category: string
          channel_count: number
          healthy_count: number
          series_count: number
          unhealthy_count: number
        }[]
      }
      get_dashboard_summary: {
        Args: never
        Returns: {
          active_users: number
          approved_payments: number
          expired_users: number
          expiring_soon: number
          healthy_channels: number
          last_refresh: string
          monthly_revenue: number
          total_categories: number
          total_channels: number
          total_series: number
          total_users: number
          trial_users: number
        }[]
      }
      get_hot_channels: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          id: number
          is_healthy: boolean
          logo_url: string
          name: string
          total_duration: number
          view_count: number
        }[]
      }
      get_m3u_distinct_categories: {
        Args: never
        Returns: {
          group_title: string
        }[]
      }
      get_metrics_summary: {
        Args: { p_hours?: number; p_type?: string }
        Returns: {
          avg_value: number
          count: number
          max_value: number
          metric_name: string
          metric_type: string
          min_value: number
        }[]
      }
      get_role_priority: { Args: { role_name: string }; Returns: number }
      get_sync_statistics: { Args: never; Returns: Json }
      get_user_top_channels: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          category: string
          channel_id: number
          channel_name: string
          last_watched: string
          total_duration: number
          view_count: number
        }[]
      }
      has_role: {
        Args: {
          check_role: Database["public"]["Enums"]["app_role"]
          check_user_id: string
        }
        Returns: boolean
      }
      increment_origin_fail_count: {
        Args: { p_origin_id: string }
        Returns: undefined
      }
      is_admin_or_master: { Args: { check_user_id?: string }; Returns: boolean }
      is_blocked: { Args: { p_identifier: string }; Returns: boolean }
      normalize_text: { Args: { input_text: string }; Returns: string }
      parse_series_info_from_name: {
        Args: { channel_name: string }
        Returns: {
          episode_number: number
          episode_title: string
          is_series: boolean
          season_number: number
          series_name: string
        }[]
      }
      record_metric: {
        Args: { p_name: string; p_tags?: Json; p_type: string; p_value: number }
        Returns: undefined
      }
      record_viewing: {
        Args: {
          p_buffer_events?: number
          p_channel_id: number
          p_device_type?: string
          p_duration?: number
          p_quality?: string
          p_user_id: string
        }
        Returns: string
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_hot_data_views: { Args: never; Returns: undefined }
      revoke_token_family: {
        Args: { p_family_id: string; p_reason?: string }
        Returns: number
      }
      toggle_feature_flag: {
        Args: { enabled_param: boolean; flag_name_param: string }
        Returns: undefined
      }
      track_affiliate_click: {
        Args: {
          p_affiliate_code: string
          p_ip_address?: string
          p_referrer?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      update_channel_health: {
        Args: {
          p_channel_id: number
          p_health_score?: number
          p_is_healthy: boolean
          p_probe_error?: string
        }
        Returns: undefined
      }
      validate_stream_token: {
        Args: { p_token: string }
        Returns: {
          channel_id: number
          is_valid: boolean
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "client" | "admin" | "master"
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
    Enums: {
      app_role: ["client", "admin", "master"],
    },
  },
} as const
