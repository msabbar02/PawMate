# 🐾 PawMate

**La plataforma integral de gestión de mascotas — App Móvil · Web · Admin · Backend**

> Proyecto Final DAM · Desarrollado por **Mohamed Sabbar**

---

## 📋 Descripción

PawMate es un ecosistema digital completo para el cuidado y gestión de mascotas en España. Conecta a dueños de animales con cuidadores verificados, ofrece seguimiento GPS en tiempo real, historial médico completo y una comunidad activa de amantes de los animales.

---

## 🏗️ Estructura del Proyecto

```
PawMate/
├── mobile/          📱 App móvil (React Native + Expo)
├── pawmate-web/     🌐 Landing Page (Vite + React)
├── admin/           👨‍💼 Panel de administración (Vite + React)
└── server/          🔧 Backend API (Node.js + Express)
```

---

## 🚀 Tech Stack

| Plataforma | Tecnologías |
|-----------|-------------|
| **Mobile** | React Native, Expo, Supabase Auth, Supabase DB |
| **Landing Web** | Vite 8, React 19, Framer Motion, Lucide React |
| **Admin** | Vite 5, React 18, Supabase, Lucide React |
| **Backend** | Node.js, Express, Supabase, Brevo (email), Stripe |
| **Base de datos** | Supabase (PostgreSQL) |
| **Despliegue** | Vercel (web + admin), Supabase Cloud |

---

## 🎯 Funcionalidades Principales

### 📱 App Móvil
- ✅ Autenticación (Email/Password, Google) con Supabase Auth
- ✅ Perfiles completos de mascotas (fotos, médico, chip)
- ✅ Seguimiento GPS de paseos con mapa y estadísticas
- ✅ Paw-Port QR Biométrico de emergencia
- ✅ Recordatorios de vacunas y citas veterinarias
- ✅ Comunidad social con feed de fotos
- ✅ Sistema de cuidadores verificados con reservas y pagos (Stripe)
- ✅ Dark mode / Light mode
- ✅ Notificaciones push (Expo Push)
- ✅ Widget del clima en tiempo real
- ✅ Radar de mascotas cercanas

### 🌐 Landing Page (pawmate-web/)
- ✅ Hero con animaciones Framer Motion y texto rotativo
- ✅ Navbar flotante de cristal con blur
- ✅ Trust band con marquee infinito
- ✅ 6 feature cards con hover e iconos
- ✅ Showcase de experiencia premium
- ✅ Estadísticas animadas con contadores
- ✅ Testimonios de usuarios
- ✅ CTA con botones de descarga
- ✅ Dark mode / Light mode
- ✅ Diseño responsive (mobile-first)

### 👨‍💼 Panel de Administración (admin/)
- ✅ Login seguro con Supabase Auth (verificación de rol admin)
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión de usuarios (CRUD, filtros, vista premium)
- ✅ Gestión de mascotas
- ✅ Gestión de reservas
- ✅ Moderación de comunidad
- ✅ Mensajes
- ✅ Reportes y logs
- ✅ Perfil de administrador editable (foto, datos)
- ✅ Gestión de administradores (crear/eliminar)
- ✅ Dark mode / Light mode
- ✅ Desplegado en Vercel

### 🔧 Backend API (server/)
- ✅ API REST con Express
- ✅ Autenticación con Supabase JWT
- ✅ CRUD de usuarios, mascotas
- ✅ Pagos con Stripe (PaymentIntent, reembolsos)
- ✅ Notificaciones por email con Brevo SMTP
- ✅ Health check endpoint
- ✅ Middleware de errores y 404

---

## ▶️ Ejecutar

### Landing Web
```bash
cd pawmate-web
npm install
npm run dev
```

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

### Backend
```bash
cd server
npm install
npm run dev
```
> Requiere `.env` con `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `BREVO_SMTP_KEY`, `STRIPE_SECRET_KEY`

---

## 👨‍💻 Desarrollador

**Mohamed Sabbar**
- 📧 msabbar02@yahoo.com
- 📱 +34 624 170 100
- 🎓 DAM — Desarrollo de Aplicaciones Multiplataforma

---

## 📄 Licencia

Proyecto educativo · Uso académico · © 2026 PawMate
