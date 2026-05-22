export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      polygonal_processes: {
        Row: {
          angle_type: string
          angular_error_seconds: number | null
          closed_at: string | null
          closed_by: string | null
          correction_method: string | null
          created_at: string
          end_azimuth_deg: number | null
          end_azimuth_min: number | null
          end_azimuth_sec: number | null
          end_east: number | null
          end_north: number | null
          end_point_code: string | null
          id: string
          linear_error: number | null
          meets_tolerance: boolean | null
          name: string
          notes: string | null
          perimeter: number | null
          project_id: string
          relative_precision: string | null
          start_azimuth_deg: number | null
          start_azimuth_min: number | null
          start_azimuth_sec: number | null
          start_east: number
          start_north: number
          start_point_code: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          angle_type?: string
          angular_error_seconds?: number | null
          closed_at?: string | null
          closed_by?: string | null
          correction_method?: string | null
          created_at?: string
          end_azimuth_deg?: number | null
          end_azimuth_min?: number | null
          end_azimuth_sec?: number | null
          end_east?: number | null
          end_north?: number | null
          end_point_code?: string | null
          id?: string
          linear_error?: number | null
          meets_tolerance?: boolean | null
          name: string
          notes?: string | null
          perimeter?: number | null
          project_id: string
          relative_precision?: string | null
          start_azimuth_deg?: number | null
          start_azimuth_min?: number | null
          start_azimuth_sec?: number | null
          start_east: number
          start_north: number
          start_point_code: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          angle_type?: string
          angular_error_seconds?: number | null
          closed_at?: string | null
          closed_by?: string | null
          correction_method?: string | null
          created_at?: string
          end_azimuth_deg?: number | null
          end_azimuth_min?: number | null
          end_azimuth_sec?: number | null
          end_east?: number | null
          end_north?: number | null
          end_point_code?: string | null
          id?: string
          linear_error?: number | null
          meets_tolerance?: boolean | null
          name?: string
          notes?: string | null
          perimeter?: number | null
          project_id?: string
          relative_precision?: string | null
          start_azimuth_deg?: number | null
          start_azimuth_min?: number | null
          start_azimuth_sec?: number | null
          start_east?: number
          start_north?: number
          start_point_code?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polygonal_processes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      polygonal_stations: {
        Row: {
          angle_deg: number | null
          angle_min: number | null
          angle_sec: number | null
          azimuth_deg: number | null
          azimuth_min: number | null
          azimuth_sec: number | null
          corrected_angle_deg: number | null
          corrected_angle_min: number | null
          corrected_angle_sec: number | null
          corrected_delta_east: number | null
          corrected_delta_north: number | null
          created_at: string
          deflection_direction: string | null
          delta_east: number | null
          delta_north: number | null
          east: number | null
          has_warnings: boolean
          horizontal_distance: number | null
          id: string
          north: number | null
          point_code: string
          process_id: string
          station_order: number
          warning_messages: Json | null
        }
        Insert: {
          angle_deg?: number | null
          angle_min?: number | null
          angle_sec?: number | null
          azimuth_deg?: number | null
          azimuth_min?: number | null
          azimuth_sec?: number | null
          corrected_angle_deg?: number | null
          corrected_angle_min?: number | null
          corrected_angle_sec?: number | null
          corrected_delta_east?: number | null
          corrected_delta_north?: number | null
          created_at?: string
          deflection_direction?: string | null
          delta_east?: number | null
          delta_north?: number | null
          east?: number | null
          has_warnings?: boolean
          horizontal_distance?: number | null
          id?: string
          north?: number | null
          point_code: string
          process_id: string
          station_order: number
          warning_messages?: Json | null
        }
        Update: {
          angle_deg?: number | null
          angle_min?: number | null
          angle_sec?: number | null
          azimuth_deg?: number | null
          azimuth_min?: number | null
          azimuth_sec?: number | null
          corrected_angle_deg?: number | null
          corrected_angle_min?: number | null
          corrected_angle_sec?: number | null
          corrected_delta_east?: number | null
          corrected_delta_north?: number | null
          created_at?: string
          deflection_direction?: string | null
          delta_east?: number | null
          delta_north?: number | null
          east?: number | null
          has_warnings?: boolean
          horizontal_distance?: number | null
          id?: string
          north?: number | null
          point_code?: string
          process_id?: string
          station_order?: number
          warning_messages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "polygonal_stations_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "polygonal_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          first_name: string
          full_name: string | null
          id: string
          last_name: string
          position: string | null
          professional_license: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          first_name: string
          full_name?: string | null
          id: string
          last_name: string
          position?: string | null
          professional_license?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          first_name?: string
          full_name?: string | null
          id?: string
          last_name?: string
          position?: string | null
          professional_license?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          angular_precision_seconds: number
          client: string
          created_at: string
          datum: string
          description: string | null
          equipment_brand: string
          equipment_calibration_date: string
          equipment_model: string
          equipment_serial: string
          id: string
          latitude: number | null
          linear_precision: string
          location: string
          longitude: number | null
          name: string
          precision_order: string
          projection: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          angular_precision_seconds: number
          client: string
          created_at?: string
          datum?: string
          description?: string | null
          equipment_brand: string
          equipment_calibration_date: string
          equipment_model: string
          equipment_serial: string
          id?: string
          latitude?: number | null
          linear_precision: string
          location: string
          longitude?: number | null
          name: string
          precision_order: string
          projection?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          angular_precision_seconds?: number
          client?: string
          created_at?: string
          datum?: string
          description?: string | null
          equipment_brand?: string
          equipment_calibration_date?: string
          equipment_model?: string
          equipment_serial?: string
          id?: string
          latitude?: number | null
          linear_precision?: string
          location?: string
          longitude?: number | null
          name?: string
          precision_order?: string
          projection?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reference_points: {
        Row: {
          code: string
          created_at: string
          description: string | null
          east: number | null
          elevation: number | null
          id: string
          north: number | null
          project_id: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          east?: number | null
          elevation?: number | null
          id?: string
          north?: number | null
          project_id: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          east?: number | null
          elevation?: number | null
          id?: string
          north?: number | null
          project_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_points_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

