# PawMate Landing Page

Landing page de la plataforma PawMate — diseño premium, animaciones 3D y páginas de utilidad para Supabase Auth.

## Tecnologías


| Librería                                                 | Versión           | Uso                                                             |
| --------------------------------------------------------- | ------------------ | --------------------------------------------------------------- |
| **React**                                                 | 19.2               | UI                                                              |
| **Vite**                                                  | 8.0                | Build tool                                                      |
| **React Router DOM**                                      | 7.x                | Rutas (`/`, `/confirm`, `/reset-password`)                      |
| **Three.js** + `@react-three/fiber` + `@react-three/drei` | 0.184 / 9.x / 10.x | Escena 3D del hero                                              |
| **Framer Motion**                                         | 12.x               | Animaciones de entrada y scroll                                 |
| **Supabase JS**                                           | 2.x                | Páginas`confirm` y `reset-password` (sólo flujos sin sesión) |
| **i18next** + `react-i18next`                             | 26.x / 17.x        | Internacionalización ES / EN                                   |
| **Lucide React** + FontAwesome                            | —                 | Iconos                                                          |
| **react-intersection-observer** + `react-scroll`          | —                 | Reveal al hacer scroll                                          |

Desplegado en **Vercel**.

## Estructura

```
web/
├── src/
│   ├── App.jsx                    # Landing principal (hero, features, showcase, etc.)
│   ├── App.css                    # Estilos
│   ├── index.css                  # Variables CSS, reset, utilidades
│   ├── main.jsx                   # Punto de entrada con providers
│   ├── pages/
│   │   ├── ConfirmPage.jsx        # Confirmación de email tras signup
│   │   └── ResetPasswordPage.jsx  # Restablecer contraseña vía Supabase Auth
│   ├── i18n/                      # Diccionarios ES / EN
│   ├── config/                    # Cliente Supabase
│   └── assets/
├── public/                        # Imágenes y favicon
├── index.html
├── vite.config.js
└── vercel.json                    # Config de despliegue
```

## Rutas


| Ruta              | Página             | Descripción                                              |
| ----------------- | ------------------- | --------------------------------------------------------- |
| `/`               | `App.jsx`           | Landing con hero 3D, features, testimonials y CTA         |
| `/confirm`        | `ConfirmPage`       | Pantalla de confirmación tras click en email de Supabase |
| `/reset-password` | `ResetPasswordPage` | Formulario para fijar nueva contraseña                   |

## Funcionalidades

- **Hero 3D**: escena con Three.js / `@react-three/fiber` y elementos flotantes con animación.
- **Cursor personalizado** con icono de huella.
- **Navbar flotante** con efecto cristal (glassmorphism).
- **Feature cards** con animaciones Framer Motion + scroll reveal.
- **Testimonials**, **stats animados** y **CTA** con botones App Store / Google Play.
- **Páginas de Supabase Auth** (`/confirm`, `/reset-password`) que usan únicamente la **anon key** y no manejan datos sensibles.
- **i18n** ES / EN con `i18next`, idioma persistido en `localStorage`.
- **Dark / Light mode** con persistencia en `localStorage`.
- **Responsive mobile-first**.

## Variables de entorno

```ini
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> Sólo se usan en las páginas `/confirm` y `/reset-password`. La landing principal no llama a Supabase.

## Instalación

```bash
cd web
npm install
```

## Ejecutar

```bash
npm run dev      # Desarrollo
npm run build    # Producción
npm run preview  # Servir build local
```
