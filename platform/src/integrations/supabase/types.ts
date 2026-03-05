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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_avatar_actions: {
        Row: {
          action_data: Json | null
          action_type: string
          avatar_id: string
          created_at: string
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_data?: Json | null
          action_type: string
          avatar_id: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          avatar_id?: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatar_actions_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_avatar_autonomy_policies: {
        Row: {
          avatar_id: string
          created_at: string
          id: string
          policy_type: string
          policy_value: string
          updated_at: string
        }
        Insert: {
          avatar_id: string
          created_at?: string
          id?: string
          policy_type: string
          policy_value?: string
          updated_at?: string
        }
        Update: {
          avatar_id?: string
          created_at?: string
          id?: string
          policy_type?: string
          policy_value?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatar_autonomy_policies_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_avatar_memory: {
        Row: {
          access_count: number
          avatar_id: string
          content: string
          created_at: string
          emotional_tag: string | null
          id: string
          importance: number
          is_active: boolean
          last_accessed_at: string
          memory_type: string
          metadata: Json | null
          source_conversation_id: string | null
          source_message_id: string | null
          subject: string
        }
        Insert: {
          access_count?: number
          avatar_id: string
          content: string
          created_at?: string
          emotional_tag?: string | null
          id?: string
          importance?: number
          is_active?: boolean
          last_accessed_at?: string
          memory_type: string
          metadata?: Json | null
          source_conversation_id?: string | null
          source_message_id?: string | null
          subject: string
        }
        Update: {
          access_count?: number
          avatar_id?: string
          content?: string
          created_at?: string
          emotional_tag?: string | null
          id?: string
          importance?: number
          is_active?: boolean
          last_accessed_at?: string
          memory_type?: string
          metadata?: Json | null
          source_conversation_id?: string | null
          source_message_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatar_memory_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_avatar_memory_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_avatar_memory_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_avatar_permission_locks: {
        Row: {
          app_id: string
          avatar_id: string
          created_at: string
          id: string
          is_locked: boolean
          locked_value: boolean
          permission_type: string
          updated_at: string
        }
        Insert: {
          app_id: string
          avatar_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_value?: boolean
          permission_type: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          avatar_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_value?: boolean
          permission_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatar_permission_locks_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_avatar_permissions: {
        Row: {
          avatar_id: string
          can_collect: boolean | null
          can_comment: boolean | null
          can_create_channels: boolean | null
          can_economic_actions: boolean | null
          can_follow: boolean | null
          can_group_chat: boolean | null
          can_initiate_activities: boolean | null
          can_like: boolean | null
          can_manage_channels: boolean | null
          can_modify_self_image: boolean | null
          can_post: boolean | null
          can_private_chat: boolean | null
          can_reply: boolean | null
          can_repost: boolean | null
          can_speak_on_behalf: boolean | null
          can_view: boolean | null
          chat_max_rounds: number | null
          chat_unlimited_rounds: boolean | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_id: string
          can_collect?: boolean | null
          can_comment?: boolean | null
          can_create_channels?: boolean | null
          can_economic_actions?: boolean | null
          can_follow?: boolean | null
          can_group_chat?: boolean | null
          can_initiate_activities?: boolean | null
          can_like?: boolean | null
          can_manage_channels?: boolean | null
          can_modify_self_image?: boolean | null
          can_post?: boolean | null
          can_private_chat?: boolean | null
          can_reply?: boolean | null
          can_repost?: boolean | null
          can_speak_on_behalf?: boolean | null
          can_view?: boolean | null
          chat_max_rounds?: number | null
          chat_unlimited_rounds?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          avatar_id?: string
          can_collect?: boolean | null
          can_comment?: boolean | null
          can_create_channels?: boolean | null
          can_economic_actions?: boolean | null
          can_follow?: boolean | null
          can_group_chat?: boolean | null
          can_initiate_activities?: boolean | null
          can_like?: boolean | null
          can_manage_channels?: boolean | null
          can_modify_self_image?: boolean | null
          can_post?: boolean | null
          can_private_chat?: boolean | null
          can_reply?: boolean | null
          can_repost?: boolean | null
          can_speak_on_behalf?: boolean | null
          can_view?: boolean | null
          chat_max_rounds?: number | null
          chat_unlimited_rounds?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatar_permissions_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: true
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_avatars: {
        Row: {
          avatar_url: string | null
          behavior_preferences: Json | null
          bio: string | null
          created_at: string
          display_name: string | null
          emergency_stop_reason: string | null
          emergency_stopped: boolean | null
          id: string
          is_active: boolean | null
          is_taken_over: boolean | null
          knowledge_base: Json | null
          name: string
          owner_id: string
          personality_traits: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          behavior_preferences?: Json | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          emergency_stop_reason?: string | null
          emergency_stopped?: boolean | null
          id?: string
          is_active?: boolean | null
          is_taken_over?: boolean | null
          knowledge_base?: Json | null
          name: string
          owner_id: string
          personality_traits?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          behavior_preferences?: Json | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          emergency_stop_reason?: string | null
          emergency_stopped?: boolean | null
          id?: string
          is_active?: boolean | null
          is_taken_over?: boolean | null
          knowledge_base?: Json | null
          name?: string
          owner_id?: string
          personality_traits?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatars_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_logs: {
        Row: {
          action_type: string
          avatar_id: string
          conversation_id: string
          created_at: string
          id: string
          input_context: Json | null
          message_id: string | null
          metadata: Json | null
          output_content: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          avatar_id: string
          conversation_id: string
          created_at?: string
          id?: string
          input_context?: Json | null
          message_id?: string | null
          metadata?: Json | null
          output_content?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          avatar_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          input_context?: Json | null
          message_id?: string | null
          metadata?: Json | null
          output_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_logs_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_context: {
        Row: {
          avatar_id: string
          context_summary: string | null
          conversation_id: string
          created_at: string
          id: string
          key_points: Json | null
          last_message_id: string | null
          message_count: number
          updated_at: string
        }
        Insert: {
          avatar_id: string
          context_summary?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          key_points?: Json | null
          last_message_id?: string | null
          message_count?: number
          updated_at?: string
        }
        Update: {
          avatar_id?: string
          context_summary?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          key_points?: Json | null
          last_message_id?: string | null
          message_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_context_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_context_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_context_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_permission_requests: {
        Row: {
          avatar_id: string
          created_at: string
          id: string
          owner_id: string
          request_data: Json
          request_type: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_id: string
          created_at?: string
          id?: string
          owner_id: string
          request_data?: Json
          request_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          request_data?: Json
          request_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_permission_requests_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_permission_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_task_locks: {
        Row: {
          avatar_id: string
          expires_at: string
          id: string
          locked_at: string
          locked_by: string
          metadata: Json | null
          task_key: string
          task_type: string
        }
        Insert: {
          avatar_id: string
          expires_at: string
          id?: string
          locked_at?: string
          locked_by: string
          metadata?: Json | null
          task_key: string
          task_type: string
        }
        Update: {
          avatar_id?: string
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by?: string
          metadata?: Json | null
          task_key?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_locks_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      app_permissions: {
        Row: {
          app_icon: string | null
          app_id: string
          app_name: string
          created_at: string
          id: string
          is_enabled: boolean
          permission_mode: string | null
          permission_type: string
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          app_icon?: string | null
          app_id: string
          app_name: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          permission_mode?: string | null
          permission_type: string
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          app_icon?: string | null
          app_id?: string
          app_name?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          permission_mode?: string | null
          permission_type?: string
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_hidden: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          message_history: Json | null
          receiver_id: string
          reject_reason: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          message_history?: Json | null
          receiver_id: string
          reject_reason?: string | null
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          message_history?: Json | null
          receiver_id?: string
          reject_reason?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          is_starred: boolean | null
          nickname: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          is_starred?: boolean | null
          nickname?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          is_starred?: boolean | null
          nickname?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chats: {
        Row: {
          avatar_url: string | null
          conversation_id: string
          created_at: string
          creator_id: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          conversation_id: string
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          conversation_id?: string
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chats_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_chats_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          name: string
          post_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          post_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          post_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      island_permissions: {
        Row: {
          app_id: string
          app_name: string
          created_at: string
          id: string
          is_enabled: boolean
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          app_name: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          app_name?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "island_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      last_message_cache: {
        Row: {
          conversation_id: string
          last_message_content: string | null
          last_message_created_at: string | null
          last_message_id: string | null
          last_message_sender_id: string | null
          last_message_type: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_id: string
          last_message_content?: string | null
          last_message_created_at?: string | null
          last_message_id?: string | null
          last_message_sender_id?: string | null
          last_message_type?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string
          last_message_content?: string | null
          last_message_created_at?: string | null
          last_message_id?: string | null
          last_message_sender_id?: string | null
          last_message_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "last_message_cache_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "last_message_cache_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "last_message_cache_last_message_sender_id_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deletions: {
        Row: {
          deleted_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          message_type: string
          metadata: Json | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          message_type?: string
          metadata?: Json | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          message_type?: string
          metadata?: Json | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_logs: {
        Row: {
          action_type: string
          app_id: string
          avatar_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          permission_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          app_id: string
          avatar_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          permission_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          app_id?: string
          avatar_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          permission_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_logs_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      post_collections: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_collections_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          likes_count: number
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_drafts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          media_data: Json | null
          unlock_settings: Json | null
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          media_data?: Json | null
          unlock_settings?: Json | null
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          media_data?: Json | null
          unlock_settings?: Json | null
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          created_at: string
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_paid: boolean
          post_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean
          post_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          duration: number | null
          height: number | null
          id: string
          mask_regions: Json | null
          masked_media_url: string | null
          media_type: string
          media_url: string
          original_media_url: string | null
          post_id: string
          sort_order: number
          thumbnail_url: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          height?: number | null
          id?: string
          mask_regions?: Json | null
          masked_media_url?: string | null
          media_type: string
          media_url: string
          original_media_url?: string | null
          post_id: string
          sort_order?: number
          thumbnail_url?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          height?: number | null
          id?: string
          mask_regions?: Json | null
          masked_media_url?: string | null
          media_type?: string
          media_url?: string
          original_media_url?: string | null
          post_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          original_post_id: string
          shared_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_post_id: string
          shared_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_post_id?: string
          shared_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_shared_post_id_fkey"
            columns: ["shared_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_unlock_rules: {
        Row: {
          blur_intensity: number
          created_at: string
          id: string
          mask_regions: Json | null
          post_id: string
          required_count: number
          unlock_mode: string
          unlock_type: string
        }
        Insert: {
          blur_intensity?: number
          created_at?: string
          id?: string
          mask_regions?: Json | null
          post_id: string
          required_count?: number
          unlock_mode?: string
          unlock_type?: string
        }
        Update: {
          blur_intensity?: number
          created_at?: string
          id?: string
          mask_regions?: Json | null
          post_id?: string
          required_count?: number
          unlock_mode?: string
          unlock_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_unlock_rules_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_unlock_status: {
        Row: {
          id: string
          media_id: string | null
          post_id: string
          region_id: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          media_id?: string | null
          post_id: string
          region_id?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          media_id?: string | null
          post_id?: string
          region_id?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_unlock_status_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "post_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_unlock_status_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_unlock_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          collections_count: number
          comments_count: number
          content: string | null
          created_at: string
          id: string
          is_deleted: boolean
          latitude: number | null
          likes_count: number
          location_name: string | null
          longitude: number | null
          scheduled_at: string | null
          shares_count: number
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          collections_count?: number
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          latitude?: number | null
          likes_count?: number
          location_name?: string | null
          longitude?: number | null
          scheduled_at?: string | null
          shares_count?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          collections_count?: number
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          latitude?: number | null
          likes_count?: number
          location_name?: string | null
          longitude?: number | null
          scheduled_at?: string | null
          shares_count?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_avatar_id: string | null
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_ai_avatar: boolean | null
          owner_id: string | null
          privacy_settings: Json | null
          unique_username: string
          unique_username_changed_at: string | null
          updated_at: string
        }
        Insert: {
          ai_avatar_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_ai_avatar?: boolean | null
          owner_id?: string | null
          privacy_settings?: Json | null
          unique_username: string
          unique_username_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_avatar_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_ai_avatar?: boolean | null
          owner_id?: string | null
          privacy_settings?: Json | null
          unique_username?: string
          unique_username_changed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ai_avatar_id_fkey"
            columns: ["ai_avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_permissions: {
        Row: {
          app_id: string
          created_at: string | null
          expires_at: string | null
          granted_at: string | null
          id: string
          permission_type: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          permission_type: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          permission_type?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          related_post_id: string | null
          related_user_id: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          related_post_id?: string | null
          related_user_id?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          related_post_id?: string | null
          related_user_id?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
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
      visual_agent_activity_logs: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          task_id: string
          timestamp: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          task_id: string
          timestamp?: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          task_id?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_agent_activity_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "visual_agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_agent_task_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          example_output: Json | null
          icon: string
          id: string
          instruction: string
          is_public: boolean
          name: string
          parameters: Json | null
          target_url: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          example_output?: Json | null
          icon: string
          id?: string
          instruction: string
          is_public?: boolean
          name: string
          parameters?: Json | null
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          example_output?: Json | null
          icon?: string
          id?: string
          instruction?: string
          is_public?: boolean
          name?: string
          parameters?: Json | null
          target_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      visual_agent_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          current_url: string | null
          error: string | null
          id: string
          progress: number | null
          result: Json | null
          started_at: string | null
          status: string
          stream_url: string | null
          target_url: string | null
          updated_at: string
          user_id: string
          user_input: string
          vm_config: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_url?: string | null
          error?: string | null
          id?: string
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          stream_url?: string | null
          target_url?: string | null
          updated_at?: string
          user_id: string
          user_input: string
          vm_config?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_url?: string | null
          error?: string | null
          id?: string
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          stream_url?: string | null
          target_url?: string | null
          updated_at?: string
          user_id?: string
          user_input?: string
          vm_config?: Json | null
        }
        Relationships: []
      }
      vm_assignments: {
        Row: {
          assigned_at: string
          id: string
          released_at: string | null
          task_id: string
          vm_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          released_at?: string | null
          task_id: string
          vm_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          released_at?: string | null
          task_id?: string
          vm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vm_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "visual_agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vm_assignments_vm_id_fkey"
            columns: ["vm_id"]
            isOneToOne: false
            referencedRelation: "vm_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      vm_instances: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          ip_address: string
          last_heartbeat_at: string | null
          metadata: Json | null
          provider: string
          status: string
          webrtc_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          ip_address: string
          last_heartbeat_at?: string | null
          metadata?: Json | null
          provider: string
          status?: string
          webrtc_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          ip_address?: string
          last_heartbeat_at?: string | null
          metadata?: Json | null
          provider?: string
          status?: string
          webrtc_url?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      acquire_task_lock: {
        Args: {
          p_avatar_id: string
          p_lock_duration_seconds?: number
          p_locked_by: string
          p_task_key: string
          p_task_type: string
        }
        Returns: boolean
      }
      cleanup_expired_session_permissions: { Args: never; Returns: number }
      cleanup_expired_task_locks: { Args: never; Returns: number }
      create_mention_notifications: {
        Args: {
          p_actor_id: string
          p_comment_id?: string
          p_content: string
          p_post_id?: string
        }
        Returns: undefined
      }
      create_private_conversation:
        | { Args: { friend_uuid: string }; Returns: string }
        | {
            Args: { friend_uuid: string; sender_uuid?: string }
            Returns: string
          }
      delete_conversation_for_all: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      get_conversations_with_details: {
        Args: { p_user_id: string }
        Returns: {
          conv_id: string
          conversation_created_at: string
          conversation_type: string
          conversation_updated_at: string
          friend_avatar: string
          friend_display_name: string
          friend_id: string
          friend_nickname: string
          group_chat_avatar: string
          group_chat_name: string
          is_hidden: boolean
          is_muted: boolean
          is_pinned: boolean
          last_message_content: string
          last_message_created_at: string
          last_message_type: string
          last_read_at: string
          unread_count: number
        }[]
      }
      get_or_create_hashtag: { Args: { tag_name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: {
        Args: { receiver_uuid: string; sender_uuid: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { conversation_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_conversation_participant_v2: {
        Args: { conv_id: string }
        Returns: boolean
      }
      is_owned_identity: { Args: { identity_id: string }; Returns: boolean }
      log_permission_change: {
        Args: {
          p_action_type: string
          p_app_id: string
          p_avatar_id: string
          p_new_value: Json
          p_old_value: Json
          p_permission_type: string
          p_user_id: string
        }
        Returns: string
      }
      release_task_lock: {
        Args: {
          p_avatar_id: string
          p_locked_by: string
          p_task_key: string
          p_task_type: string
        }
        Returns: boolean
      }
      search_relevant_memories: {
        Args: {
          p_avatar_id: string
          p_limit?: number
          p_memory_types?: string[]
          p_query: string
        }
        Returns: {
          access_count: number
          content: string
          created_at: string
          emotional_tag: string
          id: string
          importance: number
          last_accessed_at: string
          memory_type: string
          subject: string
        }[]
      }
      search_user_by_email: {
        Args: { search_email: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          unique_username: string
        }[]
      }
      search_users_by_name: {
        Args: {
          current_user_id: string
          result_limit?: number
          search_query: string
        }
        Returns: {
          ai_avatar_id: string
          avatar_url: string
          bio: string
          display_name: string
          id: string
          is_ai_avatar: boolean
          unique_username: string
        }[]
      }
      setup_first_admin: { Args: { _user_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_memory_access: {
        Args: { p_memory_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      privacy_level: "public" | "friends" | "private"
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
      app_role: ["admin", "moderator", "user"],
      privacy_level: ["public", "friends", "private"],
    },
  },
} as const
