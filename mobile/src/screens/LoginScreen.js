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
    TouchableWithoutFeedback,
    Keyboard,
    Dimensions,
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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar style="dark" />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.scrollContent}>

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

                            <TouchableOpacity style={styles.forgotPassword}>
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
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    decorativeCircle1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.primaryLight, opacity: 0.2 },
    decorativeCircle2: { position: 'absolute', bottom: -150, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: COLORS.primary, opacity: 0.1 },
    glassCard: { width: '100%', maxWidth: 400, backgroundColor: COLORS.glass, borderRadius: 30, padding: 25, shadowColor: COLORS.primary, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 10 }, shadowRadius: 30, elevation: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
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
    forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
    forgotPasswordText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
    submitButton: { backgroundColor: COLORS.primary, borderRadius: 15, height: 55, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 8, marginTop: 5 },
    submitButtonText: { color: COLORS.background, fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
    switchFlow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 10 },
    switchText: { color: COLORS.textLight, fontSize: 14 },
    switchLink: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },
    oauthSection: { marginTop: 20 },
    oauthDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    line: { flex: 1, height: 1, backgroundColor: COLORS.border },
    oauthText: { marginHorizontal: 15, color: COLORS.textLight, fontSize: 13, fontWeight: '500' },
    oauthButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
    oauthBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    oauthBtnText: { marginLeft: 8, fontWeight: '600', color: COLORS.secondary, fontSize: 14 },
});