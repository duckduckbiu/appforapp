CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: privacy_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.privacy_level AS ENUM (
    'public',
    'friends',
    'private'
);


--
-- Name: accept_friend_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_friend_request(request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_status TEXT;
BEGIN
  -- 获取好友请求信息
  SELECT sender_id, receiver_id, status
  INTO v_sender_id, v_receiver_id, v_status
  FROM friend_requests
  WHERE id = request_id;
  
  -- 检查请求是否存在
  IF NOT FOUND THEN
    RAISE EXCEPTION '好友请求不存在';
  END IF;
  
  -- 检查当前用户是否是接收者
  IF v_receiver_id != auth.uid() THEN
    RAISE EXCEPTION '无权接受此好友请求';
  END IF;
  
  -- 检查请求状态
  IF v_status != 'pending' THEN
    RAISE EXCEPTION '好友请求已处理';
  END IF;
  
  -- 更新请求状态
  UPDATE friend_requests
  SET status = 'accepted'
  WHERE id = request_id;
  
  -- 创建双向好友关系（使用 SECURITY DEFINER 绕过 RLS）
  INSERT INTO friendships (user_id, friend_id)
  VALUES (v_receiver_id, v_sender_id)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO friendships (user_id, friend_id)
  VALUES (v_sender_id, v_receiver_id)
  ON CONFLICT DO NOTHING;
END;
$$;


--
-- Name: check_ai_avatar_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_ai_avatar_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  avatar_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO avatar_count
  FROM public.ai_avatars
  WHERE owner_id = NEW.owner_id;
  
  IF avatar_count >= 5 THEN
    RAISE EXCEPTION '每个用户最多只能创建 5 个 AI 分身';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_username_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_username_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- 如果 unique_username 没有改变，允许更新
  IF OLD.unique_username = NEW.unique_username THEN
    RETURN NEW;
  END IF;
  
  -- 测试阶段：允许无限次修改用户名
  -- 仅更新修改时间
  NEW.unique_username_changed_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: cleanup_expired_session_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_session_permissions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.session_permissions
  WHERE expires_at IS NOT NULL 
    AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_last_message_cache_on_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_last_message_cache_on_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_last_message RECORD;
BEGIN
  -- 检查被删除的消息是否是最新消息
  IF EXISTS (
    SELECT 1 FROM last_message_cache
    WHERE conversation_id = OLD.conversation_id
      AND last_message_id = OLD.id
  ) THEN
    -- 查找该会话的新的最新消息
    SELECT id, content, message_type, created_at, sender_id
    INTO v_last_message
    FROM messages
    WHERE conversation_id = OLD.conversation_id
      AND is_deleted = false
      AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      -- 更新缓存为新的最新消息
      UPDATE last_message_cache
      SET 
        last_message_id = v_last_message.id,
        last_message_content = v_last_message.content,
        last_message_type = v_last_message.message_type,
        last_message_created_at = v_last_message.created_at,
        last_message_sender_id = v_last_message.sender_id,
        updated_at = now()
      WHERE conversation_id = OLD.conversation_id;
    ELSE
      -- 没有其他消息，删除缓存
      DELETE FROM last_message_cache
      WHERE conversation_id = OLD.conversation_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;


--
-- Name: create_private_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_private_conversation(friend_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_conversation_id UUID;
  v_existing_conversation_id UUID;
BEGIN
  -- 获取当前用户 ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;
  
  -- 检查好友关系是否存在
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE user_id = v_user_id AND friend_id = friend_uuid
  ) THEN
    RAISE EXCEPTION '非好友关系，无法创建会话';
  END IF;
  
  -- 首先检查是否存在隐藏的会话
  SELECT cp1.conversation_id INTO v_existing_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_user_id 
    AND cp2.user_id = friend_uuid
    AND c.type = 'private'
    AND cp1.is_hidden = true;
  
  -- 如果找到隐藏的会话，恢复显示
  IF v_existing_conversation_id IS NOT NULL THEN
    UPDATE conversation_participants
    SET is_hidden = false
    WHERE conversation_id = v_existing_conversation_id 
      AND user_id = v_user_id;
    RETURN v_existing_conversation_id;
  END IF;
  
  -- 检查是否已存在非隐藏的私聊会话
  SELECT cp1.conversation_id INTO v_existing_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_user_id 
    AND cp2.user_id = friend_uuid
    AND c.type = 'private';
  
  IF v_existing_conversation_id IS NOT NULL THEN
    RETURN v_existing_conversation_id;
  END IF;
  
  -- 创建新会话
  INSERT INTO conversations (type)
  VALUES ('private')
  RETURNING id INTO v_conversation_id;
  
  -- 添加两个参与者
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id);
  
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, friend_uuid);
  
  RETURN v_conversation_id;
END;
$$;


--
-- Name: delete_conversation_for_all(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_conversation_for_all(p_conversation_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  -- 验证用户是会话参与者
  IF NOT EXISTS (
    SELECT 1 
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id 
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION '用户不是该会话的参与者';
  END IF;
  
  -- 将会话中的所有消息标记为已删除（使用显式 schema）
  UPDATE public.messages
  SET is_deleted = true
  WHERE conversation_id = p_conversation_id;
  
  -- 删除会话的所有参与者记录
  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id;
END;
$$;


--
-- Name: get_conversations_with_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_conversations_with_details(p_user_id uuid) RETURNS TABLE(conv_id uuid, conversation_type text, conversation_created_at timestamp with time zone, conversation_updated_at timestamp with time zone, is_pinned boolean, is_muted boolean, is_hidden boolean, last_read_at timestamp with time zone, last_message_content text, last_message_type text, last_message_created_at timestamp with time zone, unread_count bigint, group_chat_name text, group_chat_avatar text, friend_id uuid, friend_display_name text, friend_avatar text, friend_nickname text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    -- 获取用户参与的所有会话
    SELECT 
      cp.conversation_id,
      cp.is_pinned,
      cp.is_muted,
      cp.is_hidden,
      cp.last_read_at,
      c.type as conversation_type,
      c.created_at as conversation_created_at,
      c.updated_at as conversation_updated_at
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.user_id = p_user_id
      AND cp.is_hidden = false
  ),
  latest_messages AS (
    -- 获取每个会话的最新消息
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content as message_content,
      m.message_type,
      m.created_at as message_created_at
    FROM messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND m.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM message_deletions md
        WHERE md.message_id = m.id AND md.user_id = p_user_id
      )
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    -- 计算每个会话的未读消息数
    SELECT 
      m.conversation_id,
      COUNT(*) as unread_count
    FROM messages m
    JOIN user_conversations uc ON uc.conversation_id = m.conversation_id
    WHERE m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamptz)
      AND m.sender_id != p_user_id
      AND m.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM message_deletions md
        WHERE md.message_id = m.id AND md.user_id = p_user_id
      )
    GROUP BY m.conversation_id
  ),
  group_info AS (
    -- 获取群聊信息
    SELECT 
      gc.conversation_id,
      gc.name as group_chat_name,
      gc.avatar_url as group_chat_avatar
    FROM group_chats gc
    WHERE gc.conversation_id IN (SELECT conversation_id FROM user_conversations)
  ),
  private_chat_info AS (
    -- 获取私聊对方信息
    SELECT 
      cp.conversation_id,
      p.id as friend_id,
      p.display_name as friend_display_name,
      p.avatar_url as friend_avatar,
      f.nickname as friend_nickname
    FROM conversation_participants cp
    JOIN profiles p ON p.id = cp.user_id
    LEFT JOIN friendships f ON f.user_id = p_user_id AND f.friend_id = cp.user_id
    WHERE cp.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND cp.user_id != p_user_id
  )
  -- 最终组合结果，使用 conv_id 作为返回列名
  SELECT 
    uc.conversation_id as conv_id,
    uc.conversation_type,
    uc.conversation_created_at,
    uc.conversation_updated_at,
    uc.is_pinned,
    uc.is_muted,
    uc.is_hidden,
    uc.last_read_at,
    -- 最新消息
    lm.message_content,
    lm.message_type,
    lm.message_created_at,
    -- 未读计数
    COALESCE(uc_count.unread_count, 0) as unread_count,
    -- 群聊信息
    gi.group_chat_name,
    gi.group_chat_avatar,
    -- 私聊对方信息
    pci.friend_id,
    pci.friend_display_name,
    pci.friend_avatar,
    pci.friend_nickname
  FROM user_conversations uc
  LEFT JOIN latest_messages lm ON lm.conversation_id = uc.conversation_id
  LEFT JOIN unread_counts uc_count ON uc_count.conversation_id = uc.conversation_id
  LEFT JOIN group_info gi ON gi.conversation_id = uc.conversation_id
  LEFT JOIN private_chat_info pci ON pci.conversation_id = uc.conversation_id
  ORDER BY 
    uc.is_pinned DESC,
    COALESCE(lm.message_created_at, uc.conversation_created_at) DESC;
END;
$$;


--
-- Name: handle_new_ai_avatar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_ai_avatar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.ai_avatar_permissions (avatar_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_ai_avatar_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_ai_avatar_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO profiles (
    id, 
    unique_username, 
    display_name, 
    avatar_url, 
    bio, 
    is_ai_avatar, 
    ai_avatar_id, 
    owner_id
  ) VALUES (
    NEW.id,
    'ai_' || substr(md5(random()::text), 1, 8),
    NEW.display_name,
    NEW.avatar_url,
    NEW.bio,
    true,
    NEW.id,
    NEW.owner_id
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  random_username TEXT;
BEGIN
  -- 生成随机用户名（user_ + 时间戳后6位）
  random_username := 'user_' || substr(md5(random()::text), 1, 8);
  
  INSERT INTO public.profiles (id, unique_username, display_name)
  VALUES (
    NEW.id,
    random_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', random_username)
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: is_blocked(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_blocked(sender_uuid uuid, receiver_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blacklist
    WHERE user_id = receiver_uuid
      AND blocked_user_id = sender_uuid
  )
$$;


--
-- Name: is_conversation_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_participant(conversation_uuid uuid, user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = conversation_uuid
      AND user_id = user_uuid
  )
$$;


--
-- Name: log_permission_change(uuid, uuid, text, text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_permission_change(p_user_id uuid, p_avatar_id uuid, p_app_id text, p_permission_type text, p_action_type text, p_old_value jsonb, p_new_value jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.permission_audit_logs (
    user_id,
    avatar_id,
    app_id,
    permission_type,
    action_type,
    old_value,
    new_value
  ) VALUES (
    p_user_id,
    p_avatar_id,
    p_app_id,
    p_permission_type,
    p_action_type,
    p_old_value,
    p_new_value
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;


--
-- Name: search_user_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_user_by_email(search_email text) RETURNS TABLE(id uuid, unique_username text, display_name text, avatar_url text, bio text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- 只返回精确匹配的邮箱（不是模糊搜索，保护隐私）
  RETURN QUERY
  SELECT 
    p.id,
    p.unique_username,
    p.display_name,
    p.avatar_url,
    p.bio
  FROM profiles p
  INNER JOIN auth.users u ON p.id = u.id
  WHERE LOWER(u.email) = LOWER(search_email)
  AND p.id != auth.uid()
  LIMIT 1;
END;
$$;


--
-- Name: update_last_message_cache(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_last_message_cache() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- 插入或更新最新消息缓存
  INSERT INTO public.last_message_cache (
    conversation_id,
    last_message_id,
    last_message_content,
    last_message_type,
    last_message_created_at,
    last_message_sender_id,
    updated_at
  ) VALUES (
    NEW.conversation_id,
    NEW.id,
    NEW.content,
    NEW.message_type,
    NEW.created_at,
    NEW.sender_id,
    now()
  )
  ON CONFLICT (conversation_id) 
  DO UPDATE SET
    last_message_id = NEW.id,
    last_message_content = NEW.content,
    last_message_type = NEW.message_type,
    last_message_created_at = NEW.created_at,
    last_message_sender_id = NEW.sender_id,
    updated_at = now()
  WHERE last_message_cache.last_message_created_at < NEW.created_at;
  
  -- 同时更新会话的 updated_at 时间戳
  UPDATE public.conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: ai_avatar_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_avatar_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_id uuid NOT NULL,
    action_type text NOT NULL,
    action_data jsonb DEFAULT '{}'::jsonb,
    target_id uuid,
    target_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_avatar_autonomy_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_avatar_autonomy_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_id uuid NOT NULL,
    policy_type text NOT NULL,
    policy_value text DEFAULT 'ask'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_value_check CHECK ((policy_value = ANY (ARRAY['always_allow'::text, 'ask'::text, 'always_deny'::text])))
);


--
-- Name: ai_avatar_permission_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_avatar_permission_locks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_id uuid NOT NULL,
    app_id text NOT NULL,
    permission_type text NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    locked_value boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_avatar_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_avatar_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_id uuid NOT NULL,
    can_view boolean DEFAULT true,
    can_like boolean DEFAULT true,
    can_collect boolean DEFAULT true,
    can_follow boolean DEFAULT false,
    can_comment boolean DEFAULT false,
    can_private_chat boolean DEFAULT false,
    can_group_chat boolean DEFAULT false,
    can_reply boolean DEFAULT false,
    can_post boolean DEFAULT false,
    can_repost boolean DEFAULT false,
    can_create_channels boolean DEFAULT false,
    can_initiate_activities boolean DEFAULT false,
    can_modify_self_image boolean DEFAULT false,
    can_speak_on_behalf boolean DEFAULT false,
    can_manage_channels boolean DEFAULT false,
    can_economic_actions boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_avatars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_avatars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    display_name text,
    bio text,
    avatar_url text,
    personality_traits jsonb DEFAULT '[]'::jsonb,
    knowledge_base jsonb DEFAULT '[]'::jsonb,
    behavior_preferences jsonb DEFAULT '{"autonomy_level": "moderate", "response_style": "friendly"}'::jsonb,
    is_active boolean DEFAULT true,
    emergency_stopped boolean DEFAULT false,
    emergency_stop_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_taken_over boolean DEFAULT false
);


--
-- Name: ai_chat_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid,
    action_type text NOT NULL,
    input_context jsonb DEFAULT '{}'::jsonb,
    output_content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_chat_logs_action_type_check CHECK ((action_type = ANY (ARRAY['send_message'::text, 'reply'::text, 'auto_chat'::text])))
);


--
-- Name: ai_permission_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_permission_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    request_type text NOT NULL,
    request_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: app_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    app_id text NOT NULL,
    app_name text NOT NULL,
    app_icon text,
    permission_type text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    permission_mode text DEFAULT 'never_allow'::text
);


--
-- Name: blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blacklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    blocked_user_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blacklist_check CHECK ((user_id <> blocked_user_id))
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone,
    is_pinned boolean DEFAULT false,
    is_muted boolean DEFAULT false,
    is_hidden boolean DEFAULT false
);

ALTER TABLE ONLY public.conversation_participants REPLICA IDENTITY FULL;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text DEFAULT 'private'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_type_check CHECK ((type = ANY (ARRAY['private'::text, 'group'::text])))
);


--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reject_reason text,
    message_history jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT friend_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);

ALTER TABLE ONLY public.friend_requests REPLICA IDENTITY FULL;


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    nickname text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_starred boolean DEFAULT false,
    CONSTRAINT friendships_check CHECK ((user_id <> friend_id))
);

ALTER TABLE ONLY public.friendships REPLICA IDENTITY FULL;


--
-- Name: group_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    avatar_url text,
    creator_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.group_chats REPLICA IDENTITY FULL;


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);

ALTER TABLE ONLY public.group_members REPLICA IDENTITY FULL;


--
-- Name: island_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.island_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    app_id text NOT NULL,
    app_name text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: last_message_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.last_message_cache (
    conversation_id uuid NOT NULL,
    last_message_id uuid,
    last_message_content text,
    last_message_type text DEFAULT 'text'::text,
    last_message_created_at timestamp with time zone,
    last_message_sender_id uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: message_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_deletions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    message_type text DEFAULT 'text'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'audio'::text, 'video'::text, 'system'::text, 'merged_forward'::text])))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: permission_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    avatar_id uuid,
    app_id text NOT NULL,
    permission_type text NOT NULL,
    action_type text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    unique_username text NOT NULL,
    display_name text,
    bio text,
    avatar_url text,
    cover_url text,
    unique_username_changed_at timestamp with time zone DEFAULT now(),
    privacy_settings jsonb DEFAULT '{"profile_visibility": "public", "allow_friend_requests": true, "posts_default_visibility": "public"}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_ai_avatar boolean DEFAULT false,
    ai_avatar_id uuid,
    owner_id uuid,
    CONSTRAINT unique_username_format CHECK ((unique_username ~ '^[a-zA-Z0-9_]+$'::text)),
    CONSTRAINT unique_username_length CHECK (((char_length(unique_username) >= 3) AND (char_length(unique_username) <= 30)))
);


--
-- Name: session_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    app_id text NOT NULL,
    permission_type text NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_avatar_actions ai_avatar_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_actions
    ADD CONSTRAINT ai_avatar_actions_pkey PRIMARY KEY (id);


--
-- Name: ai_avatar_autonomy_policies ai_avatar_autonomy_policies_avatar_id_policy_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_autonomy_policies
    ADD CONSTRAINT ai_avatar_autonomy_policies_avatar_id_policy_type_key UNIQUE (avatar_id, policy_type);


--
-- Name: ai_avatar_autonomy_policies ai_avatar_autonomy_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_autonomy_policies
    ADD CONSTRAINT ai_avatar_autonomy_policies_pkey PRIMARY KEY (id);


--
-- Name: ai_avatar_permission_locks ai_avatar_permission_locks_avatar_id_app_id_permission_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_permission_locks
    ADD CONSTRAINT ai_avatar_permission_locks_avatar_id_app_id_permission_type_key UNIQUE (avatar_id, app_id, permission_type);


--
-- Name: ai_avatar_permission_locks ai_avatar_permission_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_permission_locks
    ADD CONSTRAINT ai_avatar_permission_locks_pkey PRIMARY KEY (id);


--
-- Name: ai_avatar_permissions ai_avatar_permissions_avatar_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_permissions
    ADD CONSTRAINT ai_avatar_permissions_avatar_id_key UNIQUE (avatar_id);


--
-- Name: ai_avatar_permissions ai_avatar_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_permissions
    ADD CONSTRAINT ai_avatar_permissions_pkey PRIMARY KEY (id);


--
-- Name: ai_avatars ai_avatars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatars
    ADD CONSTRAINT ai_avatars_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_logs ai_chat_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_logs
    ADD CONSTRAINT ai_chat_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_permission_requests ai_permission_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_permission_requests
    ADD CONSTRAINT ai_permission_requests_pkey PRIMARY KEY (id);


--
-- Name: app_permissions app_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_permissions
    ADD CONSTRAINT app_permissions_pkey PRIMARY KEY (id);


--
-- Name: app_permissions app_permissions_user_id_app_id_permission_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_permissions
    ADD CONSTRAINT app_permissions_user_id_app_id_permission_type_key UNIQUE (user_id, app_id, permission_type);


--
-- Name: blacklist blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_pkey PRIMARY KEY (id);


--
-- Name: blacklist blacklist_user_id_blocked_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_user_id_blocked_user_id_key UNIQUE (user_id, blocked_user_id);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_sender_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_user_id_friend_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_id_friend_id_key UNIQUE (user_id, friend_id);


--
-- Name: group_chats group_chats_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_chats
    ADD CONSTRAINT group_chats_conversation_id_key UNIQUE (conversation_id);


--
-- Name: group_chats group_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_chats
    ADD CONSTRAINT group_chats_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: island_permissions island_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.island_permissions
    ADD CONSTRAINT island_permissions_pkey PRIMARY KEY (id);


--
-- Name: island_permissions island_permissions_user_id_app_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.island_permissions
    ADD CONSTRAINT island_permissions_user_id_app_id_key UNIQUE (user_id, app_id);


--
-- Name: last_message_cache last_message_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.last_message_cache
    ADD CONSTRAINT last_message_cache_pkey PRIMARY KEY (conversation_id);


--
-- Name: message_deletions message_deletions_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- Name: message_deletions message_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: permission_audit_logs permission_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_category_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_category_key_key UNIQUE (category, key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_unique_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_unique_username_key UNIQUE (unique_username);


--
-- Name: session_permissions session_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_permissions
    ADD CONSTRAINT session_permissions_pkey PRIMARY KEY (id);


--
-- Name: session_permissions session_permissions_user_id_app_id_permission_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_permissions
    ADD CONSTRAINT session_permissions_user_id_app_id_permission_type_key UNIQUE (user_id, app_id, permission_type);


--
-- Name: idx_ai_avatar_actions_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatar_actions_action_type ON public.ai_avatar_actions USING btree (action_type);


--
-- Name: idx_ai_avatar_actions_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatar_actions_avatar_id ON public.ai_avatar_actions USING btree (avatar_id);


--
-- Name: idx_ai_avatar_actions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatar_actions_created_at ON public.ai_avatar_actions USING btree (created_at DESC);


--
-- Name: idx_ai_avatar_autonomy_policies_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatar_autonomy_policies_avatar_id ON public.ai_avatar_autonomy_policies USING btree (avatar_id);


--
-- Name: idx_ai_avatar_permission_locks_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatar_permission_locks_avatar_id ON public.ai_avatar_permission_locks USING btree (avatar_id);


--
-- Name: idx_ai_avatar_permissions_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatar_permissions_avatar_id ON public.ai_avatar_permissions USING btree (avatar_id);


--
-- Name: idx_ai_avatars_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatars_is_active ON public.ai_avatars USING btree (is_active);


--
-- Name: idx_ai_avatars_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_avatars_owner_id ON public.ai_avatars USING btree (owner_id);


--
-- Name: idx_ai_chat_logs_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_logs_avatar_id ON public.ai_chat_logs USING btree (avatar_id);


--
-- Name: idx_ai_chat_logs_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_logs_conversation_id ON public.ai_chat_logs USING btree (conversation_id);


--
-- Name: idx_ai_chat_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_logs_created_at ON public.ai_chat_logs USING btree (created_at DESC);


--
-- Name: idx_ai_permission_requests_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_permission_requests_owner_id ON public.ai_permission_requests USING btree (owner_id);


--
-- Name: idx_ai_permission_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_permission_requests_status ON public.ai_permission_requests USING btree (status);


--
-- Name: idx_blacklist_blocked_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blacklist_blocked_user_id ON public.blacklist USING btree (blocked_user_id);


--
-- Name: idx_blacklist_user_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blacklist_user_blocked ON public.blacklist USING btree (user_id, blocked_user_id);


--
-- Name: idx_blacklist_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blacklist_user_id ON public.blacklist USING btree (user_id);


--
-- Name: idx_conversation_participants_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_conversation ON public.conversation_participants USING btree (conversation_id);


--
-- Name: idx_conversation_participants_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants USING btree (conversation_id);


--
-- Name: idx_conversation_participants_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_hidden ON public.conversation_participants USING btree (user_id, is_hidden) WHERE (is_hidden = false);


--
-- Name: idx_conversation_participants_last_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_last_read ON public.conversation_participants USING btree (user_id, conversation_id, last_read_at);


--
-- Name: idx_conversation_participants_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_pinned ON public.conversation_participants USING btree (user_id, is_pinned) WHERE (is_pinned = true);


--
-- Name: idx_conversation_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_conversation_participants_user_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_user_conversation ON public.conversation_participants USING btree (user_id, conversation_id);


--
-- Name: idx_conversation_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_friend_requests_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_receiver ON public.friend_requests USING btree (receiver_id, status);


--
-- Name: idx_friend_requests_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_sender ON public.friend_requests USING btree (sender_id);


--
-- Name: idx_friendships_friend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_friend ON public.friendships USING btree (friend_id);


--
-- Name: idx_friendships_friend_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_friend_id ON public.friendships USING btree (friend_id);


--
-- Name: idx_friendships_is_starred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_is_starred ON public.friendships USING btree (user_id, is_starred) WHERE (is_starred = true);


--
-- Name: idx_friendships_starred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_starred ON public.friendships USING btree (user_id, is_starred) WHERE (is_starred = true);


--
-- Name: idx_friendships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_user ON public.friendships USING btree (user_id);


--
-- Name: idx_friendships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_user_id ON public.friendships USING btree (user_id);


--
-- Name: idx_group_chats_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_chats_conversation_id ON public.group_chats USING btree (conversation_id);


--
-- Name: idx_group_members_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_group ON public.group_members USING btree (group_id);


--
-- Name: idx_group_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_user ON public.group_members USING btree (user_id);


--
-- Name: idx_last_message_cache_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_last_message_cache_updated ON public.last_message_cache USING btree (updated_at DESC);


--
-- Name: idx_message_deletions_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_deletions_lookup ON public.message_deletions USING btree (message_id, user_id);


--
-- Name: idx_message_deletions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_deletions_message ON public.message_deletions USING btree (message_id);


--
-- Name: idx_message_deletions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_deletions_user ON public.message_deletions USING btree (user_id);


--
-- Name: idx_message_deletions_user_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_deletions_user_message ON public.message_deletions USING btree (user_id, message_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation_cursor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_cursor ON public.messages USING btree (conversation_id, created_at DESC, id DESC) WHERE (is_deleted = false);


--
-- Name: idx_messages_conversation_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_not_deleted ON public.messages USING btree (conversation_id, is_deleted, created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_permission_audit_logs_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_audit_logs_avatar_id ON public.permission_audit_logs USING btree (avatar_id);


--
-- Name: idx_permission_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_audit_logs_created_at ON public.permission_audit_logs USING btree (created_at DESC);


--
-- Name: idx_permission_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_audit_logs_user_id ON public.permission_audit_logs USING btree (user_id);


--
-- Name: idx_profiles_ai_avatar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_ai_avatar ON public.profiles USING btree (is_ai_avatar) WHERE (is_ai_avatar = true);


--
-- Name: idx_profiles_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_owner_id ON public.profiles USING btree (owner_id) WHERE (owner_id IS NOT NULL);


--
-- Name: idx_profiles_unique_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_unique_username ON public.profiles USING btree (unique_username);


--
-- Name: idx_session_permissions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_permissions_expires ON public.session_permissions USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_session_permissions_user_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_permissions_user_app ON public.session_permissions USING btree (user_id, app_id, permission_type);


--
-- Name: ai_avatars check_ai_avatar_limit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_ai_avatar_limit_trigger BEFORE INSERT ON public.ai_avatars FOR EACH ROW EXECUTE FUNCTION public.check_ai_avatar_limit();


--
-- Name: profiles check_username_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_username_change_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_username_change();


--
-- Name: ai_avatars on_ai_avatar_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_ai_avatar_created AFTER INSERT ON public.ai_avatars FOR EACH ROW EXECUTE FUNCTION public.handle_new_ai_avatar_profile();


--
-- Name: messages trigger_cleanup_last_message_cache; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cleanup_last_message_cache AFTER UPDATE OF is_deleted ON public.messages FOR EACH ROW WHEN (((old.is_deleted = false) AND (new.is_deleted = true))) EXECUTE FUNCTION public.cleanup_last_message_cache_on_delete();


--
-- Name: messages trigger_update_last_message_cache; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_last_message_cache AFTER INSERT ON public.messages FOR EACH ROW WHEN ((new.is_deleted = false)) EXECUTE FUNCTION public.update_last_message_cache();


--
-- Name: ai_avatar_autonomy_policies update_ai_avatar_autonomy_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_avatar_autonomy_policies_updated_at BEFORE UPDATE ON public.ai_avatar_autonomy_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_avatar_permission_locks update_ai_avatar_permission_locks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_avatar_permission_locks_updated_at BEFORE UPDATE ON public.ai_avatar_permission_locks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_avatar_permissions update_ai_avatar_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_avatar_permissions_updated_at BEFORE UPDATE ON public.ai_avatar_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_avatars update_ai_avatars_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_avatars_updated_at BEFORE UPDATE ON public.ai_avatars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_chat_logs update_ai_chat_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_chat_logs_updated_at BEFORE UPDATE ON public.ai_chat_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_permission_requests update_ai_permission_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_permission_requests_updated_at BEFORE UPDATE ON public.ai_permission_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_permissions update_app_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_permissions_updated_at BEFORE UPDATE ON public.app_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: friend_requests update_friend_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: friendships update_friendships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: group_chats update_group_chats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_group_chats_updated_at BEFORE UPDATE ON public.group_chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: island_permissions update_island_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_island_permissions_updated_at BEFORE UPDATE ON public.island_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: platform_settings update_platform_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_avatar_actions ai_avatar_actions_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_actions
    ADD CONSTRAINT ai_avatar_actions_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: ai_avatar_autonomy_policies ai_avatar_autonomy_policies_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_autonomy_policies
    ADD CONSTRAINT ai_avatar_autonomy_policies_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: ai_avatar_permission_locks ai_avatar_permission_locks_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_permission_locks
    ADD CONSTRAINT ai_avatar_permission_locks_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: ai_avatar_permissions ai_avatar_permissions_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatar_permissions
    ADD CONSTRAINT ai_avatar_permissions_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: ai_avatars ai_avatars_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_avatars
    ADD CONSTRAINT ai_avatars_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ai_chat_logs ai_chat_logs_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_logs
    ADD CONSTRAINT ai_chat_logs_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: ai_chat_logs ai_chat_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_logs
    ADD CONSTRAINT ai_chat_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: ai_chat_logs ai_chat_logs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_logs
    ADD CONSTRAINT ai_chat_logs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: ai_permission_requests ai_permission_requests_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_permission_requests
    ADD CONSTRAINT ai_permission_requests_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: ai_permission_requests ai_permission_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_permission_requests
    ADD CONSTRAINT ai_permission_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: app_permissions app_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_permissions
    ADD CONSTRAINT app_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blacklist blacklist_blocked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blacklist blacklist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_chats group_chats_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_chats
    ADD CONSTRAINT group_chats_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: group_chats group_chats_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_chats
    ADD CONSTRAINT group_chats_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.group_chats(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: island_permissions island_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.island_permissions
    ADD CONSTRAINT island_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: last_message_cache last_message_cache_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.last_message_cache
    ADD CONSTRAINT last_message_cache_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: last_message_cache last_message_cache_last_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.last_message_cache
    ADD CONSTRAINT last_message_cache_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: last_message_cache last_message_cache_last_message_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.last_message_cache
    ADD CONSTRAINT last_message_cache_last_message_sender_id_fkey FOREIGN KEY (last_message_sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: message_deletions message_deletions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_deletions message_deletions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: permission_audit_logs permission_audit_logs_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.ai_avatars(id) ON DELETE SET NULL;


--
-- Name: permission_audit_logs permission_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_ai_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_ai_avatar_id_fkey FOREIGN KEY (ai_avatar_id) REFERENCES public.ai_avatars(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: session_permissions session_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_permissions
    ADD CONSTRAINT session_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_permission_requests AI 分身所有者可以更新权限请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以更新权限请求" ON public.ai_permission_requests FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: ai_avatar_actions AI 分身所有者可以查看动作日志; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以查看动作日志" ON public.ai_avatar_actions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_actions.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: ai_chat_logs AI 分身所有者可以查看日志; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以查看日志" ON public.ai_chat_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_chat_logs.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: ai_permission_requests AI 分身所有者可以查看权限请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以查看权限请求" ON public.ai_permission_requests FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: ai_avatar_permission_locks AI 分身所有者可以查看权限锁定; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以查看权限锁定" ON public.ai_avatar_permission_locks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_permission_locks.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: ai_avatar_autonomy_policies AI 分身所有者可以查看自主策略; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以查看自主策略" ON public.ai_avatar_autonomy_policies FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_autonomy_policies.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: ai_avatar_permission_locks AI 分身所有者可以管理权限锁定; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以管理权限锁定" ON public.ai_avatar_permission_locks USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_permission_locks.avatar_id) AND (ai_avatars.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_permission_locks.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: ai_avatar_autonomy_policies AI 分身所有者可以管理自主策略; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI 分身所有者可以管理自主策略" ON public.ai_avatar_autonomy_policies USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_autonomy_policies.avatar_id) AND (ai_avatars.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_autonomy_policies.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: platform_settings Allow authenticated read platform_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read platform_settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);


--
-- Name: platform_settings Allow authenticated write platform_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated write platform_settings" ON public.platform_settings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: last_message_cache Users can view cache for their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view cache for their conversations" ON public.last_message_cache FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants
  WHERE ((conversation_participants.conversation_id = last_message_cache.conversation_id) AND (conversation_participants.user_id = auth.uid())))));


--
-- Name: ai_avatar_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_avatar_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_avatar_autonomy_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_avatar_autonomy_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_avatar_permission_locks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_avatar_permission_locks ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_avatar_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_avatar_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_avatars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_avatars ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_chat_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_permission_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_permission_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: app_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: blacklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: friend_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

--
-- Name: group_chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: island_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.island_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: last_message_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.last_message_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: message_deletions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: permission_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: session_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages 发送者可以删除自己的消息; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "发送者可以删除自己的消息" ON public.messages FOR UPDATE TO authenticated USING ((sender_id = auth.uid()));


--
-- Name: conversations 用户可以创建会话; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以创建会话" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: group_chats 用户可以创建群聊; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以创建群聊" ON public.group_chats FOR INSERT TO authenticated WITH CHECK ((creator_id = auth.uid()));


--
-- Name: message_deletions 用户可以删除消息; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除消息" ON public.message_deletions FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: island_permissions 用户可以删除灵动岛权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除灵动岛权限" ON public.island_permissions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: friend_requests 用户可以删除自己发送的好友请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除自己发送的好友请求" ON public.friend_requests FOR DELETE TO authenticated USING ((sender_id = auth.uid()));


--
-- Name: session_permissions 用户可以删除自己的会话权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除自己的会话权限" ON public.session_permissions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: friendships 用户可以删除自己的好友关系; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除自己的好友关系" ON public.friendships FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: app_permissions 用户可以删除自己的应用权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除自己的应用权限" ON public.app_permissions FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: blacklist 用户可以删除黑名单; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以删除黑名单" ON public.blacklist FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: conversation_participants 用户可以加入会话; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以加入会话" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: friend_requests 用户可以发送好友请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以发送好友请求" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK ((sender_id = auth.uid()));


--
-- Name: messages 用户可以发送消息; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以发送消息" ON public.messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants
  WHERE ((conversation_participants.conversation_id = messages.conversation_id) AND (conversation_participants.user_id = auth.uid())))) AND (NOT (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id <> auth.uid()) AND (public.is_blocked(auth.uid(), cp.user_id) = true)))))));


--
-- Name: session_permissions 用户可以插入自己的会话权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以插入自己的会话权限" ON public.session_permissions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles 用户可以插入自己的资料; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以插入自己的资料" ON public.profiles FOR INSERT WITH CHECK ((id = auth.uid()));


--
-- Name: friend_requests 用户可以更新接收到的好友请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以更新接收到的好友请求" ON public.friend_requests FOR UPDATE TO authenticated USING ((receiver_id = auth.uid()));


--
-- Name: island_permissions 用户可以更新灵动岛权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以更新灵动岛权限" ON public.island_permissions FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: conversation_participants 用户可以更新自己的会话状态; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以更新自己的会话状态" ON public.conversation_participants FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: friendships 用户可以更新自己的好友关系; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以更新自己的好友关系" ON public.friendships FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: app_permissions 用户可以更新自己的应用权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以更新自己的应用权限" ON public.app_permissions FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles 用户可以更新自己的资料; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以更新自己的资料" ON public.profiles FOR UPDATE USING ((((is_ai_avatar = false) AND (id = auth.uid())) OR ((is_ai_avatar = true) AND (owner_id = auth.uid())))) WITH CHECK ((((is_ai_avatar = false) AND (id = auth.uid())) OR ((is_ai_avatar = true) AND (owner_id = auth.uid()))));


--
-- Name: ai_avatar_permissions 用户可以查看 AI 分身权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看 AI 分身权限" ON public.ai_avatar_permissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_permissions.avatar_id) AND ((ai_avatars.owner_id = auth.uid()) OR (ai_avatars.is_active = true))))));


--
-- Name: profiles 用户可以查看公开资料; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看公开资料" ON public.profiles FOR SELECT USING ((((privacy_settings ->> 'profile_visibility'::text) = 'public'::text) OR (id = auth.uid()) OR (is_ai_avatar = true)));


--
-- Name: messages 用户可以查看参与会话的消息; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看参与会话的消息" ON public.messages FOR SELECT USING ((public.is_conversation_participant(conversation_id, auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM public.message_deletions
  WHERE ((message_deletions.message_id = messages.id) AND (message_deletions.user_id = auth.uid())))))));


--
-- Name: conversations 用户可以查看参与的会话; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看参与的会话" ON public.conversations FOR SELECT USING (public.is_conversation_participant(id, auth.uid()));


--
-- Name: conversation_participants 用户可以查看参与的会话成员; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看参与的会话成员" ON public.conversation_participants FOR SELECT USING (public.is_conversation_participant(conversation_id, auth.uid()));


--
-- Name: friend_requests 用户可以查看发送给自己的好友请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看发送给自己的好友请求" ON public.friend_requests FOR SELECT TO authenticated USING (((receiver_id = auth.uid()) OR (sender_id = auth.uid())));


--
-- Name: ai_avatars 用户可以查看所有激活的 AI 分身; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看所有激活的 AI 分身" ON public.ai_avatars FOR SELECT USING (((is_active = true) OR (owner_id = auth.uid())));


--
-- Name: session_permissions 用户可以查看自己的会话权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的会话权限" ON public.session_permissions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: message_deletions 用户可以查看自己的删除记录; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的删除记录" ON public.message_deletions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: friendships 用户可以查看自己的好友关系; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的好友关系" ON public.friendships FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (friend_id = auth.uid())));


--
-- Name: permission_audit_logs 用户可以查看自己的审计日志; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的审计日志" ON public.permission_audit_logs FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: app_permissions 用户可以查看自己的应用权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的应用权限" ON public.app_permissions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: island_permissions 用户可以查看自己的灵动岛权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的灵动岛权限" ON public.island_permissions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: blacklist 用户可以查看自己的黑名单; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以查看自己的黑名单" ON public.blacklist FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: friendships 用户可以添加好友关系; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以添加好友关系" ON public.friendships FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: app_permissions 用户可以添加应用权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以添加应用权限" ON public.app_permissions FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: island_permissions 用户可以添加灵动岛权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以添加灵动岛权限" ON public.island_permissions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: blacklist 用户可以添加黑名单; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以添加黑名单" ON public.blacklist FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_avatar_permissions 用户可以管理自己 AI 分身的权限; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以管理自己 AI 分身的权限" ON public.ai_avatar_permissions USING ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_permissions.avatar_id) AND (ai_avatars.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ai_avatars
  WHERE ((ai_avatars.id = ai_avatar_permissions.avatar_id) AND (ai_avatars.owner_id = auth.uid())))));


--
-- Name: ai_avatars 用户可以管理自己的 AI 分身; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以管理自己的 AI 分身" ON public.ai_avatars USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: conversation_participants 用户可以退出会话; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "用户可以退出会话" ON public.conversation_participants FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: ai_permission_requests 系统可以创建权限请求; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "系统可以创建权限请求" ON public.ai_permission_requests FOR INSERT WITH CHECK (true);


--
-- Name: ai_avatar_actions 系统可以插入动作日志; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "系统可以插入动作日志" ON public.ai_avatar_actions FOR INSERT WITH CHECK (true);


--
-- Name: permission_audit_logs 系统可以插入审计日志; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "系统可以插入审计日志" ON public.permission_audit_logs FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_chat_logs 系统可以插入日志; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "系统可以插入日志" ON public.ai_chat_logs FOR INSERT WITH CHECK (true);


--
-- Name: group_members 群成员可以查看群成员列表_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "群成员可以查看群成员列表_v2" ON public.group_members FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.group_chats gc
     JOIN public.conversation_participants cp ON ((cp.conversation_id = gc.conversation_id)))
  WHERE ((gc.id = group_members.group_id) AND (cp.user_id = auth.uid())))));


--
-- Name: group_chats 群成员可以查看群聊信息_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "群成员可以查看群聊信息_v2" ON public.group_chats FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = group_chats.conversation_id) AND (cp.user_id = auth.uid())))));


--
-- Name: group_members 群成员可以退出群聊; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "群成员可以退出群聊" ON public.group_members FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: group_chats 群管理员可以更新群聊信息_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "群管理员可以更新群聊信息_v2" ON public.group_chats FOR UPDATE TO authenticated USING ((creator_id = auth.uid()));


--
-- Name: group_members 群管理员可以添加群成员_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "群管理员可以添加群成员_v2" ON public.group_members FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.group_chats gc
     JOIN public.conversation_participants cp ON ((cp.conversation_id = gc.conversation_id)))
  WHERE ((gc.id = group_members.group_id) AND (cp.user_id = auth.uid())))) OR (NOT (EXISTS ( SELECT 1
   FROM public.group_chats gc
  WHERE (gc.id = group_members.group_id))))));


--
-- PostgreSQL database dump complete
--


