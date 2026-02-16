# 🔧 PawMate Backend Server

API REST para la plataforma PawMate.

## 🚀 Tecnologías

- Node.js
- Express
- Firebase Admin SDK
- CORS
- dotenv

## 📂 Estructura (Próximamente)

```
server/
├── src/
│   ├── routes/        # Rutas de la API
│   ├── controllers/   # Controladores
│   ├── models/        # Modelos de datos
│   ├── middleware/    # Middleware (auth, validación)
│   ├── services/      # Servicios (Firebase, etc.)
│   └── utils/         # Utilidades
└── index.js          # Punto de entrada
```

## 🎯 Endpoints (Próximamente)

### Autenticación
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`

### Usuarios
- `GET /api/users`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Mascotas
- `GET /api/pets`
- `POST /api/pets`
- `PUT /api/pets/:id`
- `DELETE /api/pets/:id`

### Posts
- `GET /api/posts`
- `POST /api/posts`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`

### Productos
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

## 🔧 Instalación

```bash
cd server
npm install
```

## ⚙️ Configuración

Crear archivo `.env`:
```env
PORT=3000
FIREBASE_PROJECT_ID=tu-project-id
# Otras variables de entorno
```

## ▶️ Ejecutar

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

---

**Estado**: 🚧 En desarrollo
