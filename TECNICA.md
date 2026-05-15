# PawMate — Documentación Técnica

> Plataforma móvil + web para conectar dueños de mascotas con cuidadores verificados.
> Versión: 1.3 · Última revisión: 2026-05

## Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Flujos clave](#5-flujos-clave)
6. [Módulos](#6-módulos)
7. [Seguridad](#7-seguridad)
8. [Despliegue](#8-despliegue)
9. [Variables de entorno](#9-variables-de-entorno)

## 1. Visión general

```mermaid
mindmap
  root((PawMate))
    Usuarios
      normal
      Dueños
      Cuidadores
      Admins
    Funcionalidades
      Radar GPS
      Reservas
      Chat real-time
      Pagos Stripe
      Recordatorios IA
    Plataformas
      iOS / Android
      Web
      Panel Admin
```

**Propósito:** Resolver la falta de confianza al dejar a tu mascota con un cuidador desconocido, mediante verificación de identidad, pagos seguros, geolocalización en tiempo real y sistema de reseñas.


| Característica   | Valor                                         |
| ----------------- | --------------------------------------------- |
| Usuarios objetivo | Dueños de mascotas + cuidadores particulares |
| Mercado           | España (escalable)                           |
| Modelo de negocio | Comisión por reserva (Stripe)                |
| Modalidades       | Paseo (por horas) · Hotel (por fechas)       |

## 2. Arquitectura del sistema

### Diagrama de alto nivel

```mermaid
flowchart TB
    subgraph Clients[" Clientes"]
        Mobile[App Móvil<br/>React Native + Expo]
        Web[Web Landing<br/>React + Vite]
        Admin[Panel Admin<br/>React + Vite]
    end

    subgraph Backend[" Backend"]
        Server[API Express<br/>Node.js · Vercel]
    end

    subgraph Cloud[" Servicios Cloud"]
        Supabase[( Supabase<br/>Auth + PostgreSQL<br/>Storage + Realtime)]
        Stripe[Stripe]
        Resend[Resend<br/>API Cloud]
        Expo[Expo Push]
        OpenMeteo[Open-Meteo<br/>Weather API]
    end

    Mobile -.SDK.-> Supabase
    Web -.SDK.-> Supabase
    Admin -.SDK.-> Supabase
    Mobile --> Server
    Server --> Supabase
    Server --> Stripe
    Server --> Resend
    Mobile --> Expo
    Mobile -->|clima GPS| OpenMeteo
    Supabase -.Auth Hook.-> Server
```

### Por qué esta arquitectura


| Decisión                                | Motivo                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| **Supabase como backend principal**      | Auth + DB + Storage + Realtime en uno. Reduce complejidad y coste.              |
| **Express solo para tareas server-side** | Emails, pagos Stripe, lógica que requiere service-key (no exponer al cliente). |
| **Cliente directo a Supabase**           | Latencia mínima, RLS protege los datos a nivel de fila.                        |
| **Resend cloud API**                     | Entrega fiable, dashboard de logs, sin servidor de correo propio.               |

## 3. Stack tecnológico

### Móvil

```mermaid
graph LR
    A[React Native 0.81] --> B[Expo 54]
    B --> C[Supabase JS]
    B --> D[Stripe RN]
    B --> E[react-native-maps]
    B --> F[Expo Notifications]
    B --> G[i18next]
    B --> H[Open-Meteo API]
```

### Web / Admin

```mermaid
graph LR
    A[React 19] --> B[Vite 8]
    B --> C[React Router DOM]
    B --> D[Framer Motion]
    B --> E[Three.js + R3F]
    B --> F[Supabase JS]
```

### Server

```mermaid
graph LR
    A[Node.js] --> B[Express 4]
    B --> C[Supabase Service Key]
    B --> D[Stripe SDK]
    B --> E[Resend SDK]
    B --> F[express-rate-limit]
    B --> G[jsonwebtoken]
    B --> H[helmet]
```

### Resumen tabular


| Capa                | Tecnologías                                       |
| ------------------- | -------------------------------------------------- |
| **Frontend móvil** | React Native, Expo, Stripe RN, Maps, Notifications |
| **Frontend web**    | React, Vite, Framer Motion, Three.js               |
| **Backend**         | Express, Node.js                                   |
| **Base de datos**   | Supabase (PostgreSQL)                              |
| **Auth**            | Supabase Auth (JWT + PKCE)                         |
| **Storage**         | Supabase Storage Buckets                           |
| **Realtime**        | Supabase Realtime (WebSockets)                     |
| **Pagos**           | Stripe Connect                                     |
| **Email**           | Resend (API cloud)                                 |
| **Push**            | Expo Push API                                      |
| **Clima**           | Open-Meteo API (gratuita, sin API key)             |
| **i18n**            | i18next (ES + EN)                                  |
| **DNS**             | Namecheap                                          |
| **Hosting**         | Vercel (web/admin/server) + Hetzner (mail)         |

## 4. Modelo de datos

### Diagrama Entidad-Relación

```mermaid
erDiagram
    users ||--o{ pets : "tiene"
    users ||--o{ reservations : "dueño/cuidador"
    users ||--o{ messages : "envía"
    users ||--o{ notifications : "recibe"
    users ||--o{ reviews : "escribe"
    users ||--o{ reports : "reporta"
    users ||--o{ recent_activity : "genera"
    users ||--o{ posts : "publica"
    users ||--o{ preferences : "configura"
    pets  ||--o{ walks : "registra"
    pets  ||--o{ reservations : "incluido en"
    reservations ||--o| reviews : "genera"
    conversations ||--o{ messages : "contiene"
    users ||--o{ conversations : "participa"

    users {
        uuid id PK
        text email
        text role
        text verificationStatus
        numeric rating
    }
    pets {
        uuid id PK
        uuid ownerId FK
        text name
        text species
        text breed
    }
    reservations {
        uuid id PK
        uuid ownerId FK
        uuid caregiverId FK
        text status
        numeric totalPrice
    }
    conversations {
        uuid id PK
        uuid ownerId FK
        uuid caregiverId FK
        text lastMessage
        timestamptz lastMessageAt
    }
    messages {
        uuid id PK
        uuid conversationId FK
        uuid senderId FK
        text text
        boolean read
    }
    notifications {
        uuid id PK
        uuid userId FK
        text type
        text title
        boolean read
    }
    reviews {
        uuid id PK
        uuid reviewerId FK
        uuid revieweeId FK
        int rating
        text comment
    }
    walks {
        uuid id PK
        uuid petId FK
        numeric totalKm
        int durationSeconds
        jsonb route
    }
    reports {
        uuid id PK
        uuid reporterUserId FK
        uuid reportedUserId FK
        text reason
        text status
    }
    recent_activity {
        uuid id PK
        uuid userId FK
        text title
        text type
        text icon
    }
    system_logs {
        uuid id PK
        text userId
        text actionType
        text entity
        text details
    }
    posts {
        uuid id PK
        uuid authorUid FK
        text caption
        int likes
        int comments
    }
    preferences {
        uuid userId FK
        text species
        int count
    }
```

### Tablas principales (resumen)


| Tabla                        | Filas estimadas    | Propósito                    |
| ---------------------------- | ------------------ | ----------------------------- |
| `users`                      | Todos los usuarios | Perfil + rol + datos cuidador |
| `pets`                       | Una por mascota    | Ficha completa de la mascota  |
| `reservations`               | Por reserva        | Bookings con estado           |
| `walks`                      | Por paseo          | Tracking GPS                  |
| `conversations` + `messages` | Chat               | 1:1 mensajería realtime      |
| `notifications`              | Por evento         | Notificaciones in-app         |
| `reviews`                    | Tras reserva       | Reseñas a cuidadores         |
| `reports`                    | Reportes           | Bug reports + denuncias       |
| `system_logs`                | Auditoría         | Trazabilidad de acciones      |



### Storage Buckets


| Bucket    | Contenido                                                                         |
| --------- | --------------------------------------------------------------------------------- |
| `pawmate` | Fotos mascotas, documentos verificación, imágenes reportes, galería cuidadores |
| `avatars` | Fotos perfil de usuarios                                                          |

## 5. Flujos clave

### 5.1 Registro y verificación

```mermaid
sequenceDiagram
    actor U as Usuario
    participant M as App Móvil
    participant S as Supabase Auth
    participant SR as Server Express
    participant BM as Resend

    U->>M: Rellena email + password
    M->>S: signUp()
    S->>SR: Auth Hook (POST /auth-email)
    SR->>BM: Send confirm email (Resend API)
    BM->>U: Email con link
    U->>S: Click confirm link
    S-->>M: Sesión activa
    M->>U: Pantalla principal
```

### 5.2 Reserva y pago

```mermaid
sequenceDiagram
    actor O as Dueño
    actor C as Cuidador
    participant M as App
    participant SR as Server
    participant ST as Stripe
    participant DB as Supabase

    O->>M: Selecciona cuidador y servicio
    M->>SR: POST /api/payments/payment-intent
    SR->>ST: createPaymentIntent
    ST-->>SR: client_secret
    SR-->>M: client_secret
    M->>ST: Confirma pago (3D Secure)
    ST-->>M: Éxito
    M->>DB: insert reservations (status: pendiente, paymentStatus: paid)
    ST->>SR: webhook payment_intent.succeeded (firma verificada)
    SR->>DB: confirma paymentStatus=paid
    DB-->>C: Realtime notification
    C->>M: Acepta reserva manualmente
    M->>DB: update status: aceptada
    DB-->>O: Realtime notification
```

### 5.3 Paseo en tiempo real

```mermaid
flowchart LR
    A[Iniciar paseo] --> B{Permiso GPS?}
    B -->|No| C[Bloquear]
    B -->|Sí| D[watchPositionAsync]
    D --> E[Calcular distancia<br/>haversine]
    E --> F[Render polyline en mapa]
    F --> G[Update users.isWalking]
    G --> H{Detener?}
    H -->|No| D
    H -->|Sí| I[Insert walks + stats]
    I --> J[Update pets.activity]
```

### 5.4 Recordatorios inteligentes (nuevo)

```mermaid
flowchart TD
    A[Usuario crea recordatorio] --> B[Auto-detectar categoría<br/>por palabras clave]
    B --> C{Categoría detectada}
    C -->|vacuna| D[Categoría: vacuna]
    C -->|vet/médico| E[Categoría: visita vet]
    C -->|antiparásito| F[Categoría: antiparásito]
    C -->|otro| G[Categoría: genérico]
    D --> H[Guardar en pets.reminders]
    E --> H
    F --> H
    G --> H
    H --> I[Programar push notification]
    I --> J{¿Es categoría salud?}
    J -->|Sí| K[Alert: ¿Añadir al historial?]
    J -->|No| L[Fin]
    K -->|Aceptar| M[Push a pets.vaccines<br/>o pets.medicalConditions]
```

### 5.5 Chat en tiempo real

```mermaid
sequenceDiagram
    actor A as Usuario A
    actor B as Usuario B
    participant DB as Supabase Realtime

    A->>DB: insert messages
    DB-->>B: WebSocket push (conversación)
    B->>B: Marca conversación como no leída
    B->>DB: update read=true al abrir
    DB-->>A: Confirmación lectura
```

## 6. Módulos

### 6.1 Mobile (`mobile/`)

```mermaid
flowchart TD
    Root[App.js] --> Auth{¿Autenticado?}
    Auth -->|No| Login[LoginScreen]
    Auth -->|No| Signup[SignupScreen]
    Auth -->|Sí| Tabs[Bottom Tabs]
    Tabs --> Home[Home<br/>Mapa + Radar]
    Tabs --> Pets[Mis Mascotas]
    Tabs --> Books[Reservas]
    Tabs --> Care[Cuidadores]
    Tabs --> Set[Ajustes]
    Tabs --> Stack[Stack adicional]
    Stack --> Chat[ChatScreen]
    Stack --> Profile[ProfileScreen]
    Stack --> Notif[NotificationsScreen]
    Stack --> Verify[VerifyScreen]
```

**Pantallas clave:**


| Pantalla            | Función principal                                  |
| ------------------- | --------------------------------------------------- |
| `HomeScreen`        | Mapa con radar de cuidadores online + iniciar paseo |
| `MyPetsScreen`      | CRUD mascotas + recordatorios + vacunas + walks     |
| `BookingScreen`     | Lista reservas + chat por reserva + check-in QR     |
| `CaregiversScreen`  | Buscar cuidadores con filtros                       |
| `ChatScreen`        | Mensajería 1:1 realtime                            |
| `VerifyOwnerScreen` | Subida DNI + selfie para verificación              |

### 6.2 Server (`server/`)

```mermaid
flowchart LR
    REQ[Request] --> CORS[CORS]
    CORS --> RL[Rate Limit]
    RL --> AUTH[Verify Token<br/>middleware]
    AUTH --> ROUTES{Routes}
    ROUTES --> AUTHC["/api/auth"]
    ROUTES --> USERS["/api/users"]
    ROUTES --> PETS["/api/pets"]
    ROUTES --> PAY["/api/payments"]
    ROUTES --> NOTI["/api/notifications"]
```

**Endpoints:**


| Método             | Ruta                                    | Descripción                   |
| ------------------- | --------------------------------------- | ------------------------------ |
| POST                | `/api/auth/verify-token`                | Verifica JWT de Supabase       |
| GET                 | `/api/auth/profile`                     | Perfil propio                  |
| GET/PUT/DELETE      | `/api/users/:id`                        | CRUD usuario (self/admin)      |
| GET/POST/PUT/DELETE | `/api/pets/:id`                         | CRUD mascotas                  |
| POST                | `/api/payments/payment-intent`          | Crear PaymentIntent Stripe     |
| POST                | `/api/payments/refund`                  | Reembolso                      |
| POST                | `/api/payments/webhook`                 | Webhook Stripe                 |
| POST                | `/api/notifications/welcome-email`      | Email bienvenida               |
| POST                | `/api/notifications/reservation-status` | Email cambio estado reserva    |
| POST                | `/api/notifications/auth-email`         | Hook Supabase para emails auth |

### 6.3 Admin (`admin/`)

```mermaid
flowchart LR
    Login[LoginPage<br/>role check: admin] --> Dash[Dashboard]
    Dash --> Users[Usuarios]
    Dash --> Pets[Mascotas]
    Dash --> Res[Reservas]
    Dash --> Msg[Mensajes]
    Dash --> Rep[Reportes]
    Dash --> Logs[Audit Logs]
    Dash --> Verif[Verificaciones]
    Dash --> Adm[Administradores]
    Logs -.realtime.-> DB[(Supabase)]
```

**Funcionalidades:**

- Estadísticas en tiempo real (KPIs)
- Aprobar/rechazar verificaciones de cuidadores
- Banear/desbanear usuarios
- Ver chats entre usuarios (moderación)
- Audit log de todas las acciones del sistema
- Gestionar reportes de bugs/denuncias
- Cambio de contraseña a otros usuarios desde el modal de edición (validación realtime mín. 6 caracteres + coincidencia)
- **Rol Superadministrador** (`adminpawmate@gmail.com`): único con permiso para gestionar el rol `admin` (promover/degradar), banear/eliminar otros admins y cambiar contraseñas a otros admins. Se distingue con badge dorado "Superadmin" en todas las vistas. Las restricciones se replican a nivel BD mediante el trigger `protect_superadmin` para impedir bypass vía UPDATE directos.

### 6.4 Web (`web/`)

Landing page de marketing con secciones animadas.


| Sección     | Animación                                  |
| ------------ | ------------------------------------------- |
| Hero         | 3D objects (Three.js) + texto rotativo      |
| Trust band   | Marquee infinito de logos                   |
| Features     | Cards con hover effects                     |
| Showcase     | Mockups de la app                           |
| Stats        | Contadores animados (intersection observer) |
| Testimonials | Carrusel de reseñas                        |
| CTA          | Botones App Store + Google Play             |

## 7. Seguridad

### Arquitectura de seguridad

```mermaid
flowchart TB
    subgraph Layer1[" Capa 1: Cliente"]
        A[Validación formularios]
        B[HTTPS obligatorio]
    end
    subgraph Layer2[" Capa 2: Auth"]
        C[Supabase Auth JWT + PKCE]
        D[Token expira 1h<br/>Refresh token]
    end
    subgraph Layer3[" Capa 3: Server"]
        E[Rate limiting]
        F[verifyToken middleware]
        G[isAdmin middleware]
        H[CORS whitelist]
    end
    subgraph Layer4[" Capa 4: Base de datos"]
        I[Row Level Security RLS]
        J[Service key solo en server]
    end
    Layer1 --> Layer2 --> Layer3 --> Layer4
```

### Medidas implementadas


| Medida                      | Implementación                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Autenticación**          | Supabase Auth con email/password + Magic Link + OAuth Google                                                                                                |
| **Autorización**           | Roles`normal` / `caregiver` / `admin` con middleware `isAdmin`                                                                                              |
| **Tokens**                  | JWT firmados, expiran en 1h, refresh automático                                                                                                            |
| **Hashing**                 | bcrypt (gestionado por Supabase Auth)                                                                                                                       |
| **HTTPS**                   | Forzado en Vercel + TLS gestionado por Resend                                                                                                               |
| **CORS**                    | Whitelist configurada en server                                                                                                                             |
| **Cabeceras HTTP**          | `helmet` (CSP mínima, HSTS, X-Frame-Options, Referrer-Policy)                                                                                              |
| **Rate limiting**           | 200 req/15 min global + 20/5 min en`/api/auth/*` + 10/1 min en `/api/payments/*`                                                                            |
| **Webhook Stripe**          | Firma`STRIPE_WEBHOOK_SECRET` **obligatoria en producción** (503 si falta). No auto-acepta reservas. Devuelve 500 si falla la BD para que Stripe reintente. |
| **errorHandler**            | En producción sólo mensajes genéricos por código HTTP, sin`err.message` ni stack                                                                        |
| **Borrado de cuenta**       | DELETE primero en Supabase Auth (CASCADE limpia`public.users`); evita cuentas zombie                                                                        |
| **RLS reales**              | Políticas owner-based en todas las tablas + helper`public.is_admin()` `SECURITY DEFINER`                                                                   |
| **system_logs RLS separada**| Políticas independientes`select/insert/modify/delete`. Cualquier `authenticated` puede insertar registros propios (`"userId"::text = auth.uid()::text` o `'Sistema'`); solo admins pueden leer/modificar/borrar.                                |
| **Trigger protect_superadmin** | `BEFORE UPDATE` en `public.users` con `SECURITY DEFINER`. Bloquea cualquier intento de cambiar `role`/`email`/`is_banned` del superadmin y restringe que un admin no-superadmin manipule el rol o el ban de otros admins, incluso vía UPDATE directo desde el SDK. |
| **Email auth hook**         | JWT firmado con`SUPABASE_AUTH_HOOK_SECRET`                                                                                                                  |
| **Service key**             | Solo en server, nunca expuesta al cliente                                                                                                                   |
| **Auto-eliminación**       | Endpoint DELETE protegido (self o admin)                                                                                                                    |
| **Ban detection**           | Realtime listener cierra sesión al banear                                                                                                                  |
| **DKIM/SPF/DMARC**          | Configurados en Namecheap para anti-phishing                                                                                                                |
| **Sin secretos en código** | WeatherAPI, URL backend y demás vienen de variables`EXPO_PUBLIC_*`                                                                                         |

### Privacidad

- DNI/selfies guardados en Supabase Storage privado.
- Endpoint `/auth/profile` filtra campos sensibles (`idFrontUrl`, `idBackUrl`, `selfieUrl`, `expoPushToken`).
- IBAN encriptado pendiente (issue conocido).
- GDPR: usuario puede auto-eliminar cuenta + datos.

## 8. Despliegue

```mermaid
flowchart LR
    subgraph Dev[" Desarrollo local"]
        D1[Mobile: Expo Go]
        D2[Web: localhost:5173]
        D3[Server: localhost:3000]
    end

    subgraph CI[" GitHub"]
        G[git push]
    end

    subgraph Prod[" Producción"]
        V1[Vercel: web]
        V2[Vercel: admin]
        V3[Vercel: server]
        H[Resend: API Cloud]
        S[Supabase: managed]
        E[EAS Build → App Stores]
    end

    Dev --> G
    G -->|auto deploy| V1
    G -->|auto deploy| V2
    G -->|auto deploy| V3
    Dev -->|manual| E
    V3 -.API.-> H
    V1 & V2 & V3 -.SDK.-> S
```

### Tabla de despliegue


| Componente    | Plataforma     | URL                  |
| ------------- | -------------- | -------------------- |
| Web landing   | Vercel         | apppawmate.com       |
| Admin         | Vercel         | admin.apppawmate.com |
| Server API    | Vercel         | api.apppawmate.com   |
| App iOS       | App Store      | (pendiente)          |
| App Android   | Google Play    | (pendiente)          |
| Email         | Resend Cloud   | resend.com           |
| Base de datos | Supabase Cloud | xxxx.supabase.co     |

## 9. Variables de entorno

### Mobile (`mobile/.env`)

```ini
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_BASE_URL=https://api.apppawmate.com
# Opcional: si falta el widget de clima del TopBar muestra el fallback de carga.
EXPO_PUBLIC_WEATHER_API_KEY=
```

### Server (`server/.env`)

```ini
PORT=3000
NODE_ENV=production
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
# Obligatorio en producción: sin esta clave el endpoint de webhook responde 503.
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=PawMate <noreply@apppawmate.com>
EMAIL_FROM_SUPPORT=PawMate Soporte <soporte@apppawmate.com>
EMAIL_FROM_ADMIN=PawMate Admin <admin@apppawmate.com>
SUPABASE_AUTH_HOOK_SECRET=
ALLOWED_ORIGINS=https://apppawmate.com,https://admin.apppawmate.com
```

### Admin / Web (`.env`)

```ini
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

*PawMate ©  2025 - Documentación técnica.*
