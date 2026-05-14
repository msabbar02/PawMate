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
  "hotelPrice" numeric,
  "withdrawName" text,
  "withdrawCountry" text,
  "withdrawIban" text,
  "withdrawPhone" text,
  "petsCaredIds" uuid[] DEFAULT '{}',
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
  ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "hotelPrice" numeric,
  ADD COLUMN IF NOT EXISTS "withdrawName" text,
  ADD COLUMN IF NOT EXISTS "withdrawCountry" text,
  ADD COLUMN IF NOT EXISTS "withdrawIban" text,
  ADD COLUMN IF NOT EXISTS "withdrawPhone" text,
  ADD COLUMN IF NOT EXISTS "petsCaredIds" uuid[] DEFAULT '{}';

-- Migración suave: añade columna totalWalks a pets si falta
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS "totalWalks" integer DEFAULT 0;

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
  "totalWalks" integer DEFAULT 0,
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

-- ── SUPERADMIN: nico email con privilegios totales ──
-- adminpawmate@gmail.com es el superadmin: puede borrar/banear a cualquier admin
-- pero ningún admin (ni él mismo) puede borrarlo o cambiarle el rol.
CREATE OR REPLACE FUNCTION public.is_superadmin(uid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid AND lower(email) = 'adminpawmate@gmail.com'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_superadmin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;

-- ── ADMIN: borrar usuario completo (auth + cascade public) ──
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_uid uuid)
RETURNS void AS $$
DECLARE
  caller_role  text;
  target_role  text;
  target_email text;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can delete users';
  END IF;

  SELECT role, lower(email) INTO target_role, target_email
  FROM public.users WHERE id = target_uid;

  -- El superadmin nunca puede ser borrado (ni siquiera por s mismo).
  IF target_email = 'adminpawmate@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden: superadmin cannot be deleted';
  END IF;

  -- Solo el superadmin puede borrar a otros administradores.
  IF target_role = 'admin' AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: only the superadmin can delete other admins';
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
  caller_role  text;
  target_role  text;
  target_email text;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can ban users';
  END IF;

  SELECT role, lower(email) INTO target_role, target_email
  FROM public.users WHERE id = target_uid;

  IF target_email = 'adminpawmate@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden: superadmin cannot be banned';
  END IF;

  IF target_role = 'admin' AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: only the superadmin can ban other admins';
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
  caller_role  text;
  target_role  text;
  target_email text;
BEGIN
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: only admins can change roles';
  END IF;
  IF new_role NOT IN ('normal','owner','caregiver','admin') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  SELECT role, lower(email) INTO target_role, target_email
  FROM public.users WHERE id = target_uid;

  -- El superadmin nunca puede perder su rol.
  IF target_email = 'adminpawmate@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden: cannot change the role of the superadmin';
  END IF;

  -- Solo el superadmin puede cambiar el rol de un admin (degradarlo) o
  -- promover a un usuario normal a administrador.
  IF (target_role = 'admin' OR new_role = 'admin') AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: only the superadmin can manage admin roles';
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

-- ── Backfill: recalcular completedServices y petsCaredIds para cuidadores ──
-- Ejecutable múltiples veces; recalcula desde reservaciones ya completadas.
UPDATE public.users u
SET "completedServices" = sub.cnt,
    "petsCaredIds"      = sub.pet_ids
FROM (
  SELECT
    r."caregiverId" AS cg_id,
    COUNT(*)::int   AS cnt,
    COALESCE(
      ARRAY(
        SELECT DISTINCT pid
        FROM   public.reservations r2,
               unnest(COALESCE(r2."petIds", ARRAY[]::uuid[])) AS pid
        WHERE  r2."caregiverId" = r."caregiverId"
          AND  r2.status IN ('completada','completed','finalizada')
      ),
      ARRAY[]::uuid[]
    ) AS pet_ids
  FROM public.reservations r
  WHERE r.status IN ('completada','completed','finalizada')
    AND r."caregiverId" IS NOT NULL
  GROUP BY r."caregiverId"
) AS sub
WHERE u.id = sub.cg_id
  AND (COALESCE(u."completedServices",0) < sub.cnt
       OR COALESCE(array_length(u."petsCaredIds",1),0) < COALESCE(array_length(sub.pet_ids,1),0));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS — POLÍTICAS REALES (owner-based + is_admin())
-- ═══════════════════════════════════════════════════════════════════════════
-- El backend usa SERVICE_ROLE (bypass de RLS) para operaciones administrativas.
-- Las apps (mobile/web/admin) usan ANON KEY con sesión de usuario y deben
-- respetar estas políticas. El panel admin solo funciona con usuarios cuyo
-- `users.role = 'admin'`, gracias al helper is_admin() de abajo.
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

-- Helper SECURITY DEFINER para evitar recursión cuando una política de `users`
-- necesita comprobar el rol del propio usuario.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Limpia políticas previas (idempotente).
DO $$
DECLARE
  tbl text;
  pol_rec record;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users','pets','walks','reservations','conversations','messages',
    'notifications','reviews','reports','recent_activity','system_logs',
    'posts','preferences'
  ])
  LOOP
    FOR pol_rec IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_rec.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ── users ──────────────────────────────────────────────────────────────────
-- Cualquier usuario autenticado puede leer perfiles públicos básicos
-- (la app lista cuidadores). Solo el dueño o un admin puede modificar/borrar.
CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY users_insert ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY users_delete ON public.users
  FOR DELETE TO authenticated USING (id = auth.uid() OR public.is_admin());

-- ── pets ───────────────────────────────────────────────────────────────────
CREATE POLICY pets_all ON public.pets
  FOR ALL TO authenticated
  USING ("ownerId" = auth.uid() OR public.is_admin())
  WITH CHECK ("ownerId" = auth.uid() OR public.is_admin());

-- ── walks ──────────────────────────────────────────────────────────────────
CREATE POLICY walks_all ON public.walks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = walks."petId" AND p."ownerId" = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = walks."petId" AND p."ownerId" = auth.uid())
    OR public.is_admin()
  );

-- ── reservations ───────────────────────────────────────────────────────────
CREATE POLICY reservations_all ON public.reservations
  FOR ALL TO authenticated
  USING ("ownerId" = auth.uid() OR "caregiverId" = auth.uid() OR public.is_admin())
  WITH CHECK ("ownerId" = auth.uid() OR "caregiverId" = auth.uid() OR public.is_admin());

-- ── conversations ──────────────────────────────────────────────────────────
CREATE POLICY conversations_all ON public.conversations
  FOR ALL TO authenticated
  USING (
    auth.uid() IN ("ownerId","caregiverId","user1Id","user2Id")
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() IN ("ownerId","caregiverId","user1Id","user2Id")
    OR public.is_admin()
  );

-- ── messages ───────────────────────────────────────────────────────────────
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages."conversationId"
        AND auth.uid() IN (c."ownerId", c."caregiverId", c."user1Id", c."user2Id")
    )
    OR public.is_admin()
  );
CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    "senderId" = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages."conversationId"
        AND auth.uid() IN (c."ownerId", c."caregiverId", c."user1Id", c."user2Id")
    )
  );
CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated USING (
    "senderId" = auth.uid() OR public.is_admin()
  );
CREATE POLICY messages_delete ON public.messages
  FOR DELETE TO authenticated USING (
    "senderId" = auth.uid() OR public.is_admin()
  );

-- ── notifications ──────────────────────────────────────────────────────────
CREATE POLICY notifications_all ON public.notifications
  FOR ALL TO authenticated
  USING ("userId" = auth.uid() OR public.is_admin())
  WITH CHECK ("userId" = auth.uid() OR public.is_admin());

-- ── reviews ────────────────────────────────────────────────────────────────
CREATE POLICY reviews_select ON public.reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT TO authenticated WITH CHECK ("reviewerId" = auth.uid());
CREATE POLICY reviews_update ON public.reviews
  FOR UPDATE TO authenticated USING ("reviewerId" = auth.uid() OR public.is_admin());
CREATE POLICY reviews_delete ON public.reviews
  FOR DELETE TO authenticated USING ("reviewerId" = auth.uid() OR public.is_admin());

-- ── reports ────────────────────────────────────────────────────────────────
CREATE POLICY reports_select ON public.reports
  FOR SELECT TO authenticated USING (
    "reporterUserId" = auth.uid() OR public.is_admin()
  );
CREATE POLICY reports_insert ON public.reports
  FOR INSERT TO authenticated WITH CHECK ("reporterUserId" = auth.uid());
CREATE POLICY reports_update ON public.reports
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY reports_delete ON public.reports
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── recent_activity ────────────────────────────────────────────────────────
CREATE POLICY recent_activity_all ON public.recent_activity
  FOR ALL TO authenticated
  USING ("userId" = auth.uid() OR public.is_admin())
  WITH CHECK ("userId" = auth.uid() OR public.is_admin());

-- ── system_logs ────────────────────────────────────────────────────────────
-- Cualquier usuario autenticado puede insertar entradas de log SIEMPRE que el
-- userId que registra coincida con su propio auth.uid() (o sea sistema).
-- La lectura/edición/borrado queda restringida a administradores.
DROP POLICY IF EXISTS system_logs_all      ON public.system_logs;
DROP POLICY IF EXISTS system_logs_select   ON public.system_logs;
DROP POLICY IF EXISTS system_logs_insert   ON public.system_logs;
DROP POLICY IF EXISTS system_logs_modify   ON public.system_logs;
CREATE POLICY system_logs_select ON public.system_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY system_logs_insert ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    "userId"::text = auth.uid()::text
    OR "userId" = 'Sistema'
    OR public.is_admin()
  );
CREATE POLICY system_logs_modify ON public.system_logs
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY system_logs_delete ON public.system_logs
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── posts ──────────────────────────────────────────────────────────────────
CREATE POLICY posts_select ON public.posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY posts_insert ON public.posts
  FOR INSERT TO authenticated WITH CHECK ("authorUid" = auth.uid());
CREATE POLICY posts_update ON public.posts
  FOR UPDATE TO authenticated USING ("authorUid" = auth.uid() OR public.is_admin());
CREATE POLICY posts_delete ON public.posts
  FOR DELETE TO authenticated USING ("authorUid" = auth.uid() OR public.is_admin());

-- ── preferences ────────────────────────────────────────────────────────────
CREATE POLICY preferences_all ON public.preferences
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. STORAGE — BUCKETS USADOS POR LA APP
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',       'avatars',       true),
  ('pets',          'pets',          true),
  ('verifications', 'verifications', false),
  ('posts',         'posts',         true),
  ('chat',          'chat',          true),
  ('reports',       'reports',       false),
  ('gallery',       'gallery',       true)
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

  -- Reports (privado: solo administradores y el usuario que reportó)
  DROP POLICY IF EXISTS "reports_auth_all" ON storage.objects;
  CREATE POLICY "reports_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'reports') WITH CHECK (bucket_id = 'reports');

  -- Gallery (galerías públicas de cuidadores)
  DROP POLICY IF EXISTS "gallery_public_read" ON storage.objects;
  CREATE POLICY "gallery_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
  DROP POLICY IF EXISTS "gallery_auth_all" ON storage.objects;
  CREATE POLICY "gallery_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'gallery') WITH CHECK (bucket_id = 'gallery');
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. TRIGGERS DE AGREGADOS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Actualizar totalDistance y totalMinutes del dueño cuando se guarda un walk ──
-- La app guarda walks vía supabase.from('walks').insert({petId, totalKm, durationSeconds, ...})
-- pero nunca actualiza users.totalDistance / users.totalMinutes.
-- Este trigger lo hace automáticamente desde el servidor de BD.

CREATE OR REPLACE FUNCTION public.update_user_walk_stats()
RETURNS trigger AS $$
DECLARE
  owner_id uuid;
BEGIN
  -- Look up the owner of the pet
  SELECT "ownerId" INTO owner_id FROM public.pets WHERE id = NEW."petId";
  IF owner_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.users SET
    "totalDistance" = COALESCE("totalDistance", 0) + COALESCE(NEW."totalKm", 0),
    "totalMinutes"  = COALESCE("totalMinutes",  0) + COALESCE(CEIL(NEW."durationSeconds"::numeric / 60)::integer, 0)
  WHERE id = owner_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'update_user_walk_stats failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_walk_inserted ON public.walks;
CREATE TRIGGER on_walk_inserted
  AFTER INSERT ON public.walks
  FOR EACH ROW EXECUTE PROCEDURE public.update_user_walk_stats();

-- ── Backfill: recalcular totalDistance y totalMinutes desde walks existentes ──
-- Ejecutar una sola vez sobre BDs que ya tienen datos.
UPDATE public.users u
SET
  "totalDistance" = COALESCE(agg.total_km, 0),
  "totalMinutes"  = COALESCE(agg.total_min, 0)
FROM (
  SELECT
    p."ownerId" AS uid,
    SUM(w."totalKm") AS total_km,
    SUM(CEIL(w."durationSeconds"::numeric / 60))::integer AS total_min
  FROM public.walks w
  JOIN public.pets p ON p.id = w."petId"
  WHERE p."ownerId" IS NOT NULL
  GROUP BY p."ownerId"
) agg
WHERE u.id = agg.uid
  AND (COALESCE(u."totalDistance", 0) = 0 OR COALESCE(u."totalMinutes", 0) = 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. LIMPIEZA: tablas obsoletas
-- ═══════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public."friendRequests" CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN
-- ═══════════════════════════════════════════════════════════════════════════
