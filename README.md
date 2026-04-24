# 🐾 PawMate

**La plataforma integral de gestión de mascotas — App Móvil · Landing Web · Admin · Backend**

> Proyecto Final DAM · Desarrollado por **Mohamed Sabbar**

---

## 📋 Descripción

PawMate es un ecosistema digital completo para el cuidado y gestión de mascotas en España. Conecta a dueños de animales con cuidadores verificados, ofrece seguimiento GPS en tiempo real, historial médico completo, chat integrado, pagos con Stripe y una comunidad activa de amantes de los animales.

---

## 🏗️ Estructura del Proyecto

```
PawMate/
├── mobile/          📱 App móvil (React Native 0.81 + Expo 54)
├── pawmate-web/     🌐 Landing Page (Vite 8 + React 19 + Three.js)
├── admin/           👨‍💼 Panel de administración (Vite 5 + React 18)
└── server/          🔧 Backend API REST (Node.js + Express)
```

---

## 🚀 Tech Stack Completo

### 📱 App Móvil — `mobile/`

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Framework** | React Native | 0.81.5 |
| **Runtime** | React | 19.1.0 |
| **Plataforma** | Expo | ~54.0 |
| **Navegación** | React Navigation (Bottom Tabs + Native Stack) | 7.x |
| **Base de datos / Auth** | Supabase JS (PostgreSQL + Auth + Realtime + Storage) | 2.x |
| **Pagos** | Stripe React Native | 0.50.3 |
| **Mapas & GPS** | react-native-maps (Google Maps) | 1.20.1 |
| **Notificaciones push** | Expo Notifications | ~0.32 |
| **Cámara & Fotos** | Expo Camera + Expo Image Picker | ~17.0 |
| **Localización** | Expo Location | ~19.0 |
| **QR Biométrico** | react-native-qrcode-svg + expo-print + expo-sharing | — |
| **Animaciones** | React Native Reanimated + Gesture Handler | 4.1 / 2.28 |
| **Bottom Sheet** | @gorhom/bottom-sheet | 5.x |
| **Iconos** | @expo/vector-icons (Ionicons) + FontAwesome | — |
| **Persistencia** | AsyncStorage | 2.x |
| **i18n** | i18next + react-i18next (ES / EN) | — |
| **Multimedia** | expo-av · expo-contacts · expo-crypto · expo-file-system | — |

---

### 🌐 Landing Page — `pawmate-web/`

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Bundler** | Vite | 8.0.1 |
| **Framework** | React | 19.2.4 |
| **Router** | React Router DOM | v7 |
| **Animaciones** | Framer Motion | 12.x |
| **3D / WebGL** | Three.js + @react-three/fiber + @react-three/drei | 0.184 / 9.x / 10.x |
| **Iconos** | Lucide React + FontAwesome | — |
| **Scroll animado** | react-intersection-observer + react-scroll | — |
| **i18n** | i18next + react-i18next (ES / EN) | — |
| **Auth pages** | Supabase JS (confirm & reset password) | 2.x |
| **Deploy** | Vercel | — |

---

### 👨‍💼 Panel de Administración — `admin/`

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Bundler** | Vite | 5.1.6 |
| **Framework** | React | 18.2.0 |
| **Router** | React Router DOM | v6 |
| **Base de datos / Auth** | Supabase JS (PostgreSQL + Auth) | 2.x |
| **Iconos** | Lucide React + FontAwesome | — |
| **i18n** | i18next + react-i18next (ES / EN) | — |
| **Deploy** | Vercel | — |

---

### 🔧 Backend API — `server/`

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Runtime** | Node.js | LTS |
| **Framework** | Express | 4.18.2 |
| **Base de datos** | Supabase JS (PostgreSQL) | 2.x |
| **Pagos** | Stripe | 20.4.0 |
| **Email transaccional** | Nodemailer → BillionMail SMTP (self-hosted) | 6.x |
| **Autenticación** | jsonwebtoken (JWT middleware) | 9.x |
| **CORS & variables** | cors + dotenv | — |
| **Dev** | Nodemon | 3.x |
| **Deploy** | Vercel (serverless functions) | — |

---

### ☁️ Infraestructura & Servicios

| Servicio | Uso |
|----------|-----|
| **Supabase** | PostgreSQL · Auth · Realtime · Storage (base de datos principal) |
| **Stripe** | Procesamiento de pagos (PaymentIntent + reembolsos) |
| **BillionMail** | Servidor SMTP self-hosted para emails transaccionales |
| **Vercel** | Despliegue: landing web, admin y backend (serverless) |
| **Expo Push** | Notificaciones push en tiempo real a dispositivos |
| **Google Maps** | Mapas nativos y seguimiento GPS de paseos |

---

## 🎯 Funcionalidades Principales

### 📱 App Móvil
- ✅ Autenticación con Supabase Auth (Email/Password, Google OAuth)
- ✅ Perfiles completos de mascotas (fotos, historial médico, chip NFC)
- ✅ Seguimiento GPS en tiempo real de paseos con mapa, distancia, duración y velocidad
- ✅ Modo oscuro personalizado en Google Maps
- ✅ Paw-Port QR Biométrico — código QR de emergencia imprimible y descargable
- ✅ Recordatorios de vacunas y citas veterinarias
- ✅ Chat en tiempo real entre dueños y cuidadores (Supabase Realtime)
- ✅ Sistema de cuidadores verificados con reservas y pagos (Stripe)
- ✅ Flujo de verificación de identidad en 3 pasos (DNI frontal + dorsal + selfie + certificados)
- ✅ Notificaciones push en tiempo real (Expo Notifications)
- ✅ Widget del clima en tiempo real
- ✅ Radar de mascotas cercanas
- ✅ Dark mode / Light mode con tema naranja-navy
- ✅ Localización completa ES / EN (i18next)
- ✅ Banner de perfil incompleto con indicador de progreso

### 🌐 Landing Page (`pawmate-web/`)
- ✅ Hero con elementos 3D flotantes animados (Three.js + @react-three/fiber)
- ✅ Cursor personalizado en forma de huella
- ✅ Navbar flotante de cristal con efecto blur
- ✅ Trust band con marquee infinito
- ✅ Feature cards con animaciones Framer Motion y scroll reveal
- ✅ Showcase de experiencia premium con estadísticas animadas
- ✅ Sección de testimonios
- ✅ CTA con botones de descarga (App Store / Google Play)
- ✅ Páginas de confirmación y reseteo de contraseña (Supabase Auth)
- ✅ Responsive mobile-first · i18n ES/EN

### 👨‍💼 Panel de Administración (`admin/`)
- ✅ Login seguro con verificación de rol admin (Supabase Auth)
- ✅ Dashboard con métricas y estadísticas en tiempo real
- ✅ Gestión completa de usuarios (CRUD, filtros, estado)
- ✅ Gestión de mascotas
- ✅ Gestión y moderación de reservas
- ✅ Moderación de comunidad
- ✅ Bandeja de mensajes y conversaciones
- ✅ Sistema de reportes y logs de actividad
- ✅ Flujo de verificaciones de identidad (aprobar / rechazar con rol)
- ✅ Gestión de administradores (crear / eliminar)
- ✅ Perfil de administrador editable (avatar, datos personales)
- ✅ Dark mode / Light mode · i18n ES/EN
- ✅ Desplegado en Vercel

### 🔧 Backend API (`server/`)
- ✅ API REST modular con Express (auth, users, pets, notifications, payments)
- ✅ Middleware de autenticación con JWT (tokens de Supabase)
- ✅ CORS configurado por entorno (producción / desarrollo local)
- ✅ Procesamiento de pagos con Stripe (PaymentIntent + reembolsos)
- ✅ Emails transaccionales HTML con Nodemailer → BillionMail SMTP (self-hosted)
  - Confirmación de reserva, aceptación/rechazo por el cuidador, bienvenida
- ✅ Health check endpoint (`GET /api/health`)
- ✅ Handlers globales de error y 404
- ✅ Serverless-ready para Vercel

---

## ▶️ Ejecutar en Local

### Landing Web
```bash
cd pawmate-web
npm install
npm run dev
```
> Requiere `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### Panel de Administración
```bash
cd admin
npm install
npm run dev
```
> Requiere `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### App Móvil
```bash
cd mobile
npm install
npx expo start --clear --tunnel
```
> Requiere `.env` con `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Backend
```bash
cd server
npm install
npm run dev
```
> Requiere `.env` con `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `JWT_SECRET`

---

## 👨‍💻 Desarrollador

**Mohamed Sabbar**
- 📧 msabbar02@yahoo.com
- 📱 +34 624 170 100
- 🎓 DAM — Desarrollo de Aplicaciones Multiplataforma
- 🔗 [GitHub](https://github.com/msabbar02/PawMate)

---

## 📄 Licencia

Proyecto educativo · Uso académico · © 2026 PawMate
