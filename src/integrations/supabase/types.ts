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
      campaign_custom_columns: {
        Row: {
          created_at: string
          display_order: number
          formula: string | null
          id: string
          name: string
          organization_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          formula?: string | null
          id?: string
          name: string
          organization_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          formula?: string | null
          id?: string
          name?: string
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_custom_values: {
        Row: {
          campaign_id: string
          column_id: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          campaign_id: string
          column_id: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          campaign_id?: string
          column_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_custom_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "campaign_custom_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget: number | null
          budget_alert_threshold: number | null
          clicks: number | null
          client_id: string | null
          conversions: number | null
          created_at: string
          end_date: string | null
          id: string
          impressions: number | null
          leads: number | null
          name: string
          objective: string
          organization_id: string
          platform: string | null
          project_id: string | null
          spend: number | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          budget_alert_threshold?: number | null
          clicks?: number | null
          client_id?: string | null
          conversions?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          name: string
          objective?: string
          organization_id: string
          platform?: string | null
          project_id?: string | null
          spend?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          budget_alert_threshold?: number | null
          clicks?: number | null
          client_id?: string | null
          conversions?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          name?: string
          objective?: string
          organization_id?: string
          platform?: string | null
          project_id?: string | null
          spend?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sheet_sync_configs: {
        Row: {
          column_mapping: Json
          created_at: string
          created_by: string
          frequency: string
          header_row: number
          id: string
          is_active: boolean
          last_synced_at: string | null
          match_field: string
          name: string
          next_run_at: string | null
          organization_id: string
          range_a1: string
          sheet_name: string
          spreadsheet_id: string
          updated_at: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          created_by: string
          frequency?: string
          header_row?: number
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          match_field?: string
          name?: string
          next_run_at?: string | null
          organization_id: string
          range_a1?: string
          sheet_name?: string
          spreadsheet_id: string
          updated_at?: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          created_by?: string
          frequency?: string
          header_row?: number
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          match_field?: string
          name?: string
          next_run_at?: string | null
          organization_id?: string
          range_a1?: string
          sheet_name?: string
          spreadsheet_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_sheet_sync_logs: {
        Row: {
          clients_created: number | null
          clients_updated: number | null
          config_id: string
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          rows_read: number | null
          status: string
          triggered_by: string
        }
        Insert: {
          clients_created?: number | null
          clients_updated?: number | null
          config_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          rows_read?: number | null
          status: string
          triggered_by?: string
        }
        Update: {
          clients_created?: number | null
          clients_updated?: number | null
          config_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          rows_read?: number | null
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sheet_sync_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "client_sheet_sync_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          budget: number | null
          color: string | null
          created_at: string
          id: string
          industry: string | null
          leads: number | null
          name: string
          organization_id: string
          spend: number | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          color?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          leads?: number | null
          name: string
          organization_id: string
          spend?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          color?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          leads?: number | null
          name?: string
          organization_id?: string
          spend?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      google_ads_campaigns: {
        Row: {
          advertising_channel_type: string | null
          average_cpc_micros: number | null
          campaign_id: string
          campaign_name: string
          clicks: number | null
          conversions: number | null
          conversions_value: number | null
          cost_micros: number | null
          created_at: string
          ctr: number | null
          daily_budget_micros: number | null
          date_range_end: string
          date_range_start: string
          google_account_id: string
          id: string
          impressions: number | null
          last_synced_at: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advertising_channel_type?: string | null
          average_cpc_micros?: number | null
          campaign_id: string
          campaign_name: string
          clicks?: number | null
          conversions?: number | null
          conversions_value?: number | null
          cost_micros?: number | null
          created_at?: string
          ctr?: number | null
          daily_budget_micros?: number | null
          date_range_end: string
          date_range_start: string
          google_account_id: string
          id?: string
          impressions?: number | null
          last_synced_at?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advertising_channel_type?: string | null
          average_cpc_micros?: number | null
          campaign_id?: string
          campaign_name?: string
          clicks?: number | null
          conversions?: number | null
          conversions_value?: number | null
          cost_micros?: number | null
          created_at?: string
          ctr?: number | null
          daily_budget_micros?: number | null
          date_range_end?: string
          date_range_start?: string
          google_account_id?: string
          id?: string
          impressions?: number | null
          last_synced_at?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_ads_sync_log: {
        Row: {
          campaigns_synced: number | null
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          error_message: string | null
          google_account_id: string | null
          id: string
          status: string
          triggered_by: string
          user_id: string
        }
        Insert: {
          campaigns_synced?: number | null
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          google_account_id?: string | null
          id?: string
          status: string
          triggered_by?: string
          user_id: string
        }
        Update: {
          campaigns_synced?: number | null
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          google_account_id?: string | null
          id?: string
          status?: string
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_ads_campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string
          campaign_type: string | null
          clicks: number | null
          conversion_value_in_local_currency: number | null
          conversions: number | null
          cost_in_local_currency: number | null
          created_at: string
          ctr: number | null
          currency_code: string | null
          daily_budget_amount: number | null
          date_range_end: string
          date_range_start: string
          id: string
          impressions: number | null
          last_synced_at: string
          linkedin_account_id: string
          status: string | null
          total_budget_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          campaign_type?: string | null
          clicks?: number | null
          conversion_value_in_local_currency?: number | null
          conversions?: number | null
          cost_in_local_currency?: number | null
          created_at?: string
          ctr?: number | null
          currency_code?: string | null
          daily_budget_amount?: number | null
          date_range_end: string
          date_range_start: string
          id?: string
          impressions?: number | null
          last_synced_at?: string
          linkedin_account_id: string
          status?: string | null
          total_budget_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          campaign_type?: string | null
          clicks?: number | null
          conversion_value_in_local_currency?: number | null
          conversions?: number | null
          cost_in_local_currency?: number | null
          created_at?: string
          ctr?: number | null
          currency_code?: string | null
          daily_budget_amount?: number | null
          date_range_end?: string
          date_range_start?: string
          id?: string
          impressions?: number | null
          last_synced_at?: string
          linkedin_account_id?: string
          status?: string | null
          total_budget_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_ads_sync_log: {
        Row: {
          campaigns_synced: number | null
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          error_message: string | null
          id: string
          linkedin_account_id: string | null
          status: string
          triggered_by: string
          user_id: string
        }
        Insert: {
          campaigns_synced?: number | null
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          id?: string
          linkedin_account_id?: string | null
          status: string
          triggered_by?: string
          user_id: string
        }
        Update: {
          campaigns_synced?: number | null
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          id?: string
          linkedin_account_id?: string | null
          status?: string
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          payment_status: string
          plan: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          payment_status?: string
          plan?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          payment_status?: string
          plan?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_frozen: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_frozen?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_frozen?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          organization_id: string
          spend: number | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          spend?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          spend?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          organization_id: string | null
          source: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string | null
          source?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string | null
          source?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          conversation_id: string | null
          created_at: string
          email: string
          email_error: string | null
          email_sent: boolean
          id: string
          message: string
          name: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          email: string
          email_error?: string | null
          email_sent?: boolean
          id?: string
          message: string
          name?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          email?: string
          email_error?: string | null
          email_sent?: boolean
          id?: string
          message?: string
          name?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee: string | null
          campaign_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token_encrypted: string | null
          account_id: string | null
          account_name: string | null
          created_at: string
          id: string
          is_connected: boolean
          provider: string
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          provider: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          provider?: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
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
      organization_invitations_safe: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          organization_id: string | null
          role: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          organization_id?: string | null
          role?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          organization_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations_safe: {
        Row: {
          account_id: string | null
          account_name: string | null
          created_at: string | null
          id: string | null
          is_connected: boolean | null
          provider: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string | null
          id?: string | null
          is_connected?: boolean | null
          provider?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string | null
          id?: string | null
          is_connected?: boolean | null
          provider?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      admin_delete_user_data: {
        Args: { _target_user_id: string }
        Returns: Json
      }
      admin_get_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_frozen: boolean
          organizations: Json
          user_id: string
        }[]
      }
      admin_manage_user: {
        Args: { _action: string; _org_id?: string; _target_user_id: string }
        Returns: Json
      }
      approve_member: { Args: { _member_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_cron_service_role_key: { Args: never; Returns: string }
      get_effective_plan: {
        Args: { _user_id: string }
        Returns: {
          has_access: boolean
          payment_status: string
          period_end: string
          plan: string
        }[]
      }
      get_integration_tokens: {
        Args: { _provider: string; _user_id: string }
        Returns: {
          access_token: string
          account_id: string
          account_name: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
      get_integrations_encryption_key: { Args: never; Returns: string }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          id: string
          invited_by_name: string
          organization_id: string
          organization_name: string
          role: string
        }[]
      }
      get_my_memberships: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          role: string
          status: string
        }[]
      }
      get_org_members_with_details: {
        Args: { _org_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          joined_at: string
          member_id: string
          role: string
          status: string
          user_id: string
        }[]
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_public_email_domain: { Args: { _domain: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_pending_members: {
        Args: { _org_id: string }
        Returns: {
          email: string
          full_name: string
          member_id: string
          requested_at: string
          role: string
          user_id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reject_member: { Args: { _member_id: string }; Returns: Json }
      seed_cron_service_role_key: { Args: { _key: string }; Returns: undefined }
      set_integration_tokens: {
        Args: {
          _access_token: string
          _account_id: string
          _account_name: string
          _provider: string
          _refresh_token: string
          _token_expires_at: string
          _user_id: string
        }
        Returns: undefined
      }
      transfer_org_ownership: {
        Args: { _new_owner_user_id: string; _org_id: string }
        Returns: Json
      }
      trigger_google_ads_auto_sync: { Args: never; Returns: undefined }
      trigger_linkedin_ads_auto_sync: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin"
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
      app_role: ["super_admin"],
    },
  },
} as const
