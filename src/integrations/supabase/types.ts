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
      affiliate_analytics: {
        Row: {
          affiliate_id: string | null
          avg_order_value: number | null
          clicks: number | null
          commission_earned: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          id: string
          period_end: string
          period_start: string
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
          id?: string
          period_end: string
          period_start: string
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
          id?: string
          period_end?: string
          period_start?: string
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
          config_value: Json
          description: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      affiliate_fraud_logs: {
        Row: {
          affiliate_id: string | null
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
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
          id: string
          ip_address: string | null
          landing_page: string | null
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id?: string | null
          clicked_at?: string | null
          converted?: boolean | null
          converted_at?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string | null
          clicked_at?: string | null
          converted?: boolean | null
          converted_at?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
      affiliate_marketing_materials: {
        Row: {
          active: boolean | null
          content_text: string | null
          content_url: string | null
          created_at: string | null
          description: string | null
          dimensions: string | null
          download_count: number | null
          file_size: number | null
          id: string
          title: string
          type: string
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
          file_size?: number | null
          id?: string
          title: string
          type: string
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
          file_size?: number | null
          id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_plan_commissions: {
        Row: {
          affiliate_id: string | null
          commission_type: string | null
          commission_value: number
          created_at: string | null
          id: string
          plan_type: string
        }
        Insert: {
          affiliate_id?: string | null
          commission_type?: string | null
          commission_value: number
          created_at?: string | null
          id?: string
          plan_type: string
        }
        Update: {
          affiliate_id?: string | null
          commission_type?: string | null
          commission_value?: number
          created_at?: string | null
          id?: string
          plan_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_plan_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          commission_earned: number
          commission_type: string
          commission_value: number
          confirmed_at: string | null
          coupon_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          plan_purchased: string | null
          plan_value: number | null
          referred_cliente_id: string | null
          referred_user_id: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          commission_earned?: number
          commission_type: string
          commission_value: number
          confirmed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          plan_purchased?: string | null
          plan_value?: number | null
          referred_cliente_id?: string | null
          referred_user_id?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          commission_earned?: number
          commission_type?: string
          commission_value?: number
          confirmed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          plan_purchased?: string | null
          plan_value?: number | null
          referred_cliente_id?: string | null
          referred_user_id?: string | null
          status?: string
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
            foreignKeyName: "affiliate_referrals_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_tiers: {
        Row: {
          bonus_amount: number | null
          color: string | null
          commission_percentage: number
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          min_referrals: number | null
          min_revenue: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          bonus_amount?: number | null
          color?: string | null
          commission_percentage: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          min_referrals?: number | null
          min_revenue?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          bonus_amount?: number | null
          color?: string | null
          commission_percentage?: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          min_referrals?: number | null
          min_revenue?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_withdrawals: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          transaction_id: string | null
          withdrawal_type: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          transaction_id?: string | null
          withdrawal_type?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          transaction_id?: string | null
          withdrawal_type?: string
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
          available_balance: number
          cliente_id: string | null
          commission_type: string
          commission_value: number
          conversion_rate: number | null
          created_at: string
          created_by: string | null
          custom_slug: string | null
          email: string | null
          fraud_score: number | null
          id: string
          is_recurring_enabled: boolean | null
          last_click_at: string | null
          name: string
          notes: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          status: string
          tier_id: string | null
          total_clicks: number | null
          total_earnings: number
          total_referrals: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          available_balance?: number
          cliente_id?: string | null
          commission_type?: string
          commission_value?: number
          conversion_rate?: number | null
          created_at?: string
          created_by?: string | null
          custom_slug?: string | null
          email?: string | null
          fraud_score?: number | null
          id?: string
          is_recurring_enabled?: boolean | null
          last_click_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          tier_id?: string | null
          total_clicks?: number | null
          total_earnings?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          available_balance?: number
          cliente_id?: string | null
          commission_type?: string
          commission_value?: number
          conversion_rate?: number | null
          created_at?: string
          created_by?: string | null
          custom_slug?: string | null
          email?: string | null
          fraud_score?: number | null
          id?: string
          is_recurring_enabled?: boolean | null
          last_click_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          tier_id?: string | null
          total_clicks?: number | null
          total_earnings?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "affiliate_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      app_feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          flag_name: string
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          flag_name: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          flag_name?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
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
      coupon_usage: {
        Row: {
          affiliate_referral_id: string | null
          client_id: string | null
          coupon_id: string | null
          discount_applied: number | null
          id: string
          order_value: number | null
          used_at: string | null
        }
        Insert: {
          affiliate_referral_id?: string | null
          client_id?: string | null
          coupon_id?: string | null
          discount_applied?: number | null
          id?: string
          order_value?: number | null
          used_at?: string | null
        }
        Update: {
          affiliate_referral_id?: string | null
          client_id?: string | null
          coupon_id?: string | null
          discount_applied?: number | null
          id?: string
          order_value?: number | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_affiliate_referral_id_fkey"
            columns: ["affiliate_referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
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
          affiliate_id: string | null
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
          affiliate_id?: string | null
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
          affiliate_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "discount_coupons_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
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
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "viewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_config: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          flag_name: string
          id: string
          percentage: number
          rollback_available: boolean | null
          target_devices: string[] | null
          target_users: string[] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_name: string
          id?: string
          percentage?: number
          rollback_available?: boolean | null
          target_devices?: string[] | null
          target_users?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_name?: string
          id?: string
          percentage?: number
          rollback_available?: boolean | null
          target_devices?: string[] | null
          target_users?: string[] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      health_snapshots: {
        Row: {
          id: string
          overall_status: string | null
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
      mercado_pago_config: {
        Row: {
          created_at: string | null
          id: string
          production_access_token: string | null
          public_key: string | null
          sandbox_access_token: string | null
          updated_at: string | null
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
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
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          processed: boolean | null
          raw_payload: Json
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          data_id?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          processed?: boolean | null
          raw_payload: Json
        }
        Update: {
          action?: string | null
          created_at?: string | null
          data_id?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          processed?: boolean | null
          raw_payload?: Json
        }
        Relationships: []
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
      migration_audit: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          executed_at: string
          executed_by: string | null
          id: string
          metadata: Json | null
          migration_name: string
          rollback_available: boolean | null
          rollback_executed_at: string | null
          rows_affected: number | null
          status: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          metadata?: Json | null
          migration_name: string
          rollback_available?: boolean | null
          rollback_executed_at?: string | null
          rows_affected?: number | null
          status?: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          metadata?: Json | null
          migration_name?: string
          rollback_available?: boolean | null
          rollback_executed_at?: string | null
          rows_affected?: number | null
          status?: string
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          external_reference: string | null
          id: string
          mercado_pago_payment_id: string | null
          mercado_pago_preference_id: string | null
          metadata: Json | null
          paid_at: string | null
          payer_email: string | null
          payment_method: string | null
          payment_type: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          external_reference?: string | null
          id?: string
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payer_email?: string | null
          payment_method?: string | null
          payment_type?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          external_reference?: string | null
          id?: string
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payer_email?: string | null
          payment_method?: string | null
          payment_type?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_identities"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_sessions"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      playback_tokens: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          last_used_at: string | null
          max_uses: number | null
          permissions: Json | null
          revoked_at: string | null
          token_hash: string
          use_count: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          max_uses?: number | null
          permissions?: Json | null
          revoked_at?: string | null
          token_hash: string
          use_count?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          max_uses?: number | null
          permissions?: Json | null
          revoked_at?: string | null
          token_hash?: string
          use_count?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playback_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_identities"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "playback_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_sessions"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "playback_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      profiles: {
        Row: {
          cliente_ativo: boolean | null
          cliente_legacy_id: string | null
          contact_phone: string | null
          created_at: string | null
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
          migrated_from_clientes: boolean | null
          nome: string
          origem_cadastro: string | null
          plano: Database["public"]["Enums"]["plano_cliente"] | null
          situacao: Database["public"]["Enums"]["situacao_cliente"] | null
          telefone: string | null
          telefone_whatsapp: string | null
          theme: string | null
          totp_enabled: boolean | null
          totp_secret: string | null
          totp_verified_at: string | null
          updated_at: string | null
          user_id: string | null
          valor_pago: number | null
        }
        Insert: {
          cliente_ativo?: boolean | null
          cliente_legacy_id?: string | null
          contact_phone?: string | null
          created_at?: string | null
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
          id: string
          is_recorrente?: boolean | null
          migrated_from_clientes?: boolean | null
          nome: string
          origem_cadastro?: string | null
          plano?: Database["public"]["Enums"]["plano_cliente"] | null
          situacao?: Database["public"]["Enums"]["situacao_cliente"] | null
          telefone?: string | null
          telefone_whatsapp?: string | null
          theme?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_pago?: number | null
        }
        Update: {
          cliente_ativo?: boolean | null
          cliente_legacy_id?: string | null
          contact_phone?: string | null
          created_at?: string | null
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
          migrated_from_clientes?: boolean | null
          nome?: string
          origem_cadastro?: string | null
          plano?: Database["public"]["Enums"]["plano_cliente"] | null
          situacao?: Database["public"]["Enums"]["situacao_cliente"] | null
          telefone?: string | null
          telefone_whatsapp?: string | null
          theme?: string | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_pago?: number | null
        }
        Relationships: []
      }
      profiles_migration_jobs: {
        Row: {
          batch_size: number | null
          created_by: string | null
          error_count: number | null
          finished_at: string | null
          job_id: string
          processed_records: number | null
          started_at: string | null
          status: string | null
          success_count: number | null
          summary: Json | null
          total_records: number | null
        }
        Insert: {
          batch_size?: number | null
          created_by?: string | null
          error_count?: number | null
          finished_at?: string | null
          job_id?: string
          processed_records?: number | null
          started_at?: string | null
          status?: string | null
          success_count?: number | null
          summary?: Json | null
          total_records?: number | null
        }
        Update: {
          batch_size?: number | null
          created_by?: string | null
          error_count?: number | null
          finished_at?: string | null
          job_id?: string
          processed_records?: number | null
          started_at?: string | null
          status?: string | null
          success_count?: number | null
          summary?: Json | null
          total_records?: number | null
        }
        Relationships: []
      }
      profiles_migration_logs: {
        Row: {
          action: string | null
          cliente_id: string | null
          created_at: string | null
          error: string | null
          field_mapping: Json | null
          id: number
          job_id: string | null
          profile_id: string | null
        }
        Insert: {
          action?: string | null
          cliente_id?: string | null
          created_at?: string | null
          error?: string | null
          field_mapping?: Json | null
          id?: number
          job_id?: string | null
          profile_id?: string | null
        }
        Update: {
          action?: string | null
          cliente_id?: string | null
          created_at?: string | null
          error?: string | null
          field_mapping?: Json | null
          id?: number
          job_id?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_migration_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "profiles_migration_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      profiles_orphan_archive: {
        Row: {
          archived_at: string | null
          id: string
          original_data: Json
          reason: string | null
        }
        Insert: {
          archived_at?: string | null
          id: string
          original_data: Json
          reason?: string | null
        }
        Update: {
          archived_at?: string | null
          id?: string
          original_data?: Json
          reason?: string | null
        }
        Relationships: []
      }
      pwa_settings: {
        Row: {
          app_name: string
          background_color: string | null
          categories: string[] | null
          created_at: string
          description: string | null
          display_mode: string | null
          favicon_16: string | null
          favicon_32: string | null
          icon_192: string | null
          icon_512: string | null
          icon_maskable: string | null
          id: string
          install_banner_delay_seconds: number | null
          install_banner_enabled: boolean | null
          install_banner_message: string | null
          install_banner_style: string | null
          language: string | null
          orientation: string | null
          prefer_related_applications: boolean | null
          push_enabled: boolean | null
          push_endpoint: string | null
          push_vapid_private_key: string | null
          push_vapid_public_key: string | null
          scope: string | null
          short_name: string
          start_url: string | null
          sw_api_strategy: string | null
          sw_app_shell_precache: boolean | null
          sw_auto_update: boolean | null
          sw_cache_expiration_days: number | null
          sw_clients_claim: boolean | null
          sw_enabled: boolean | null
          sw_images_strategy: string | null
          sw_js_css_strategy: string | null
          sw_max_cache_items: number | null
          sw_offline_page_url: string | null
          sw_show_update_popup: boolean | null
          sw_skip_waiting: boolean | null
          theme_color: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_name?: string
          background_color?: string | null
          categories?: string[] | null
          created_at?: string
          description?: string | null
          display_mode?: string | null
          favicon_16?: string | null
          favicon_32?: string | null
          icon_192?: string | null
          icon_512?: string | null
          icon_maskable?: string | null
          id?: string
          install_banner_delay_seconds?: number | null
          install_banner_enabled?: boolean | null
          install_banner_message?: string | null
          install_banner_style?: string | null
          language?: string | null
          orientation?: string | null
          prefer_related_applications?: boolean | null
          push_enabled?: boolean | null
          push_endpoint?: string | null
          push_vapid_private_key?: string | null
          push_vapid_public_key?: string | null
          scope?: string | null
          short_name?: string
          start_url?: string | null
          sw_api_strategy?: string | null
          sw_app_shell_precache?: boolean | null
          sw_auto_update?: boolean | null
          sw_cache_expiration_days?: number | null
          sw_clients_claim?: boolean | null
          sw_enabled?: boolean | null
          sw_images_strategy?: string | null
          sw_js_css_strategy?: string | null
          sw_max_cache_items?: number | null
          sw_offline_page_url?: string | null
          sw_show_update_popup?: boolean | null
          sw_skip_waiting?: boolean | null
          theme_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_name?: string
          background_color?: string | null
          categories?: string[] | null
          created_at?: string
          description?: string | null
          display_mode?: string | null
          favicon_16?: string | null
          favicon_32?: string | null
          icon_192?: string | null
          icon_512?: string | null
          icon_maskable?: string | null
          id?: string
          install_banner_delay_seconds?: number | null
          install_banner_enabled?: boolean | null
          install_banner_message?: string | null
          install_banner_style?: string | null
          language?: string | null
          orientation?: string | null
          prefer_related_applications?: boolean | null
          push_enabled?: boolean | null
          push_endpoint?: string | null
          push_vapid_private_key?: string | null
          push_vapid_public_key?: string | null
          scope?: string | null
          short_name?: string
          start_url?: string | null
          sw_api_strategy?: string | null
          sw_app_shell_precache?: boolean | null
          sw_auto_update?: boolean | null
          sw_cache_expiration_days?: number | null
          sw_clients_claim?: boolean | null
          sw_enabled?: boolean | null
          sw_images_strategy?: string | null
          sw_js_css_strategy?: string | null
          sw_max_cache_items?: number | null
          sw_offline_page_url?: string | null
          sw_show_update_popup?: boolean | null
          sw_skip_waiting?: boolean | null
          theme_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qos_metrics: {
        Row: {
          bitrate_kbps: number | null
          channel_id: string | null
          id: string
          latency_ms: number | null
          rebuffer_count: number | null
          timestamp: string | null
          viewer_count: number | null
        }
        Insert: {
          bitrate_kbps?: number | null
          channel_id?: string | null
          id?: string
          latency_ms?: number | null
          rebuffer_count?: number | null
          timestamp?: string | null
          viewer_count?: number | null
        }
        Update: {
          bitrate_kbps?: number | null
          channel_id?: string | null
          id?: string
          latency_ms?: number | null
          rebuffer_count?: number | null
          timestamp?: string | null
          viewer_count?: number | null
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
      rls_audit_resolutions: {
        Row: {
          applied_fix: string | null
          created_at: string
          id: string
          issue_description: string
          issue_hash: string
          issue_type: string
          policy_name: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          suggested_fix: string | null
          table_name: string
          updated_at: string
        }
        Insert: {
          applied_fix?: string | null
          created_at?: string
          id?: string
          issue_description: string
          issue_hash: string
          issue_type: string
          policy_name?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          suggested_fix?: string | null
          table_name: string
          updated_at?: string
        }
        Update: {
          applied_fix?: string | null
          created_at?: string
          id?: string
          issue_description?: string
          issue_hash?: string
          issue_type?: string
          policy_name?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          suggested_fix?: string | null
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rls_fix_backups: {
        Row: {
          backup_timestamp: string
          created_by: string | null
          id: string
          metadata: Json | null
          policy_definition: string
          policy_name: string | null
          restore_sql: string | null
          schema_name: string
          table_name: string
        }
        Insert: {
          backup_timestamp?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          policy_definition: string
          policy_name?: string | null
          restore_sql?: string | null
          schema_name: string
          table_name: string
        }
        Update: {
          backup_timestamp?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          policy_definition?: string
          policy_name?: string | null
          restore_sql?: string | null
          schema_name?: string
          table_name?: string
        }
        Relationships: []
      }
      rls_manifest: {
        Row: {
          action: string
          created_at: string | null
          expected_using: string | null
          expected_with_check: string | null
          id: string
          policy_name: string
          required_for_roles: string[] | null
          schema_name: string
          severity: string | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          expected_using?: string | null
          expected_with_check?: string | null
          id?: string
          policy_name: string
          required_for_roles?: string[] | null
          schema_name: string
          severity?: string | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          expected_using?: string | null
          expected_with_check?: string | null
          id?: string
          policy_name?: string
          required_for_roles?: string[] | null
          schema_name?: string
          severity?: string | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      rls_scan_results: {
        Row: {
          action: string | null
          created_at: string | null
          evidence: Json | null
          fixed_at: string | null
          fixed_by: string | null
          id: string
          issue_type: string
          proposed_fix: Json | null
          scan_id: string
          scan_timestamp: string
          schema_name: string
          severity: string
          status: string | null
          table_name: string
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          evidence?: Json | null
          fixed_at?: string | null
          fixed_by?: string | null
          id?: string
          issue_type: string
          proposed_fix?: Json | null
          scan_id: string
          scan_timestamp?: string
          schema_name: string
          severity: string
          status?: string | null
          table_name: string
        }
        Update: {
          action?: string | null
          created_at?: string | null
          evidence?: Json | null
          fixed_at?: string | null
          fixed_by?: string | null
          id?: string
          issue_type?: string
          proposed_fix?: Json | null
          scan_id?: string
          scan_timestamp?: string
          schema_name?: string
          severity?: string
          status?: string | null
          table_name?: string
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
      scheduler_config: {
        Row: {
          created_at: string | null
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      schema_drift_log: {
        Row: {
          created_at: string
          current_state: string | null
          drift_type: string
          expected_state: string | null
          fix_applied: boolean
          fix_applied_at: string | null
          fix_applied_by: string | null
          fix_sql: string | null
          id: string
          metadata: Json | null
          notes: string | null
          object_name: string
          object_type: string
          resolved_at: string | null
          scan_id: string
          severity: string
        }
        Insert: {
          created_at?: string
          current_state?: string | null
          drift_type: string
          expected_state?: string | null
          fix_applied?: boolean
          fix_applied_at?: string | null
          fix_applied_by?: string | null
          fix_sql?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          object_name: string
          object_type: string
          resolved_at?: string | null
          scan_id: string
          severity: string
        }
        Update: {
          created_at?: string
          current_state?: string | null
          drift_type?: string
          expected_state?: string | null
          fix_applied?: boolean
          fix_applied_at?: string | null
          fix_applied_by?: string | null
          fix_sql?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          object_name?: string
          object_type?: string
          resolved_at?: string | null
          scan_id?: string
          severity?: string
        }
        Relationships: []
      }
      schema_expected_state: {
        Row: {
          check_enabled: boolean
          created_at: string
          definition: string
          id: string
          is_critical: boolean
          metadata: Json | null
          object_name: string
          object_schema: string
          object_type: string
          parent_object: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          check_enabled?: boolean
          created_at?: string
          definition: string
          id?: string
          is_critical?: boolean
          metadata?: Json | null
          object_name: string
          object_schema?: string
          object_type: string
          parent_object?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          check_enabled?: boolean
          created_at?: string
          definition?: string
          id?: string
          is_critical?: boolean
          metadata?: Json | null
          object_name?: string
          object_schema?: string
          object_type?: string
          parent_object?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      schema_migrations_tracking: {
        Row: {
          applied_at: string
          applied_by: string | null
          checksum: string
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          migration_file: string
          migration_name: string
          rollback_sql: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          checksum: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          migration_file: string
          migration_name: string
          rollback_sql?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          checksum?: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          migration_file?: string
          migration_name?: string
          rollback_sql?: string | null
          status?: string
          updated_at?: string
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
      storage_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      storage_sync_events: {
        Row: {
          channel_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          source_type: string
          source_url: string | null
          started_at: string | null
          status: string
          sync_duration_ms: number | null
          target_type: string
          target_url: string | null
        }
        Insert: {
          channel_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          source_type?: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          sync_duration_ms?: number | null
          target_type?: string
          target_url?: string | null
        }
        Update: {
          channel_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          source_type?: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          sync_duration_ms?: number | null
          target_type?: string
          target_url?: string | null
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
      transcode_job_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          job_id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["transcode_job_status"]
          old_status: Database["public"]["Enums"]["transcode_job_status"] | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          job_id: string
          metadata?: Json | null
          new_status: Database["public"]["Enums"]["transcode_job_status"]
          old_status?:
            | Database["public"]["Enums"]["transcode_job_status"]
            | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          job_id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["transcode_job_status"]
          old_status?:
            | Database["public"]["Enums"]["transcode_job_status"]
            | null
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
        Relationships: []
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
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          mercado_pago_customer_id: string | null
          mercado_pago_subscription_id: string | null
          metadata: Json | null
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          mercado_pago_customer_id?: string | null
          mercado_pago_subscription_id?: string | null
          metadata?: Json | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          mercado_pago_customer_id?: string | null
          mercado_pago_subscription_id?: string | null
          metadata?: Json | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
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
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_identities"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_sessions"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_totp_secrets: {
        Row: {
          created_at: string | null
          totp_secret: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          totp_secret: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          totp_secret?: string
          user_id?: string
          verified_at?: string | null
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
      viewer_profiles: {
        Row: {
          avatar_color: string | null
          avatar_url: string | null
          created_at: string | null
          id: string
          is_kids: boolean | null
          language: string | null
          last_used_at: string | null
          maturity_rating: string | null
          name: string
          pin_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          is_kids?: boolean | null
          language?: string | null
          last_used_at?: string | null
          maturity_rating?: string | null
          name: string
          pin_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          is_kids?: boolean | null
          language?: string | null
          last_used_at?: string | null
          maturity_rating?: string | null
          name?: string
          pin_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vod_host_status: {
        Row: {
          avg_download_speed_bps: number | null
          blocked_until: string | null
          consecutive_failures: number | null
          created_at: string | null
          host: string
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          total_failures: number | null
          total_successes: number | null
          updated_at: string | null
        }
        Insert: {
          avg_download_speed_bps?: number | null
          blocked_until?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          host: string
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          total_failures?: number | null
          total_successes?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_download_speed_bps?: number | null
          blocked_until?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          host?: string
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          total_failures?: number | null
          total_successes?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
          last_watched_at: string | null
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
          last_watched_at?: string | null
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
          last_watched_at?: string | null
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
      profile_identities: {
        Row: {
          identity_created_at: string | null
          identity_data: Json | null
          identity_id: string | null
          identity_updated_at: string | null
          last_sign_in_at: string | null
          nome: string | null
          profile_email: string | null
          profile_id: string | null
          provider: string | null
        }
        Relationships: []
      }
      profile_sessions: {
        Row: {
          aal: "aal1" | "aal2" | "aal3" | null
          email: string | null
          factor_id: string | null
          ip: unknown
          nome: string | null
          not_after: string | null
          profile_id: string | null
          refreshed_at: string | null
          session_created_at: string | null
          session_id: string | null
          session_updated_at: string | null
          user_agent: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_transcode_job: {
        Args: { p_processor_id: string }
        Returns: string
      }
      calculate_ladder_preset: {
        Args: {
          p_historical_views: number
          p_source_height: number
          p_source_width: number
        }
        Returns: Database["public"]["Enums"]["quality_ladder_preset"]
      }
      calculate_prewarm_predictions: { Args: never; Returns: number }
      check_affiliate_fraud: {
        Args: {
          p_action_type?: string
          p_affiliate_id: string
          p_ip_address: string
        }
        Returns: boolean
      }
      check_and_block_ip: {
        Args: {
          _event_type: string
          _ip_address: string
          _threshold?: number
          _window_minutes?: number
        }
        Returns: boolean
      }
      check_cdn_rate_limit: {
        Args: { p_request_size?: number; p_type: string; p_value: string }
        Returns: Json
      }
      check_host_circuit_breaker: {
        Args: { p_url: string }
        Returns: {
          blocked_until: string
          consecutive_failures: number
          host: string
          is_blocked: boolean
        }[]
      }
      check_suspicious_login: {
        Args: { _email?: string; _ip_address: string }
        Returns: Json
      }
      cleanup_fase8_old_data: {
        Args: { p_dry_run?: boolean }
        Returns: {
          action: string
          rows_deleted: number
          table_name: string
        }[]
      }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      cleanup_old_auth_logs: { Args: never; Returns: undefined }
      cleanup_old_logs: {
        Args: { days_to_keep?: number }
        Returns: {
          activity_deleted: number
          notifications_deleted: number
          sessions_deleted: number
        }[]
      }
      cleanup_old_metrics: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      cleanup_old_suspicious_attempts: { Args: never; Returns: undefined }
      cleanup_old_vod_downloads: { Args: never; Returns: undefined }
      cleanup_orphaned_downloads: { Args: never; Returns: number }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      detect_permissive_policies: {
        Args: never
        Returns: {
          command: string
          policy_name: string
          qual: string
          schema_name: string
          severity: string
          table_name: string
          with_check: string
        }[]
      }
      detect_permissive_rls_policies: {
        Args: never
        Returns: {
          command: string
          issue_type: string
          policy_definition: string
          policy_name: unknown
          severity: string
          table_name: unknown
        }[]
      }
      detect_tables_without_rls: {
        Args: never
        Returns: {
          schema_name: string
          severity: string
          table_name: string
        }[]
      }
      determine_content_destination: {
        Args: { p_channel_id: string }
        Returns: {
          destination: string
          fallback_url: string
          reason: string
          resolved_url: string
          should_download: boolean
        }[]
      }
      execute_sql_as_service_role: {
        Args: { caller_user_id: string; sql_query: string }
        Returns: undefined
      }
      find_vod_by_hash: {
        Args: { p_sha256: string }
        Returns: {
          channel_id: string
          file_size_bytes: number
          r2_url: string
        }[]
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
      get_all_rls_policies: {
        Args: never
        Returns: {
          cmd: string
          permissive: string
          policyname: unknown
          qual: string
          roles: unknown[]
          schemaname: unknown
          tablename: unknown
          with_check: string
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
      get_content_routing_stats: {
        Args: never
        Returns: {
          high_demand_channels: number
          in_r2: number
          in_stream: number
          live_count: number
          movies_count: number
          origin_only: number
          r2_jobs_completed: number
          r2_jobs_failed: number
          r2_jobs_processing: number
          r2_jobs_queued: number
          series_count: number
          stream_jobs_processing: number
          stream_jobs_queued: number
          stream_jobs_ready: number
          total_vods: number
        }[]
      }
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
      get_migration_status: {
        Args: never
        Returns: {
          description: string
          enabled: boolean
          flag_name: string
          last_updated: string
          percentage: number
        }[]
      }
      get_notification_retry_stats: { Args: never; Returns: Json }
      get_profile_auth_status: { Args: { p_profile_id: string }; Returns: Json }
      get_profile_or_cliente: {
        Args: { p_id: string }
        Returns: {
          cliente_ativo: boolean
          data_vencimento: string
          email: string
          id: string
          nome: string
          plano: string
          situacao: string
          telefone: string
        }[]
      }
      get_profile_with_auth: { Args: { p_user_id: string }; Returns: Json }
      get_r2_download_candidates: {
        Args: { p_limit?: number }
        Returns: {
          channel_id: string
          channel_name: string
          demand_score: number
          group_title: string
          reason: string
          stream_url: string
          views_24h: number
        }[]
      }
      get_rls_coverage_summary: { Args: never; Returns: Json }
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
      get_stream_performance_summary: {
        Args: { p_hours?: number }
        Returns: {
          avg_response_time_ms: number
          avg_startup_time_ms: number
          by_device_type: Json
          by_route_type: Json
          cache_hit_rate: number
          error_rate: number
          p95_response_time_ms: number
          total_buffer_events: number
          total_gb_served: number
          total_streams: number
        }[]
      }
      get_stream_upload_candidates: {
        Args: { p_limit?: number }
        Returns: {
          channel_id: string
          channel_name: string
          demand_score: number
          group_title: string
          reason: string
          stream_url: string
          views_24h: number
        }[]
      }
      get_subscription_status: {
        Args: { p_user_id: string }
        Returns: {
          can_play: boolean
          expires_at: string
          has_subscription: boolean
          plan_name: string
          status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      get_table_policies: {
        Args: { table_name: string }
        Returns: {
          policy_cmd: string
          policy_name: string
          policy_permissive: string
          policy_qual: string
          policy_roles: string[]
          policy_with_check: string
        }[]
      }
      get_tables_without_rls: {
        Args: never
        Returns: {
          rowsecurity: boolean
          schemaname: unknown
          tablename: unknown
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
      get_transcode_queue_stats: { Args: never; Returns: Json }
      get_user_role: { Args: { _user_id?: string }; Returns: string }
      get_user_subscription_status: {
        Args: { p_user_id: string }
        Returns: {
          can_play: boolean
          expires_at: string
          has_subscription: boolean
          plan_name: string
          status: string
        }[]
      }
      get_vod_statistics: {
        Args: never
        Returns: {
          active_downloads: number
          avg_file_size_mb: number
          blocked_hosts: number
          downloads_failed: number
          downloads_in_progress: number
          downloads_paused: number
          total_storage_bytes: number
          total_vods: number
          vods_pending: number
          vods_uploaded: number
        }[]
      }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      index_advisor: {
        Args: { query: string }
        Returns: {
          errors: string[]
          index_statements: string[]
          startup_cost_after: Json
          startup_cost_before: Json
          total_cost_after: Json
          total_cost_before: Json
        }[]
      }
      invalidate_profile_sessions: {
        Args: { p_profile_id: string }
        Returns: number
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_admin_or_master: { Args: { _user_id?: string }; Returns: boolean }
      is_client: { Args: { _user_id?: string }; Returns: boolean }
      is_master: { Args: { _user_id?: string }; Returns: boolean }
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
      pg_index_exists: { Args: { index_name: string }; Returns: boolean }
      pg_table_is_visible: { Args: { table_name: string }; Returns: boolean }
      record_channel_view: {
        Args: {
          p_channel_id: string
          p_profile_id: string
          p_watch_seconds?: number
        }
        Returns: undefined
      }
      record_host_failure: {
        Args: { p_error?: string; p_url: string }
        Returns: undefined
      }
      record_host_success: {
        Args: { p_bytes?: number; p_duration_ms?: number; p_url: string }
        Returns: undefined
      }
      record_streaming_metric: {
        Args: { p_channel_id: string; p_metric_type: string; p_value: number }
        Returns: undefined
      }
      run_complete_rls_audit: { Args: never; Returns: Json }
      scan_schema_drift: {
        Args: never
        Returns: {
          critical_count: number
          drift_count: number
          high_count: number
          scan_id: string
        }[]
      }
      search_m3u_entries: {
        Args: {
          limit_count?: number
          search_query: string
          source_key?: string
        }
        Returns: {
          group_title: string
          id: string
          score: number
          source_name: string
          stream_url: string
          title: string
          tvg_logo: string
        }[]
      }
      search_playlist_entries: {
        Args: {
          p_group_title?: string
          p_limit?: number
          p_playlist_key?: string
          p_query: string
        }
        Returns: {
          group_title: string
          id: string
          playlist_key: string
          rank: number
          stream_url: string
          title: string
          tvg_logo: string
        }[]
      }
      toggle_feature_flag: {
        Args: { p_enabled: boolean; p_flag_name: string; p_percentage?: number }
        Returns: undefined
      }
      track_affiliate_click: {
        Args: {
          p_affiliate_id: string
          p_ip_address?: string
          p_landing_page?: string
          p_referrer?: string
          p_user_agent?: string
          p_utm_campaign?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: string
      }
      track_channel_view: {
        Args: { p_channel_id: string; p_watch_seconds?: number }
        Returns: undefined
      }
      update_transcode_job_status: {
        Args: {
          p_changed_by?: string
          p_job_id: string
          p_metadata?: Json
          p_new_status: Database["public"]["Enums"]["transcode_job_status"]
        }
        Returns: undefined
      }
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
      user_access_days_remaining: {
        Args: { _user_id: string }
        Returns: number
      }
      user_has_totp_enabled: { Args: { p_user_id: string }; Returns: boolean }
      user_has_valid_access: { Args: { _user_id: string }; Returns: boolean }
      validate_playback_token: {
        Args: { p_ip_address?: string; p_token_hash: string }
        Returns: {
          error_message: string
          permissions: Json
          user_id: string
          valid: boolean
        }[]
      }
      validate_sql_syntax: { Args: { sql: string }; Returns: boolean }
      verify_user_totp: {
        Args: { p_totp_secret: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "admin" | "super_admin" | "master"
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
      m3u_sync_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "partial"
      origem_cadastro:
        | "Google Ads"
        | "Facebook"
        | "Instagram"
        | "Indicação"
        | "Website"
        | "Outro"
      payment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "refunded"
        | "cancelled"
        | "in_process"
      plano_cliente: "Mensal" | "Trimestral" | "Semestral" | "Anual"
      quality_ladder_preset: "basic" | "standard" | "premium" | "ultra"
      situacao_cliente: "Testando" | "Ativo" | "Devendo" | "Inativo" | "Lead"
      subscription_status:
        | "trial"
        | "active"
        | "canceled"
        | "expired"
        | "past_due"
      transcode_job_status:
        | "queued"
        | "processing"
        | "ready"
        | "failed"
        | "cancelled"
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
      app_role: ["client", "admin", "super_admin", "master"],
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
      m3u_sync_status: ["pending", "running", "completed", "failed", "partial"],
      origem_cadastro: [
        "Google Ads",
        "Facebook",
        "Instagram",
        "Indicação",
        "Website",
        "Outro",
      ],
      payment_status: [
        "pending",
        "approved",
        "rejected",
        "refunded",
        "cancelled",
        "in_process",
      ],
      plano_cliente: ["Mensal", "Trimestral", "Semestral", "Anual"],
      quality_ladder_preset: ["basic", "standard", "premium", "ultra"],
      situacao_cliente: ["Testando", "Ativo", "Devendo", "Inativo", "Lead"],
      subscription_status: [
        "trial",
        "active",
        "canceled",
        "expired",
        "past_due",
      ],
      transcode_job_status: [
        "queued",
        "processing",
        "ready",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
