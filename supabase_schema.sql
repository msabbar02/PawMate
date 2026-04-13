-- ==========================================
-- SCRIPT DE MIGRACIÓN: FIREBASE -> SUPABASE
-- PAWMATE
-- ==========================================

-- 1. Tabla: users
-- Esta tabla extiende la tabla auth.users nativa de Supabase
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
  role text DEFAULT 'normal', -- 'normal', 'owner', 'caregiver', 'admin'
  address jsonb DEFAULT '{}'::jsonb, -- {city, postalCode, province, country}
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
  -- Verification fields
  "verificationRequestedAt" timestamp with time zone,
  "pendingRole" text,
  "idFrontUrl" text,
  "idBackUrl" text,
  "selfieUrl" text,
  "certDocUrl" text,
  -- Caregiver-specific fields
  "acceptedSpecies" text[],
  "serviceTypes" text[],
  "serviceRadius" integer,
  "maxConcurrentWalks" integer,
  "maxConcurrentHotel" integer,
  latitude numeric,
  longitude numeric,
  "isOnline" boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Tabla: pets
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

-- 3. Tabla: preferences
CREATE TABLE IF NOT EXISTS public.preferences (
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  species text,
  count integer DEFAULT 1,
  PRIMARY KEY ("userId", species)
);

-- 4. Tabla: notifications
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

-- 5. Tabla: reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "caregiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "petIds" uuid[] DEFAULT '{}',
  date timestamp with time zone,
  "startTime" text,
  "endTime" text,
  status text DEFAULT 'pending', -- 'pending', 'accepted', 'completed', 'cancelled'
  price numeric,
  notes text,
  "paymentStatus" text,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Tabla: messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "senderId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "receiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  text text,
  "imageUrl" text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 7. Tabla: walks
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

-- 8. Tabla: recent_activity
CREATE TABLE IF NOT EXISTS public.recent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text, -- 'pet', 'walk', 'reservation', 'system', 'profile'
  icon text DEFAULT 'paw',
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- REALTIME
-- ==========================================
-- Activar Realtime en las tablas clave usando REPLICA IDENTITY FULL
-- Esto asgura poder escuchar los deletes/updates a nivel cliente.
ALTER TABLE public.pets REPLICA IDENTITY FULL;
ALTER TABLE public.walks REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.recent_activity REPLICA IDENTITY FULL;

-- IMPORTANTE: Crear la publicación supabase_realtime si no existe o añadirle las tablas.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.pets, 
  public.walks, 
  public.messages, 
  public.reservations,
  public.notifications,
  public.recent_activity;

-- ==========================================
-- TRIGGER DE AUTENTICACION
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger as $$
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

-- IMPORTANTE: POLÍTICAS RLS BÁSICAS PARA DESARROLLO (Podes tunear luego)
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pets_accessAll" ON public.pets FOR ALL USING (true);
CREATE POLICY "walks_accessAll" ON public.walks FOR ALL USING (true);
CREATE POLICY "activity_accessAll" ON public.recent_activity FOR ALL USING (true);

-- ==========================================
-- MIGRATION: REALTIME MAP MODULES (execute in Supabase SQL Editor)
-- ==========================================
-- Columna para Modo Manada 🐾
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isGroupWalking" boolean DEFAULT false;

-- Activar Realtime en public.users (para cuidadores online + modo manada)
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
