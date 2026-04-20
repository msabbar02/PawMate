/**
 * Maps Ionicons names to FontAwesome solid icons.
 * Used across the mobile app after migrating from Ionicons to FontAwesome.
 */
import {
  faHouse, faPaw, faUsers, faCalendarDays, faGear, faLock,
  faChevronRight, faChevronLeft,
  faLocationDot, faLocationArrow, faLocationCrosshairs,
  faBell, faComments, faComment,
  faPersonWalking, faStar, faCirclePlay, faPlay,
  faClock, faCircleCheck, faCheck, faCheckDouble,
  faCircleXmark, faXmark, faRibbon, faMagnifyingGlass,
  faShieldHalved, faCamera, faEye, faEyeSlash,
  faEnvelope, faPhone, faUser,
  faArrowRight, faArrowLeft, faPaperPlane, faPencil, faTrash,
  faPlus, faCirclePlus, faMinus, faFileLines, faDownload,
  faMars, faVenus, faMap, faFire, faGauge, faShareNodes,
  faCloudArrowUp, faCircleInfo, faCreditCard, faBriefcase,
  faTriangleExclamation, faCircleExclamation, faBolt, faFlag,
  faSun, faMoon, faCloudSun, faCloudMoon, faCloud, faCloudRain, faCloudBolt, faSnowflake,
  faTag, faCompass, faQrcode, faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';

import {
  faCircleDot as farCircleDot,
  faStar as farStar,
} from '@fortawesome/free-regular-svg-icons';

import {
  faGoogle, faApple as fabApple,
} from '@fortawesome/free-brands-svg-icons';

// Mapping from Ionicons name to FA icon definition
const iconMap = {
  // Navigation / Arrows
  'chevron-forward': faChevronRight,
  'chevron-back': faChevronLeft,
  'arrow-forward': faArrowRight,
  'arrow-back': faArrowLeft,
  'navigate': faLocationArrow,
  'navigate-outline': faLocationArrow,
  'compass-outline': faCompass,

  // Home
  'home': faHouse,
  'home-outline': faHouse,

  // Paw
  'paw': faPaw,
  'paw-outline': faPaw,

  // People
  'people': faUsers,
  'people-outline': faUsers,
  'person': faUser,
  'person-outline': faUser,

  // Calendar
  'calendar': faCalendarDays,
  'calendar-outline': faCalendarDays,

  // Settings
  'settings': faGear,
  'settings-outline': faGear,

  // Lock
  'lock-closed': faLock,
  'lock-closed-outline': faLock,

  // Location
  'location': faLocationDot,
  'location-outline': faLocationDot,
  'locate': faLocationCrosshairs,
  'locate-outline': faLocationCrosshairs,

  // Notifications
  'notifications': faBell,
  'notifications-outline': faBell,

  // Messages / Chat
  'chatbubbles': faComments,
  'chatbubbles-outline': faComments,
  'chatbubble': faComment,
  'chatbubble-outline': faComment,

  // Walk
  'walk': faPersonWalking,
  'walk-outline': faPersonWalking,

  // Star
  'star': faStar,
  'star-outline': farStar,

  // Play
  'play': faPlay,
  'play-circle': faCirclePlay,
  'play-circle-outline': faCirclePlay,

  // Time / Clock
  'time': faClock,
  'time-outline': faClock,

  // Check
  'checkmark': faCheck,
  'checkmark-circle': faCircleCheck,
  'checkmark-circle-outline': faCircleCheck,
  'checkmark-done': faCheckDouble,
  'checkmark-done-outline': faCheckDouble,

  // Close / X
  'close': faXmark,
  'close-circle': faCircleXmark,
  'close-circle-outline': faCircleXmark,

  // Radio buttons
  'radio-button-on': farCircleDot,
  'radio-button-on-outline': farCircleDot,
  'radio-button-off': farCircleDot,

  // Ribbon
  'ribbon': faRibbon,
  'ribbon-outline': faRibbon,

  // Search
  'search': faMagnifyingGlass,
  'search-outline': faMagnifyingGlass,

  // Shield
  'shield-checkmark': faShieldHalved,
  'shield-checkmark-outline': faShieldHalved,

  // Camera
  'camera': faCamera,
  'camera-outline': faCamera,

  // Eye
  'eye': faEye,
  'eye-outline': faEye,
  'eye-off': faEyeSlash,
  'eye-off-outline': faEyeSlash,

  // Mail
  'mail': faEnvelope,
  'mail-outline': faEnvelope,

  // Phone
  'call': faPhone,
  'call-outline': faPhone,

  // Pencil / Edit
  'pencil': faPencil,
  'pencil-outline': faPencil,
  'create-outline': faPencil,

  // Trash
  'trash': faTrash,
  'trash-outline': faTrash,

  // Add / Plus
  'add': faPlus,
  'add-circle': faCirclePlus,

  // Minus / Remove
  'remove': faMinus,

  // Document
  'document-text': faFileLines,
  'document-text-outline': faFileLines,

  // Download
  'download-outline': faDownload,

  // Gender
  'male': faMars,
  'female': faVenus,

  // Map
  'map-outline': faMap,

  // Fire / Flame
  'flame-outline': faFire,

  // Speed
  'speedometer-outline': faGauge,

  // Share
  'share-outline': faShareNodes,

  // Cloud
  'cloud-upload-outline': faCloudArrowUp,

  // Info
  'information-circle-outline': faCircleInfo,

  // Card / Payment
  'card': faCreditCard,
  'card-outline': faCreditCard,

  // Briefcase
  'briefcase-outline': faBriefcase,

  // Warning / Alert
  'warning': faTriangleExclamation,
  'warning-outline': faTriangleExclamation,
  'alert-circle': faCircleExclamation,
  'alert-circle-outline': faCircleExclamation,

  // Flash / Bolt
  'flash': faBolt,
  'flash-outline': faBolt,

  // Flag
  'flag-outline': faFlag,

  // Weather
  'sunny': faSun,
  'moon': faMoon,
  'partly-sunny': faCloudSun,
  'cloudy-night': faCloudMoon,
  'cloud': faCloud,
  'rainy': faCloudRain,
  'thunderstorm': faCloudBolt,
  'snow': faSnowflake,

  // Brands
  'logo-google': faGoogle,
  'logo-apple': fabApple,

  // Tag / Price
  'pricetag': faTag,

  // Pulse
  'pulse-outline': faBolt,

  // Pause
  'pause-circle-outline': faClock, // no exact FA match, use clock

  // QR Code
  'qr-code-outline': faQrcode,

  // Log out
  'log-out-outline': faRightFromBracket,

  // Send
  'send': faPaperPlane,
};

/**
 * Get a FontAwesome icon definition from an Ionicons name.
 * Returns faPaw as fallback for unknown icons.
 */
export function getIcon(ionName) {
  return iconMap[ionName] || faPaw;
}

export default iconMap;
