# PawMate Admin Panel

Panel de administración completo para gestionar la plataforma PawMate.

## Tecnologías


| Librería                   | Versión    | Uso                                               |
| --------------------------- | ----------- | ------------------------------------------------- |
| **React**                   | 18.2        | UI                                                |
| **Vite**                    | 5           | Build tool                                        |
| **React Router DOM**        | 6.x         | Navegación SPA                                   |
| **Supabase JS**             | ^2.101      | Auth + PostgreSQL + Realtime + Storage            |
| **i18next + react-i18next** | 26.x / 17.x | Internacionalización (ES/EN)                     |
| **Recharts**                | ^3.8        | Gráficas del dashboard (área, tarta, compuesta) |
| **FontAwesome**             | ^7.2        | Iconos (solid, regular, brands)                   |
| **lucide-react**            | ^0.354      | Iconos adicionales                                |
| CSS personalizado           | —          | Variables, glassmorphism, tema claro/oscuro       |

Desplegado en **Vercel**.

## Estructura

```
admin/
├── src/
│   ├── components/
│   │   └── AdminLayout.jsx/css        # Sidebar + topbar, nav items, realtime heartbeat, toggle idioma
│   ├── config/
│   │   ├── supabase.js                # Cliente Supabase con fetch timeout de 12 s
│   │   └── api.js                     # Helper para llamar al servidor (ban-email, rating-request)
│   ├── context/
│   │   ├── AuthContext.jsx            # Auth con verificación de role === 'admin', timeout de seguridad
│   │   └── ThemeContext.jsx           # Dark/Light mode persistido en localStorage
│   ├── i18n/
│   │   ├── i18n.js                    # Configuración i18next (idioma guardado en localStorage)
│   │   ├── es.json                    # Traducciones español
│   │   └── en.json                    # Traducciones inglés
│   ├── pages/
│   │   ├── DashboardPage.jsx/css      # KPIs, gráficas con filtro de ventana temporal, actividad reciente
│   │   ├── UsersPage.jsx/css          # Lista usuarios, filtros, ban/unban, ver detalle, editar rol
│   │   ├── UserDetailPage.jsx         # Vista detallada de un usuario (+ ruta /users/:id)
│   │   ├── PetsPage.jsx               # Lista mascotas con propietario, filtro por especie, editar/eliminar
│   │   ├── PetDetailPage.jsx          # Vista detallada de una mascota (+ ruta /pets/:id)
│   │   ├── ReservationsPage.jsx       # Lista reservas, filtro por estado, editar estado, Realtime
│   │   ├── ReservationDetailPage.jsx  # Vista detallada de una reserva (+ ruta /reservations/:id)
│   │   ├── ReportsPage.jsx            # Reportes de usuarios + pestaña de reseñas (moderar/eliminar)
│   │   ├── ReportDetailPage.jsx       # Vista detallada de un reporte (+ ruta /reports/:id)
│   │   ├── LogsPage.jsx               # Logs del sistema (system_logs), filtro por acción, auto-refresh 30 s
│   │   ├── VerificationsPage.jsx/css  # Solicitudes de verificación de cuidadores (aprobar/rechazar + preview documentos)
│   │   ├── AdminsPage.jsx/css         # Gestión de admins: listar, crear nuevo, revocar permisos
│   │   ├── ProfilePage.jsx/css        # Perfil del admin autenticado: editar datos y foto (Supabase Storage)
│   │   ├── LoginPage.jsx/css          # Login con Supabase Auth
│   │   └── DetailPage.css             # CSS compartido para páginas de detalle
│   ├── App.jsx                        # Rutas con ProtectedRoute
│   ├── App.css                        # Variables CSS globales + tema claro/oscuro
│   └── main.jsx                       # Punto de entrada con ErrorBoundary + providers
├── .env                               # Variables de entorno (no comiteado)
├── vite.config.js
└── vercel.json                        # Config de despliegue en Vercel
```

## Rutas


| Ruta                | Página               | Descripción                 |
| ------------------- | --------------------- | ---------------------------- |
| `/login`            | LoginPage             | Acceso público              |
| `/`                 | DashboardPage         | KPIs y gráficas             |
| `/users`            | UsersPage             | Lista de usuarios            |
| `/users/:id`        | UserDetailPage        | Detalle de usuario           |
| `/pets`             | PetsPage              | Lista de mascotas            |
| `/pets/:id`         | PetDetailPage         | Detalle de mascota           |
| `/reservations`     | ReservationsPage      | Lista de reservas            |
| `/reservations/:id` | ReservationDetailPage | Detalle de reserva           |
| `/reports`          | ReportsPage           | Reportes + reseñas          |
| `/reports/:id`      | ReportDetailPage      | Detalle de reporte           |
| `/logs`             | LogsPage              | Logs del sistema             |
| `/verifications`    | VerificationsPage     | Verificaciones de cuidadores |
| `/admins`           | AdminsPage            | Gestión de administradores  |
| `/profile`          | ProfilePage           | Perfil del admin             |

## Funcionalidades

- **Dashboard**: KPIs en tiempo real (usuarios, mascotas, reservas, reportes), gráficas de área/tarta/compuesta con filtros de ventana temporal (1h, 24h, 7d, 30d, todo), actividad reciente
- **Usuarios**: listado con búsqueda y filtro por rol, ban/unban con email automático al servidor, editar rol, ver mascotas del usuario, Realtime (postgres_changes)
- **Mascotas**: listado con propietario resuelto, filtro por especie, editar datos, eliminar
- **Reservas**: listado con filtro por estado, editar estado, eliminar, Realtime (postgres_changes)
- **Reportes**: dos pestañas — reportes de usuarios (resolver/eliminar) y reseñas (moderar/eliminar)
- **Logs**: registro de acciones del sistema (`system_logs`), filtro por tipo de acción, auto-refresco cada 30 s. Las políticas RLS están separadas (`select/insert/modify/delete`): cualquier usuario autenticado puede insertar su propio registro (login, signup, logout…) y solo los admins pueden leerlos/borrarlos. Realtime activo en la vista.
- **Verificaciones**: solicitudes de cuidadores con preview de documentos (DNI frontal/trasero, selfie, certificado), aprobar (cambia `role`) o rechazar
- **Administradores**: listar admins, crear nuevo admin (signup + update role), revocar permisos
- **Superadministrador** (`adminpawmate@gmail.com`): único rol con permiso para gestionar el rol `admin`, banear/eliminar otros admins y cambiar contraseñas de otros admins. Se distingue con badge dorado "Superadmin" en lista de usuarios, detalle, modal de edición, perfil y página de admins. La protección se aplica también a nivel BD mediante el trigger `protect_superadmin` (bloquea cualquier UPDATE directo malicioso).
- **Cambio de contraseña** desde el modal de edición de usuarios (validación realtime: mínimo 6 caracteres + coincidencia). Restringido a superadmin si el destinatario es otro admin.
- **Perfil**: editar nombre, teléfono, bio, ubicación; subir foto de perfil a Supabase Storage
- **Internacionalización**: ES/EN con i18next, idioma persistido en localStorage
- **Tema**: claro/oscuro con persistencia en localStorage
- **Realtime**: heartbeat en el layout + suscripciones en usuarios y reservas
- **Acceso restringido**: solo `role: 'admin'` en la tabla `users`; timeout de seguridad de 5 s en la inicialización de auth
- **RLS reales**: todas las consultas respetan las políticas de `supabase_schema.sql`. El helper SQL `public.is_admin()` permite que los administradores vean/modifiquen filas ajenas sin necesidad de service key en el cliente.

## Variables de entorno

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# Opcional — por defecto apunta a producción
VITE_API_URL=https://api.apppawmate.com
```

## Instalación y ejecución

```bash
cd admin
npm install
npm run dev
```
