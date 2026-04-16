# 🔧 PawMate Backend Server

API REST para la plataforma PawMate.

## 🚀 Tecnologías

- **Node.js** + **Express**
- **Supabase** (Auth JWT + PostgreSQL)
- **Brevo** (SMTP para emails transaccionales)
- **Stripe** (pagos y reembolsos)
- **CORS** + **dotenv**

## 📂 Estructura

```
server/
├── src/
│   ├── index.js                    # Punto de entrada Express
│   ├── config/
│   │   └── supabase.js             # Cliente Supabase Admin
│   ├── controllers/
│   │   ├── auth.controller.js      # Verificar token, obtener perfil
│   │   ├── users.controller.js     # CRUD de usuarios
│   │   ├── pets.controller.js      # CRUD de mascotas
│   │   ├── notifications.controller.js # Emails de reserva (Brevo)
│   │   └── payment.controller.js   # Stripe PaymentIntent + reembolsos
│   ├── middleware/
│   │   ├── auth.middleware.js      # Verificar JWT de Supabase
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

## 🎯 Endpoints

### Health Check
- `GET /api/health` — Estado del servidor

### Autenticación
- `POST /api/auth/verify-token` — Verificar token JWT de Supabase
- `GET /api/auth/profile` — Obtener perfil del usuario autenticado

### Usuarios (requiere auth)
- `GET /api/users` — Listar usuarios (solo admin)
- `GET /api/users/:id` — Obtener usuario por ID
- `PUT /api/users/:id` — Actualizar usuario
- `DELETE /api/users/:id` — Eliminar usuario (solo admin)

### Mascotas (requiere auth)
- `GET /api/pets` — Listar mascotas del usuario
- `POST /api/pets` — Crear mascota
- `GET /api/pets/:id` — Obtener mascota por ID
- `PUT /api/pets/:id` — Actualizar mascota
- `DELETE /api/pets/:id` — Eliminar mascota

### Notificaciones
- `POST /api/notifications/reservation-status` — Enviar email al dueño cuando el cuidador acepta/rechaza reserva

### Pagos (requiere auth)
- `POST /api/payments/payment-intent` — Crear PaymentIntent de Stripe
- `POST /api/payments/refund` — Reembolsar pago

## 🔧 Instalación

```bash
cd server
npm install
```

## ⚙️ Configuración

Crear archivo `.env`:
```env
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key

# Brevo SMTP (emails)
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=tu-email@brevo.com
BREVO_SMTP_PASS=tu-api-key
BREVO_FROM_EMAIL=noreply@pawmate.com

# Stripe
STRIPE_SECRET_KEY=sk_...
```

## ▶️ Ejecutar

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

---

**Estado**: ✅ Funcional
