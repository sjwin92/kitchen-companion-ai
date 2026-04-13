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
          expiry_date: string | null
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
          expiry_date?: string | null
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
          expiry_date?: string | null
          id?: string
          location?: string
          name?: string
          quantity?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredient_prices: {
        Row: {
          estimated_price_gbp: number
          id: string
          ingredient_name: string
          last_updated: string
          retailer: string | null
          retailer_product_id: string | null
          retailer_product_url: string | null
          unit: string
        }
        Insert: {
          estimated_price_gbp?: number
          id?: string
          ingredient_name: string
          last_updated?: string
          retailer?: string | null
          retailer_product_id?: string | null
          retailer_product_url?: string | null
          unit?: string
        }
        Update: {
          estimated_price_gbp?: number
          id?: string
          ingredient_name?: string
          last_updated?: string
          retailer?: string | null
          retailer_product_id?: string | null
          retailer_product_url?: string | null
          unit?: string
        }
        Relationships: []
      }
      meal_feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          meal_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          meal_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          meal_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_feedback_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal_library"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_library: {
        Row: {
          avg_rating: number | null
          category: string | null
          content_score: number | null
          content_status: string | null
          created_at: string
          cuisine: string | null
          description: string | null
          dietary_tags: string[]
          effort_level: string | null
          external_recipe_id: string | null
          generation_context: Json | null
          id: string
          image: string | null
          ingredients: Json
          instructions: string | null
          is_promoted: boolean
          last_cooked_at: string | null
          last_planned_at: string | null
          lifecycle_status: string
          media_prompt: string | null
          missing_ingredients: Json
          nutrition: Json | null
          original_user_id: string | null
          prep_time: string | null
          promotion_score: number
          quality_score: number
          recommendation_reason: string | null
          script_seed: string | null
          source: string
          substitutions: Json
          times_cooked: number
          times_planned: number
          times_skipped: number
          times_viewed: number
          title: string
          updated_at: string
          use_soon_items_used: string[]
          user_id: string
          video_queue_status: string | null
          youtube_ready: boolean | null
        }
        Insert: {
          avg_rating?: number | null
          category?: string | null
          content_score?: number | null
          content_status?: string | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          dietary_tags?: string[]
          effort_level?: string | null
          external_recipe_id?: string | null
          generation_context?: Json | null
          id?: string
          image?: string | null
          ingredients?: Json
          instructions?: string | null
          is_promoted?: boolean
          last_cooked_at?: string | null
          last_planned_at?: string | null
          lifecycle_status?: string
          media_prompt?: string | null
          missing_ingredients?: Json
          nutrition?: Json | null
          original_user_id?: string | null
          prep_time?: string | null
          promotion_score?: number
          quality_score?: number
          recommendation_reason?: string | null
          script_seed?: string | null
          source?: string
          substitutions?: Json
          times_cooked?: number
          times_planned?: number
          times_skipped?: number
          times_viewed?: number
          title: string
          updated_at?: string
          use_soon_items_used?: string[]
          user_id: string
          video_queue_status?: string | null
          youtube_ready?: boolean | null
        }
        Update: {
          avg_rating?: number | null
          category?: string | null
          content_score?: number | null
          content_status?: string | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          dietary_tags?: string[]
          effort_level?: string | null
          external_recipe_id?: string | null
          generation_context?: Json | null
          id?: string
          image?: string | null
          ingredients?: Json
          instructions?: string | null
          is_promoted?: boolean
          last_cooked_at?: string | null
          last_planned_at?: string | null
          lifecycle_status?: string
          media_prompt?: string | null
          missing_ingredients?: Json
          nutrition?: Json | null
          original_user_id?: string | null
          prep_time?: string | null
          promotion_score?: number
          quality_score?: number
          recommendation_reason?: string | null
          script_seed?: string | null
          source?: string
          substitutions?: Json
          times_cooked?: number
          times_planned?: number
          times_skipped?: number
          times_viewed?: number
          title?: string
          updated_at?: string
          use_soon_items_used?: string[]
          user_id?: string
          video_queue_status?: string | null
          youtube_ready?: boolean | null
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
          notes: string | null
          protein_g: number | null
          rating: number | null
          source: string | null
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
          notes?: string | null
          protein_g?: number | null
          rating?: number | null
          source?: string | null
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
          notes?: string | null
          protein_g?: number | null
          rating?: number | null
          source?: string | null
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
          status: string
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
          status?: string
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
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_ratings: {
        Row: {
          created_at: string
          id: string
          meal_plan_id: string | null
          meal_slot: string | null
          notes: string | null
          rating: number
          recipe_id: string
          title: string
          user_id: string
          would_repeat: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          meal_plan_id?: string | null
          meal_slot?: string | null
          notes?: string | null
          rating: number
          recipe_id: string
          title: string
          user_id: string
          would_repeat?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          meal_plan_id?: string | null
          meal_slot?: string | null
          notes?: string | null
          rating?: number
          recipe_id?: string
          title?: string
          user_id?: string
          would_repeat?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_ratings_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_slot_settings: {
        Row: {
          budget_friendly_bias: boolean | null
          complexity: string | null
          created_at: string
          cuisine_preference: string | null
          family_friendly_bias: boolean | null
          id: string
          pantry_first_bias: boolean | null
          quick_bias: boolean | null
          servings: number | null
          slot: string
          target_prep_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_friendly_bias?: boolean | null
          complexity?: string | null
          created_at?: string
          cuisine_preference?: string | null
          family_friendly_bias?: boolean | null
          id?: string
          pantry_first_bias?: boolean | null
          quick_bias?: boolean | null
          servings?: number | null
          slot?: string
          target_prep_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_friendly_bias?: boolean | null
          complexity?: string | null
          created_at?: string
          cuisine_preference?: string | null
          family_friendly_bias?: boolean | null
          id?: string
          pantry_first_bias?: boolean | null
          quick_bias?: boolean | null
          servings?: number | null
          slot?: string
          target_prep_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string[] | null
          budget_sensitivity: string | null
          cooking_confidence: string | null
          cooking_time: string | null
          created_at: string
          daily_calorie_goal: number | null
          dietary_preferences: string[] | null
          disliked_ingredients: string[] | null
          display_name: string | null
          household_size: number | null
          id: string
          onboarding_complete: boolean | null
          planning_style: string | null
          preferred_cuisines: string[] | null
          primary_goal: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string[] | null
          budget_sensitivity?: string | null
          cooking_confidence?: string | null
          cooking_time?: string | null
          created_at?: string
          daily_calorie_goal?: number | null
          dietary_preferences?: string[] | null
          disliked_ingredients?: string[] | null
          display_name?: string | null
          household_size?: number | null
          id: string
          onboarding_complete?: boolean | null
          planning_style?: string | null
          preferred_cuisines?: string[] | null
          primary_goal?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string[] | null
          budget_sensitivity?: string | null
          cooking_confidence?: string | null
          cooking_time?: string | null
          created_at?: string
          daily_calorie_goal?: number | null
          dietary_preferences?: string[] | null
          disliked_ingredients?: string[] | null
          display_name?: string | null
          household_size?: number | null
          id?: string
          onboarding_complete?: boolean | null
          planning_style?: string | null
          preferred_cuisines?: string[] | null
          primary_goal?: string | null
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
      staple_meals: {
        Row: {
          category: string | null
          created_at: string
          frequency_hint: string | null
          id: string
          image: string | null
          meal_slot: string | null
          notes: string | null
          recipe_id: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          frequency_hint?: string | null
          id?: string
          image?: string | null
          meal_slot?: string | null
          notes?: string | null
          recipe_id: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          frequency_hint?: string | null
          id?: string
          image?: string | null
          meal_slot?: string | null
          notes?: string | null
          recipe_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meal_plan_id: string | null
          metadata: Json | null
          recipe_id: string | null
          recipe_title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meal_plan_id?: string | null
          metadata?: Json | null
          recipe_id?: string | null
          recipe_title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meal_plan_id?: string | null
          metadata?: Json | null
          recipe_id?: string | null
          recipe_title?: string | null
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
      recalculate_meal_scores: {
        Args: { p_meal_id: string }
        Returns: undefined
      }
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
