-- ═══════════════════════════════════════════════════════════════════════════
-- PAWMATE — DDL COMPLETO (Supabase)
-- Última actualización: 29/04/2026
-- Ejecutable de cero o sobre BD existente. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════
-- EXTENSIONES
-- ══════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLAS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── USERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "firstName" text,
  "lastName" text,
  "fullName" text,
  email text,
  phone text,
  "photoURL" text,
  avatar text,
  bio text,
  role text DEFAULT 'normal',
  address jsonb DEFAULT '{}'::jsonb,
  city text,
  province text,
  country text,
  "postalCode" text,
  "birthDate" timestamp with time zone,
  "verificationStatus" text DEFAULT 'unverified',
  "verificationRejectionReason" text,
  "saveWalks" boolean DEFAULT true,
  "saveLocation" boolean DEFAULT true,
  "totalWalks" integer DEFAULT 0,
  "totalDistance" numeric DEFAULT 0,
  "totalMinutes" integer DEFAULT 0,
  "emergencyContacts" jsonb DEFAULT '[]'::jsonb,
  "fcmToken" text,
  "verificationRequestedAt" timestamp with time zone,
  "pendingRole" text,
  "idFrontUrl" text,
  "idBackUrl" text,
  "selfieUrl" text,
  "certDocUrl" text,
  "acceptedSpecies" text[],
  "serviceTypes" text[],
  "serviceRadius" integer,
  "maxConcurrentWalks" integer,
  "maxConcurrentHotel" integer,
  price numeric DEFAULT 0,
  experience text,
  rating numeric DEFAULT 0,
  "reviewCount" integer DEFAULT 0,
  schedule jsonb DEFAULT '{}'::jsonb,
  latitude numeric,
  longitude numeric,
  "isOnline" boolean DEFAULT false,
  "isGroupWalking" boolean DEFAULT false,
  iban text,
  "completedServices" integer DEFAULT 0,
  "galleryPhotos" jsonb DEFAULT '[]'::jsonb,
  "isWalking" boolean DEFAULT false,
  "walkingPetId" uuid,
  "walkingPets" uuid[] DEFAULT '{}',
  "expoPushToken" text,
  "lastSeen" timestamp with time zone,
  last_seen timestamp with time zone,
  is_banned boolean DEFAULT false,
  "isVerified" boolean DEFAULT false,
  gender text,
  created_at timestamp with time zone DEFAULT now()
);

-- Migración suave: añade columnas si faltan en BDs existentes
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "verificationRejectionReason" text,
  ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isVerified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expoPushToken" text,
  ADD COLUMN IF NOT EXISTS "galleryPhotos" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "walkingPets" uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone;

-- ── PETS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text NOT NULL,
  breed text,
  weight numeric,
  "photoURL" text,
  image text,
  size text,
  "energyLevel" text,
  description text,
  "birthDate" timestamp with time zone,
  birthdate timestamp with time zone,
  sex text,
  gender text,
  color text,
  sterilized boolean DEFAULT false,
  "chipId" text,
  allergies text,
  medications text,
  "medicalConditions" text,
  insurance text,
  "vetName" text,
  "vetPhone" text,
  activity jsonb DEFAULT '{}'::jsonb,
  vaccines jsonb DEFAULT '[]'::jsonb,
  reminders jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ── RESERVATIONS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "caregiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "ownerName" text,
  "caregiverName" text,
  "ownerAvatar" text,
  "caregiverAvatar" text,
  "serviceType" text,
  "petIds" uuid[] DEFAULT '{}',
  "petNames" text[] DEFAULT '{}',
  "petId" uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  "startDate" text,
  "endDate" text,
  date timestamp with time zone,
  "startTime" text,
  "endTime" text,
  "startDateTime" timestamp with time zone,
  "endDateTime" timestamp with time zone,
  status text DEFAULT 'pendiente',
  price numeric,
  "totalPrice" numeric DEFAULT 0,
  notes text,
  "paymentStatus" text,
  "paymentIntentId" text,
  "paymentReleased" boolean DEFAULT false,
  "paymentReleasedAt" timestamp with time zone,
  "qrCode" text,
  "reviewedByOwner" boolean DEFAULT false,
  "walkActive" boolean DEFAULT false,
  "completedAt" timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ── CONVERSATIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "caregiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "user1Id" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "user2Id" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "ownerName" text,
  "caregiverName" text,
  "ownerAvatar" text,
  "caregiverAvatar" text,
  "lastMessage" text,
  "lastMessageAt" timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE("ownerId", "caregiverId")
);

-- ── MESSAGES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  "senderId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "receiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "senderName" text,
  text text,
  "imageUrl" text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- ── NOTIFICATIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type text,
  title text,
  body text,
  icon text,
  "iconBg" text,
  "iconColor" text,
  read boolean DEFAULT false,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ── REVIEWS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reviewerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "reviewerName" text,
  "revieweeId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "revieweeName" text,
  rating integer,
  comment text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── WALKS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.walks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "petId" uuid REFERENCES public.pets(id) ON DELETE CASCADE,
  route jsonb DEFAULT '[]'::jsonb,
  "totalKm" numeric DEFAULT 0,
  calories integer DEFAULT 0,
  "durationSeconds" integer DEFAULT 0,
  "startTime" timestamp with time zone,
  "endTime" timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ── REPORTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  "reporterUserId" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  "reportedUserId" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  "reporterName" text,
  "reporterEmail" text,
  reason text,
  message text,
  "imageUrls" text[] DEFAULT '{}',
  status text DEFAULT 'pending',
  "adminNotes" text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── PREFERENCES ────────────────────────────
CREATE TABLE IF NOT EXISTS public.preferences (
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  species text,
  count integer DEFAULT 1,
  PRIMARY KEY ("userId", species)
);

-- ── RECENT_ACTIVITY ────────────────────────
CREATE TABLE IF NOT EXISTS public.recent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text,
  icon text DEFAULT 'paw',
  created_at timestamp with time zone DEFAULT now()
);

-- ── SYSTEM_LOGS ────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text,
  "userEmail" text,
  "actionType" text,
  entity text,
  details text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── POSTS (comunidad - moderación admin) ───
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "authorName" text,
  "authorAvatar" text,
  caption text,
  "imageUrl" text,
  "imageUrls" text[] DEFAULT '{}',
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  "createdAt" timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ÍNDICES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_pets_owner             ON public.pets("ownerId");
CREATE INDEX IF NOT EXISTS idx_reservations_owner     ON public.reservations("ownerId");
CREATE INDEX IF NOT EXISTS idx_reservations_caregiver ON public.reservations("caregiverId");
CREATE INDEX IF NOT EXISTS idx_reservations_status    ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conv          ON public.messages("conversationId");
CREATE INDEX IF NOT EXISTS idx_messages_receiver      ON public.messages("receiverId");
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications("userId");
CREATE INDEX IF NOT EXISTS idx_reports_status         ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_users_role             ON public.users(role);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. REALTIME
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.users           REPLICA IDENTITY FULL;
ALTER TABLE public.pets            REPLICA IDENTITY FULL;
ALTER TABLE public.walks           REPLICA IDENTITY FULL;
ALTER TABLE public.messages        REPLICA IDENTITY FULL;
ALTER TABLE public.reservations    REPLICA IDENTITY FULL;
ALTER TABLE public.conversations   REPLICA IDENTITY FULL;
ALTER TABLE public.notifications   REPLICA IDENTITY FULL;
ALTER TABLE public.recent_activity REPLICA IDENTITY FULL;
ALTER TABLE public.reports         REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','pets','walks','messages','conversations','reservations',
    'notifications','recent_activity','reports','posts'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FUNCIONES Y TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Auto-crear public.users al crearse auth.users (Google/Email) ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, "firstName", "lastName", "fullName", "photoURL", avatar, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'firstName',
             split_part(COALESCE(new.raw_user_meta_data->>'full_name',
                                 new.raw_user_meta_data->>'name', ''), ' ', 1)),
    COALESCE(new.raw_user_meta_data->>'lastName', ''),
    COALESCE(new.raw_user_meta_data->>'fullName',
             new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'avatar_url',
    'normal'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── ADMIN: borrar usuario completo (auth + cascade public) ──
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_uid uuid)
RETURNS void AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can delete users';
  END IF;
  DELETE FROM auth.users WHERE id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ── ADMIN: banear / desbanear ──
CREATE OR REPLACE FUNCTION public.admin_set_ban(target_uid uuid, banned boolean)
RETURNS void AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can ban users';
  END IF;
  UPDATE public.users SET is_banned = banned WHERE id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_ban(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean) TO authenticated;

-- ── ADMIN: cambiar rol ──
CREATE OR REPLACE FUNCTION public.admin_set_role(target_uid uuid, new_role text)
RETURNS void AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can change roles';
  END IF;
  IF new_role NOT IN ('normal','owner','caregiver','admin') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;
  UPDATE public.users SET role = new_role WHERE id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text) TO authenticated;

-- ── Sincronizar usuarios huérfanos (auth sin public) ──
INSERT INTO public.users (id, email, "fullName", "photoURL", avatar, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', ''),
  au.raw_user_meta_data->>'avatar_url',
  au.raw_user_meta_data->>'avatar_url',
  'normal'
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS — POLÍTICAS PERMISIVAS (panel admin con anon key)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users','pets','walks','reservations','conversations','messages',
    'notifications','reviews','reports','recent_activity','system_logs',
    'posts','preferences'
  ])
  LOOP
    pol := tbl || '_all';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', pol, tbl);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. STORAGE — BUCKETS USADOS POR LA APP
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',       'avatars',       true),
  ('pets',          'pets',          true),
  ('verifications', 'verifications', false),
  ('posts',         'posts',         true),
  ('chat',          'chat',          true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  -- Avatars
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  DROP POLICY IF EXISTS "avatars_auth_write" ON storage.objects;
  CREATE POLICY "avatars_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
  DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
  CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
  DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
  CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

  -- Pets
  DROP POLICY IF EXISTS "pets_public_read" ON storage.objects;
  CREATE POLICY "pets_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'pets');
  DROP POLICY IF EXISTS "pets_auth_all" ON storage.objects;
  CREATE POLICY "pets_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'pets') WITH CHECK (bucket_id = 'pets');

  -- Verifications (privado)
  DROP POLICY IF EXISTS "verifications_auth_all" ON storage.objects;
  CREATE POLICY "verifications_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'verifications') WITH CHECK (bucket_id = 'verifications');

  -- Posts
  DROP POLICY IF EXISTS "posts_public_read" ON storage.objects;
  CREATE POLICY "posts_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
  DROP POLICY IF EXISTS "posts_auth_all" ON storage.objects;
  CREATE POLICY "posts_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'posts') WITH CHECK (bucket_id = 'posts');

  -- Chat
  DROP POLICY IF EXISTS "chat_public_read" ON storage.objects;
  CREATE POLICY "chat_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'chat');
  DROP POLICY IF EXISTS "chat_auth_all" ON storage.objects;
  CREATE POLICY "chat_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'chat') WITH CHECK (bucket_id = 'chat');
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. LIMPIEZA: tablas obsoletas
-- ═══════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public."friendRequests" CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN
-- ═══════════════════════════════════════════════════════════════════════════
