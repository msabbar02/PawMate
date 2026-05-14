/**
 * Email del superadministrador (privilegios totales sobre otros admins).
 *
 * Reglas que aplica el frontend (la BD y el backend repiten la validación):
 *   - Solo el superadmin puede crear nuevos administradores.
 *   - Solo el superadmin puede borrar/banear/degradar a otros admins.
 *   - El superadmin no puede ser borrado por nadie (ni por sí mismo).
 */
export const SUPERADMIN_EMAIL = 'adminpawmate@gmail.com';

/**
 * Indica si el email recibido corresponde al superadministrador.
 * Compara en minúsculas para evitar discrepancias por capitalización.
 *
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function isSuperadmin(email) {
    return (email || '').toLowerCase() === SUPERADMIN_EMAIL;
}

/**
 * Devuelve el rol "para mostrar" del usuario. El superadministrador siempre
 * se muestra como `superadmin` aunque en BD esté guardado como `admin`.
 *
 * @param {{ email?: string, role?: string }} user
 * @returns {string}
 */
export function displayRole(user) {
    if (isSuperadmin(user?.email)) return 'superadmin';
    return user?.role || 'normal';
}
