/**
 * Drop-in replacement for Ionicons that uses FontAwesome.
 * Usage: <Icon name="home" size={24} color="#000" />
 * Same API as Ionicons so migration is just changing the import.
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
