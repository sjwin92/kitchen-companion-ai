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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      favorite_recipes: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image: string | null
          recipe_id: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image?: string | null
          recipe_id: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image?: string | null
          recipe_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      food_items: {
        Row: {
          created_at: string
          date_added: string
          days_until_expiry: number
          id: string
          location: string
          name: string
          quantity: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          days_until_expiry?: number
          id?: string
          location?: string
          name: string
          quantity?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          days_until_expiry?: number
          id?: string
          location?: string
          name?: string
          quantity?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_log: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          deducted_item_ids: Json
          fat_g: number | null
          id: string
          identified_ingredients: Json
          image_url: string | null
          logged_at: string
          meal_plan_id: string | null
          protein_g: number | null
          title: string
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          deducted_item_ids?: Json
          fat_g?: number | null
          id?: string
          identified_ingredients?: Json
          image_url?: string | null
          logged_at?: string
          meal_plan_id?: string | null
          protein_g?: number | null
          title?: string
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          deducted_item_ids?: Json
          fat_g?: number | null
          id?: string
          identified_ingredients?: Json
          image_url?: string | null
          logged_at?: string
          meal_plan_id?: string | null
          protein_g?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_log_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          image: string | null
          meal_slot: string
          planned_date: string
          recipe_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string | null
          meal_slot?: string
          planned_date: string
          recipe_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image?: string | null
          meal_slot?: string
          planned_date?: string
          recipe_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cooking_time: string | null
          created_at: string
          dietary_preferences: string[] | null
          disliked_ingredients: string[] | null
          display_name: string | null
          household_size: number | null
          id: string
          onboarding_complete: boolean | null
          updated_at: string
        }
        Insert: {
          cooking_time?: string | null
          created_at?: string
          dietary_preferences?: string[] | null
          disliked_ingredients?: string[] | null
          display_name?: string | null
          household_size?: number | null
          id: string
          onboarding_complete?: boolean | null
          updated_at?: string
        }
        Update: {
          cooking_time?: string | null
          created_at?: string
          dietary_preferences?: string[] | null
          disliked_ingredients?: string[] | null
          display_name?: string | null
          household_size?: number | null
          id?: string
          onboarding_complete?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      scan_sessions: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          image_path: string | null
          parsed_items: Json
          raw_output: Json | null
          source_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          image_path?: string | null
          parsed_items?: Json
          raw_output?: Json | null
          source_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          image_path?: string | null
          parsed_items?: Json
          raw_output?: Json | null
          source_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_list: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          name: string
          quantity: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          name: string
          quantity?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          quantity?: string
          user_id?: string
        }
        Relationships: []
      }
      waste_log: {
        Row: {
          id: string
          name: string
          quantity: string
          reason: string
          user_id: string
          wasted_at: string
        }
        Insert: {
          id?: string
          name: string
          quantity?: string
          reason?: string
          user_id: string
          wasted_at?: string
        }
        Update: {
          id?: string
          name?: string
          quantity?: string
          reason?: string
          user_id?: string
          wasted_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
