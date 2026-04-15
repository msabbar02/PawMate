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
    Alert,
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
                autoCapitalize={isPassword ? 'none' : 'none'}
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

export default function LoginScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [errors, setErrors] = useState({});

    const validateForm = () => {
        let isValid = true;
        let newErrors = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleLogin = async () => {
        Keyboard.dismiss();

        if (!validateForm()) return;

        setLoading(true);
        setErrors({});

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });
            if (error) throw error;
            // El onAuthStateChanged general se encargará de la redirección
        } catch (error) {
            console.error("Supabase Login Error:", error.message);
            let errorMsg = 'Ocurrió un error. Intenta de nuevo.';
            if (error.message.includes('Invalid login credentials')) {
                errorMsg = 'Correo o contraseña incorrectos.';
            } else if (error.message.includes('FetchError') || error.message.includes('Network request failed')) {
                errorMsg = 'Error de red. Revisa tu conexión a internet.';
            }
            setErrors({ form: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!formData.email.trim()) {
            setErrors({ email: 'Ingresa tu correo para restablecer la contraseña.' });
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(formData.email);
            if (error) throw error;
            Alert.alert('¡Enlace enviado! ✉️', 'Revisa tu correo para cambiar la contraseña.');
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMagicLink = async () => {
        if (!formData.email.trim()) {
            setErrors({ email: 'Ingresa un correo para mandar el Magic Link.' });
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({ email: formData.email });
            if (error) throw error;
            Alert.alert('¡Magic Link enviado! 🪄', 'Pide a tu compi que revise su correo para entrar.');
        } catch (error) {
            Alert.alert('Error', error.message);
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
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >

                    <View style={styles.decorativeCircle1} />
                    <View style={styles.decorativeCircle2} />

                    <View style={styles.glassCard}>

                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <Ionicons name="paw" size={40} color={COLORS.background} />
                            </View>
                            <Text style={styles.title}>Iniciar Sesión</Text>
                            <Text style={styles.subtitle}>Bienvenido de vuelta a PawMate</Text>
                        </View>

                        <View style={styles.formContainer}>
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

                            <TouchableOpacity style={styles.forgotPassword} onPress={handleResetPassword}>
                                <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                            </TouchableOpacity>

                            {errors.form && <Text style={styles.serverError}>{errors.form}</Text>}

                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={COLORS.background} />
                                ) : (
                                    <Text style={styles.submitButtonText}>Entrar</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary, marginTop: 12 }]}
                                onPress={handleMagicLink}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={COLORS.primary} />
                                ) : (
                                    <Text style={[styles.submitButtonText, { color: COLORS.primary }]}>Mandar Magic Link 🪄</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.switchFlow}>
                                <Text style={styles.switchText}>¿No tienes cuenta? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                    <Text style={styles.switchLink}>Regístrate aquí</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.oauthSection}>
                                <View style={styles.oauthDivider}>
                                    <View style={styles.line} />
                                    <Text style={styles.oauthText}>O continúa con</Text>
                                    <View style={styles.line} />
                                </View>

                                <View style={styles.oauthButtonsRow}>
                                    <TouchableOpacity style={styles.oauthBtn}>
                                        <Ionicons name="logo-google" size={20} color="#DB4437" />
                                        <Text style={styles.oauthBtnText}>Google</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.oauthBtn}>
                                        <Ionicons name="logo-apple" size={20} color="#000000" />
                                        <Text style={styles.oauthBtnText}>Apple</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                        </View>

                    </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    decorativeCircle1: { position: 'absolute', top: -120, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: COLORS.primary, opacity: 0.08 },
    decorativeCircle2: { position: 'absolute', bottom: -140, left: -80, width: 350, height: 350, borderRadius: 175, backgroundColor: COLORS.primaryLight, opacity: 0.06 },
    glassCard: { width: '100%', maxWidth: 420, backgroundColor: COLORS.background, borderRadius: 28, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24, elevation: 12 },
    header: { alignItems: 'center', marginBottom: 32 },
    logoContainer: { width: 76, height: 76, backgroundColor: COLORS.primary, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 10 },
    title: { fontSize: 28, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 6, fontWeight: '500' },
    formContainer: { width: '100%' },
    inputWrapper: { marginBottom: 16 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 16, height: 54, borderWidth: 1.5, borderColor: COLORS.border },
    inputError: { borderColor: COLORS.danger, backgroundColor: '#FEE2E2' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 15, color: COLORS.secondary, fontWeight: '500' },
    eyeBtn: { padding: 6 },
    errorText: { color: COLORS.danger, fontSize: 12, marginTop: 6, marginLeft: 10, fontWeight: '600' },
    serverError: { color: '#fff', backgroundColor: COLORS.danger, padding: 12, borderRadius: 12, textAlign: 'center', marginBottom: 16, fontWeight: '700', fontSize: 13 },
    forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
    forgotPasswordText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
    submitButton: { backgroundColor: COLORS.primary, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 8, marginTop: 4 },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
    switchFlow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22, marginBottom: 10 },
    switchText: { color: COLORS.textLight, fontSize: 14 },
    switchLink: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
    oauthSection: { marginTop: 22 },
    oauthDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    line: { flex: 1, height: 1, backgroundColor: COLORS.border },
    oauthText: { marginHorizontal: 14, color: COLORS.textLight, fontSize: 13, fontWeight: '600' },
    oauthButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
    oauthBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
    oauthBtnText: { marginLeft: 8, fontWeight: '700', color: COLORS.secondary, fontSize: 14 },
});