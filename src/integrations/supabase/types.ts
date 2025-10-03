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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          password_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          password_hash: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          clicked_at: string
          id: string
          ip_address: unknown | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          clicked_at?: string
          id?: string
          ip_address?: unknown | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          clicked_at?: string
          id?: string
          ip_address?: unknown | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_sales: {
        Row: {
          affiliate_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          order_value: number
          paid_at: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          commission_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          order_value: number
          paid_at?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_value?: number
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_sales_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          commission_rate: number
          created_at: string
          email: string
          id: string
          name: string
          password_hash: string
          status: string
          total_clicks: number
          total_commission: number
          total_paid: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          affiliate_code: string
          commission_rate?: number
          created_at?: string
          email: string
          id?: string
          name: string
          password_hash: string
          status?: string
          total_clicks?: number
          total_commission?: number
          total_paid?: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          affiliate_code?: string
          commission_rate?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_hash?: string
          status?: string
          total_clicks?: number
          total_commission?: number
          total_paid?: number
          total_sales?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string | null
          actor: string | null
          after: Json | null
          before: Json | null
          company_id: string | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action?: string | null
          actor?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string | null
          actor?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_history: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          price: number
          product_variant_id: string | null
          quantity: number
          session_id: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          price: number
          product_variant_id?: string | null
          quantity?: number
          session_id: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          price?: number
          product_variant_id?: string | null
          quantity?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_history_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_history_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "v_customer_wishes"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          data: Json | null
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json | null
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json | null
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_contacts: {
        Row: {
          address: Json | null
          company_id: string
          created_at: string | null
          emails: string[] | null
          id: string
          phones: string[] | null
          social: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          company_id: string
          created_at?: string | null
          emails?: string[] | null
          id?: string
          phones?: string[] | null
          social?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          company_id?: string
          created_at?: string | null
          emails?: string[] | null
          id?: string
          phones?: string[] | null
          social?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cms_page_versions: {
        Row: {
          body_json: Json
          created_at: string | null
          editor_user: string | null
          footer_json: Json
          header_json: Json
          id: string
          note: string | null
          page_id: string | null
          published_at: string | null
          seo_json: Json
          status: Database["public"]["Enums"]["cms_version_status"]
        }
        Insert: {
          body_json?: Json
          created_at?: string | null
          editor_user?: string | null
          footer_json?: Json
          header_json?: Json
          id?: string
          note?: string | null
          page_id?: string | null
          published_at?: string | null
          seo_json?: Json
          status?: Database["public"]["Enums"]["cms_version_status"]
        }
        Update: {
          body_json?: Json
          created_at?: string | null
          editor_user?: string | null
          footer_json?: Json
          header_json?: Json
          id?: string
          note?: string | null
          page_id?: string | null
          published_at?: string | null
          seo_json?: Json
          status?: Database["public"]["Enums"]["cms_version_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cms_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cms_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          company_id: string
          created_at: string | null
          current_version_id: string | null
          id: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          current_version_id?: string | null
          id?: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          current_version_id?: string | null
          id?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pages_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "cms_page_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_scripts: {
        Row: {
          allow_custom: boolean | null
          category: Database["public"]["Enums"]["cms_script_category"]
          company_id: string
          config: Json
          created_at: string | null
          custom_code: string | null
          enabled: boolean | null
          id: string
          name: string
          position: Database["public"]["Enums"]["cms_script_pos"]
          provider: Database["public"]["Enums"]["cms_script_provider"]
          updated_at: string | null
        }
        Insert: {
          allow_custom?: boolean | null
          category?: Database["public"]["Enums"]["cms_script_category"]
          company_id: string
          config?: Json
          created_at?: string | null
          custom_code?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          position?: Database["public"]["Enums"]["cms_script_pos"]
          provider: Database["public"]["Enums"]["cms_script_provider"]
          updated_at?: string | null
        }
        Update: {
          allow_custom?: boolean | null
          category?: Database["public"]["Enums"]["cms_script_category"]
          company_id?: string
          config?: Json
          created_at?: string | null
          custom_code?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          position?: Database["public"]["Enums"]["cms_script_pos"]
          provider?: Database["public"]["Enums"]["cms_script_provider"]
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string | null
          id: string
          name: string
          nfeio_company_id: string | null
          regime: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name: string
          nfeio_company_id?: string | null
          regime?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name?: string
          nfeio_company_id?: string | null
          regime?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean | null
          code: string
          company_id: string | null
          created_at: string
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          min_order_value: number | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          active?: boolean | null
          code: string
          company_id?: string | null
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
          valid_from?: string
          valid_until: string
        }
        Update: {
          active?: boolean | null
          code?: string
          company_id?: string | null
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: Json | null
          company_id: string | null
          cpf_cnpj: string | null
          created_at: string | null
          document_norm: string | null
          email: string | null
          email_norm: string | null
          id: string
          is_person: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          company_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          document_norm?: string | null
          email?: string | null
          email_norm?: string | null
          id?: string
          is_person?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          company_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          document_norm?: string | null
          email?: string | null
          email_norm?: string | null
          id?: string
          is_person?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_variables: {
        Row: {
          company_id: string | null
          created_at: string | null
          environment: string
          id: string
          key: string
          provider: string
          updated_at: string | null
          value: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          environment?: string
          id?: string
          key: string
          provider: string
          updated_at?: string | null
          value: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          environment?: string
          id?: string
          key?: string
          provider?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_code: string | null
          id: string
          integration_id: string | null
          ip_address: string | null
          level: string | null
          message: string | null
          payload: Json | null
          request_id: string | null
          response_status: number | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          integration_id?: string | null
          ip_address?: string | null
          level?: string | null
          message?: string | null
          payload?: Json | null
          request_id?: string | null
          response_status?: number | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          integration_id?: string | null
          ip_address?: string | null
          level?: string | null
          message?: string | null
          payload?: Json | null
          request_id?: string | null
          response_status?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_templates: {
        Row: {
          created_at: string | null
          display_name: string
          doc_url: string | null
          id: string
          optional_fields: Json
          provider: string
          required_fields: Json
          type: Database["public"]["Enums"]["integration_type"]
        }
        Insert: {
          created_at?: string | null
          display_name: string
          doc_url?: string | null
          id?: string
          optional_fields?: Json
          provider: string
          required_fields: Json
          type: Database["public"]["Enums"]["integration_type"]
        }
        Update: {
          created_at?: string | null
          display_name?: string
          doc_url?: string | null
          id?: string
          optional_fields?: Json
          provider?: string
          required_fields?: Json
          type?: Database["public"]["Enums"]["integration_type"]
        }
        Relationships: []
      }
      integrations: {
        Row: {
          auto_sync: boolean | null
          company_id: string | null
          config: Json
          created_at: string | null
          description: string | null
          environment: string | null
          id: string
          last_error: string | null
          last_run_at: string | null
          last_sync_at: string | null
          metadata: Json | null
          mode: string | null
          name: string
          provider: string
          secrets: Json
          status: Database["public"]["Enums"]["integration_status"] | null
          sync_frequency: number | null
          tags: string[] | null
          type: Database["public"]["Enums"]["integration_type"]
          updated_at: string | null
          version: string | null
          webhook_url: string | null
        }
        Insert: {
          auto_sync?: boolean | null
          company_id?: string | null
          config?: Json
          created_at?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          mode?: string | null
          name: string
          provider: string
          secrets?: Json
          status?: Database["public"]["Enums"]["integration_status"] | null
          sync_frequency?: number | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["integration_type"]
          updated_at?: string | null
          version?: string | null
          webhook_url?: string | null
        }
        Update: {
          auto_sync?: boolean | null
          company_id?: string | null
          config?: Json
          created_at?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          mode?: string | null
          name?: string
          provider?: string
          secrets?: Json
          status?: Database["public"]["Enums"]["integration_status"] | null
          sync_frequency?: number | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["integration_type"]
          updated_at?: string | null
          version?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          danfe_url: string | null
          id: string
          nfeio_id: string | null
          number: string | null
          order_id: string | null
          series: string | null
          status: string | null
          xml_url: string | null
        }
        Insert: {
          created_at?: string | null
          danfe_url?: string | null
          id?: string
          nfeio_id?: string | null
          number?: string | null
          order_id?: string | null
          series?: string | null
          status?: string | null
          xml_url?: string | null
        }
        Update: {
          created_at?: string | null
          danfe_url?: string | null
          id?: string
          nfeio_id?: string | null
          number?: string | null
          order_id?: string | null
          series?: string | null
          status?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      m3u_lists: {
        Row: {
          created_at: string
          file_size: number | null
          file_url: string
          filename: string
          id: string
          name: string
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          file_url: string
          filename: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number | null
          file_url?: string
          filename?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m3u_lists_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_sessions: {
        Row: {
          affiliate_code: string | null
          created_at: string
          device_id: string
          expires_at: string
          id: string
          plan_selected: string | null
          user_data: Json
        }
        Insert: {
          affiliate_code?: string | null
          created_at?: string
          device_id: string
          expires_at?: string
          id?: string
          plan_selected?: string | null
          user_data?: Json
        }
        Update: {
          affiliate_code?: string | null
          created_at?: string
          device_id?: string
          expires_at?: string
          id?: string
          plan_selected?: string | null
          user_data?: Json
        }
        Relationships: []
      }
      nfeio_companies: {
        Row: {
          address: Json | null
          company_id: string
          created_at: string
          email: string | null
          environment: string
          federal_tax_number: string
          id: string
          name: string
          nfeio_company_id: string
          status: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          company_id: string
          created_at?: string
          email?: string | null
          environment?: string
          federal_tax_number: string
          id?: string
          name: string
          nfeio_company_id: string
          status?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          company_id?: string
          created_at?: string
          email?: string | null
          environment?: string
          federal_tax_number?: string
          id?: string
          name?: string
          nfeio_company_id?: string
          status?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nfeio_settings: {
        Row: {
          api_key: string
          auto_issue_invoices: boolean | null
          certificate_id: string | null
          certificate_password: string | null
          company_id: string
          created_at: string
          id: string
          sandbox_mode: boolean
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key: string
          auto_issue_invoices?: boolean | null
          certificate_id?: string | null
          certificate_password?: string | null
          company_id: string
          created_at?: string
          id?: string
          sandbox_mode?: boolean
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          auto_issue_invoices?: boolean | null
          certificate_id?: string | null
          certificate_password?: string | null
          company_id?: string
          created_at?: string
          id?: string
          sandbox_mode?: boolean
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          price: number
          product_variant_id: string | null
          qty: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          price: number
          product_variant_id?: string | null
          qty: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          price?: number
          product_variant_id?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "v_customer_wishes"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          coupon_discount: number | null
          coupon_id: string | null
          created_at: string | null
          customer_id: string | null
          discount: number | null
          freight: number | null
          id: string
          mp_payment_id: string | null
          mp_payment_status: string | null
          mp_preference_id: string | null
          nfeio_invoice_id: string | null
          status: string | null
          subtotal: number | null
          total: number | null
        }
        Insert: {
          company_id?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount?: number | null
          freight?: number | null
          id?: string
          mp_payment_id?: string | null
          mp_payment_status?: string | null
          mp_preference_id?: string | null
          nfeio_invoice_id?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
        }
        Update: {
          company_id?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount?: number | null
          freight?: number | null
          id?: string
          mp_payment_id?: string | null
          mp_payment_status?: string | null
          mp_preference_id?: string | null
          nfeio_invoice_id?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          cost: number | null
          created_at: string | null
          id: string
          option_name: string | null
          option_value: string | null
          price: number
          product_id: string | null
          stock: number | null
        }
        Insert: {
          barcode?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          option_name?: string | null
          option_value?: string | null
          price: number
          product_id?: string | null
          stock?: number | null
        }
        Update: {
          barcode?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          option_name?: string | null
          option_value?: string | null
          price?: number
          product_id?: string | null
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category: string | null
          cest: string | null
          cfop: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          ncm: string | null
          sku: string
          unit: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          ncm?: string | null
          sku: string
          unit?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          ncm?: string | null
          sku?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          role?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          cfop: string | null
          cost: number | null
          created_at: string | null
          id: string
          ncm: string | null
          product_variant_id: string | null
          purchase_id: string | null
          qty: number | null
        }
        Insert: {
          cfop?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          ncm?: string | null
          product_variant_id?: string | null
          purchase_id?: string | null
          qty?: number | null
        }
        Update: {
          cfop?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          ncm?: string | null
          product_variant_id?: string | null
          purchase_id?: string | null
          qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "v_customer_wishes"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          status: string | null
          supplier_id: string | null
          total: number | null
          xml_key: string | null
          xml_raw: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          supplier_id?: string | null
          total?: number | null
          xml_key?: string | null
          xml_raw?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          supplier_id?: string | null
          total?: number | null
          xml_key?: string | null
          xml_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recommended_players: {
        Row: {
          created_at: string
          description: string | null
          download_links: Json
          featured: boolean
          icon_url: string | null
          id: string
          name: string
          platforms: Json
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          download_links?: Json
          featured?: boolean
          icon_url?: string | null
          id?: string
          name: string
          platforms?: Json
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          download_links?: Json
          featured?: boolean
          icon_url?: string | null
          id?: string
          name?: string
          platforms?: Json
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reconciliations: {
        Row: {
          checked_at: string | null
          id: string
          mp_status: string | null
          nfe_status: string | null
          ok: boolean | null
          order_id: string | null
          stock_ok: boolean | null
        }
        Insert: {
          checked_at?: string | null
          id?: string
          mp_status?: string | null
          nfe_status?: string | null
          ok?: boolean | null
          order_id?: string | null
          stock_ok?: boolean | null
        }
        Update: {
          checked_at?: string | null
          id?: string
          mp_status?: string | null
          nfe_status?: string | null
          ok?: boolean | null
          order_id?: string | null
          stock_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      site_configurations: {
        Row: {
          created_at: string
          id: string
          key: string
          section: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          section: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          section?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string | null
          id: string
          note: string | null
          product_variant_id: string | null
          qty: number
          ref_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string | null
          product_variant_id?: string | null
          qty: number
          ref_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string | null
          product_variant_id?: string | null
          qty?: number
          ref_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "v_customer_wishes"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          cnpj: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: Json | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: Json | null
          cnpj?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      v_customer_wishes: {
        Row: {
          company_id: string | null
          current_price: number | null
          customer_id: string | null
          historical_price: number | null
          interaction_count: number | null
          last_interaction: string | null
          net_quantity: number | null
          option_name: string | null
          option_value: string | null
          product_name: string | null
          variant_id: string | null
          was_purchased: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      normalize_document: {
        Args: { document: string }
        Returns: string
      }
      normalize_email: {
        Args: { email: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      cms_script_category: "essential" | "analytics" | "ads"
      cms_script_pos: "head" | "body_end"
      cms_script_provider:
        | "gtm"
        | "ga4"
        | "google_ads"
        | "meta_pixel"
        | "custom"
      cms_version_status: "draft" | "published" | "archived"
      integration_status: "inactive" | "active" | "error" | "pending"
      integration_type:
        | "payment"
        | "fiscal"
        | "messaging"
        | "marketplace"
        | "other"
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
      app_role: ["admin", "user"],
      cms_script_category: ["essential", "analytics", "ads"],
      cms_script_pos: ["head", "body_end"],
      cms_script_provider: ["gtm", "ga4", "google_ads", "meta_pixel", "custom"],
      cms_version_status: ["draft", "published", "archived"],
      integration_status: ["inactive", "active", "error", "pending"],
      integration_type: [
        "payment",
        "fiscal",
        "messaging",
        "marketplace",
        "other",
      ],
    },
  },
} as const
