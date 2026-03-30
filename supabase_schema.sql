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
  size text,
  "energyLevel" text,
  description text,
  "birthDate" timestamp with time zone,
  sex text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Tabla: posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "authorName" text,
  "authorRole" text,
  "authorPhotoURL" text,
  caption text,
  "imageUrl" text,      -- Mantenido por retrocompatibilidad
  "imageUrls" text[],   -- Array para multiples imagenes
  "speciesTags" text[],
  "likesCount" integer DEFAULT 0,
  "commentsCount" integer DEFAULT 0,
  "engagementScore" integer DEFAULT 0,
  "likedBy" uuid[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Tabla: comments
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  "authorUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "authorName" text,
  "authorPhotoURL" text,
  text text NOT NULL,
  "replyTo" jsonb,
  "likedBy" uuid[] DEFAULT '{}',
  "likesCount" integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Tabla: friendRequests
CREATE TABLE IF NOT EXISTS public."friendRequests" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fromUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "fromName" text,
  "fromPhotoURL" text,
  "toUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "toName" text,
  status text DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Tabla: friends (tabla relacional muchos a muchos)
CREATE TABLE IF NOT EXISTS public.friends (
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "friendId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("userId", "friendId")
);

-- 7. Tabla: preferences
CREATE TABLE IF NOT EXISTS public.preferences (
  "userId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  species text,
  count integer DEFAULT 1,
  PRIMARY KEY ("userId", species)
);

-- 8. Tabla: reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" uuid REFERENCES public.posts(id) ON DELETE SET NULL, -- Si el post se borra, el reporte persiste
  "reporterUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "reporterName" text,
  "authorUid" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "authorName" text,
  reason text,
  status text DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Tabla: notifications
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

-- 10. Tabla: reservations
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

-- 11. Tabla: messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "senderId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "receiverId" uuid REFERENCES public.users(id) ON DELETE CASCADE,
  text text,
  "imageUrl" text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- TRIGGER DE AUTENTICACION
-- ==========================================
-- Este trigger crea automáticamente un registro en public.users
-- cada vez que un usuario se registra mediante Supabase Auth
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

-- ==========================================
-- ACTIVACION RLS (Row Level Security) (OPCIONAL/INICIAL)
-- Para simplificar la migración al inicio, las politicas 
-- permitiran el acceso anonimo/autenticado total. 
-- DEBES restringir esto despues para producción.
-- ==========================================
-- (Puedes omitir esto si quieres gestionar las politicas desde el Panel de Supabase)
