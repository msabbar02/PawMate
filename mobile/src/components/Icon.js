/**
 * Sustituto directo de Ionicons que dibuja con FontAwesome.
 * Mantiene la misma API (`name`, `size`, `color`, `style`) para que migrar
 * solo requiera cambiar el import en cada pantalla.
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { getIcon } from '../utils/iconMap';

export default function Icon({ name, size = 20, color, style, ...props }) {
  const icon = getIcon(name);
  if (!icon) return null;
  return (
    <FontAwesomeIcon
      icon={icon}
      size={size}
      color={color}
      style={style}
      {...props}
    />
  );
}
