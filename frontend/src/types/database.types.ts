export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      alerts: {
        Row: {
          id: string
          device_id: string | null
          camera_id: string | null
          timestamp: string
          received_at: string | null
          detection_count: number | null
          has_evidence: boolean | null
          evidence_path: string | null
          raw_payload: Json | null
          processed: boolean | null
        }
        Insert: {
          id?: string
          device_id?: string | null
          camera_id?: string | null
          timestamp: string
          received_at?: string | null
          detection_count?: number | null
          has_evidence?: boolean | null
          evidence_path?: string | null
          raw_payload?: Json | null
          processed?: boolean | null
        }
        Update: {
          id?: string
          device_id?: string | null
          camera_id?: string | null
          timestamp?: string
          received_at?: string | null
          detection_count?: number | null
          has_evidence?: boolean | null
          evidence_path?: string | null
          raw_payload?: Json | null
          processed?: boolean | null
        }
      }
      devices: {
        Row: {
          id: string
          device_id: string
          name: string | null
          location: string | null
          coordinates: unknown | null
          auth_user_id: string | null
          is_online: boolean | null
          last_seen_at: string | null
          created_at: string | null
          settings_version: string | null
        }
        Insert: {
          id?: string
          device_id: string
          name?: string | null
          location?: string | null
          coordinates?: unknown | null
          auth_user_id?: string | null
          is_online?: boolean | null
          last_seen_at?: string | null
          created_at?: string | null
          settings_version?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          name?: string | null
          location?: string | null
          coordinates?: unknown | null
          auth_user_id?: string | null
          is_online?: boolean | null
          last_seen_at?: string | null
          created_at?: string | null
          settings_version?: string | null
        }
      }
      cameras: {
        Row: {
          id: string
          device_id: string | null
          camera_id: string
          name: string | null
          source_url: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          device_id?: string | null
          camera_id: string
          name?: string | null
          source_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string | null
          camera_id?: string
          name?: string | null
          source_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
      }
      detections: {
        Row: {
          id: string
          alert_id: string | null
          feature: string
          class_id: number | null
          class_name: string | null
          confidence: number | null
          bbox_xyxy: number[] | null
          tracker_id: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          alert_id?: string | null
          feature: string
          class_id?: number | null
          class_name?: string | null
          confidence?: number | null
          bbox_xyxy?: number[] | null
          tracker_id?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          alert_id?: string | null
          feature?: string
          class_id?: number | null
          class_name?: string | null
          confidence?: number | null
          bbox_xyxy?: number[] | null
          tracker_id?: number | null
          created_at?: string | null
        }
      }
    }
  }
}
