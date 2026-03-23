# 🐾 PawMate

**La plataforma integral de gestión de mascotas — App Móvil · Web · Admin · Backend**

> Proyecto Final DAM · Desarrollado por **Mohamed Sabbar**

---

## 📋 Descripción

PawMate es un ecosistema digital completo para el cuidado y gestión de mascotas en España. Conecta a dueños de animales con cuidadores verificados, ofrece seguimiento GPS en tiempo real, historial médico completo y una comunidad activa de amantes de los animales.

---

## 🏗️ Estructura del Proyecto

```
PawMate0/
├── mobile/          📱 App móvil (React Native + Expo)
├── web/             🌐 Carpeta original (vacía / legacy)
├── pawmate-web/     🚀 Landing Page (Vite + React) ← NUEVO
├── admin/           👨‍💼 Panel de administración
└── server/          🔧 Backend API (Node.js + Express)
```

---

## 🚀 Tech Stack

| Plataforma | Tecnologías |
|-----------|-------------|
| **Mobile** | React Native, Expo, Firebase Auth, Firestore |
| **Landing Web** | Vite, React, Framer Motion, Lucide React |
| **Admin** | React / Next.js |
| **Backend** | Node.js, Express, Firebase Admin SDK |

---

## 🎯 Funcionalidades Principales

### 📱 App Móvil
- ✅ Autenticación (Email/Password, Google)
- ✅ Perfiles completos de mascotas (fotos, médico, chip)
- ✅ Seguimiento GPS de paseos con mapa y estadísticas
- ✅ Paw-Port QR Biométrico de emergencia
- ✅ Recordatorios de vacunas y citas veterinarias
- ✅ Comunidad social con feed de fotos
- ✅ Sistema de cuidadores verificados con reservas
- ✅ Dark mode / Light mode
- ✅ Notificaciones push

### 🌐 Landing Page (pawmate-web/)
- ✅ Hero con animaciones Framer Motion
- ✅ Sección de funcionalidades con cards animadas
- ✅ GPS Tracking showcase
- ✅ Comunidad showcase
- ✅ Sección "Cómo Funciona"
- ✅ Testimonials
- ✅ CTA con descarga de app
- ✅ Diseño responsive mobile-first

---

## ▶️ Ejecutar

### Landing Web
```bash
cd pawmate-web
npm install
npm run dev
# → http://localhost:5173
```

### App Móvil
```bash
cd mobile
npm install
npx expo start --clear --tunnel
```

---

## 👨‍💻 Desarrollador

**Mohamed Sabbar**
- 📧 msabbar02@yahoo.com
- 📱 +34 624 170 100
- 🎓 DAM — Desarrollo de Aplicaciones Multiplataforma

---

## 📄 Licencia

Proyecto educativo · Uso académico · © 2026 PawMate
