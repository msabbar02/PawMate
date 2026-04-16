# 🌐 PawMate Landing Page

Landing page de la plataforma PawMate — diseño premium, moderno y responsive.

## 🚀 Tecnologías

- **React 19** + **Vite 8**
- **Framer Motion** (animaciones fluidas)
- **Lucide React** (iconos SVG)
- **react-intersection-observer** (animaciones al scroll)
- CSS puro con variables y diseño responsive
- Desplegado en **Vercel**

## 📂 Estructura

```
pawmate-web/
├── src/
│   ├── App.jsx         # Todos los componentes de la landing page
│   ├── App.css         # Estilos de los componentes
│   ├── index.css       # Variables CSS, reset, utilidades
│   └── main.jsx        # Punto de entrada
├── public/
│   ├── premium_hero.png         # Imagen del hero
│   ├── premium_lifestyle.png    # Imagen del showcase
│   └── favicon.svg              # Favicon
├── index.html
├── vite.config.js
└── package.json
```

## 🎯 Secciones

- **Navbar** — Flotante con efecto cristal (glassmorphism), menú hamburguesa en móvil
- **Hero** — Texto con animación de palabras rotativas, métricas, imagen con tarjetas flotantes
- **Trust Band** — Marquee infinito con highlights de la app
- **Features** — 6 tarjetas con iconos, hover elevado y descripción
- **Showcase** — Dos columnas: checklist de beneficios + imagen premium
- **Stats** — Contadores animados sobre fondo degradado oscuro
- **Testimonials** — Tarjetas de reseñas con estrellas y avatares
- **CTA** — Llamada a la acción con botones de descarga (App Store / Google Play)
- **Footer** — Grid de 4 columnas con links y redes sociales
- **Dark/Light Mode** — Toggle con persistencia en localStorage

## 🎨 Paleta de Colores

| Variable | Color | Uso |
|----------|-------|-----|
| `--forest` | `#1a7a4c` | Color primario |
| `--forest-deep` | `#145f3b` | Hover primario |
| `--mint` | `#34d399` | Acentos |
| `--mint-light` | `#d1fae5` | Badges, fondos suaves |
| `--ink` | `#0f2419` | Texto principal |
| `--slate` | `#4b6358` | Texto secundario |
| `--fog` | `#f0f7f4` | Fondos claros |
| `--cloud` | `#ffffff` | Fondo base |

## 🔧 Instalación

```bash
cd pawmate-web
npm install
```

## ▶️ Ejecutar

```bash
npm run dev
```

## 📦 Build

```bash
npm run build
```

---

**Estado**: ✅ Funcional
