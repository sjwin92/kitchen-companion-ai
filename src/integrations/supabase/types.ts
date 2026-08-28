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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          created_at: string
          expires_at: string
          function_name: string
          id: string
          input_hash: string
          response: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          function_name: string
          id?: string
          input_hash: string
          response: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          function_name?: string
          id?: string
          input_hash?: string
          response?: Json
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          request_count: number
          updated_at: string
          usage_date: string
          usage_kind: string
          user_id: string
        }
        Insert: {
          request_count?: number
          updated_at?: string
          usage_date?: string
          usage_kind: string
          user_id: string
        }
        Update: {
          request_count?: number
          updated_at?: string
          usage_date?: string
          usage_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          actual_cost_gbp: number | null
          capability: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          estimated_cost_gbp: number
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          provider: string
          provider_request_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          actual_cost_gbp?: number | null
          capability: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_gbp?: number
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          provider: string
          provider_request_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actual_cost_gbp?: number | null
          capability?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_gbp?: number
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          provider?: string
          provider_request_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_partnerships: {
        Row: {
          agreement_reference: string | null
          created_at: string
          creator_id: string
          founder_approved_at: string | null
          id: string
          notes: string | null
          permission_confirmed_at: string | null
          public_contact_route: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreement_reference?: string | null
          created_at?: string
          creator_id: string
          founder_approved_at?: string | null
          id?: string
          notes?: string | null
          permission_confirmed_at?: string | null
          public_contact_route?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_reference?: string | null
          created_at?: string
          creator_id?: string
          founder_approved_at?: string | null
          id?: string
          notes?: string | null
          permission_confirmed_at?: string | null
          public_contact_route?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_partnerships_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          review_status: string
          slug: string
          social_links: Json
          updated_at: string
          verified: boolean
          website_url: string | null
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id?: string
          review_status?: string
          slug: string
          social_links?: Json
          updated_at?: string
          verified?: boolean
          website_url?: string | null
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          review_status?: string
          slug?: string
          social_links?: Json
          updated_at?: string
          verified?: boolean
          website_url?: string | null
        }
        Relationships: []
      }
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
          confidence: number | null
          created_at: string
          date_added: string
          days_until_expiry: number
          expiry_date: string | null
          id: string
          lifecycle_state: string
          location: string
          name: string
          provenance: string
          quantity: string
          quantity_value: number | null
          status: string
          unit: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          date_added?: string
          days_until_expiry?: number
          expiry_date?: string | null
          id?: string
          lifecycle_state?: string
          location?: string
          name: string
          provenance?: string
          quantity?: string
          quantity_value?: number | null
          status?: string
          unit?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          confidence?: number | null
          created_at?: string
          date_added?: string
          days_until_expiry?: number
          expiry_date?: string | null
          id?: string
          lifecycle_state?: string
          location?: string
          name?: string
          provenance?: string
          quantity?: string
          quantity_value?: number | null
          status?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      ingredient_aliases: {
        Row: {
          alias: string
          created_at: string
          ingredient_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          ingredient_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          ingredient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
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
      ingredients: {
        Row: {
          canonical_name: string
          created_at: string
          default_aisle: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          default_aisle?: string | null
          display_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          default_aisle?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_events: {
        Row: {
          created_at: string
          event_type: string
          food_item_id: string | null
          id: string
          metadata: Json
          quantity_delta: number | null
          reason: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          food_item_id?: string | null
          id?: string
          metadata?: Json
          quantity_delta?: number | null
          reason?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          food_item_id?: string | null
          id?: string
          metadata?: Json
          quantity_delta?: number | null
          reason?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "current_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
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
          calorie_high: number | null
          calorie_low: number | null
          calories: number | null
          carbs_g: number | null
          carbs_high_g: number | null
          carbs_low_g: number | null
          confidence: number | null
          confirmed_at: string | null
          created_at: string
          deducted_item_ids: Json
          estimate_model: string | null
          fat_g: number | null
          fat_high_g: number | null
          fat_low_g: number | null
          id: string
          identified_ingredients: Json
          image_delete_after: string | null
          image_path: string | null
          image_url: string | null
          logged_at: string
          meal_plan_id: string | null
          notes: string | null
          protein_g: number | null
          protein_high_g: number | null
          protein_low_g: number | null
          provenance: string
          rating: number | null
          source: string | null
          title: string
          user_id: string
        }
        Insert: {
          calorie_high?: number | null
          calorie_low?: number | null
          calories?: number | null
          carbs_g?: number | null
          carbs_high_g?: number | null
          carbs_low_g?: number | null
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          deducted_item_ids?: Json
          estimate_model?: string | null
          fat_g?: number | null
          fat_high_g?: number | null
          fat_low_g?: number | null
          id?: string
          identified_ingredients?: Json
          image_delete_after?: string | null
          image_path?: string | null
          image_url?: string | null
          logged_at?: string
          meal_plan_id?: string | null
          notes?: string | null
          protein_g?: number | null
          protein_high_g?: number | null
          protein_low_g?: number | null
          provenance?: string
          rating?: number | null
          source?: string | null
          title?: string
          user_id: string
        }
        Update: {
          calorie_high?: number | null
          calorie_low?: number | null
          calories?: number | null
          carbs_g?: number | null
          carbs_high_g?: number | null
          carbs_low_g?: number | null
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          deducted_item_ids?: Json
          estimate_model?: string | null
          fat_g?: number | null
          fat_high_g?: number | null
          fat_low_g?: number | null
          id?: string
          identified_ingredients?: Json
          image_delete_after?: string | null
          image_path?: string | null
          image_url?: string | null
          logged_at?: string
          meal_plan_id?: string | null
          notes?: string | null
          protein_g?: number | null
          protein_high_g?: number | null
          protein_low_g?: number | null
          provenance?: string
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
          bulk_servings: number | null
          created_at: string
          id: string
          image: string | null
          inventory_item_id: string | null
          is_leftover_of: string | null
          meal_slot: string
          plan_kind: string
          planned_date: string
          recipe_id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          bulk_servings?: number | null
          created_at?: string
          id?: string
          image?: string | null
          inventory_item_id?: string | null
          is_leftover_of?: string | null
          meal_slot?: string
          plan_kind?: string
          planned_date: string
          recipe_id: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          bulk_servings?: number | null
          created_at?: string
          id?: string
          image?: string | null
          inventory_item_id?: string | null
          is_leftover_of?: string | null
          meal_slot?: string
          plan_kind?: string
          planned_date?: string
          recipe_id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "current_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_is_leftover_of_fkey"
            columns: ["is_leftover_of"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
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
      notification_preferences: {
        Row: {
          expiry_reminders: boolean
          last_expiry_sent_on: string | null
          notify_hour: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expiry_reminders?: boolean
          last_expiry_sent_on?: string | null
          notify_hour?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expiry_reminders?: boolean
          last_expiry_sent_on?: string | null
          notify_hour?: number
          timezone?: string
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
          lunchbox_count: number | null
          max_prep_time: number | null
          monthly_budget_gbp: number | null
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
          lunchbox_count?: number | null
          max_prep_time?: number | null
          monthly_budget_gbp?: number | null
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
          lunchbox_count?: number | null
          max_prep_time?: number | null
          monthly_budget_gbp?: number | null
          onboarding_complete?: boolean | null
          planning_style?: string | null
          preferred_cuisines?: string[] | null
          primary_goal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_error: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_error?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_error?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipt_reconciliations: {
        Row: {
          created_at: string
          id: string
          matched_items: Json
          receipt_date: string | null
          retailer: string | null
          total_gbp: number
          unmatched_items: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          matched_items?: Json
          receipt_date?: string | null
          retailer?: string | null
          total_gbp?: number
          unmatched_items?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          matched_items?: Json
          receipt_date?: string | null
          retailer?: string | null
          total_gbp?: number
          unmatched_items?: Json
          user_id?: string
        }
        Relationships: []
      }
      recipe_book_access: {
        Row: {
          access_source: string
          external_reference: string | null
          granted_at: string
          recipe_book_id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          access_source?: string
          external_reference?: string | null
          granted_at?: string
          recipe_book_id: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          access_source?: string
          external_reference?: string | null
          granted_at?: string
          recipe_book_id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_book_access_recipe_book_id_fkey"
            columns: ["recipe_book_id"]
            isOneToOne: false
            referencedRelation: "recipe_books"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_book_recipes: {
        Row: {
          position: number
          recipe_book_id: string
          recipe_id: string
          section_title: string | null
        }
        Insert: {
          position?: number
          recipe_book_id: string
          recipe_id: string
          section_title?: string | null
        }
        Update: {
          position?: number
          recipe_book_id?: string
          recipe_id?: string
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_book_recipes_recipe_book_id_fkey"
            columns: ["recipe_book_id"]
            isOneToOne: false
            referencedRelation: "recipe_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_book_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_books: {
        Row: {
          access_model: string
          content_version: number
          cover_path: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          published_at: string | null
          review_status: string
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          access_model?: string
          content_version?: number
          cover_path?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          review_status?: string
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          access_model?: string
          content_version?: number
          cover_path?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          review_status?: string
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_books_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          aisle: string | null
          id: string
          ingredient_id: string | null
          name: string
          normalized_name: string
          optional: boolean
          position: number
          preparation: string | null
          quantity: number | null
          recipe_id: string
          unit: string | null
        }
        Insert: {
          aisle?: string | null
          id?: string
          ingredient_id?: string | null
          name: string
          normalized_name: string
          optional?: boolean
          position?: number
          preparation?: string | null
          quantity?: number | null
          recipe_id: string
          unit?: string | null
        }
        Update: {
          aisle?: string | null
          id?: string
          ingredient_id?: string | null
          name?: string
          normalized_name?: string
          optional?: boolean
          position?: number
          preparation?: string | null
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_memory: {
        Row: {
          last_cooked_at: string | null
          last_planned_at: string | null
          last_viewed_at: string | null
          rating: number | null
          recipe_id: string
          times_cooked: number
          times_planned: number
          times_skipped: number
          times_viewed: number
          user_id: string
        }
        Insert: {
          last_cooked_at?: string | null
          last_planned_at?: string | null
          last_viewed_at?: string | null
          rating?: number | null
          recipe_id: string
          times_cooked?: number
          times_planned?: number
          times_skipped?: number
          times_viewed?: number
          user_id: string
        }
        Update: {
          last_cooked_at?: string | null
          last_planned_at?: string | null
          last_viewed_at?: string | null
          rating?: number | null
          recipe_id?: string
          times_cooked?: number
          times_planned?: number
          times_skipped?: number
          times_viewed?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_memory_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_reviews: {
        Row: {
          checklist: Json
          content_version: number
          decision: string
          id: string
          notes: string | null
          recipe_id: string
          reviewed_at: string
          reviewer_user_id: string
        }
        Insert: {
          checklist?: Json
          content_version: number
          decision: string
          id?: string
          notes?: string | null
          recipe_id: string
          reviewed_at?: string
          reviewer_user_id: string
        }
        Update: {
          checklist?: Json
          content_version?: number
          decision?: string
          id?: string
          notes?: string | null
          recipe_id?: string
          reviewed_at?: string
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_reviews_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_submissions: {
        Row: {
          created_at: string
          duplicate_of_recipe_id: string | null
          id: string
          licence_grant: string | null
          promoted_recipe_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          rights_confirmed: boolean
          status: string
          user_id: string
          user_recipe_id: string
        }
        Insert: {
          created_at?: string
          duplicate_of_recipe_id?: string | null
          id?: string
          licence_grant?: string | null
          promoted_recipe_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          rights_confirmed?: boolean
          status?: string
          user_id: string
          user_recipe_id: string
        }
        Update: {
          created_at?: string
          duplicate_of_recipe_id?: string | null
          id?: string
          licence_grant?: string | null
          promoted_recipe_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          rights_confirmed?: boolean
          status?: string
          user_id?: string
          user_recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_submissions_duplicate_of_recipe_id_fkey"
            columns: ["duplicate_of_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_submissions_promoted_recipe_id_fkey"
            columns: ["promoted_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_submissions_user_recipe_id_fkey"
            columns: ["user_recipe_id"]
            isOneToOne: true
            referencedRelation: "user_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          content_version: number
          created_at: string
          created_by: string | null
          id: string
          recipe_id: string
          snapshot: Json
          verification_tier: string
        }
        Insert: {
          content_version: number
          created_at?: string
          created_by?: string | null
          id?: string
          recipe_id: string
          snapshot: Json
          verification_tier: string
        }
        Update: {
          content_version?: number
          created_at?: string
          created_by?: string | null
          id?: string
          recipe_id?: string
          snapshot?: Json
          verification_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          allergen_tags: string[]
          audio_url: string | null
          catalogue_batch: string | null
          content_version: number
          contributor_user_id: string | null
          cook_minutes: number
          created_at: string
          creator_id: string | null
          cuisine_tags: string[]
          dedupe_hash: string | null
          description: string | null
          dietary_tags: string[]
          difficulty: string
          equipment_tags: string[]
          estimated_cost_high_gbp: number | null
          estimated_cost_low_gbp: number | null
          id: string
          image_path: string | null
          instructions: Json
          meal_types: string[]
          media_attribution: Json
          nutrition: Json
          nutrition_provenance: string
          prep_minutes: number
          price_estimate_as_of: string | null
          published_at: string | null
          review_status: string
          rights_basis: string
          rights_notes: string | null
          season_tags: string[]
          servings: number
          slug: string
          source_label: string | null
          source_type: string
          source_url: string | null
          storage_guidance: Json
          swap_guidance: Json
          title: string
          updated_at: string
          verification_tier: string | null
          youtube_url: string | null
        }
        Insert: {
          allergen_tags?: string[]
          audio_url?: string | null
          catalogue_batch?: string | null
          content_version?: number
          contributor_user_id?: string | null
          cook_minutes?: number
          created_at?: string
          creator_id?: string | null
          cuisine_tags?: string[]
          dedupe_hash?: string | null
          description?: string | null
          dietary_tags?: string[]
          difficulty?: string
          equipment_tags?: string[]
          estimated_cost_high_gbp?: number | null
          estimated_cost_low_gbp?: number | null
          id?: string
          image_path?: string | null
          instructions?: Json
          meal_types?: string[]
          media_attribution?: Json
          nutrition?: Json
          nutrition_provenance?: string
          prep_minutes?: number
          price_estimate_as_of?: string | null
          published_at?: string | null
          review_status?: string
          rights_basis?: string
          rights_notes?: string | null
          season_tags?: string[]
          servings?: number
          slug: string
          source_label?: string | null
          source_type?: string
          source_url?: string | null
          storage_guidance?: Json
          swap_guidance?: Json
          title: string
          updated_at?: string
          verification_tier?: string | null
          youtube_url?: string | null
        }
        Update: {
          allergen_tags?: string[]
          audio_url?: string | null
          catalogue_batch?: string | null
          content_version?: number
          contributor_user_id?: string | null
          cook_minutes?: number
          created_at?: string
          creator_id?: string | null
          cuisine_tags?: string[]
          dedupe_hash?: string | null
          description?: string | null
          dietary_tags?: string[]
          difficulty?: string
          equipment_tags?: string[]
          estimated_cost_high_gbp?: number | null
          estimated_cost_low_gbp?: number | null
          id?: string
          image_path?: string | null
          instructions?: Json
          meal_types?: string[]
          media_attribution?: Json
          nutrition?: Json
          nutrition_provenance?: string
          prep_minutes?: number
          price_estimate_as_of?: string | null
          published_at?: string | null
          review_status?: string
          rights_basis?: string
          rights_notes?: string | null
          season_tags?: string[]
          servings?: number
          slug?: string
          source_label?: string | null
          source_type?: string
          source_url?: string | null
          storage_guidance?: Json
          swap_guidance?: Json
          title?: string
          updated_at?: string
          verification_tier?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
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
      user_recipes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          ingredients: Json
          instructions: Json
          nutrition: Json
          provenance: string
          servings: number
          title: string
          updated_at: string
          user_id: string
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          ingredients?: Json
          instructions?: Json
          nutrition?: Json
          provenance?: string
          servings?: number
          title: string
          updated_at?: string
          user_id: string
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          ingredients?: Json
          instructions?: Json
          nutrition?: Json
          provenance?: string
          servings?: number
          title?: string
          updated_at?: string
          user_id?: string
          youtube_url?: string | null
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
      current_inventory: {
        Row: {
          confidence: number | null
          created_at: string | null
          date_added: string | null
          days_until_expiry: number | null
          derived_days_until_expiry: number | null
          expiry_date: string | null
          freshness_state: string | null
          id: string | null
          lifecycle_state: string | null
          location: string | null
          name: string | null
          provenance: string | null
          quantity: string | null
          quantity_value: number | null
          status: string | null
          unit: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          date_added?: string | null
          days_until_expiry?: number | null
          derived_days_until_expiry?: never
          expiry_date?: string | null
          freshness_state?: never
          id?: string | null
          lifecycle_state?: string | null
          location?: string | null
          name?: string | null
          provenance?: string | null
          quantity?: string | null
          quantity_value?: number | null
          status?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          date_added?: string | null
          days_until_expiry?: number | null
          derived_days_until_expiry?: never
          expiry_date?: string | null
          freshness_state?: never
          id?: string | null
          lifecycle_state?: string | null
          location?: string | null
          name?: string | null
          provenance?: string | null
          quantity?: string | null
          quantity_value?: number | null
          status?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      complete_ai_usage: {
        Args: {
          p_actual_cost_gbp?: number
          p_error_code?: string
          p_event_id: string
          p_input_tokens?: number
          p_output_tokens?: number
          p_provider_request_id?: string
          p_status: string
        }
        Returns: undefined
      }
      complete_onboarding: {
        Args: { p_preferences: Json }
        Returns: {
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
          lunchbox_count: number | null
          max_prep_time: number | null
          monthly_budget_gbp: number | null
          onboarding_complete: boolean | null
          planning_style: string | null
          preferred_cuisines: string[] | null
          primary_goal: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_meal_log: {
        Args: {
          p_estimate: Json
          p_image_path?: string
          p_inventory_item_ids?: string[]
          p_meal_plan_id?: string
          p_notes?: string
          p_rating?: number
          p_source?: string
        }
        Returns: string
      }
      consume_ai_quota: {
        Args: { p_usage_kind: string; p_user_id: string }
        Returns: boolean
      }
      create_beta_invite: {
        Args: { p_code: string; p_email: string; p_expires_at: string }
        Returns: string
      }
      edge_promote_recipe_submission: {
        Args: {
          p_reviewer_id: string
          p_reviewer_notes?: string
          p_slug: string
          p_submission_id: string
        }
        Returns: string
      }
      edge_review_catalogue_recipe: {
        Args: {
          p_checklist: Json
          p_decision: string
          p_notes?: string
          p_recipe_id: string
          p_reviewer_id: string
          p_verification_tier?: string
        }
        Returns: {
          allergen_tags: string[]
          audio_url: string | null
          catalogue_batch: string | null
          content_version: number
          contributor_user_id: string | null
          cook_minutes: number
          created_at: string
          creator_id: string | null
          cuisine_tags: string[]
          dedupe_hash: string | null
          description: string | null
          dietary_tags: string[]
          difficulty: string
          equipment_tags: string[]
          estimated_cost_high_gbp: number | null
          estimated_cost_low_gbp: number | null
          id: string
          image_path: string | null
          instructions: Json
          meal_types: string[]
          media_attribution: Json
          nutrition: Json
          nutrition_provenance: string
          prep_minutes: number
          price_estimate_as_of: string | null
          published_at: string | null
          review_status: string
          rights_basis: string
          rights_notes: string | null
          season_tags: string[]
          servings: number
          slug: string
          source_label: string | null
          source_type: string
          source_url: string | null
          storage_guidance: Json
          swap_guidance: Json
          title: string
          updated_at: string
          verification_tier: string | null
          youtube_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      food_freshness: { Args: { p_expiry_date: string }; Returns: string }
      get_ai_budget_status: { Args: never; Returns: Json }
      move_meal_plan: {
        Args: {
          p_plan_id: string
          p_target_date: string
          p_target_slot: string
        }
        Returns: {
          bulk_servings: number | null
          created_at: string
          id: string
          image: string | null
          inventory_item_id: string | null
          is_leftover_of: string | null
          meal_slot: string
          plan_kind: string
          planned_date: string
          recipe_id: string
          status: string
          title: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      move_shopping_items_to_inventory: {
        Args: { p_items: Json }
        Returns: number
      }
      promote_recipe_submission: {
        Args: {
          p_reviewer_notes?: string
          p_slug: string
          p_submission_id: string
        }
        Returns: string
      }
      recommend_catalogue_recipes: {
        Args: {
          p_limit?: number
          p_min_match?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          components: Json
          matched_count: number
          matched_ingredient_ids: string[]
          missing_count: number
          missing_ingredient_ids: string[]
          reasons: string[]
          recipe_id: string
          score: number
        }[]
      }
      reserve_ai_budget: {
        Args: {
          p_capability: string
          p_estimated_cost_gbp: number
          p_model: string
          p_provider: string
          p_user_id: string
        }
        Returns: string
      }
      review_catalogue_recipe: {
        Args: {
          p_checklist: Json
          p_decision: string
          p_notes?: string
          p_recipe_id: string
          p_verification_tier?: string
        }
        Returns: {
          allergen_tags: string[]
          audio_url: string | null
          catalogue_batch: string | null
          content_version: number
          contributor_user_id: string | null
          cook_minutes: number
          created_at: string
          creator_id: string | null
          cuisine_tags: string[]
          dedupe_hash: string | null
          description: string | null
          dietary_tags: string[]
          difficulty: string
          equipment_tags: string[]
          estimated_cost_high_gbp: number | null
          estimated_cost_low_gbp: number | null
          id: string
          image_path: string | null
          instructions: Json
          meal_types: string[]
          media_attribution: Json
          nutrition: Json
          nutrition_provenance: string
          prep_minutes: number
          price_estimate_as_of: string | null
          published_at: string | null
          review_status: string
          rights_basis: string
          rights_notes: string | null
          season_tags: string[]
          servings: number
          slug: string
          source_label: string | null
          source_type: string
          source_url: string | null
          storage_guidance: Json
          swap_guidance: Json
          title: string
          updated_at: string
          verification_tier: string | null
          youtube_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_inventory_item: {
        Args: {
          p_item_id: string
          p_quantity_delta?: number
          p_reason?: string
          p_to_state: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          date_added: string
          days_until_expiry: number
          expiry_date: string | null
          id: string
          lifecycle_state: string
          location: string
          name: string
          provenance: string
          quantity: string
          quantity_value: number | null
          status: string
          unit: string | null
          updated_at: string
          user_id: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "food_items"
          isOneToOne: true
          isSetofReturn: false
        }
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
