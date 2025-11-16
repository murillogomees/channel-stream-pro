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
      admin_phones: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          phone: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          phone: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cliente_ativo: boolean | null
          data_cadastro: string | null
          data_contratacao: string | null
          data_ultima_edicao: string | null
          data_ultimo_pagamento: string | null
          data_vencimento: string | null
          email: string | null
          forma_ultimo_pagamento: string | null
          id: string
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
          telegram: string | null
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
          email?: string | null
          forma_ultimo_pagamento?: string | null
          id?: string
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
          telegram?: string | null
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
          email?: string | null
          forma_ultimo_pagamento?: string | null
          id?: string
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
          telegram?: string | null
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
      m3u_lists: {
        Row: {
          created_at: string | null
          file_url: string
          id: string
          is_default: boolean | null
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_url: string
          id?: string
          is_default?: boolean | null
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_url?: string
          id?: string
          is_default?: boolean | null
          name?: string
          status?: string | null
          updated_at?: string | null
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
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
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
          admin_phone_id: string
          confirmed_at: string | null
          created_at: string | null
          delivery_status: string | null
          error_message: string | null
          escalated: boolean | null
          escalated_at: string | null
          id: string
          security_event_id: string
          sent_at: string
        }
        Insert: {
          admin_phone_id: string
          confirmed_at?: string | null
          created_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          escalated?: boolean | null
          escalated_at?: string | null
          id?: string
          security_event_id: string
          sent_at?: string
        }
        Update: {
          admin_phone_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          escalated?: boolean | null
          escalated_at?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
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
      cleanup_old_metrics: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_auth_uid: { Args: never; Returns: string }
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
    }
    Enums: {
      app_role: "client" | "admin"
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
      app_role: ["client", "admin"],
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
