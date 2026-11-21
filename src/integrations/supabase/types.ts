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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          paid_at: string | null
        }
        Insert: {
          amount: number
          category?: string
          company_id: string
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_accounts: {
        Row: {
          company_id: string
          external_account_id: string | null
          id: string
          last_sync_at: string | null
          nickname: string | null
          provider: string
          status: string
        }
        Insert: {
          company_id: string
          external_account_id?: string | null
          id?: string
          last_sync_at?: string | null
          nickname?: string | null
          provider?: string
          status?: string
        }
        Update: {
          company_id?: string
          external_account_id?: string | null
          id?: string
          last_sync_at?: string | null
          nickname?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_tokens: {
        Row: {
          access_token: string
          account_id: string
          expires_at: string
          refresh_token: string
        }
        Insert: {
          access_token: string
          account_id: string
          expires_at: string
          refresh_token: string
        }
        Update: {
          access_token?: string
          account_id?: string
          expires_at?: string
          refresh_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          packaging_snapshot: number | null
          product_id: string | null
          quantity: number
          transport_snapshot: number | null
          unit_cost_snapshot: number | null
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          packaging_snapshot?: number | null
          product_id?: string | null
          quantity: number
          transport_snapshot?: number | null
          unit_cost_snapshot?: number | null
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          packaging_snapshot?: number | null
          product_id?: string | null
          quantity?: number
          transport_snapshot?: number | null
          unit_cost_snapshot?: number | null
          unit_price?: number
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          external_order_id: string | null
          gross_amount: number
          id: string
          marketplace_account_id: string | null
          marketplace_fees: number | null
          ordered_at: string | null
          shipping_cost: number | null
          status: string
        }
        Insert: {
          company_id: string
          external_order_id?: string | null
          gross_amount?: number
          id?: string
          marketplace_account_id?: string | null
          marketplace_fees?: number | null
          ordered_at?: string | null
          shipping_cost?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          external_order_id?: string | null
          gross_amount?: number
          id?: string
          marketplace_account_id?: string | null
          marketplace_fees?: number | null
          ordered_at?: string | null
          shipping_cost?: number | null
          status?: string
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
            foreignKeyName: "orders_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_quantity: number | null
          company_id: string
          created_at: string | null
          id: string
          marketplace_item_id: string | null
          packaging_cost: number | null
          permalink: string | null
          price: number | null
          purchase_cost: number | null
          sku: string | null
          sold_quantity: number | null
          status: string | null
          thumbnail: string | null
          title: string
          transport_cost: number | null
        }
        Insert: {
          available_quantity?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          marketplace_item_id?: string | null
          packaging_cost?: number | null
          permalink?: string | null
          price?: number | null
          purchase_cost?: number | null
          sku?: string | null
          sold_quantity?: number | null
          status?: string | null
          thumbnail?: string | null
          title: string
          transport_cost?: number | null
        }
        Update: {
          available_quantity?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          marketplace_item_id?: string | null
          packaging_cost?: number | null
          permalink?: string | null
          price?: number | null
          purchase_cost?: number | null
          sku?: string | null
          sold_quantity?: number | null
          status?: string | null
          thumbnail?: string | null
          title?: string
          transport_cost?: number | null
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
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company: { Args: { company_name: string }; Returns: string }
      is_company_member: { Args: { cid: string }; Returns: boolean }
      is_company_owner: { Args: { cid: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
