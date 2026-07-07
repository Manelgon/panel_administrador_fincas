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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: number | null
          entity_name: string | null
          entity_type: string
          id: number
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: number | null
          entity_name?: string | null
          entity_type: string
          id?: number
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: number | null
          entity_name?: string | null
          entity_type?: string
          id?: number
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          id: string
          reason: string | null
          scope: string
          type_restriction: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          id?: string
          reason?: string | null
          scope?: string
          type_restriction?: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          id?: string
          reason?: string | null
          scope?: string
          type_restriction?: string
        }
        Relationships: []
      }
      chat_temporal: {
        Row: {
          created_at: string
          id: number
          message: Json
          sender: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          message: Json
          sender?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          message?: Json
          sender?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      comunidades: {
        Row: {
          activo: boolean
          cif: string | null
          ciudad: string | null
          codigo: string
          cp: string | null
          created_at: string
          direccion: string | null
          id: number
          nombre_cdad: string
          provincia: string | null
          tipo: string
        }
        Insert: {
          activo?: boolean
          cif?: string | null
          ciudad?: string | null
          codigo: string
          cp?: string | null
          created_at?: string
          direccion?: string | null
          id?: number
          nombre_cdad: string
          provincia?: string | null
          tipo?: string
        }
        Update: {
          activo?: boolean
          cif?: string | null
          ciudad?: string | null
          codigo?: string
          cp?: string | null
          created_at?: string
          direccion?: string | null
          id?: number
          nombre_cdad?: string
          provincia?: string | null
          tipo?: string
        }
        Relationships: []
      }
      doc_submissions: {
        Row: {
          created_at: string
          doc_key: string
          id: number
          invoice_number: string | null
          payload: Json
          pdf_path: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_key: string
          id?: number
          invoice_number?: string | null
          payload: Json
          pdf_path: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_key?: string
          id?: number
          invoice_number?: string | null
          payload?: Json
          pdf_path?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      document_settings: {
        Row: {
          doc_key: string
          id: number
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          doc_key: string
          id?: number
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          doc_key?: string
          id?: number
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_reports: {
        Row: {
          community_id: string
          community_name: string
          created_at: string
          emails_count: number
          id: string
          pdf_path: string
          period_end: string
          period_start: string
          title: string
        }
        Insert: {
          community_id: string
          community_name: string
          created_at?: string
          emails_count: number
          id?: string
          pdf_path: string
          period_end: string
          period_start: string
          title: string
        }
        Update: {
          community_id?: string
          community_name?: string
          created_at?: string
          emails_count?: number
          id?: string
          pdf_path?: string
          period_end?: string
          period_start?: string
          title?: string
        }
        Relationships: []
      }
      empleado_comunidad: {
        Row: {
          comunidad_id: number
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          comunidad_id: number
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          comunidad_id?: number
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_comunidad_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_comunidad_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fichaje_settings: {
        Row: {
          auto_close_enabled: boolean
          daily_execution_hour: number | null
          id: number
          max_hours_duration: number
          max_minutes_duration: number
          updated_at: string | null
        }
        Insert: {
          auto_close_enabled?: boolean
          daily_execution_hour?: number | null
          id?: number
          max_hours_duration?: number
          max_minutes_duration?: number
          updated_at?: string | null
        }
        Update: {
          auto_close_enabled?: boolean
          daily_execution_hour?: number | null
          id?: number
          max_hours_duration?: number
          max_minutes_duration?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      incidencias: {
        Row: {
          adjuntos: string[] | null
          aviso: number | null
          aviso_proveedor: number | null
          categoria: string | null
          comunidad_id: number
          created_at: string
          dia_resuelto: string | null
          email: string | null
          estado: string | null
          fecha_recordatorio: string | null
          gestor_asignado: string | null
          id: number
          id_email_gestion: string | null
          mensaje: string
          motivo_ticket: string | null
          nombre_cliente: string | null
          nota_gestor: string | null
          nota_propietario: string | null
          proveedor_id: number | null
          quien_lo_recibe: string | null
          resuelto: boolean
          resuelto_por: string | null
          sentimiento: string | null
          source: string | null
          telefono: string | null
          todas_notas_propietario: string | null
          urgencia: string | null
        }
        Insert: {
          adjuntos?: string[] | null
          aviso?: number | null
          aviso_proveedor?: number | null
          categoria?: string | null
          comunidad_id: number
          created_at?: string
          dia_resuelto?: string | null
          email?: string | null
          estado?: string | null
          fecha_recordatorio?: string | null
          gestor_asignado?: string | null
          id?: number
          id_email_gestion?: string | null
          mensaje: string
          motivo_ticket?: string | null
          nombre_cliente?: string | null
          nota_gestor?: string | null
          nota_propietario?: string | null
          proveedor_id?: number | null
          quien_lo_recibe?: string | null
          resuelto?: boolean
          resuelto_por?: string | null
          sentimiento?: string | null
          source?: string | null
          telefono?: string | null
          todas_notas_propietario?: string | null
          urgencia?: string | null
        }
        Update: {
          adjuntos?: string[] | null
          aviso?: number | null
          aviso_proveedor?: number | null
          categoria?: string | null
          comunidad_id?: number
          created_at?: string
          dia_resuelto?: string | null
          email?: string | null
          estado?: string | null
          fecha_recordatorio?: string | null
          gestor_asignado?: string | null
          id?: number
          id_email_gestion?: string | null
          mensaje?: string
          motivo_ticket?: string | null
          nombre_cliente?: string | null
          nota_gestor?: string | null
          nota_propietario?: string | null
          proveedor_id?: number | null
          quien_lo_recibe?: string | null
          resuelto?: boolean
          resuelto_por?: string | null
          sentimiento?: string | null
          source?: string | null
          telefono?: string | null
          todas_notas_propietario?: string | null
          urgencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_gestor_asignado_fkey"
            columns: ["gestor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "incidencias_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_quien_lo_recibe_fkey"
            columns: ["quien_lo_recibe"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "incidencias_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      incidencias_serincobot: {
        Row: {
          adjuntos: string[] | null
          aviso: string | null
          categoria: string | null
          codigo: string | null
          comunidad: string | null
          comunidad_id: number | null
          created_at: string
          dia_resuelto: string | null
          email: string | null
          estado: string | null
          fecha_recordatorio: string | null
          gestor_asignado: string | null
          id: number
          id_email_gestion: string | null
          mensaje: string | null
          motivo_ticket: string | null
          nombre_cliente: string | null
          nota_gestor: string | null
          nota_propietario: string | null
          quien_lo_recibe: string | null
          resuelto: boolean
          resuelto_por: string | null
          sentimiento: string | null
          source: string | null
          telefono: string | null
          timestamp: string | null
          todas_notas_propietario: string | null
          urgencia: string | null
        }
        Insert: {
          adjuntos?: string[] | null
          aviso?: string | null
          categoria?: string | null
          codigo?: string | null
          comunidad?: string | null
          comunidad_id?: number | null
          created_at?: string
          dia_resuelto?: string | null
          email?: string | null
          estado?: string | null
          fecha_recordatorio?: string | null
          gestor_asignado?: string | null
          id?: number
          id_email_gestion?: string | null
          mensaje?: string | null
          motivo_ticket?: string | null
          nombre_cliente?: string | null
          nota_gestor?: string | null
          nota_propietario?: string | null
          quien_lo_recibe?: string | null
          resuelto?: boolean
          resuelto_por?: string | null
          sentimiento?: string | null
          source?: string | null
          telefono?: string | null
          timestamp?: string | null
          todas_notas_propietario?: string | null
          urgencia?: string | null
        }
        Update: {
          adjuntos?: string[] | null
          aviso?: string | null
          categoria?: string | null
          codigo?: string | null
          comunidad?: string | null
          comunidad_id?: number | null
          created_at?: string
          dia_resuelto?: string | null
          email?: string | null
          estado?: string | null
          fecha_recordatorio?: string | null
          gestor_asignado?: string | null
          id?: number
          id_email_gestion?: string | null
          mensaje?: string | null
          motivo_ticket?: string | null
          nombre_cliente?: string | null
          nota_gestor?: string | null
          nota_propietario?: string | null
          quien_lo_recibe?: string | null
          resuelto?: boolean
          resuelto_por?: string | null
          sentimiento?: string | null
          source?: string | null
          telefono?: string | null
          timestamp?: string | null
          todas_notas_propietario?: string | null
          urgencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_serincobot_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_serincobot_gestor_asignado_fkey"
            columns: ["gestor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "incidencias_serincobot_quien_lo_recibe_fkey"
            columns: ["quien_lo_recibe"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "incidencias_serincobot_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          current_value: number
          id: string
          updated_at: string
        }
        Insert: {
          current_value?: number
          id: string
          updated_at?: string
        }
        Update: {
          current_value?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      "MIGRATION BBDD": {
        Row: {
          categoria: string | null
          comunidad: string | null
          dia_resuelto: string | null
          email: string | null
          gestor_asignado: string | null
          id: number
          mensaje: string | null
          nombre_cliente: string | null
          quien_lo_recibe: string | null
          resuelto: boolean | null
          sentimiento: string | null
          telefono: string | null
          timestamp: string | null
          urgencia: string | null
        }
        Insert: {
          categoria?: string | null
          comunidad?: string | null
          dia_resuelto?: string | null
          email?: string | null
          gestor_asignado?: string | null
          id: number
          mensaje?: string | null
          nombre_cliente?: string | null
          quien_lo_recibe?: string | null
          resuelto?: boolean | null
          sentimiento?: string | null
          telefono?: string | null
          timestamp?: string | null
          urgencia?: string | null
        }
        Update: {
          categoria?: string | null
          comunidad?: string | null
          dia_resuelto?: string | null
          email?: string | null
          gestor_asignado?: string | null
          id?: number
          mensaje?: string | null
          nombre_cliente?: string | null
          quien_lo_recibe?: string | null
          resuelto?: boolean | null
          sentimiento?: string | null
          telefono?: string | null
          timestamp?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      morosidad: {
        Row: {
          apellidos: string | null
          aviso: number | null
          comunidad_id: number
          created_at: string
          documento: string | null
          email_deudor: string | null
          estado: string | null
          fecha_notificacion: string | null
          fecha_pago: string | null
          fecha_resuelto: string | null
          gestor: string | null
          id: number
          id_email_deuda: string | null
          importe: number
          nombre_deudor: string
          observaciones: string | null
          ref: string | null
          resuelto_por: string | null
          subtipo_disputa: string | null
          telefono_deudor: string | null
          titulo_documento: string
        }
        Insert: {
          apellidos?: string | null
          aviso?: number | null
          comunidad_id: number
          created_at?: string
          documento?: string | null
          email_deudor?: string | null
          estado?: string | null
          fecha_notificacion?: string | null
          fecha_pago?: string | null
          fecha_resuelto?: string | null
          gestor?: string | null
          id?: number
          id_email_deuda?: string | null
          importe: number
          nombre_deudor: string
          observaciones?: string | null
          ref?: string | null
          resuelto_por?: string | null
          subtipo_disputa?: string | null
          telefono_deudor?: string | null
          titulo_documento: string
        }
        Update: {
          apellidos?: string | null
          aviso?: number | null
          comunidad_id?: number
          created_at?: string
          documento?: string | null
          email_deudor?: string | null
          estado?: string | null
          fecha_notificacion?: string | null
          fecha_pago?: string | null
          fecha_resuelto?: string | null
          gestor?: string | null
          id?: number
          id_email_deuda?: string | null
          importe?: number
          nombre_deudor?: string
          observaciones?: string | null
          ref?: string | null
          resuelto_por?: string | null
          subtipo_disputa?: string | null
          telefono_deudor?: string | null
          titulo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "morosidad_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "morosidad_gestor_fkey"
            columns: ["gestor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "morosidad_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      n8n_chat_temporal_ai: {
        Row: {
          created_at: string | null
          id: number
          message: Json | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          message?: Json | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          message?: Json | null
          session_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: number | null
          entity_type: string | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: number | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: number | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          nombre: string
          rol: Database["public"]["Enums"]["user_role"]
          telefono: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean
          apellido?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          nombre: string
          rol?: Database["public"]["Enums"]["user_role"]
          telefono?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean
          apellido?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          nombre?: string
          rol?: Database["public"]["Enums"]["user_role"]
          telefono?: string | null
          user_id?: string
        }
        Relationships: []
      }
      propietarios: {
        Row: {
          apellid_cliente: string | null
          codigo_comunidad: string | null
          comunidad: string | null
          contestacion: boolean | null
          created_at: string
          direccion_postal: string | null
          id: number
          id_comunidad: number | null
          mail: string | null
          nombre_cliente: string | null
          telefono: string | null
        }
        Insert: {
          apellid_cliente?: string | null
          codigo_comunidad?: string | null
          comunidad?: string | null
          contestacion?: boolean | null
          created_at?: string
          direccion_postal?: string | null
          id?: number
          id_comunidad?: number | null
          mail?: string | null
          nombre_cliente?: string | null
          telefono?: string | null
        }
        Update: {
          apellid_cliente?: string | null
          codigo_comunidad?: string | null
          comunidad?: string | null
          contestacion?: boolean | null
          created_at?: string
          direccion_postal?: string | null
          id?: number
          id_comunidad?: number | null
          mail?: string | null
          nombre_cliente?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propietarios_id_comunidad_fkey"
            columns: ["id_comunidad"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean | null
          cif: string | null
          ciudad: string | null
          cp: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: number
          nombre: string
          provincia: string | null
          servicio: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          cif?: string | null
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: number
          nombre: string
          provincia?: string | null
          servicio?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          cif?: string | null
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: number
          nombre?: string
          provincia?: string | null
          servicio?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      rag_cdades: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      record_messages: {
        Row: {
          content: string
          created_at: string
          entity_id: number
          entity_type: string
          id: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entity_id: number
          entity_type: string
          id?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entity_id?: number
          entity_type?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reuniones: {
        Row: {
          acta_carta: boolean | null
          acta_email: boolean | null
          borrador_acta: boolean | null
          citacion_carta: boolean | null
          citacion_email: boolean | null
          comunidad_id: number
          confirmada: boolean
          created_at: string
          created_by: string | null
          enviado: boolean
          estado_cuentas: boolean | null
          fecha_reunion: string
          id: number
          imprimir_acta: boolean | null
          informe_incidencias: boolean | null
          morosos: boolean | null
          notas: string | null
          pasar_acuerdos: boolean | null
          pto_ordinario: boolean | null
          redactar_acta: boolean | null
          resuelto: boolean
          tipo: string
          updated_at: string
          vb_pendiente: boolean | null
        }
        Insert: {
          acta_carta?: boolean | null
          acta_email?: boolean | null
          borrador_acta?: boolean | null
          citacion_carta?: boolean | null
          citacion_email?: boolean | null
          comunidad_id: number
          confirmada?: boolean
          created_at?: string
          created_by?: string | null
          enviado?: boolean
          estado_cuentas?: boolean | null
          fecha_reunion: string
          id?: number
          imprimir_acta?: boolean | null
          informe_incidencias?: boolean | null
          morosos?: boolean | null
          notas?: string | null
          pasar_acuerdos?: boolean | null
          pto_ordinario?: boolean | null
          redactar_acta?: boolean | null
          resuelto?: boolean
          tipo: string
          updated_at?: string
          vb_pendiente?: boolean | null
        }
        Update: {
          acta_carta?: boolean | null
          acta_email?: boolean | null
          borrador_acta?: boolean | null
          citacion_carta?: boolean | null
          citacion_email?: boolean | null
          comunidad_id?: number
          confirmada?: boolean
          created_at?: string
          created_by?: string | null
          enviado?: boolean
          estado_cuentas?: boolean | null
          fecha_reunion?: string
          id?: number
          imprimir_acta?: boolean | null
          informe_incidencias?: boolean | null
          morosos?: boolean | null
          notas?: string | null
          pasar_acuerdos?: boolean | null
          pto_ordinario?: boolean | null
          redactar_acta?: boolean | null
          resuelto?: boolean
          tipo?: string
          updated_at?: string
          vb_pendiente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reuniones_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      task_timers: {
        Row: {
          comunidad_id: number | null
          created_at: string
          duration_seconds: number | null
          end_at: string | null
          id: number
          incidencia_id: number | null
          is_manual: boolean
          morosidad_id: number | null
          nota: string | null
          start_at: string
          tipo_tarea: string | null
          user_id: string
        }
        Insert: {
          comunidad_id?: number | null
          created_at?: string
          duration_seconds?: number | null
          end_at?: string | null
          id?: number
          incidencia_id?: number | null
          is_manual?: boolean
          morosidad_id?: number | null
          nota?: string | null
          start_at?: string
          tipo_tarea?: string | null
          user_id: string
        }
        Update: {
          comunidad_id?: number | null
          created_at?: string
          duration_seconds?: number | null
          end_at?: string | null
          id?: number
          incidencia_id?: number | null
          is_manual?: boolean
          morosidad_id?: number | null
          nota?: string | null
          start_at?: string
          tipo_tarea?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_timers_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_timers_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_timers_morosidad_id_fkey"
            columns: ["morosidad_id"]
            isOneToOne: false
            referencedRelation: "morosidad"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_timers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          end_at: string | null
          id: number
          note: string | null
          start_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          id?: number
          note?: string | null
          start_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          id?: number
          note?: string | null
          start_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vacation_balances: {
        Row: {
          created_at: string
          id: string
          no_retribuidos_total: number
          no_retribuidos_usados: number
          retribuidos_total: number
          retribuidos_usados: number
          user_id: string
          vacaciones_total: number
          vacaciones_usados: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          no_retribuidos_total?: number
          no_retribuidos_usados?: number
          retribuidos_total?: number
          retribuidos_usados?: number
          user_id: string
          vacaciones_total?: number
          vacaciones_usados?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          no_retribuidos_total?: number
          no_retribuidos_usados?: number
          retribuidos_total?: number
          retribuidos_usados?: number
          user_id?: string
          vacaciones_total?: number
          vacaciones_usados?: number
          year?: number
        }
        Relationships: []
      }
      vacation_policies: {
        Row: {
          count_holidays: boolean
          count_weekends: boolean
          id: string
          is_active: boolean
          max_approved_per_day: number
          name: string
          updated_at: string
        }
        Insert: {
          count_holidays?: boolean
          count_weekends?: boolean
          id?: string
          is_active?: boolean
          max_approved_per_day?: number
          name: string
          updated_at?: string
        }
        Update: {
          count_holidays?: boolean
          count_weekends?: boolean
          id?: string
          is_active?: boolean
          max_approved_per_day?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          admin_id: string | null
          comment_admin: string | null
          comment_user: string | null
          created_at: string
          date_from: string
          date_to: string
          days_count: number
          id: string
          replaces_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          comment_admin?: string | null
          comment_user?: string | null
          created_at?: string
          date_from: string
          date_to: string
          days_count: number
          id?: string
          replaces_id?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          comment_admin?: string | null
          comment_user?: string | null
          created_at?: string
          date_from?: string
          date_to?: string
          days_count?: number
          id?: string
          replaces_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "vacation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      monthly_hours: {
        Row: {
          hours: number | null
          month: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      time_entries_monthly: {
        Row: {
          day: string | null
          hours: number | null
          month: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      admin_clock_out: { Args: { _user_id: string }; Returns: number }
      auto_close_stale_sessions: {
        Args: never
        Returns: {
          id: number
          start_at: string
          user_id: string
        }[]
      }
      clock_in: { Args: { _note?: string }; Returns: number }
      clock_out: { Args: never; Returns: number }
      get_next_invoice_number: {
        Args: { sequence_id: string }
        Returns: number
      }
      has_comunidad: { Args: { _comunidad_id: number }; Returns: boolean }
      has_open_entry: { Args: { _user: string }; Returns: boolean }
      is_active_employee: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          similarity: number
        }[]
      }
      start_task_timer:
        | {
            Args: { _comunidad_id: number; _nota?: string }
            Returns: {
              comunidad_id: number | null
              created_at: string
              duration_seconds: number | null
              end_at: string | null
              id: number
              incidencia_id: number | null
              is_manual: boolean
              morosidad_id: number | null
              nota: string | null
              start_at: string
              tipo_tarea: string | null
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "task_timers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _comunidad_id: number
              _incidencia_id?: number
              _nota?: string
              _tipo_tarea?: string
            }
            Returns: {
              comunidad_id: number | null
              created_at: string
              duration_seconds: number | null
              end_at: string | null
              id: number
              incidencia_id: number | null
              is_manual: boolean
              morosidad_id: number | null
              nota: string | null
              start_at: string
              tipo_tarea: string | null
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "task_timers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _comunidad_id: number
              _incidencia_id?: number
              _morosidad_id?: number
              _nota?: string
              _tipo_tarea?: string
            }
            Returns: {
              comunidad_id: number | null
              created_at: string
              duration_seconds: number | null
              end_at: string | null
              id: number
              incidencia_id: number | null
              is_manual: boolean
              morosidad_id: number | null
              nota: string | null
              start_at: string
              tipo_tarea: string | null
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "task_timers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      stop_task_timer: {
        Args: never
        Returns: {
          comunidad_id: number | null
          created_at: string
          duration_seconds: number | null
          end_at: string | null
          id: number
          incidencia_id: number | null
          is_manual: boolean
          morosidad_id: number | null
          nota: string | null
          start_at: string
          tipo_tarea: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "task_timers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      user_role: "admin" | "empleado" | "gestor"
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
      user_role: ["admin", "empleado", "gestor"],
    },
  },
} as const
