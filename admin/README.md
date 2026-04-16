# 👨‍💼 PawMate Admin Panel

Panel de administración completo para gestionar la plataforma PawMate.

## 🚀 Tecnologías

- **React 18** + **Vite 5**
- **Supabase** (Auth + PostgreSQL)
- **Lucide React** (iconos)
- **React Router DOM** (navegación)
- CSS personalizado con variables y diseño glassmorphism
- Desplegado en **Vercel**

## 📂 Estructura

```
admin/
├── src/
│   ├── components/
│   │   └── AdminLayout.jsx/css    # Layout principal (sidebar + topbar)
│   ├── config/
│   │   └── supabase.js            # Cliente Supabase
│   ├── context/
│   │   ├── AuthContext.jsx         # Auth con verificación de rol admin
│   │   └── ThemeContext.jsx        # Dark/Light mode con localStorage
│   ├── pages/
│   │   ├── DashboardPage.jsx/css   # Estadísticas y actividad reciente
│   │   ├── UsersPage.jsx/css       # CRUD usuarios + vista premium
│   │   ├── PetsPage.jsx            # Gestión de mascotas
│   │   ├── ReservationsPage.jsx    # Reservas
│   │   ├── MessagesPage.jsx        # Mensajes
│   │   ├── CommunityPage.jsx       # Moderación de posts
│   │   ├── ReportsPage.jsx         # Reportes
│   │   ├── LogsPage.jsx            # Logs del sistema
│   │   ├── ProfilePage.jsx/css     # Perfil admin editable (foto, datos)
│   │   ├── AdminsPage.jsx/css      # Gestión de administradores
│   │   └── LoginPage.jsx/css       # Login con Supabase Auth
│   ├── App.jsx                     # Rutas y ProtectedRoute
│   ├── App.css                     # Variables CSS + tema claro/oscuro
│   └── main.jsx                    # Punto de entrada con providers
├── .env                            # Variables de entorno (no comiteado)
├── vite.config.js
└── vercel.json                     # Config de despliegue en Vercel
```

## 🎯 Funcionalidades

- 📊 Dashboard con estadísticas en tiempo real (usuarios, mascotas, reservas)
- 👥 Gestión de usuarios con filtros, búsqueda y vista detallada premium
- 🐾 Gestión de mascotas
- 📅 Gestión de reservas
- 💬 Mensajes
- 📝 Moderación de comunidad
- 📈 Reportes y logs
- 👤 Perfil de admin editable (nombre, foto, teléfono, ubicación, bio)
- 🔑 Gestión de administradores (crear nuevos admins, revocar permisos)
- 🌓 Modo claro / oscuro con persistencia en localStorage
- 🔒 Acceso restringido a usuarios con `role: 'admin'` en tabla `users`

## 🔧 Instalación

```bash
cd admin
npm install
```

## ⚙️ Configuración

Crear archivo `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## ▶️ Ejecutar

```bash
npm run dev
```

## 🔐 Acceso

Solo usuarios con `role: 'admin'` en la tabla `users` de Supabase pueden acceder.

## 🚀 Despliegue

Desplegado automáticamente en **Vercel**. Asegurar que las variables de entorno están configuradas en el dashboard de Vercel.

---

**Estado**: ✅ Funcional
