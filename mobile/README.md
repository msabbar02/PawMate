# PawMate Mobile App

Aplicación móvil para Android e iOS desarrollada con React Native y Expo.

## Tecnologías

### Core


| Paquete                                       | Uso                                 |
| --------------------------------------------- | ----------------------------------- |
| React Native 0.81 + Expo 54                   | Framework base                      |
| React Navigation (Bottom Tabs + Native Stack) | Navegación                         |
| Supabase JS 2.x                               | Auth, PostgreSQL, Storage, Realtime |
| Stripe React Native 0.50                      | PaymentSheet + Apple/Google Pay     |

### Mapas y localización


| Paquete                              | Uso                          |
| ------------------------------------ | ---------------------------- |
| react-native-maps (Google Maps) 1.20 | Mapa nativo, radar, tracking |
| expo-location                        | GPS en tiempo real           |

### Clima


| Servicio       | Usado en        | Notas                                                                                   |
| -------------- | --------------- | --------------------------------------------------------------------------------------- |
| WeatherAPI.com | `TopBar.js`     | Widget con API key vía`EXPO_PUBLIC_WEATHER_API_KEY`. Sin clave — fallback silencioso. |
| Open-Meteo API | `HomeScreen.js` | Clima en panel de inicio, sin API key                                                   |

### Multimedia y archivos


| Paquete                   | Uso                                         |
| ------------------------- | ------------------------------------------- |
| expo-camera               | Escáner QR para check-in de reservas       |
| expo-image-picker         | Selección de fotos (mascotas, avatar)      |
| expo-print + expo-sharing | Generación y exportación del Paw-Port PDF |
| expo-file-system          | Lectura de archivos locales                 |
| expo-av                   | Reproducción de audio/vídeo               |
| react-native-view-shot    | Capturas de pantalla                        |

### Notificaciones y comunicación


| Paquete            | Uso                                              |
| ------------------ | ------------------------------------------------ |
| expo-notifications | Push notifications                               |
| expo-contacts      | Importar contactos de emergencia desde la agenda |

### Autenticación OAuth


| Paquete           | Uso                               |
| ----------------- | --------------------------------- |
| expo-auth-session | Flujo OAuth 2.0 (Google)          |
| expo-web-browser  | Apertura del navegador para OAuth |

### UI e iconos


| Paquete                               | Uso                                   |
| ------------------------------------- | ------------------------------------- |
| @fortawesome/react-native-fontawesome | Iconos FontAwesome (icono principal)  |
| lucide-react-native                   | Iconos adicionales                    |
| react-native-qrcode-svg               | Generación de códigos QR (Paw-Port) |
| react-native-svg                      | Dependencia de QR                     |
| react-native-reanimated 4.x           | Animaciones fluidas                   |
| react-native-gesture-handler 2.x      | Gestos táctiles                      |
| @gorhom/bottom-sheet 5.x              | Paneles deslizantes                   |
| react-native-safe-area-context        | Márgenes seguros iOS/Android         |

### Formularios y datos


| Paquete                                   | Uso                                        |
| ----------------------------------------- | ------------------------------------------ |
| @react-native-community/datetimepicker    | Selector de fechas y horas                 |
| @react-native-picker/picker               | Selector de especie/tipo                   |
| @react-native-async-storage/async-storage | Persistencia local (tema, idioma, cuentas) |
| humps                                     | Conversión camelCase ↔ snake_case        |

### Internacionalización

Sistema propio de traducción ES/EN via `LanguageContext.js` (sin librerías externas). Archivos en `src/i18n/es.js` y `src/i18n/en.js`.

## Estructura

```
mobile/
├── App.js                              # Punto de entrada
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js               # Mapa principal, radar cuidadores, paseos, clima
│   │   ├── LoginScreen.js              # Login email/password + Google OAuth + multicuenta
│   │   ├── SignupScreen.js             # Registro con validación y términos
│   │   ├── ConfirmScreen.js            # Pantalla de confirmación de email post-registro
│   │   ├── MyPetsScreen.js             # CRUD mascotas, historial médico, recordatorios, Paw-Port
│   │   ├── BookingScreen.js            # Reservas del usuario, chat por reserva, check-in QR, reseñas
│   │   ├── CaregiversScreen.js         # Búsqueda de cuidadores con filtros
│   │   ├── CaregiverProfileScreen.js   # Perfil público del cuidador (general, horario, reseñas)
│   │   ├── CaregiverDashboardScreen.js # Panel del cuidador: estadísticas, insignias, galería, retiro
│   │   ├── CaregiverSetupScreen.js     # Configuración del perfil de cuidador (precios, horario)
│   │   ├── CreateBookingScreen.js      # Creación de reserva (tipo, mascotas, fechas, precio)
│   │   ├── ChatScreen.js               # Chat 1:1 en tiempo real (Supabase Realtime)
│   │   ├── MessagesScreen.js           # Lista de conversaciones
│   │   ├── NotificationsScreen.js      # Centro de notificaciones con gestión de leídas
│   │   ├── ProfileScreen.js            # Edición del perfil personal
│   │   ├── SettingsScreen.js           # Ajustes, contraseña, contactos emergencia, reportes, política
│   │   └── VerifyOwnerScreen.js        # Verificación de identidad (DNI + selfie + certificados)
│   ├── components/
│   │   ├── Icon.js                     # Wrapper unificado FontAwesome/Ionicons
│   │   ├── TopBar.js                   # Barra superior con buscador y widget clima (WeatherAPI.com)
│   │   ├── SOSButton.js                # Botón SOS con GPS de alta precisión
│   │   ├── WeatherWidget.js            # Widget de clima alternativo
│   │   ├── PetMarker.js                # Marcador personalizado de mascota en mapa
│   │   ├── RadarChips.js               # Chips de filtro de distancia (500m / 2km / 5km)
│   │   └── CustomMultiSelect.js        # Selector múltiple reutilizable
│   ├── config/
│   │   ├── supabase.js                 # Cliente Supabase
│   │   ├── stripe.js                   # SafeStripeProvider + useSafeStripe (compatible Expo Go)
│   │   └── api.js                      # URL base del backend + helpers de autenticación
│   ├── context/
│   │   ├── AuthContext.js              # Sesión Supabase, userData, presencia, push token
│   │   ├── ThemeContext.js             # Dark/Light mode + modo zurdo (persistido en AsyncStorage)
│   │   └── LanguageContext.js          # i18n propio ES/EN con persistencia
│   ├── navigation/
│   │   └── AppNavigator.js             # Bottom Tabs + Stack Navigator
│   ├── utils/
│   │   ├── iconMap.js                  # Mapa Ionicons → FontAwesome
│   │   ├── notificationHelpers.js      # createNotification + push via Expo API
│   │   ├── pushNotifications.js        # Registro del expoPushToken en Supabase
│   │   ├── recommendationHelpers.js    # Preferencias de especie por likes
│   │   ├── storageHelpers.js           # Upload a Supabase Storage (avatares, mascotas, docs)
│   │   └── logger.js                   # logActivity (recent_activity) + logSystemAction (system_logs)
│   ├── i18n/
│   │   ├── es.js                       # Traducciones en español
│   │   └── en.js                       # Traducciones en inglés
│   ├── constants/
│   │   └── colors.js                   # Constantes de color globales (COLORS)
│   └── theme/
│       └── colors.js                   # Objetos lightTheme / darkTheme
└── assets/                             # Imágenes, fuentes, iconos
```

## Funcionalidades

### Autenticación y cuenta

- Login con email/password y Google OAuth (expo-auth-session
- Registro con validación y aceptación de términos
- Pantalla de confirmación de email post-registro
- Cambio de contraseña desde ajustes
- Eliminación de cuenta (elimina perfil + auth en Supabase)

### Perfil y ajustes

- Edición de perfil: nombre, teléfono, ciudad, provincia, país, fecha de nacimiento
- Foto de perfil con upload a Supabase Storage
- Contactos de emergencia: añadir manualmente o importar desde la agenda del dispositivo
- Dark mode / Light mode (guardado en AsyncStorage, detecta preferencia del sistema)
- Modo zurdo (invierte la posición de botones y controles)
- Idioma: español / inglés (guardado en AsyncStorage)
- Política de privacidad integrada
- Sistema de reporte de bugs/incidencias con imágenes adjuntas

### Mascotas

- CRUD completo de mascotas: nombre, especie (5 tipos), raza, peso, género, color, fecha de nacimiento
- Fotos de portada e imágenes adicionales
- Ficha médica: chip NFC, alergias, medicamentos, condiciones, seguro, veterinario
- Historial de salud: registros de vacunas, visitas, antiparasitarios
- Recordatorios con auto-detección de categoría (vacuna, vet, antiparásito, genérico) y notificación push
- Paw-Port QR biométrico: ficha de emergencia imprimible con expo-print y descargable con expo-sharing
- Historial de paseos por mascota con mapa de ruta

### Paseos y mapa

- Mapa principal con Google Maps y modo oscuro personalizado
- Tracking GPS de paseos en tiempo real: distancia (haversine), duración, velocidad
- Ruta guardada como polyline en mapa
- Paseo también accesible desde MyPetsScreen por mascota individual
- Clima en tiempo real: WeatherAPI.com en TopBar + Open-Meteo en pantalla principal

### Cuidadores y reservas

- Búsqueda y filtrado de cuidadores por nombre, servicio, especie y verificación
- Perfil público del cuidador: bio, precios, horario semanal de disponibilidad, galería, reseñas
- Crear reserva: tipo de servicio (paseo por horas / hotel por fechas), selección de mascotas, notas
- Pago integrado con Stripe (PaymentSheet + Apple Pay / Google Pay)
- Check-in QR: el cuidador escanea el QR de la reserva para iniciarla
- Sistema de reseñas: valoración con estrellas y comentario tras reserva completada
- Chat 1:1 dentro de cada reserva y en la bandeja de mensajes

### Panel del cuidador

- Estadísticas: reservas completadas, activas, pendientes y ganancias totales
- Sistema de insignias: Bronce (0+), Plata (5+), Oro (20+), Platino (50+), Leyenda (100+ completadas)
- Galería de fotos del cuidador (upload a Supabase Storage)
- Formulario de retiro de ganancias (nombre, país, IBAN, teléfono)
- Configuración del perfil: bio, precios, radio de servicio, especies aceptadas, disponibilidad por días

### Verificación de identidad

- Flujo de 3 pasos: elegir rol (dueño / cuidador), subir documentos, confirmación
- Documentos requeridos: DNI frontal, DNI dorsal, selfie
- Para cuidadores: certificados adicionales, especies aceptadas, tipos de servicio

### Notificaciones

- Notificaciones in-app en tiempo real (Supabase Realtime)
- Push notifications via Expo (registro automático del token en Supabase)
- Centro de notificaciones con selección múltiple, marcar como leída y eliminar

### SOS

- Botón SOS de emergencias con animación de pulso
- Obtiene GPS de alta precisión y pasa coordenadas al padre para disparar alerta

## Instalación

```bash
cd mobile
npm install
```

## Ejecutar

```bash
# Desarrollo con Expo
npx expo start --clear --tunnel

# Android
npx expo run:android

# iOS
npx expo run:ios
```

## Variables de entorno

```ini
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# URL del backend Express. Si no se define usa https://api.apppawmate.com.
EXPO_PUBLIC_API_BASE_URL=https://api.apppawmate.com

# Clave de WeatherAPI.com para el widget del TopBar. Opcional: si falta,
# el widget muestra el fallback de carga sin llamar al servicio.
EXPO_PUBLIC_WEATHER_API_KEY=
```
