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
      leveling_processes: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closure_error_mm: number | null
          correction_method: string
          created_at: string
          discrepancy_mm: number | null
          end_bm_code: string | null
          end_bm_elevation: number | null
          forward_error_mm: number | null
          has_return_run: boolean
          id: string
          meets_tolerance: boolean | null
          name: string
          notes: string | null
          project_id: string
          return_error_mm: number | null
          site_id: string
          start_bm_code: string
          start_bm_elevation: number
          status: string
          tolerance_mm: number | null
          total_distance_km: number | null
          type: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closure_error_mm?: number | null
          correction_method?: string
          created_at?: string
          discrepancy_mm?: number | null
          end_bm_code?: string | null
          end_bm_elevation?: number | null
          forward_error_mm?: number | null
          has_return_run?: boolean
          id?: string
          meets_tolerance?: boolean | null
          name: string
          notes?: string | null
          project_id: string
          return_error_mm?: number | null
          site_id: string
          start_bm_code: string
          start_bm_elevation: number
          status?: string
          tolerance_mm?: number | null
          total_distance_km?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closure_error_mm?: number | null
          correction_method?: string
          created_at?: string
          discrepancy_mm?: number | null
          end_bm_code?: string | null
          end_bm_elevation?: number | null
          forward_error_mm?: number | null
          has_return_run?: boolean
          id?: string
          meets_tolerance?: boolean | null
          name?: string
          notes?: string | null
          project_id?: string
          return_error_mm?: number | null
          site_id?: string
          start_bm_code?: string
          start_bm_elevation?: number
          status?: string
          tolerance_mm?: number | null
          total_distance_km?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leveling_processes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leveling_processes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      leveling_readings: {
        Row: {
          backsight: number | null
          correction_applied: number | null
          created_at: string
          distance_accumulated_km: number | null
          distance_m: number | null
          elevation_calculated: number | null
          elevation_corrected: number | null
          foresight: number | null
          has_warnings: boolean
          id: string
          instrument_height: number | null
          point_code: string
          point_type: string
          process_id: string
          reading_order: number
          run_type: string
          warning_messages: Json | null
        }
        Insert: {
          backsight?: number | null
          correction_applied?: number | null
          created_at?: string
          distance_accumulated_km?: number | null
          distance_m?: number | null
          elevation_calculated?: number | null
          elevation_corrected?: number | null
          foresight?: number | null
          has_warnings?: boolean
          id?: string
          instrument_height?: number | null
          point_code: string
          point_type?: string
          process_id: string
          reading_order: number
          run_type?: string
          warning_messages?: Json | null
        }
        Update: {
          backsight?: number | null
          correction_applied?: number | null
          created_at?: string
          distance_accumulated_km?: number | null
          distance_m?: number | null
          elevation_calculated?: number | null
          elevation_corrected?: number | null
          foresight?: number | null
          has_warnings?: boolean
          id?: string
          instrument_height?: number | null
          point_code?: string
          point_type?: string
          process_id?: string
          reading_order?: number
          run_type?: string
          warning_messages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "leveling_readings_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "leveling_processes"
            referencedColumns: ["id"]
          },
        ]
      }
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
          site_id: string
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
          site_id: string
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
          site_id?: string
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
          {
            foreignKeyName: "polygonal_processes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
          demo_seeded_at: string | null
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
          demo_seeded_at?: string | null
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
          demo_seeded_at?: string | null
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
      reports: {
        Row: {
          generated_at: string | null
          generated_by: string
          id: string
          included_processes: Json
          observations: string | null
          project_id: string
          title: string
        }
        Insert: {
          generated_at?: string | null
          generated_by: string
          id?: string
          included_processes: Json
          observations?: string | null
          project_id: string
          title: string
        }
        Update: {
          generated_at?: string | null
          generated_by?: string
          id?: string
          included_processes?: Json
          observations?: string | null
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_points: {
        Row: {
          code: string
          created_at: string
          easting: number | null
          id: string
          initial_elevation: number | null
          location_description: string
          northing: number | null
          site_id: string
        }
        Insert: {
          code: string
          created_at?: string
          easting?: number | null
          id?: string
          initial_elevation?: number | null
          location_description: string
          northing?: number | null
          site_id: string
        }
        Update: {
          code?: string
          created_at?: string
          easting?: number | null
          id?: string
          initial_elevation?: number | null
          location_description?: string
          northing?: number | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_points_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_readings: {
        Row: {
          accumulated_settlement: number | null
          alert_status: string
          created_at: string
          elevation: number
          id: string
          partial_settlement: number | null
          point_id: string
          velocity: number | null
          visit_id: string
        }
        Insert: {
          accumulated_settlement?: number | null
          alert_status?: string
          created_at?: string
          elevation: number
          id?: string
          partial_settlement?: number | null
          point_id: string
          velocity?: number | null
          visit_id: string
        }
        Update: {
          accumulated_settlement?: number | null
          alert_status?: string
          created_at?: string
          elevation?: number
          id?: string
          partial_settlement?: number | null
          point_id?: string
          velocity?: number | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_readings_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "settlement_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_readings_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "settlement_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_visits: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closure_error_mm: number | null
          created_at: string
          date: string
          equipment: string | null
          id: string
          notes: string | null
          operator: string | null
          site_id: string
          status: string
          updated_at: string
          visit_number: number
          weather_conditions: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closure_error_mm?: number | null
          created_at?: string
          date: string
          equipment?: string | null
          id?: string
          notes?: string | null
          operator?: string | null
          site_id: string
          status?: string
          updated_at?: string
          visit_number: number
          weather_conditions?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closure_error_mm?: number | null
          created_at?: string
          date?: string
          equipment?: string | null
          id?: string
          notes?: string | null
          operator?: string | null
          site_id?: string
          status?: string
          updated_at?: string
          visit_number?: number
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_visits_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          accumulated_alarm: number
          accumulated_alert: number
          accumulated_caution: number
          angular_distortion_limit: number
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          status: string
          structure_type: string
          updated_at: string
          velocity_alarm: number
          velocity_alert: number
          velocity_caution: number
        }
        Insert: {
          accumulated_alarm?: number
          accumulated_alert?: number
          accumulated_caution?: number
          angular_distortion_limit?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          status?: string
          structure_type: string
          updated_at?: string
          velocity_alarm?: number
          velocity_alert?: number
          velocity_caution?: number
        }
        Update: {
          accumulated_alarm?: number
          accumulated_alert?: number
          accumulated_caution?: number
          angular_distortion_limit?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          status?: string
          structure_type?: string
          updated_at?: string
          velocity_alarm?: number
          velocity_alert?: number
          velocity_caution?: number
        }
        Relationships: [
          {
            foreignKeyName: "sites_project_id_fkey"
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

