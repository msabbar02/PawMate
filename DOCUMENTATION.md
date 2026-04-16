# PawMate — Full Technical Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Server (API)](#4-server-api)
5. [Mobile App](#5-mobile-app)
6. [Admin Panel](#6-admin-panel)
7. [Web Landing Page](#7-web-landing-page)
8. [External Services](#8-external-services)
9. [Environment Variables](#9-environment-variables)
10. [Code Review & Known Issues](#10-code-review--known-issues)

---

## 1. Project Overview

**PawMate** is a pet care platform connecting pet owners with caregivers. It consists of four modules:

| Module | Tech Stack | Purpose |
|--------|-----------|---------|
| **Mobile** | React Native + Expo | Owner & caregiver mobile app |
| **Server** | Express.js (Node.js) | REST API, emails, payments |
| **Admin** | React + Vite | Admin dashboard |
| **Web** | React + Vite | Marketing landing page |

**Primary backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
**Deployment:** Vercel (server, admin, web)

---

## 2. Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile App  │     │  Admin Panel │     │   Web Page   │
│ (React Native│     │   (React)    │     │   (React)    │
│   + Expo)    │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  Supabase SDK      │  Supabase SDK      │  Supabase SDK
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                     SUPABASE                            │
│  ┌──────────┐  ┌───────────┐  ┌─────────┐  ┌────────┐ │
│  │   Auth   │  │ PostgreSQL│  │ Storage │  │Realtime│ │
│  │  (PKCE)  │  │  + RLS    │  │ Buckets │  │Channels│ │
│  └──────────┘  └───────────┘  └─────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
       │
       │  REST calls (emails, payments)
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Express    │────▶│  Brevo SMTP  │     │    Stripe    │
│   Server     │     │  (emails)    │     │  (payments)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Data Flow

- **Mobile ↔ Supabase:** Direct client SDK for CRUD, auth, realtime subscriptions, storage uploads
- **Mobile → Server:** Email notifications, payment intents, refunds
- **Admin ↔ Supabase:** Direct client SDK for management operations
- **Supabase → Server:** Auth webhook for custom emails (welcome, OTP, magic link)

---

## 3. Database Schema

### Tables

#### `users`
Primary user table for both owners and caregivers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Matches Supabase Auth UID |
| `email` | text | User email |
| `fullName` | text | Display name |
| `role` | text | `'normal'`, `'caregiver'`, `'admin'` |
| `avatar` / `photoURL` | text | Profile photo URL |
| `phone` | text | Phone number |
| `address`, `city`, `postalCode`, `province`, `country` | text | Location |
| `latitude` / `longitude` | float8 | GPS coordinates |
| `birthdate` | text | Date of birth |
| `bio` | text | User bio |
| `is_banned` | boolean | Admin ban flag |
| `ban_reason` | text | Reason for ban |
| `isOnline` | boolean | Caregiver online toggle |
| `isWalking` | boolean | Currently on a walk |
| `walkingPetId` | uuid | Pet being walked |
| `isGroupWalking` | boolean | Group walk mode active |
| `last_seen` | timestamptz | Last activity timestamp |
| `expoPushToken` | text | Push notification token |
| `verificationStatus` | text | `'none'`, `'pending'`, `'approved'`, `'rejected'` |
| `verificationData` | jsonb | DNI photos, selfie, certificate URLs |
| `acceptedSpecies` | jsonb | Species the caregiver accepts |
| `services` | jsonb | Services offered by caregiver |
| `price` | numeric | Caregiver hourly rate |
| `experience` | text | Caregiver experience description |
| `schedule` | jsonb | Weekly availability |
| `maxConcurrent` | int | Max simultaneous bookings |
| `iban` | text | Bank account (payouts) |
| `rating` | numeric | Average review rating |
| `reviewCount` | int | Total reviews received |
| `totalWalks` / `totalDistance` / `totalMinutes` | numeric | Walk statistics |
| `emergencyContacts` | jsonb | Emergency contact list |
| `saveWalks` / `saveLocation` | boolean | Privacy preferences |
| `preferences` | jsonb | App preferences |
| `created_at` | timestamptz | Registration date |

#### `pets`
Pet profiles owned by users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `ownerId` | uuid (FK → users) | Pet owner |
| `name` | text | Pet name |
| `species` | text | `'dog'`, `'cat'`, `'bird'`, etc. |
| `breed` | text | Breed |
| `weight` | numeric | Weight in kg |
| `image` / `photoURL` | text | Main photo URL |
| `size` | text | Small/medium/large |
| `energyLevel` | text | Activity level |
| `birthdate` | timestamptz | Date of birth |
| `gender` / `sex` | text | Gender |
| `color` | text | Coat color |
| `sterilized` | boolean | Sterilization status |
| `chipId` | text | Microchip ID |
| `allergies` / `medications` / `medicalConditions` | text | Health info |
| `insurance` | text | Pet insurance |
| `vetName` / `vetPhone` | text | Veterinarian contact |
| `activity` | jsonb | `{ km, images: [] }` — walk stats + extra photos |
| `vaccines` | jsonb | Vaccination records |
| `reminders` | jsonb | Care reminders |
| `created_at` | timestamptz | Created date |

#### `reservations`
Bookings between owners and caregivers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `ownerId` / `caregiverId` | uuid (FK → users) | Parties |
| `ownerName` / `caregiverName` | text | Cached display names |
| `ownerAvatar` / `caregiverAvatar` | text | Cached avatars |
| `petNames` | text | Pet names for the booking |
| `serviceType` | text | Service type |
| `startDate` / `endDate` | text | Display dates |
| `startDateTime` / `endDateTime` | timestamptz | ISO timestamps |
| `totalPrice` | numeric | Calculated price |
| `status` | text | `'pendiente'`, `'confirmada'`, `'activa'`, `'completada'`, `'cancelada'`, `'rechazada'` |
| `checkinCode` | text | QR code for check-in |
| `checkinConfirmed` | boolean | Check-in verified |
| `cancelledBy` | text | Who cancelled |
| `cancelReason` | text | Cancellation reason |
| `notes` | text | Booking notes |
| `created_at` | timestamptz | Created date |

#### `conversations`
Chat conversations between two users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `ownerId` / `caregiverId` | uuid (FK → users) | Participants |
| `ownerName` / `caregiverName` | text | Display names |
| `ownerAvatar` / `caregiverAvatar` | text | Avatars |
| `lastMessage` | text | Last message preview |
| `lastMessageAt` | timestamptz | Last message timestamp |
| `created_at` | timestamptz | Created date |
| **UNIQUE** | | `(ownerId, caregiverId)` |

#### `messages`
Individual chat messages.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `conversationId` | uuid (FK → conversations) | Parent conversation |
| `senderId` | uuid (FK → users) | Message author |
| `receiverId` | uuid (FK → users) | Message recipient |
| `text` | text | Message content |
| `read` | boolean | Read status |
| `created_at` | timestamptz | Sent time |

#### `notifications`
In-app notifications.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `userId` | uuid (FK → users) | Recipient |
| `type` | text | `'new_message'`, `'booking_request'`, `'booking_confirmed'`, `'booking_cancelled'`, `'walk_started'`, etc. |
| `title` / `body` | text | Notification content |
| `data` | jsonb | Extra payload (conversationId, reservationId, etc.) |
| `read` | boolean | Read status |
| `created_at` | timestamptz | Created time |

#### `reviews`
Caregiver reviews from owners.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `caregiverId` | uuid (FK → users) | Reviewed caregiver |
| `ownerId` | uuid (FK → users) | Review author |
| `ownerName` / `ownerAvatar` | text | Cached author info |
| `reservationId` | uuid (FK → reservations) | Related booking |
| `rating` | int | 1–5 stars |
| `comment` | text | Review text |
| `created_at` | timestamptz | Created time |

#### `walks`
GPS walk tracking records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `petId` | uuid (FK → pets) | Pet walked |
| `route` | jsonb | Array of `{ latitude, longitude }` |
| `totalKm` | numeric | Distance in km |
| `calories` | int | Estimated calories burned |
| `durationSeconds` | int | Walk duration |
| `startTime` / `endTime` | timestamptz | Walk timestamps |
| `created_at` | timestamptz | Created time |

#### `reports`
User-submitted reports (bugs, feedback, incidents).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `userId` | uuid (FK → users) | Reporter |
| `userName` / `userEmail` | text | Reporter info |
| `type` | text | Report category |
| `title` / `description` | text | Report content |
| `imageUrl` | text | Attached image |
| `status` | text | `'pending'`, `'resolved'`, `'dismissed'` |
| `adminNotes` | text | Admin response |
| `created_at` | timestamptz | Created time |

#### `recent_activity`
Activity log for user actions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `userId` | uuid (FK → users) | Actor |
| `title` / `description` | text | Activity info |
| `type` / `icon` | text | Category and display icon |
| `created_at` | timestamptz | Activity time |

#### `system_logs`
Admin audit trail.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `userId` | uuid | Actor |
| `userEmail` | text | Actor email |
| `action` | text | Action type (e.g., `WALK_COMPLETED`, `BOOKING_CREATED`) |
| `module` | text | Module name |
| `details` | jsonb | Extra data |
| `created_at` | timestamptz | Log time |

#### `preferences`
User species preferences for recommendations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `userId` | uuid (FK → users) | User |
| `species` | text | Species name |
| `score` | numeric | Preference score |

#### Database Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `handle_new_user()` | After INSERT on `auth.users` | Creates `users` row from auth metadata |
| `update_caregiver_rating()` | After INSERT on `reviews` | Recalculates caregiver `rating` and `reviewCount` |

---

## 4. Server (API)

**Location:** `server/`
**Stack:** Express.js 4, Node.js
**Deployment:** Vercel (serverless)

### Endpoints

#### Auth Routes (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/verify-token` | Yes | Verifies Supabase JWT token |
| GET | `/me` | Yes | Returns current user profile |

#### Users Routes (`/api/users`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes (admin) | List all users |
| GET | `/:id` | Yes | Get user by ID |
| PUT | `/:id` | Yes (owner/admin) | Update user profile |
| DELETE | `/:id` | Yes (admin) | Delete user |

#### Pets Routes (`/api/pets`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List user's pets |
| GET | `/:id` | Yes | Get pet by ID |
| POST | `/` | Yes | Create pet |
| PUT | `/:id` | Yes | Update pet |
| DELETE | `/:id` | Yes | Delete pet |

#### Payment Routes (`/api/payments`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/create-intent` | Yes | Create Stripe PaymentIntent |
| POST | `/refund` | Yes | Refund a payment |

#### Notification/Email Routes (`/api/notifications`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reservation-status` | **None** | Send reservation status email |
| POST | `/welcome-email` | **None** | Send welcome email |
| POST | `/auth-email` | Webhook | Supabase auth email hook |

### Middleware
- **`auth.middleware.js`**: Verifies Supabase JWT, fetches user profile, sets `req.user` with `uid`, `email`, `role`, `isAdmin`
- **`error.middleware.js`**: Global error handler, returns `{ success: false, message }`

### Email Templates
Sent via **Brevo SMTP**:
- **Welcome email**: Branded HTML with user's name
- **Reservation status**: Dynamic template based on status (confirmed, cancelled, completed, etc.)
- **Auth hook**: Custom OTP/magic-link/confirmation emails (replaces Supabase defaults)

---

## 5. Mobile App

**Location:** `mobile/`
**Stack:** React Native 0.76 + Expo SDK 52
**Entry:** `App.js` → Providers (Auth, Theme, SafeStripe) → `AppNavigator`

### Navigation Structure

```
Stack Navigator (Root)
│
├── LoginScreen (unauthenticated)
├── SignupScreen (unauthenticated)
│
└── MainTabs (authenticated - Bottom Tab Navigator)
    ├── 🏠 Home          → HomeScreen (map + radar + walk tracker)
    ├── 🐾 Mascotas      → MyPetsScreen (pet management)
    ├── 📋 Reservas      → BookingScreen (bookings - hidden for role='normal')
    ├── 🧑‍⚕️ Cuidadores   → CaregiversScreen OR CaregiverDashboardScreen
    └── ⚙️ Ajustes       → SettingsScreen
    
    Additional Stack Screens:
    ├── CaregiverProfile  → CaregiverProfileScreen
    ├── Messages          → MessagesScreen
    ├── CreateBooking     → CreateBookingScreen
    ├── Chat              → ChatScreen
    ├── CaregiverSetup    → CaregiverSetupScreen
    ├── Verify            → VerifyOwnerScreen
    ├── Notifications     → NotificationsScreen
    ├── Profile           → ProfileScreen
    └── Settings          → SettingsScreen
```

### Screens

| Screen | Description |
|--------|-------------|
| **HomeScreen** | Map with caregiver radar (online caregivers as markers), group walk mode, SOS button, weather widget, walk tracking (GPS + polyline + timer). Dog picker modal for walk initiation. |
| **MyPetsScreen** | Pet CRUD with wizard-style modal (7 steps: photo → basic → breed → health → medical → vet → reminders). Walk tracking per pet. Walk history with share. Vaccine & reminder management. Multiple photo support (up to 5). |
| **BookingScreen** | Two-mode view: card list + conversation list. Reservation detail modal with status actions (confirm, start, complete, cancel + reason). QR check-in code. Chat modal per reservation. Review submission. Delete for cancelled/completed. |
| **CaregiversScreen** | List of verified caregivers with filters (species, distance). Navigate to caregiver profile. |
| **CaregiverDashboardScreen** | Caregiver's management hub: stats, availability toggle, booking management, earnings. |
| **CaregiverProfileScreen** | Public profile: General info, schedule, reviews tabs. Chat or book actions. |
| **LoginScreen** | Email/password login with animated background. |
| **SignupScreen** | Registration with password strength validation (8+ chars, uppercase, number, special). |
| **ProfileScreen** | Edit profile: name, phone, address (GPS auto-detect), birth date, bio, avatar upload, emergency contacts. |
| **SettingsScreen** | Theme toggle, left-hand mode, change password, invite friend, privacy policy, bug report, delete account. |
| **NotificationsScreen** | Notification list with batch actions (select all, mark read, delete). Click navigates to relevant screen. |
| **ChatScreen** | Real-time 1:1 messaging with Supabase realtime channel. |
| **MessagesScreen** | Conversation list with last message preview. |
| **VerifyOwnerScreen** | Identity verification flow: role selection → DNI upload → selfie → (certificate for caregivers) → species/services config. |
| **CreateBookingScreen** | Booking creation: service type, dates, pet selection, price calculation. |

### Key Features

#### Walk Tracking
- Start from **Home** (dog picker) or from **MyPets** (per-pet)
- Walk state synced via `users.isWalking` flag — prevents concurrent walks across screens
- GPS tracking with `Location.watchPositionAsync` (high accuracy, 3s interval, 5m distance)
- Haversine distance calculation, live timer
- Polyline rendered on MapView during walk
- Walk saved to `walks` table on stop, pet `activity.km` updated

#### Caregiver Radar
- Map shows online caregivers as markers
- Realtime updates via Supabase channels
- Group walk mode for community walks
- Distance-based filtering (500m / 2km / 5km chips)

#### Reservation Flow
1. Owner browses caregivers → views profile → creates booking
2. Notification sent to caregiver
3. Caregiver confirms/rejects from BookingScreen
4. On confirm: QR check-in code generated
5. Owner checks in with QR
6. Caregiver marks as active → completes
7. Owner can leave review after completion
8. Emails sent at each status change

#### Notification System
- In-app notifications stored in `notifications` table
- Expo push notifications via `exp.host` API
- Click handling routes to relevant screen (chat, reservations)

### State Management

**AuthContext** provides:
- `user` — Supabase auth user object
- `userData` — Full user profile from `users` table
- `refreshUserData()` — Re-fetch profile from DB
- `updateUserOptimistic()` — Optimistic UI updates
- `unreadMessages` — Count of unread messages
- `pendingBookings` — Count of pending reservations
- Presence heartbeat every 60s
- Ban detection via realtime listener

**ThemeContext** provides:
- `isDarkMode` / `toggleDarkMode()` — Persisted to AsyncStorage
- `isLeftHanded` / `toggleLeftHanded()` — UI layout flip
- `theme` — Color tokens for current mode

### Theme
- **Brand primary:** `#F5A623` (orange)
- **Dark background:** `#1A1A2E`
- **Light background:** `#F7F7FA`
- Light and dark mode with smooth transitions

---

## 6. Admin Panel

**Location:** `admin/`
**Stack:** React 19 + Vite 6
**Auth:** Supabase email/password (role check: `admin` only)
**Deployment:** Vercel

### Pages

| Page | Route | Description |
|------|-------|-------------|
| **LoginPage** | `/` | Admin login with animated background |
| **DashboardPage** | `/` | KPI cards (users, pets, reservations, revenue, reports), recent activity log, quick stats charts |
| **UsersPage** | `/users` | User CRUD: search, filter by role/status, ban/unban, verify/reject, edit profile, view details with pet list. Privacy notice for passwords. |
| **PetsPage** | `/pets` | Pet list with owner info: view details, delete. Species icons. |
| **ReservationsPage** | `/reservations` | Reservation management: filter by status, view details, update status. |
| **MessagesPage** | `/messages` | Conversation browser: select conversation → view messages. Real-time updates. |
| **ReportsPage** | `/reports` | User reports: view, add admin notes, mark resolved/dismissed, delete. Image viewer. |
| **LogsPage** | `/logs` | System audit log: searchable, filterable by module/action. |
| **CommunityPage** | `/community` | (Exists but not routed — placeholder) |

### Layout
- **AdminLayout**: Sidebar navigation with icons, collapsible, user avatar, sign-out button. Dark gradient theme.

### Auth Flow
1. Admin enters email/password → `supabase.auth.signInWithPassword()`
2. Fetches user profile → checks `role === 'admin'`
3. Non-admin users see error, session cleared
4. `onAuthStateChange` listener maintains session
5. Protected routes redirect to login if unauthenticated

### Real-time
- Dashboard: realtime channels for users, pets, reservations, activity, reports tables
- Messages: realtime for conversations + messages
- All tables auto-refresh on changes

---

## 7. Web Landing Page

**Location:** `pawmate-web/`
**Stack:** React 19 + Vite 8 + Framer Motion
**Deployment:** Vercel

### Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page with animated sections |
| `/confirm` | Email confirmation success page |
| `/reset-password` | Password reset form |

### Sections
1. **Navbar** — Floating glass blur, responsive hamburger, dark/light toggle
2. **Hero** — Rotating accent words animation, gradient glows, download CTA
3. **Trust Band** — Infinite marquee of partner logos/badges
4. **Features** — 6 feature cards with hover effects
5. **Showcase** — App screenshots/mockups
6. **Stats** — Animated counters (triggered on scroll intersection)
7. **Testimonials** — User review quotes
8. **CTA** — Download buttons (App Store, Google Play)
9. **Footer** — Links and social

### Theme
- Dark/light mode persisted to `localStorage('pawmate-theme')`
- Framer Motion for all animations

---

## 8. External Services

| Service | Module | Purpose | Config |
|---------|--------|---------|--------|
| **Supabase** | All | Auth, DB, Storage, Realtime | URL + anon key |
| **Stripe** | Server + Mobile | Payment processing | Secret key (server) + publishable key (mobile) |
| **Brevo (Sendinblue)** | Server | Transactional emails via SMTP | SMTP user + password |
| **Expo Push** | Mobile | Push notifications | Expo push token (auto) |
| **WeatherAPI** | Mobile | Weather data on home map | API key in TopBar.js |
| **Google Maps** | Mobile | MapView, markers, polylines | Expo built-in |
| **Firebase** | Mobile (legacy) | Previously used for auth/storage — still initialized | API key + config |

### Supabase Storage Buckets
- **`pawmate`** — Pet photos, verification documents, report images, gallery photos
- **`avatars`** — User profile photos

### Image Upload Pipeline
1. `expo-image-picker` selects image
2. `expo-file-system` reads as base64
3. `base64-arraybuffer` decodes to ArrayBuffer
4. Upload to Supabase Storage bucket
5. Get public URL → update database row
6. Fallback: store base64 data URL if bucket unavailable

---

## 9. Environment Variables

### Mobile (`mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

### Server (`server/.env`)
```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ... (service role key)
STRIPE_SECRET_KEY=sk_...
BREVO_SMTP_USER=...
BREVO_SMTP_PASS=...
SUPABASE_AUTH_HOOK_SECRET=... (optional)
```

### Admin (`admin/.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Web (`pawmate-web/.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 10. Code Review & Known Issues

### CRITICAL

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 1 | **RLS policies allow full access** | `supabase_schema.sql` | All policies are `USING (true)`. Any authenticated user can read/write all data in all tables. |
| 2 | **Privilege escalation** | `server/src/controllers/users.controller.js` | `updateUser` accepts raw `req.body` — user can set `role: 'admin'` on themselves. |
| 3 | **Hardcoded API keys** | `mobile/src/config/firebase.js`, `admin/src/config/firebase.js`, `mobile/src/components/TopBar.js` | Firebase keys and WeatherAPI key in source code. |
| 4 | **Unauthenticated email endpoints** | `server/src/routes/notifications.routes.js` | `/reservation-status`, `/welcome-email` have no auth middleware. Anyone can trigger emails. |
| 5 | **CORS allows all origins** | `server/src/index.js` | `app.use(cors())` with no origin restriction. |

### HIGH

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 6 | **Mass assignment in pets** | `server/src/controllers/pets.controller.js` | `createPet` and `updatePet` spread raw `req.body` into DB. |
| 7 | **No refund authorization** | `server/src/controllers/payment.controller.js` | Any user can refund any payment. No ownership check. |
| 8 | **getUserById exposes all data** | `server/src/routes/users.routes.js` | Any auth user can fetch any user's full profile (IBAN, phone, etc.). |
| 9 | **No rate limiting** | `server/src/index.js` | No rate limiter on any endpoint. Email endpoints vulnerable to abuse. |
| 10 | **Banned users keep API access** | `server/src/middleware/auth.middleware.js` | `verifyToken` never checks `is_banned`. |
| 11 | **Password policy inconsistency** | Signup requires 8 chars, Settings requires 6 | Users can downgrade password strength. |
| 12 | **IBAN stored in plaintext** | `users` table | Financial PII with no encryption. |

### MEDIUM

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 13 | **Duplicated walk logic** | `HomeScreen.js` + `MyPetsScreen.js` | ~100 lines of identical walk tracking code. Should be a shared hook. |
| 14 | **Duplicate utility functions** | `haversineKm`, `formatDuration` | Copy-pasted across screens. |
| 15 | **No database indexes** | `supabase_schema.sql` | No indexes beyond PKs. Queries on `ownerId`, `role`, `status` do full scans. |
| 16 | **N+1 queries in admin** | `admin/src/pages/PetsPage.jsx` | Each pet triggers a separate owner fetch. |
| 17 | **Duplicate/conflicting columns** | `pets` table | `birthDate`/`birthdate`, `sex`/`gender`, `image`/`photoURL` — same data, different columns. |
| 18 | **Account deletion incomplete** | `SettingsScreen.js` | Only deletes `users` row. Orphans pets, reservations, messages, storage files, and auth user. |

### LOW

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 19 | **Dead Firebase config** | `admin/src/config/firebase.js` | Imported but never used. Exposes keys for no reason. |
| 20 | **Misleading function name** | `storageHelpers.js` | `saveAvatarToFirestore` uses Supabase, not Firestore. |
| 21 | **Stale UI references** | `admin/src/pages/UsersPage.jsx` | Privacy notice mentions "Firebase Authentication" and "Firestore". |
| 22 | **`Math.random()` as React key** | `admin/src/pages/LogsPage.jsx` | Defeats React reconciliation. |
