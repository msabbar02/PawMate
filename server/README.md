# PawMate Backend Server

API REST para la plataforma PawMate.

## Tecnologías

- **Node.js** + **Express 4**
- **Supabase** (Auth JWT + PostgreSQL con service key — bypass de RLS para tareas administrativas)
- **Resend 6.x** (API de email transaccional cloud, cliente singleton)
- **Stripe 20.x** (PaymentIntent, reembolsos y webhooks con verificación de firma)
- **helmet 8.x** (cabeceras HTTP de seguridad: CSP, HSTS, X-Frame-Options, etc.)
- **express-rate-limit 8.x** (rate-limit global + endpoints sensibles)
- **jsonwebtoken** (verificación del hook de Supabase Auth)
- **CORS** + **dotenv**

## Estructura

```
server/
├── src/
│   ├── index.js                    # Punto de entrada Express + rate limiting + raw body webhook
│   ├── config/
│   │   └── supabase.js             # Cliente Supabase Admin
│   ├── controllers/
│   │   ├── auth.controller.js      # Verificar token, obtener perfil (sin campos sensibles)
│   │   ├── email.controller.js     # Emails HTML de auth, bienvenida y baneo via Resend
│   │   ├── users.controller.js     # CRUD usuarios con filtrado de campos por rol y paginación
│   │   ├── pets.controller.js      # CRUD de mascotas
│   │   ├── notifications.controller.js # Emails de estado de reserva y solicitud de valoración
│   │   └── payment.controller.js   # Stripe PaymentIntent + reembolsos + webhook
│   ├── middleware/
│   │   ├── auth.middleware.js      # Verificar JWT de Supabase + check isAdmin
│   │   └── error.middleware.js     # Manejo global de errores + 404
│   ├── routes/
│   │   ├── index.js                # Router principal + health check
│   │   ├── auth.routes.js          # /api/auth/*
│   │   ├── users.routes.js         # /api/users/*
│   │   ├── pets.routes.js          # /api/pets/*
│   │   ├── notifications.routes.js # /api/notifications/*
│   │   └── payment.routes.js       # /api/payments/*
│   └── utils/
│       └── response.js             # Helpers sendSuccess / sendError
├── package.json
└── .env                            # Variables de entorno (no comiteado)
```

## Endpoints

### Health Check

- `GET /api/health` — Estado del servidor

### Autenticación

- `POST /api/auth/verify-token` — Verificar token JWT de Supabase
- `GET /api/auth/profile` — Perfil propio (sin URLs de documentos de verificación)

### Usuarios (requiere auth)

- `GET /api/users?limit=50&offset=0&role=caregiver&search=` — Listar con paginación (admin)
- `GET /api/users/:id` — Perfil de usuario (campos públicos para otros, todos para uno mismo)
- `PUT /api/users/:id` — Actualizar usuario
- `DELETE /api/users/:id` — Eliminar usuario (admin, no puede auto-eliminarse)

### Mascotas (requiere auth)

- `GET /api/pets` — Listar mascotas del usuario autenticado
- `POST /api/pets` — Crear mascota
- `GET /api/pets/:id` — Obtener mascota por ID
- `PUT /api/pets/:id` — Actualizar mascota
- `DELETE /api/pets/:id` — Eliminar mascota

### Notificaciones (requiere auth, salvo auth-email)

- `POST /api/notifications/reservation-status` — Email HTML al dueño y al cuidador sobre el estado de la reserva
- `POST /api/notifications/welcome-email` — Email de bienvenida al nuevo usuario
- `POST /api/notifications/auth-email` — Hook de Supabase Auth: signup, magic link, recovery, cambio de email (usa su propio JWT HMAC)
- `POST /api/notifications/ban-email` — Email de notificación al usuario cuando un admin lo banea
- `POST /api/notifications/rating-request` — Email al dueño solicitando valorar al cuidador tras reserva completada

### Pagos

- `POST /api/payments/payment-intent` *(auth)* — Crear PaymentIntent de Stripe con validación de reserva
- `POST /api/payments/refund` *(auth)* — Reembolsar pago + actualizar `paymentStatus: 'refunded'` en DB
- `POST /api/payments/webhook` *(Stripe, sin auth)* — Webhook para `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

## Seguridad

- **Helmet** activo: CSP mínima, HSTS, `X-Frame-Options`, `Referrer-Policy`, etc. Si el paquete no está instalado el servidor sigue arrancando con un warning.
- **Rate limiting** por familia de endpoints:
  - `/api/*` — 200 req / 15 min (global, `/api/health` exento).
  - `/api/auth/*` — 20 req / 5 min (anti fuerza bruta).
  - `/api/payments/payment-intent` y `/api/payments/refund` — 10 req / 1 min.
- **Stripe webhook**: verifica la firma con `STRIPE_WEBHOOK_SECRET` y usa raw-body parser. En producción la firma es **obligatoria**: si falta el secret responde `503`. Si la actualización en BD falla devuelve `500` para que Stripe reintente con backoff. **No** marca automáticamente la reserva como `aceptada`; sólo actualiza `paymentStatus = 'paid'` (la aceptación queda en manos del cuidador).
- **Borrado de cuenta** (`DELETE /api/users/:id`): primero borra en Supabase Auth (el `ON DELETE CASCADE` limpia `public.users` automáticamente), evitando dejar cuentas zombie.
- **Manejo de errores**: en producción sólo se devuelven mensajes genéricos por familia HTTP (`Internal Server Error`, `Forbidden`, etc.). Nunca se filtra `err.message` interno ni stack al cliente.
- **Resend** se instancia una sola vez (singleton lazy) en lugar de crear un cliente por envío.
- **Campos sensibles**: `idFrontUrl`, `idBackUrl`, `selfieUrl`, `certDocUrl`, `fcmToken`, `expoPushToken` nunca se exponen a otros usuarios.
- **Pago idempotente**: verifica que la reserva no esté ya pagada antes de crear un PaymentIntent.
- **Doble reembolso**: previene reembolsos duplicados verificando `paymentStatus !== 'refunded'`.
- **RLS** activa en todas las tablas (ver `supabase_schema.sql`). El servidor usa la service key para operaciones administrativas que exigen bypass.

## Instalación

```bash
cd server
npm install
```

## Configuración

Crear archivo `.env`:

```env
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=PawMate <noreply@apppawmate.com>
EMAIL_FROM_SUPPORT=PawMate Soporte <support@apppawmate.com>
EMAIL_FROM_ADMIN=PawMate Admin <admin@apppawmate.com>
SMTP_FROM=noreply@apppawmate.com
SMTP_FROM_SUPPORT=support@apppawmate.com
SMTP_FROM_ADMIN=admin@apppawmate.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase Auth hook JWT (para /api/notifications/auth-email)
SUPABASE_AUTH_HOOK_SECRET=v1,whsec_...
```

## Ejecutar

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```
