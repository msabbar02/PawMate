# 📱 PawMate Mobile App

Aplicación móvil para Android e iOS desarrollada con React Native y Expo.

## 🚀 Tecnologías

- **React Native** + **Expo**
- **React Navigation** (navegación por pestañas y stack)
- **Supabase** (Auth, Database, Storage)
- **Stripe** (pagos de reservas)
- **Expo Push Notifications**
- AsyncStorage (almacenamiento local)
- Expo Location (GPS tracking)

## 📂 Estructura

```
mobile/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js           # Pantalla principal con radar y clima
│   │   ├── LoginScreen.js          # Login con Supabase Auth
│   │   ├── SignupScreen.js         # Registro de usuario
│   │   ├── ProfileScreen.js        # Perfil del usuario
│   │   ├── SettingsScreen.js       # Configuración y preferencias
│   │   ├── MyPetsScreen.js         # Gestión de mascotas propias
│   │   ├── BookingScreen.js        # Reservar cuidador
│   │   ├── CaregiversScreen.js     # Lista de cuidadores
│   │   ├── CaregiverProfileScreen.js # Perfil de cuidador
│   │   ├── MessagesScreen.js       # Chat
│   │   ├── NotificationsScreen.js  # Centro de notificaciones
│   │   └── VerifyOwnerScreen.js    # Verificación de dueño
│   ├── components/
│   │   ├── TopBar.js               # Barra superior
│   │   ├── SOSButton.js            # Botón SOS emergencias
│   │   ├── WeatherWidget.js        # Widget del clima
│   │   ├── PetMarker.js            # Marcador de mascota en mapa
│   │   ├── RadarChips.js           # Chips del radar
│   │   └── CustomMultiSelect.js    # Selector múltiple
│   ├── config/
│   │   ├── supabase.js             # Cliente Supabase
│   │   ├── stripe.js               # Config de Stripe
│   │   └── api.js                  # URL base del backend
│   ├── context/
│   │   ├── AuthContext.js          # Autenticación con Supabase
│   │   └── ThemeContext.js         # Dark/Light mode
│   ├── navigation/
│   │   └── AppNavigator.js         # Navegación principal
│   ├── utils/
│   │   ├── friendHelpers.js        # Sistema de amigos
│   │   ├── notificationHelpers.js  # Helpers de notificaciones
│   │   ├── pushNotifications.js    # Expo Push Notifications
│   │   ├── recommendationHelpers.js # Recomendaciones
│   │   ├── storageHelpers.js       # AsyncStorage helpers
│   │   └── logger.js              # Logger utility
│   ├── constants/
│   │   └── colors.js               # Paleta de colores
│   └── theme/
│       └── colors.js               # Colores del tema
├── assets/                         # Imágenes, fuentes, iconos
└── App.js                          # Punto de entrada
```

## 🎯 Funcionalidades

- 🔐 Autenticación con Supabase (Email/Password, Google)
- 🐾 Gestión completa de mascotas (fotos, médico, chip, vacunas)
- 📍 Seguimiento GPS de paseos en tiempo real
- 🆔 Paw-Port QR biométrico de emergencia
- ⏰ Recordatorios de vacunas y citas veterinarias
- 👥 Comunidad social con feed de fotos
- 🏥 Historial médico completo
- 🧑‍🍳 Cuidadores verificados con reservas y pagos (Stripe)
- 💬 Chat entre dueños y cuidadores
- 🌡️ Widget del clima en tiempo real
- 📡 Radar de mascotas cercanas
- 🌓 Dark mode / Light mode
- 🔔 Notificaciones push (Expo)
- 🆘 Botón SOS de emergencias

## 🔧 Instalación

```bash
cd mobile
npm install
```

## ▶️ Ejecutar

```bash
# Desarrollo con Expo
npx expo start --clear --tunnel

# Android
npx expo run:android

# iOS
npx expo run:ios
```

---

**Estado**: ✅ Funcional · **Última actualización**: Abril 2026
