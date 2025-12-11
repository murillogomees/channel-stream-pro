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
          blocked_until: string | null
          created_at: string | null
          id: string
          ip_address: string
          is_permanent: boolean | null
          reason: string | null
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address: string
          is_permanent?: boolean | null
          reason?: string | null
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string
          is_permanent?: boolean | null
          reason?: string | null
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
        ]
      }
      iptv_channels: {
        Row: {
          bitrate_estimate: number | null
          category: string | null
          codec_hint: string | null
          content_type: string | null
          created_at: string | null
          fallback_channel_id: number | null
          health_score: number | null
          id: number
          is_healthy: boolean | null
          last_probe_at: string | null
          logo_url: string | null
          metadata: Json | null
          name: string
          original_url: string
          priority: number | null
          probe_error: string | null
          resolution: string | null
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
          fallback_channel_id?: number | null
          health_score?: number | null
          id?: number
          is_healthy?: boolean | null
          last_probe_at?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          original_url: string
          priority?: number | null
          probe_error?: string | null
          resolution?: string | null
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
          fallback_channel_id?: number | null
          health_score?: number | null
          id?: number
          is_healthy?: boolean | null
          last_probe_at?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          original_url?: string
          priority?: number | null
          probe_error?: string | null
          resolution?: string | null
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
        ]
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
        ]
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
      player_events: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cliente_ativo: boolean | null
          contact_phone: string | null
          created_at: string | null
          data_contratacao: string | null
          data_vencimento: string | null
          email: string
          id: string
          nome: string | null
          origem_cadastro: string | null
          plano: string | null
          situacao: string | null
          theme: string | null
          updated_at: string | null
          valor_pago: number | null
        }
        Insert: {
          cliente_ativo?: boolean | null
          contact_phone?: string | null
          created_at?: string | null
          data_contratacao?: string | null
          data_vencimento?: string | null
          email: string
          id: string
          nome?: string | null
          origem_cadastro?: string | null
          plano?: string | null
          situacao?: string | null
          theme?: string | null
          updated_at?: string | null
          valor_pago?: number | null
        }
        Update: {
          cliente_ativo?: boolean | null
          contact_phone?: string | null
          created_at?: string | null
          data_contratacao?: string | null
          data_vencimento?: string | null
          email?: string
          id?: string
          nome?: string | null
          origem_cadastro?: string | null
          plano?: string | null
          situacao?: string | null
          theme?: string | null
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
      rls_audit_resolutions: {
        Row: {
          created_at: string | null
          id: string
          issue_hash: string
          issue_type: string
          policy_name: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          suggested_fix: string | null
          table_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_hash: string
          issue_type: string
          policy_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggested_fix?: string | null
          table_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_hash?: string
          issue_type?: string
          policy_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggested_fix?: string | null
          table_name?: string
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
      sent_notifications: {
        Row: {
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
        Relationships: [
          {
            foreignKeyName: "sent_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "supabase_instance_audit_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "supabase_instances"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "supabase_instance_backups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "supabase_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      supabase_instances: {
        Row: {
          anon_key_enc: string | null
          created_at: string
          created_by: string | null
          db_size_bytes: number | null
          id: string
          last_backup: string | null
          last_health_check: string | null
          name: string
          pg_host: string | null
          pg_port: number | null
          postgres_version: string | null
          service_role_key_enc: string
          status: string | null
          supabase_url: string
          updated_at: string
        }
        Insert: {
          anon_key_enc?: string | null
          created_at?: string
          created_by?: string | null
          db_size_bytes?: number | null
          id?: string
          last_backup?: string | null
          last_health_check?: string | null
          name: string
          pg_host?: string | null
          pg_port?: number | null
          postgres_version?: string | null
          service_role_key_enc: string
          status?: string | null
          supabase_url: string
          updated_at?: string
        }
        Update: {
          anon_key_enc?: string | null
          created_at?: string
          created_by?: string | null
          db_size_bytes?: number | null
          id?: string
          last_backup?: string | null
          last_health_check?: string | null
          name?: string
          pg_host?: string | null
          pg_port?: number | null
          postgres_version?: string | null
          service_role_key_enc?: string
          status?: string | null
          supabase_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_backups: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string | null
          file_path: string | null
          file_size: number | null
          id: string
          status: string | null
        }
        Insert: {
          backup_type: string
          completed_at?: string | null
          created_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          status?: string | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
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
      trending_rankings: {
        Row: {
          content_id: string
          content_type: string | null
          created_at: string
          id: string
          rank_position: number | null
          score: number | null
          updated_at: string
        }
        Insert: {
          content_id: string
          content_type?: string | null
          created_at?: string
          id?: string
          rank_position?: number | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string | null
          created_at?: string
          id?: string
          rank_position?: number | null
          score?: number | null
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
      [_ in never]: never
    }
    Functions: {
      check_suspicious_login: {
        Args: { _email: string; _ip_address: string }
        Returns: Json
      }
      cleanup_fase8_old_data:
        | { Args: never; Returns: Json }
        | { Args: { p_dry_run?: boolean }; Returns: Json }
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
      get_channel_shard: { Args: { channel_id: number }; Returns: number }
      has_role: {
        Args: {
          check_role: Database["public"]["Enums"]["app_role"]
          check_user_id: string
        }
        Returns: boolean
      }
      is_admin_or_master: { Args: { check_user_id?: string }; Returns: boolean }
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
