-- ==========================================
-- PAWMATE - ESQUEMA COMPLETO (12 tablas)
-- Última actualización: 15/04/2026
-- ==========================================

-- ══════════════════════════════════════════
-- MIGRATION: Run these on existing databases
-- ══════════════════════════════════════════
-- USERS
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS iban text;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "completedServices" integer DEFAULT 0;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "galleryPhotos" jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "acceptedSpecies" jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isWalking" boolean DEFAULT false;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "walkingPetId" uuid;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "walkingPets" uuid[] DEFAULT '{}';
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "expoPushToken" text;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "lastSeen" timestamp with time zone;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isVerified" boolean DEFAULT false;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender text;
-- RESERVATIONS
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "walkActive" boolean DEFAULT false;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "petId" uuid REFERENCES public.pets(id) ON DELETE SET NULL;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "paymentIntentId" text;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "completedAt" timestamp with time zone;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "paymentReleased" boolean DEFAULT false;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "paymentReleasedAt" timestamp with time zone;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "ownerAvatar" text;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "caregiverAvatar" text;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "startDateTime" timestamp with time zone;
-- ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "endDateTime" timestamp with time zone;
-- REPORTS
-- ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "reporterUserId" uuid REFERENCES public.users(id) ON DELETE SET NULL;
-- ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "reportedUserId" uuid REFERENCES public.users(id) ON DELETE SET NULL;
-- CONVERSATIONS
-- ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "user1Id" uuid REFERENCES public.users(id) ON DELETE CASCADE;
-- ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "user2Id" uuid REFERENCES public.users(id) ON DELETE CASCADE;
-- ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- ══════════════════════════════════════════
-- 1. USERS
-- ══════════════════════════════════════════
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
  role text DEFAULT 'normal',               -- 'normal', 'owner', 'caregiver', 'admin'
  address jsonb DEFAULT '{}'::jsonb,
  city text,
  province text,
  country text,
  "postalCode" text,
  "birthDate" timestamp with time zone,
  "verificationStatus" text DEFAULT 'unverified', -- 'unverified', 'pending', 'verified'
  "saveWalks" boolean DEFAULT true,
  "saveLocation" boolean DEFAULT true,
  "totalWalks" integer DEFAULT 0,
  "totalDistance" numeric DEFAULT 0,
  "totalMinutes" integer DEFAULT 0,
  "emergencyContacts" jsonb DEFAULT '[]'::jsonb,
  "fcmToken" text,
  -- Verificación
  "verificationRequestedAt" timestamp with time zone,
  "pendingRole" text,
  "idFrontUrl" text,
  "idBackUrl" text,
  "selfieUrl" text,
  "certDocUrl" text,
  -- Cuidador
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
  -- Estado en tiempo real
  "isWalking" boolean DEFAULT false,
  "walkingPetId" uuid,
  "walkingPets" uuid[] DEFAULT '{}',
  -- Push notifications
  "expoPushToken" text,
  -- Sesión / moderación
  "lastSeen" timestamp with time zone,
  last_seen timestamp with time zone,
  is_banned boolean DEFAULT false,
  "isVerified" boolean DEFAULT false,
  gender text,
  created_at timestamp with time zone DEFAULT now()
);

-- ══════════════════════════════════════════
-- 2. PETS
-- ══════════════════════════════════════════
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

-- ══════════════════════════════════════════
-- 3. RESERVATIONS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "caregiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "ownerName" text,
  "caregiverName" text,
  "serviceType" text,
  "petIds" uuid[] DEFAULT '{}',
  "petNames" text[] DEFAULT '{}',
  "startDate" text,
  "endDate" text,
  date timestamp with time zone,
  "startTime" text,
  "endTime" text,
  status text DEFAULT 'pendiente',          -- 'pendiente', 'aceptada', 'activa', 'in_progress', 'completada', 'cancelada'
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
  -- Compatibilidad: petId individual + petIds array
  "petId" uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  -- Avatares para mostrar en historial sin join
  "ownerAvatar" text,
  "caregiverAvatar" text,
  -- Fechas combinadas
  "startDateTime" timestamp with time zone,
  "endDateTime" timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ══════════════════════════════════════════
-- 4. CONVERSATIONS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "caregiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  -- Aliases genéricos (admin: chats que no son owner-caregiver)
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

-- ══════════════════════════════════════════
-- 5. MESSAGES
-- ══════════════════════════════════════════
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

-- ══════════════════════════════════════════
-- 6. NOTIFICATIONS
-- ══════════════════════════════════════════
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

-- ══════════════════════════════════════════
-- 7. REVIEWS
-- ══════════════════════════════════════════
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

-- ══════════════════════════════════════════
-- 8. WALKS
-- ══════════════════════════════════════════
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

-- ══════════════════════════════════════════
-- 9. REPORTS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Quien reportó / quien fue reportado (admin moderation)
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

-- ══════════════════════════════════════════
-- 10. PREFERENCES
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.preferences (
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  species text,
  count integer DEFAULT 1,
  PRIMARY KEY ("userId", species)
);

-- ══════════════════════════════════════════
-- 11. RECENT_ACTIVITY
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.recent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text,
  icon text DEFAULT 'paw',
  created_at timestamp with time zone DEFAULT now()
);

-- ══════════════════════════════════════════
-- 12. SYSTEM_LOGS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text,
  "userEmail" text,
  "actionType" text,
  entity text,
  details text,
  created_at timestamp with time zone DEFAULT now()
);

-- ══════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.pets REPLICA IDENTITY FULL;
ALTER TABLE public.walks REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.recent_activity REPLICA IDENTITY FULL;

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.users,
  public.pets,
  public.walks,
  public.messages,
  public.conversations,
  public.reservations,
  public.notifications,
  public.recent_activity,
  public.reports;

-- ══════════════════════════════════════════
-- TRIGGER: auto-crear usuario al registrarse
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, "firstName", "lastName", "fullName", role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'firstName', ''),
    COALESCE(new.raw_user_meta_data->>'lastName', ''),
    COALESCE(new.raw_user_meta_data->>'fullName', ''),
    'normal'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ══════════════════════════════════════════
-- RLS (permisivo para desarrollo)
-- ══════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pets_all" ON public.pets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "walks_all" ON public.walks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "reservations_all" ON public.reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "conversations_all" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "messages_all" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "notifications_all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "reviews_all" ON public.reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "reports_all" ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "activity_all" ON public.recent_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "system_logs_all" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════
-- LIMPIEZA: borrar tablas que ya no se usan
-- ══════════════════════════════════════════
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public."friendRequests" CASCADE;
-- NOTA: la tabla 'posts' es usada por admin/CommunityPage.jsx para moderación.
-- Si la mantienes, crea aquí la definición. Si quitas la pestaña Comunidad, descomenta:
-- DROP TABLE IF EXISTS public.posts CASCADE;
