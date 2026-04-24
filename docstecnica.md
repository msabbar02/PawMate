# 📘 PawMate — Documentación Técnica

> Plataforma móvil + web para conectar dueños de mascotas con cuidadores verificados.
> Versión: 1.0 · Última revisión: 2026-04

---

## 📑 Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Flujos clave](#5-flujos-clave)
6. [Módulos](#6-módulos)
7. [Seguridad](#7-seguridad)
8. [Despliegue](#8-despliegue)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Issues conocidos](#10-issues-conocidos)

---

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
| Modalidades       | Paseo · Hotel ·                             |

---

## 2. Arquitectura del sistema

### Diagrama de alto nivel

```mermaid
flowchart TB
    subgraph Clients["🖥️ Clientes"]
        Mobile[📱 App Móvil<br/>React Native + Expo]
        Web[🌐 Web Landing<br/>React + Vite]
        Admin[👨‍💼 Panel Admin<br/>React + Vite]
    end

    subgraph Backend["⚙️ Backend"]
        Server[🚀 API Express<br/>Node.js · Vercel]
    end

    subgraph Cloud["☁️ Servicios Cloud"]
        Supabase[(🗄️ Supabase<br/>Auth + PostgreSQL<br/>Storage + Realtime)]
        Stripe[💳 Stripe]
        BillionMail[📧 BillionMail<br/>Hetzner VPS]
        Expo[🔔 Expo Push]
    end

    Mobile -.SDK.-> Supabase
    Web -.SDK.-> Supabase
    Admin -.SDK.-> Supabase
    Mobile --> Server
    Server --> Supabase
    Server --> Stripe
    Server --> BillionMail
    Mobile --> Expo
    Supabase -.Auth Hook.-> Server
```

### Por qué esta arquitectura


| Decisión                                | Motivo                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| **Supabase como backend principal**      | Auth + DB + Storage + Realtime en uno. Reduce complejidad y coste.              |
| **Express solo para tareas server-side** | Emails, pagos Stripe, lógica que requiere service-key (no exponer al cliente). |
| **Cliente directo a Supabase**           | Latencia mínima, RLS protege los datos a nivel de fila.                        |
| **BillionMail self-hosted**              | Control total del envío, sin coste por email, sin límites de proveedor.       |

---

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
    B --> E[Nodemailer]
    B --> F[express-rate-limit]
    B --> G[jsonwebtoken]
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
| **Email**           | BillionMail SMTP (Hetzner)                         |
| **Push**            | Expo Push API                                      |
| **i18n**            | i18next (ES + EN)                                  |
| **DNS**             | Namecheap                                          |
| **Hosting**         | Vercel (web/admin/server) + Hetzner (mail)         |

---

## 4. Modelo de datos

### Diagrama Entidad-Relación

```mermaid
erDiagram
    users ||--o{ pets : "tiene"
    users ||--o{ reservations : "como dueño"
    users ||--o{ reservations : "como cuidador"
    users ||--o{ messages : "envía"
    users ||--o{ notifications : "recibe"
    users ||--o{ reviews : "escribe"
    users ||--o{ reports : "reporta"
    pets  ||--o{ walks : "registra"
    pets  ||--o{ reservations : "incluido en"
    reservations ||--o| reviews : "genera"
    conversations ||--o{ messages : "contiene"

    users {
        uuid id PK
        text email
        text fullName
        text role "normal/caregiver/admin"
        text photoURL
        boolean isOnline
        boolean isWalking
        text verificationStatus
        jsonb services
        numeric rating
    }
    pets {
        uuid id PK
        uuid ownerId FK
        text name
        text species
        text breed
        jsonb vaccines
        jsonb reminders
        text medicalConditions
    }
    reservations {
        uuid id PK
        uuid ownerId FK
        uuid caregiverId FK
        text serviceType
        text status
        timestamptz startDateTime
        numeric totalPrice
    }
    walks {
        uuid id PK
        uuid petId FK
        jsonb route
        numeric totalKm
        int durationSeconds
    }
    messages {
        uuid id PK
        uuid conversationId FK
        uuid senderId FK
        text text
        boolean read
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

> Esquema completo SQL en [supabase_schema.sql](supabase_schema.sql)

### Storage Buckets


| Bucket    | Contenido                                                                         |
| --------- | --------------------------------------------------------------------------------- |
| `pawmate` | Fotos mascotas, documentos verificación, imágenes reportes, galería cuidadores |
| `avatars` | Fotos perfil de usuarios                                                          |

---

## 5. Flujos clave

### 5.1 Registro y verificación

```mermaid
sequenceDiagram
    actor U as Usuario
    participant M as App Móvil
    participant S as Supabase Auth
    participant SR as Server Express
    participant BM as BillionMail

    U->>M: Rellena email + password
    M->>S: signUp()
    S->>SR: Auth Hook (POST /auth-email)
    SR->>BM: Send confirm email
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
    M->>DB: insert reservations (status: pendiente)
    DB-->>C: Realtime notification
    C->>M: Acepta reserva
    M->>DB: update status: confirmada
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
    C -->|vacuna| D[💉]
    C -->|vet/médico| E[🩺]
    C -->|antiparásito| F[🐛]
    C -->|otro| G[📌]
    D & E & F --> H[Guardar en pets.reminders]
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

---

## 6. Módulos

### 6.1 Mobile (`mobile/`)

```mermaid
flowchart TD
    Root[App.js] --> Auth{¿Autenticado?}
    Auth -->|No| Login[LoginScreen]
    Auth -->|No| Signup[SignupScreen]
    Auth -->|Sí| Tabs[Bottom Tabs]
    Tabs --> Home[🏠 Home<br/>Mapa + Radar]
    Tabs --> Pets[🐾 Mis Mascotas]
    Tabs --> Books[📋 Reservas]
    Tabs --> Care[🧑‍⚕️ Cuidadores]
    Tabs --> Set[⚙️ Ajustes]
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

---

## 7. Seguridad

### Arquitectura de seguridad

```mermaid
flowchart TB
    subgraph Layer1["🔒 Capa 1: Cliente"]
        A[Validación formularios]
        B[HTTPS obligatorio]
    end
    subgraph Layer2["🔐 Capa 2: Auth"]
        C[Supabase Auth JWT + PKCE]
        D[Token expira 1h<br/>Refresh token]
    end
    subgraph Layer3["🛡️ Capa 3: Server"]
        E[Rate limiting]
        F[verifyToken middleware]
        G[isAdmin middleware]
        H[CORS whitelist]
    end
    subgraph Layer4["🗄️ Capa 4: Base de datos"]
        I[Row Level Security RLS]
        J[Service key solo en server]
    end
    Layer1 --> Layer2 --> Layer3 --> Layer4
```

### Medidas implementadas


| Medida                | Implementación                                                |
| --------------------- | -------------------------------------------------------------- |
| **Autenticación**    | Supabase Auth con email/password + Magic Link + OAuth Google   |
| **Autorización**     | Roles`normal` / `caregiver` / `admin` con middleware `isAdmin` |
| **Tokens**            | JWT firmados, expiran en 1h, refresh automático               |
| **Hashing**           | bcrypt (gestionado por Supabase Auth)                          |
| **HTTPS**             | Forzado en Vercel + Let's Encrypt en BillionMail               |
| **CORS**              | Whitelist configurada en server                                |
| **Rate limiting**     | express-rate-limit en endpoints públicos                      |
| **Email auth hook**   | JWT firmado con`SUPABASE_AUTH_HOOK_SECRET`                     |
| **Service key**       | Solo en server, nunca expuesta al cliente                      |
| **Auto-eliminación** | Endpoint DELETE protegido (self o admin)                       |
| **Ban detection**     | Realtime listener cierra sesión al banear                     |
| **DKIM/SPF/DMARC**    | Configurados en Namecheap para anti-phishing                   |

### Privacidad

- DNI/selfies guardados en Supabase Storage privado.
- Endpoint `/auth/profile` filtra campos sensibles (`idFrontUrl`, `idBackUrl`, `selfieUrl`, `expoPushToken`).
- IBAN encriptado pendiente (issue conocido).
- GDPR: usuario puede auto-eliminar cuenta + datos.

---

## 8. Despliegue

```mermaid
flowchart LR
    subgraph Dev["💻 Desarrollo local"]
        D1[Mobile: Expo Go]
        D2[Web: localhost:5173]
        D3[Server: localhost:3000]
    end

    subgraph CI["🔄 GitHub"]
        G[git push]
    end

    subgraph Prod["🚀 Producción"]
        V1[Vercel: web]
        V2[Vercel: admin]
        V3[Vercel: server]
        H[Hetzner: BillionMail]
        S[Supabase: managed]
        E[EAS Build → App Stores]
    end

    Dev --> G
    G -->|auto deploy| V1
    G -->|auto deploy| V2
    G -->|auto deploy| V3
    Dev -->|manual| E
    V3 -.SMTP.-> H
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
| Email server  | Hetzner VPS    | mail.apppawmate.com  |
| Base de datos | Supabase Cloud | xxxx.supabase.co     |

---

## 9. Variables de entorno

### Mobile (`mobile/.env`)

```ini
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_URL=
```

### Server (`server/.env`)

```ini
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SMTP_HOST=mail.apppawmate.com
SMTP_PORT=587
SMTP_USER=noreply@apppawmate.com
SMTP_PASS=
SMTP_FROM=noreply@apppawmate.com
SUPABASE_AUTH_HOOK_SECRET=
ALLOWED_ORIGINS=https://apppawmate.com,https://admin.apppawmate.com
```

### Admin / Web (`.env`)

```ini
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## 10. Issues conocidos

> Lista priorizada de mejoras pendientes.

### 🔴 Críticos


| # | Problema                                  | Solución propuesta                         |
| - | ----------------------------------------- | ------------------------------------------- |
| 1 | RLS policies =`USING (true)`              | Reescribir policies por tabla con ownership |
| 2 | `updateUser` permite cambiar `role`       | Whitelist de campos editables               |
| 3 | API keys hardcodeadas (Weather)            | Mover a variables de entorno                |

### 🟠 Altos


| # | Problema                                 | Solución                                      |
| - | ---------------------------------------- | ---------------------------------------------- |
| 4 | Email endpoints sin rate limit estricto  | Aplicar 10 emails/hora/IP                      |
| 5 | IBAN en plaintext                        | Encriptar con KMS                              |
| 6 | Sin índices en`ownerId`, `status`       | `CREATE INDEX` en schema                       |
| 7 | Vercel bloquea SMTP outbound (plan free) | Migrar server a Render/Railway o usar plan Pro |

### 🟡 Medios


| #  | Problema                                                          | Solución                               |
| -- | ----------------------------------------------------------------- | --------------------------------------- |
| 8  | Lógica paseos duplicada en Home + MyPets                         | Extraer a hook`useWalkTracking()`       |
| 9  | N+1 queries en Admin PetsPage                                     | Join con`select(..., owner:users(...))` |
| 10 | Columnas duplicadas (`birthdate`/`birthDate`, `image`/`photoURL`) | Unificar a una sola                     |

### 🟢 Bajos

- `Math.random()` como key en LogsPage


*PawMate © 2026 · Documentación técnica v1.0*
