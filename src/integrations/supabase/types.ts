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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          collected_at: string | null
          created_at: string
          customer_name: string | null
          delivered_at: string | null
          delivery_address: string
          delivery_fee: number
          driver_id: string | null
          establishment_id: string
          id: string
          observations: string | null
          prep_time_minutes: number | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          urgency: string
        }
        Insert: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          collected_at?: string | null
          created_at?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_address: string
          delivery_fee: number
          driver_id?: string | null
          establishment_id: string
          id?: string
          observations?: string | null
          prep_time_minutes?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          urgency?: string
        }
        Update: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          collected_at?: string | null
          created_at?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_address?: string
          delivery_fee?: number
          driver_id?: string | null
          establishment_id?: string
          id?: string
          observations?: string | null
          prep_time_minutes?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_offers: {
        Row: {
          created_at: string
          delivery_id: string
          driver_id: string
          id: string
          offered_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["delivery_offer_status"]
        }
        Insert: {
          created_at?: string
          delivery_id: string
          driver_id: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["delivery_offer_status"]
        }
        Update: {
          created_at?: string
          delivery_id?: string
          driver_id?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["delivery_offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_offers_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          blocked_until: string | null
          cpf: string
          created_at: string
          id: string
          is_online: boolean
          phone: string
          plate: string | null
          queue_joined_at: string | null
          updated_at: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          blocked_until?: string | null
          cpf: string
          created_at?: string
          id?: string
          is_online?: boolean
          phone: string
          plate?: string | null
          queue_joined_at?: string | null
          updated_at?: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          blocked_until?: string | null
          cpf?: string
          created_at?: string
          id?: string
          is_online?: boolean
          phone?: string
          plate?: string | null
          queue_joined_at?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      establishments: {
        Row: {
          address: string
          business_name: string
          cnpj: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          phone: string
          responsible_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          business_name: string
          cnpj: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone: string
          responsible_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          business_name?: string
          cnpj?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string
          responsible_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_weekly_reports: {
        Row: {
          created_at: string
          entity_id: string
          entity_name: string
          entity_type: Database["public"]["Enums"]["financial_entity_type"]
          id: string
          net_payout: number
          platform_fee: number
          status: Database["public"]["Enums"]["report_payment_status"]
          total_deliveries: number
          total_value: number
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_name?: string
          entity_type: Database["public"]["Enums"]["financial_entity_type"]
          id?: string
          net_payout?: number
          platform_fee?: number
          status?: Database["public"]["Enums"]["report_payment_status"]
          total_deliveries?: number
          total_value?: number
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_name?: string
          entity_type?: Database["public"]["Enums"]["financial_entity_type"]
          id?: string
          net_payout?: number
          platform_fee?: number
          status?: Database["public"]["Enums"]["report_payment_status"]
          total_deliveries?: number
          total_value?: number
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          delivery_id: string
          from_user_id: string
          id: string
          rating: number
          to_user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          delivery_id: string
          from_user_id: string
          id?: string
          rating: number
          to_user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          delivery_id?: string
          from_user_id?: string
          id?: string
          rating?: number
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_status: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["approval_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_delivery_participant: {
        Args: { _delivery_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "establishment" | "driver"
      approval_status: "pending" | "approved" | "rejected" | "suspended"
      delivery_offer_status: "pending" | "accepted" | "rejected" | "expired"
      delivery_status:
        | "searching"
        | "accepted"
        | "collecting"
        | "delivering"
        | "completed"
        | "cancelled"
      financial_entity_type: "establishment" | "driver"
      report_payment_status: "pending" | "paid"
      vehicle_type: "motorcycle" | "bicycle" | "car"
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
      app_role: ["admin", "establishment", "driver"],
      approval_status: ["pending", "approved", "rejected", "suspended"],
      delivery_offer_status: ["pending", "accepted", "rejected", "expired"],
      delivery_status: [
        "searching",
        "accepted",
        "collecting",
        "delivering",
        "completed",
        "cancelled",
      ],
      financial_entity_type: ["establishment", "driver"],
      report_payment_status: ["pending", "paid"],
      vehicle_type: ["motorcycle", "bicycle", "car"],
    },
  },
} as const
