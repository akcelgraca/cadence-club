-- ============================================================
-- 027_clubs_and_messages.sql
-- Clubs system + Direct Messages system
-- ============================================================

-- ============================================================
-- CLUBS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clubs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  description  text,
  avatar_url   text,
  city         text,
  category     text,                          -- matches ActivityCategory keys
  is_private   boolean     NOT NULL DEFAULT false,
  owner_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_count int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id  uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role     text        NOT NULL DEFAULT 'member',   -- 'admin' | 'member'
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS clubs_owner_id_idx       ON public.clubs(owner_id);
CREATE INDEX IF NOT EXISTS clubs_is_private_idx     ON public.clubs(is_private);
CREATE INDEX IF NOT EXISTS clubs_member_count_idx   ON public.clubs(member_count DESC);
CREATE INDEX IF NOT EXISTS club_members_club_id_idx ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS club_members_user_id_idx ON public.club_members(user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.clubs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Public clubs are visible to everyone; private clubs only to members
CREATE POLICY "clubs_select" ON public.clubs
  FOR SELECT USING (
    is_private = false
    OR owner_id = auth.uid()
    OR auth.uid() IN (
      SELECT user_id FROM public.club_members WHERE club_id = id
    )
  );

-- Any authenticated user can create a club (they become the owner)
CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Only the owner can update the club
CREATE POLICY "clubs_update" ON public.clubs
  FOR UPDATE USING (auth.uid() = owner_id);

-- Only the owner can delete the club
CREATE POLICY "clubs_delete" ON public.clubs
  FOR DELETE USING (auth.uid() = owner_id);

-- Club membership is visible to everyone
CREATE POLICY "club_members_select" ON public.club_members
  FOR SELECT USING (true);

-- Users can only insert their own membership
CREATE POLICY "club_members_insert" ON public.club_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove only their own membership; owners can remove anyone
CREATE POLICY "club_members_delete" ON public.club_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT owner_id FROM public.clubs WHERE id = club_id
    )
  );

-- ── member_count trigger ─────────────────────────────────────────────────────
-- Keeps clubs.member_count accurate automatically.

CREATE OR REPLACE FUNCTION public.update_club_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_member_count ON public.club_members;
CREATE TRIGGER trg_club_member_count
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();


-- ============================================================
-- DIRECT MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  last_message_at         timestamptz,
  last_message_body       text,
  last_message_sender_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid  NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text        NOT NULL CHECK (char_length(body) > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  is_read         boolean     NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS conv_participants_conv_id_idx ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS conv_participants_user_id_idx ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS messages_conv_id_idx          ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx        ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_is_read_idx          ON public.messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS conversations_last_msg_idx    ON public.conversations(last_message_at DESC NULLS LAST);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                   ENABLE ROW LEVEL SECURITY;

-- A user can see a conversation only if they are a participant
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.conversation_participants WHERE conversation_id = id
    )
  );

-- Any authenticated user can create a conversation
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Participants can update last_message fields (done by the send function)
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.conversation_participants WHERE conversation_id = id
    )
  );

-- Participants can see participation rows
CREATE POLICY "conv_participants_select" ON public.conversation_participants
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT user_id FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
    )
  );

-- Authenticated users can create participation rows (for both parties when starting a conv)
CREATE POLICY "conv_participants_insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Participants can read messages in their conversations
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.conversation_participants WHERE conversation_id = messages.conversation_id
    )
  );

-- Only the sender can insert a message (and must be a participant)
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() IN (
      SELECT user_id FROM public.conversation_participants WHERE conversation_id = messages.conversation_id
    )
  );

-- Participants can mark messages as read
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.conversation_participants WHERE conversation_id = messages.conversation_id
    )
  );

-- ── last_message trigger ─────────────────────────────────────────────────────
-- Updates conversations.last_message_* automatically on every new message.

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_at        = NEW.created_at,
    last_message_body      = left(NEW.body, 200),
    last_message_sender_id = NEW.sender_id
  WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_last_message ON public.messages;
CREATE TRIGGER trg_conversation_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime for the messages table so the chat screen receives
-- new messages instantly without polling.

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- ACTIVITY PHOTO URL
-- Allow storing a photo per activity (Instagram 4:5 format).
-- ============================================================

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS photo_url text;
