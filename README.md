# 🐾 PawMate

**Aplicación completa de gestión de mascotas con app móvil, web y panel de administración**

---

## 📋 Descripción del Proyecto

PawMate es una plataforma integral para el cuidado y gestión de mascotas que incluye:

- 📱 **Aplicación Móvil** (Android & iOS) - Para dueños de mascotas
- 🌐 **Aplicación Web** - Versión web para navegadores
- 👨‍💼 **Panel de Administración** - Gestión completa del sistema
- 🔧 **Backend API** - Servidor y base de datos

---

## 🏗️ Estructura del Proyecto

```
PawMate0/
├── mobile/          # 📱 Aplicación móvil (React Native + Expo)
│   ├── src/         # Código fuente
│   └── assets/      # Imágenes, fuentes, etc.
│
├── web/             # 🌐 Aplicación web (React/Next.js)
│   ├── src/         # Código fuente
│   └── public/      # Archivos estáticos
│
├── admin/           # 👨‍💼 Panel de administración (React/Next.js)
│   ├── src/         # Código fuente
│   └── public/      # Archivos estáticos
│
└── server/          # 🔧 Backend API (Node.js + Express)
    └── src/         # Código fuente
```

---

## 🚀 Tecnologías Utilizadas

### Mobile App
- React Native
- Expo
- React Navigation
- Firebase (Auth, Firestore, Storage)

### Web & Admin
- React / Next.js
- Firebase
- Tailwind CSS / Material-UI

### Backend
- Node.js
- Express
- Firebase Admin SDK

---

## 🌿 Estrategia de Branching

Este proyecto sigue un flujo de trabajo profesional con Git:

- **`main`** - Rama de producción (código estable)
- **`develop`** - Rama de desarrollo (integración)
- **`feature/*`** - Ramas para nuevas funcionalidades

### Ejemplo de workflow:
```bash
# Crear nueva funcionalidad
git checkout develop
git checkout -b feature/nombre-funcionalidad

# Desarrollar y hacer commits
git add .
git commit -m "feat: descripción de la funcionalidad"

# Merge a develop cuando esté lista
git checkout develop
git merge feature/nombre-funcionalidad

# Cuando develop esté estable, merge a main
git checkout main
git merge develop
```

---

## 📦 Instalación

### Requisitos Previos
- Node.js (v16 o superior)
- npm o yarn
- Expo CLI (para mobile)
- Cuenta de Firebase

### Configuración Inicial

**1. Clonar el repositorio**
```bash
git clone <URL_DEL_REPO>
cd PawMate0
```

**2. Instalar dependencias** (se hará en cada carpeta según se desarrolle)
```bash
# Mobile
cd mobile
npm install

# Web
cd ../web
npm install

# Admin
cd ../admin
npm install

# Server
cd ../server
npm install
```

**3. Configurar variables de entorno**
- Crear archivos `.env` en cada carpeta según sea necesario
- Añadir credenciales de Firebase (NO subir a Git)

---

## 🎯 Funcionalidades Principales

### Aplicación Móvil
- ✅ Registro e inicio de sesión
- ✅ Gestión de perfiles de mascotas
- ✅ Seguimiento de salud y vacunas
- ✅ Comunidad de usuarios
- ✅ Tienda de productos

### Panel de Administración
- ✅ Dashboard con estadísticas
- ✅ Gestión de usuarios
- ✅ Gestión de mascotas
- ✅ Moderación de contenido
- ✅ Gestión de productos

---

## 👨‍💻 Desarrollo

Este proyecto está siendo desarrollado como parte del proyecto final de **DAM** (Desarrollo de Aplicaciones Multiplataforma).

**Desarrollador**: Mohamed Sabbar

---

## 📝 Estado del Proyecto

🚧 **En desarrollo activo** - Reconstrucción completa desde cero

El proyecto se está desarrollando de forma gradual con commits diarios para asegurar:
- Código limpio y bien documentado
- Comprensión profunda de cada componente
- Preparación para examen final

---

## 📄 Licencia

Este proyecto es de uso educativo.

---

## 📞 Contacto

**Email**: msabbar02@yahoo.com  
**Móvil**: +34 624 170 100

---

> **Última actualización**: 16 de Febrero de 2026
