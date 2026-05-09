# PawMate Backend Server

API REST para la plataforma PawMate.

## Tecnologías

- **Node.js** + **Express**
- **Supabase** (Auth JWT + PostgreSQL con service key)
- **Resend** (API de email transaccional cloud)
- **Stripe** (pagos, reembolsos y webhooks)
- **express-rate-limit** (protección contra abuso de API — 200 req/15 min)
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
│   │   ├── email.controller.js     # Emails HTML de auth (signup, magic link, recovery, cambio email)
│   │   ├── users.controller.js     # CRUD usuarios con filtrado de campos por rol y paginación
│   │   ├── pets.controller.js      # CRUD de mascotas
│   │   ├── notifications.controller.js # Emails HTML de reserva via Resend
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

### Notificaciones (requiere auth)
- `POST /api/notifications/reservation-status` — Email HTML al dueño y al cuidador sobre el estado de la reserva
- `POST /api/notifications/welcome-email` — Email de bienvenida al nuevo usuario
- `POST /api/notifications/auth-email` — Hook de Supabase Auth (usa su propio JWT)

### Pagos
- `POST /api/payments/payment-intent` *(auth)* — Crear PaymentIntent de Stripe con validación de reserva
- `POST /api/payments/refund` *(auth)* — Reembolsar pago + actualizar `paymentStatus: 'refunded'` en DB
- `POST /api/payments/webhook` *(Stripe, sin auth)* — Webhook para `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

## Seguridad

- **Rate limiting**: 200 req / 15 min por IP en todas las rutas `/api/*`
- **Campos sensibles**: `idFrontUrl`, `idBackUrl`, `selfieUrl`, `certDocUrl`, `fcmToken`, `expoPushToken` nunca se exponen a otros usuarios
- **Pago idempotente**: verifica que la reserva no esté ya pagada antes de crear un PaymentIntent
- **Doble reembolso**: previene reembolsos duplicados verificando `paymentStatus !== 'refunded'`
- **Stripe webhook**: verifica firma con `STRIPE_WEBHOOK_SECRET`; raw body parser en `/api/payments/webhook`

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

---

**Estado**:  Funcional
