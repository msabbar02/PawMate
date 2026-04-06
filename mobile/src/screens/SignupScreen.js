import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
    Dimensions,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

const InputField = ({ icon, placeholder, value, fieldName, secureTextEntry, isPassword, onChangeText, onTogglePassword, error }) => (
    <View style={styles.inputWrapper}>
        <View style={[styles.inputContainer, error && styles.inputError]}>
            <Ionicons name={icon} size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textLight}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                autoCapitalize={isPassword ? 'none' : (fieldName === 'email' ? 'none' : 'words')}
                keyboardType={fieldName === 'email' ? 'email-address' : 'default'}
            />
            {isPassword && (
                <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={onTogglePassword}
                >
                    <Ionicons name={secureTextEntry ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.primary} />
                </TouchableOpacity>
            )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

export default function SignupScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const [errors, setErrors] = useState({});

    const validateForm = () => {
        let isValid = true;
        let newErrors = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.fullName.trim()) {
            newErrors.fullName = 'El nombre completo es requerido.';
            isValid = false;
        }

        if (!formData.email.trim()) {
            newErrors.email = 'El email es requerido.';
            isValid = false;
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = 'Ingresa un email válido.';
            isValid = false;
        }

        if (!formData.password) {
            newErrors.password = 'La contraseña es requerida.';
            isValid = false;
        } else if (formData.password.length < 8) {
            newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
            isValid = false;
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Las contraseñas no coinciden.';
            isValid = false;
        }

        if (!termsAccepted) {
            newErrors.terms = 'Debes aceptar los términos y condiciones.';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const checkEmailExists = async (email) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('email', email.toLowerCase().trim())
                .maybeSingle();
            if (error) return false;
            return !!data;
        } catch {
            return false;
        }
    };

    const handleSignup = async () => {
        Keyboard.dismiss();

        if (!validateForm()) return;

        setLoading(true);
        setErrors({});

        try {
            // Check email already registered
            const emailTaken = await checkEmailExists(formData.email);
            if (emailTaken) {
                setErrors({ email: 'Este correo electrónico ya está registrado.' });
                return;
            }

            const { data, error } = await supabase.auth.signUp({
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                options: {
                    data: {
                        fullName: formData.fullName.trim(),
                        firstName: formData.fullName.trim().split(' ')[0],
                        lastName: formData.fullName.trim().split(' ').slice(1).join(' ') || '',
                        email: formData.email.toLowerCase().trim(),
                    }
                }
            });

            // Supabase devuelve error si falla el envío del email de confirmación
            // pero el usuario SÍ queda creado — en ese caso mostramos mensaje amigable
            if (error) {
                const msg = error.message || '';
                if (
                    msg.toLowerCase().includes('sending confirmation email') ||
                    msg.toLowerCase().includes('email') ||
                    msg.toLowerCase().includes('smtp')
                ) {
                    // Usuario creado pero email de confirmación falló
                    // Si hay sesión activa, el AuthContext redirigirá automáticamente
                    if (!data?.session) {
                        setErrors({
                            form: '¡Cuenta creada! Revisa tu bandeja de entrada para confirmar tu correo.',
                        });
                    }
                    return;
                }
                if (msg.includes('User already registered') || msg.includes('already registered')) {
                    setErrors({ email: 'Este correo electrónico ya está registrado.' });
                    return;
                }
                if (msg.includes('FetchError') || msg.includes('Network request failed') || msg.includes('fetch')) {
                    setErrors({ form: 'Error de red. Revisa tu conexión a internet.' });
                    return;
                }
                throw error;
            }

            // Si no se requiere confirmación de email, el usuario queda logueado
            // y AuthContext lo redirige automáticamente.
            // Si se requiere confirmación, mostramos aviso.
            if (data?.user && !data?.session) {
                setErrors({
                    form: '¡Cuenta creada! Revisa tu correo para confirmar tu cuenta.',
                });
            }
        } catch (error) {
            console.error('Supabase Signup Error:', error.message);
            setErrors({ form: 'Ocurrió un error. Inténtalo de nuevo.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar style="dark" />
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >

                    <View style={styles.decorativeCircle1} />
                    <View style={styles.decorativeCircle2} />

                    <View style={styles.glassCard}>

                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <Ionicons name="paw" size={40} color={COLORS.background} />
                            </View>
                            <Text style={styles.title}>Crear Cuenta</Text>
                            <Text style={styles.subtitle}>Cuidando lo que más quieres</Text>
                        </View>

                        <View style={styles.formContainer}>

                            <InputField
                                icon="person-outline"
                                placeholder="Nombre Completo"
                                value={formData.fullName}
                                fieldName="fullName"
                                error={errors.fullName}
                                onChangeText={(text) => {
                                    setFormData({ ...formData, fullName: text });
                                    if (errors.fullName) setErrors({ ...errors, fullName: null });
                                }}
                            />

                            <InputField
                                icon="mail-outline"
                                placeholder="Correo Electrónico"
                                value={formData.email}
                                fieldName="email"
                                error={errors.email}
                                onChangeText={(text) => {
                                    setFormData({ ...formData, email: text });
                                    if (errors.email) setErrors({ ...errors, email: null });
                                }}
                            />

                            <InputField
                                icon="lock-closed-outline"
                                placeholder="Contraseña"
                                value={formData.password}
                                fieldName="password"
                                secureTextEntry={!showPassword}
                                isPassword
                                error={errors.password}
                                onChangeText={(text) => {
                                    setFormData({ ...formData, password: text });
                                    if (errors.password) setErrors({ ...errors, password: null });
                                }}
                                onTogglePassword={() => setShowPassword(!showPassword)}
                            />

                            <InputField
                                icon="lock-closed-outline"
                                placeholder="Confirmar Contraseña"
                                value={formData.confirmPassword}
                                fieldName="confirmPassword"
                                secureTextEntry={!showConfirmPassword}
                                isPassword
                                error={errors.confirmPassword}
                                onChangeText={(text) => {
                                    setFormData({ ...formData, confirmPassword: text });
                                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                                }}
                                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                            />

                            <View style={styles.termsWrapper}>
                                <TouchableOpacity
                                    style={styles.checkbox}
                                    onPress={() => {
                                        setTermsAccepted(!termsAccepted);
                                        if (errors.terms) setErrors({ ...errors, terms: null });
                                    }}
                                >
                                    {termsAccepted && <Ionicons name="checkmark" size={16} color={COLORS.background} style={styles.checkIcon} />}
                                    {!termsAccepted && <View style={styles.checkboxInner} />}
                                </TouchableOpacity>
                                <Text style={styles.termsText}>Acepto los Términos y Política de Privacidad</Text>
                            </View>
                            {errors.terms && <Text style={[styles.errorText, { marginTop: -10, marginBottom: 15 }]}>{errors.terms}</Text>}

                            {errors.form && (
                                <Text style={[
                                    styles.serverError,
                                    errors.form.includes('creada') && { backgroundColor: '#16a34a' }
                                ]}>
                                    {errors.form}
                                </Text>
                            )}

                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleSignup}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={COLORS.background} />
                                ) : (
                                    <Text style={styles.submitButtonText}>Regístrate</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.switchFlow}>
                                <Text style={styles.switchText}>¿Ya tienes cuenta? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                    <Text style={styles.switchLink}>Inicia Sesión</Text>
                                </TouchableOpacity>
                            </View>

                        </View>

                    </View>
                </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    decorativeCircle1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.primaryLight, opacity: 0.2 },
    decorativeCircle2: { position: 'absolute', bottom: -150, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: COLORS.primary, opacity: 0.1 },
    glassCard: { width: '100%', maxWidth: 400, backgroundColor: COLORS.glass, borderRadius: 30, padding: 25, shadowColor: COLORS.primary, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 10 }, shadowRadius: 30, elevation: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', marginTop: 40, marginBottom: 40 },
    header: { alignItems: 'center', marginBottom: 30 },
    logoContainer: { width: 80, height: 80, backgroundColor: COLORS.primary, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 15, transform: [{ rotate: '-10deg' }], shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 8 },
    title: { fontSize: 26, fontWeight: '900', color: COLORS.secondary },
    subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4, fontWeight: '500' },
    formContainer: { width: '100%' },
    inputWrapper: { marginBottom: 16 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 15, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: COLORS.border },
    inputError: { borderColor: COLORS.danger, backgroundColor: '#ffebee' },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: COLORS.secondary },
    eyeBtn: { padding: 5 },
    errorText: { color: COLORS.danger, fontSize: 12, marginTop: 6, marginLeft: 10, fontWeight: '500' },
    serverError: { color: COLORS.background, backgroundColor: COLORS.danger, padding: 10, borderRadius: 10, textAlign: 'center', marginBottom: 15, fontWeight: 'bold' },
    termsWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    checkIcon: { backgroundColor: COLORS.primary, width: 22, height: 22, borderRadius: 4, textAlign: 'center', lineHeight: 22 },
    checkboxInner: { width: 10, height: 10, borderRadius: 2, backgroundColor: 'transparent' },
    termsText: { color: COLORS.textLight, fontSize: 13, flex: 1 },
    submitButton: { backgroundColor: COLORS.primary, borderRadius: 15, height: 55, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 8, marginTop: 5 },
    submitButtonText: { color: COLORS.background, fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
    switchFlow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 10 },
    switchText: { color: COLORS.textLight, fontSize: 14 },
    switchLink: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },
});