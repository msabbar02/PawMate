import React, { useState, useContext } from 'react';
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
    Image,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { useTranslation } from '../context/LanguageContext';
import { AuthContext } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

/**
 * Campo de texto reutilizable con icono, soporte de contraseña y mensaje de
 * error inline (sin ref controlada, para el formulario de registro).
 */
const InputField = ({ icon, placeholder, value, fieldName, secureTextEntry, isPassword, onChangeText, onTogglePassword, error }) => (
    <View style={styles.inputWrapper}>
        <View style={[styles.inputContainer, error && styles.inputError]}>
            <Icon name={icon} size={20} color={COLORS.textLight} style={styles.inputIcon} />
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
                    <Icon name={secureTextEntry ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.primary} />
                </TouchableOpacity>
            )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

export default function SignupScreen({ navigation }) {
    const { t } = useTranslation();
    const { markSignupInProgress } = useContext(AuthContext);
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

    /**
     * Valida todos los campos del formulario de registro.
     *
     * @returns {boolean} `true` si todos los campos son válidos.
     */
    const validateForm = () => {
        let isValid = true;
        let newErrors = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.fullName.trim()) {
            newErrors.fullName = t('signup.nameRequired');
            isValid = false;
        }

        if (!formData.email.trim()) {
            newErrors.email = t('login.emailRequired');
            isValid = false;
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = t('login.invalidEmail');
            isValid = false;
        }

        if (!formData.password) {
            newErrors.password = t('login.passwordRequired');
            isValid = false;
        } else if (formData.password.length < 8) {
            newErrors.password = t('signup.passwordMinLength');
            isValid = false;
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = t('signup.passwordsMismatch');
            isValid = false;
        }

        if (!termsAccepted) {
            newErrors.terms = t('signup.termsRequired');
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    /**
     * Comprueba si el email ya está registrado en la tabla de usuarios.
     *
     * @param {string} email Email a verificar.
     * @returns {Promise<boolean>} `true` si el email ya existe.
     */
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

    /**
     * Registra al usuario en Supabase Auth. Si el envío del email de
     * confirmación falla pero el usuario se creó igualmente, navega a
     * `Confirm`. Si el registro es sin email de confirmación, el
     * `AuthContext` redirige automáticamente.
     */
    const handleSignup = async () => {
        Keyboard.dismiss();

        if (!validateForm()) return;

        setLoading(true);
        setErrors({});

        try {
            // Verifica si el email ya está registrado antes de llamar a signUp.
            const emailTaken = await checkEmailExists(formData.email);
            if (emailTaken) {
                setErrors({ email: t('signup.emailExists') });
                return;
            }

            // Marca que el próximo SIGNED_IN proviene de un registro recién hecho,
            // para que se loggee como USER_SIGNUP.
            markSignupInProgress();

            const { data, error } = await supabase.auth.signUp({
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                options: {
                    data: {
                        fullName: formData.fullName.trim(),
                        firstName: formData.fullName.trim().split(' ')[0],
                        lastName: formData.fullName.trim().split(' ').slice(1).join(' ') || '',
                        email: formData.email.toLowerCase().trim(),
                    },
                    emailRedirectTo: 'https://apppawmate.com/confirm',
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
                        navigation.replace('Confirm');
                    }
                    return;
                }
                if (msg.includes('User already registered') || msg.includes('already registered')) {
                    setErrors({ email: t('signup.emailExists') });
                    return;
                }
                if (msg.includes('FetchError') || msg.includes('Network request failed') || msg.includes('fetch')) {
                    setErrors({ form: t('login.networkError') });
                    return;
                }
                throw error;
            }

            // Si no se requiere confirmación de email, el usuario queda logueado
            // y AuthContext lo redirige automáticamente.
            // Si se requiere confirmación, navegamos a la pantalla de confirmación.
            if (data?.user && !data?.session) {
                navigation.replace('Confirm');
            }
        } catch (error) {
            console.error('Supabase Signup Error:', error.message);
            setErrors({ form: t('signup.genericError') });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Registra al usuario mediante OAuth de Google (mismo flujo PKCE que
     * el login).
     */
    const handleGoogleSignup = async () => {
        try {
            setLoading(true);
            // Marca que el pr\u00f3ximo SIGNED_IN proviene de un registro.
            markSignupInProgress();
            const redirectTo = 'pawmate://signup';
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                    queryParams: {
                        prompt: 'select_account',
                        access_type: 'offline',
                    },
                },
            });
            if (error) throw error;

            const result = await WebBrowser.openAuthSessionAsync(data.url, 'pawmate://');
            if (result.type === 'success' && result.url) {
                const url = result.url;
                const codeMatch = url.match(/[?&]code=([^&#]+)/);
                if (codeMatch) {
                    const code = decodeURIComponent(codeMatch[1]);
                    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
                    if (sessionError) throw sessionError;
                } else {
                    let params = {};
                    const hashIndex = url.indexOf('#');
                    if (hashIndex !== -1) {
                        const fragment = url.substring(hashIndex + 1);
                        params = Object.fromEntries(new URLSearchParams(fragment));
                    }
                    if (params.access_token && params.refresh_token) {
                        await supabase.auth.setSession({
                            access_token: params.access_token,
                            refresh_token: params.refresh_token,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Google signup error:', error);
            Alert.alert(t('common.error'), error.message || t('signup.googleError'));
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
                                <Image source={require('../../assets/logo-small.png')} style={{ width: 56, height: 56, borderRadius: 12 }} resizeMode="contain" />
                            </View>
                            <Text style={styles.title}>{t('signup.title')}</Text>
                            <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
                        </View>

                        <View style={styles.formContainer}>

                            <InputField
                                icon="person-outline"
                                placeholder={t('signup.fullName')}
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
                                placeholder={t('login.email')}
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
                                placeholder={t('login.password')}
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
                                placeholder={t('signup.confirmPassword')}
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
                                    {termsAccepted && <Icon name="checkmark" size={16} color={COLORS.background} style={styles.checkIcon} />}
                                    {!termsAccepted && <View style={styles.checkboxInner} />}
                                </TouchableOpacity>
                                <Text style={styles.termsText}>{t('signup.acceptTerms')}</Text>
                            </View>
                            {errors.terms && <Text style={[styles.errorText, { marginTop: -10, marginBottom: 15 }]}>{errors.terms}</Text>}

                            {errors.form && (
                                <Text style={[
                                    styles.serverError,
                                    errors.form.includes(t('signup.accountCreated')) && { backgroundColor: '#16a34a' }
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
                                    <Text style={styles.submitButtonText}>{t('signup.signUp')}</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.switchFlow}>
                                <Text style={styles.switchText}>{t('signup.hasAccount')} </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                    <Text style={styles.switchLink}>{t('signup.loginHere')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.oauthSection}>
                                <View style={styles.oauthDivider}>
                                    <View style={styles.line} />
                                    <Text style={styles.oauthText}>{t('signup.continueWith')}</Text>
                                    <View style={styles.line} />
                                </View>
                                <View style={styles.oauthButtonsRow}>
                                    <TouchableOpacity style={styles.oauthBtn} onPress={handleGoogleSignup} disabled={loading}>
                                        <Icon name="logo-google" size={20} color="#DB4437" />
                                        <Text style={styles.oauthBtnText}>Google</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.oauthBtn} disabled>
                                        <Icon name="logo-apple" size={20} color="#000000" />
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
    glassCard: { width: '100%', maxWidth: 420, backgroundColor: COLORS.background, borderRadius: 28, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24, elevation: 12, marginTop: 40, marginBottom: 40 },
    header: { alignItems: 'center', marginBottom: 32 },
    logoContainer: { width: 76, height: 76, backgroundColor: 'transparent', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
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
    termsWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    checkIcon: { backgroundColor: COLORS.primary, width: 24, height: 24, borderRadius: 6, textAlign: 'center', lineHeight: 24 },
    checkboxInner: { width: 10, height: 10, borderRadius: 2, backgroundColor: 'transparent' },
    termsText: { color: COLORS.textLight, fontSize: 13, flex: 1, fontWeight: '500' },
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