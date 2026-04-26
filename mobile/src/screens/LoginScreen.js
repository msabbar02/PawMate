import React, { useState, useEffect, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { useTranslation } from '../context/LanguageContext';

const SAVED_ACCOUNTS_KEY = '@pawmate_saved_accounts';
const MAX_SAVED_ACCOUNTS = 5;

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

const InputField = ({ icon, placeholder, value, fieldName, secureTextEntry, isPassword, onChangeText, onTogglePassword, error, inputRef }) => (
    <View style={styles.inputWrapper}>
        <View style={[styles.inputContainer, error && styles.inputError]}>
            <Icon name={icon} size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textLight}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={fieldName === 'email' ? 'email-address' : 'default'}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
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

export default function LoginScreen({ navigation }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [savedAccounts, setSavedAccounts] = useState([]);
    const passwordInputRef = useRef(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [errors, setErrors] = useState({});

    // ── Load saved accounts ──
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
                if (raw) setSavedAccounts(JSON.parse(raw));
            } catch { /* ignore */ }
        })();
    }, []);

    const persistAccount = async (email) => {
        try {
            const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            const filtered = list.filter(e => e.toLowerCase() !== email.toLowerCase());
            const next = [email, ...filtered].slice(0, MAX_SAVED_ACCOUNTS);
            await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    };

    const removeAccount = async (email) => {
        try {
            const next = savedAccounts.filter(e => e !== email);
            setSavedAccounts(next);
            await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    };

    const pickAccount = (email) => {
        setFormData({ email, password: '' });
        setErrors({});
        setTimeout(() => passwordInputRef.current?.focus(), 150);
    };

    const validateForm = () => {
        let isValid = true;
        let newErrors = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
            const cleanEmail = formData.email.toLowerCase().trim();
            const { error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: formData.password
            });
            if (error) throw error;
            await persistAccount(cleanEmail);
            // El onAuthStateChanged general se encargará de la redirección
        } catch (error) {
            console.error("Supabase Login Error:", error.message);
            let errorMsg = t('login.genericError');
            if (error.message.includes('Invalid login credentials')) {
                errorMsg = t('login.invalidCredentials');
            } else if (error.message.includes('FetchError') || error.message.includes('Network request failed')) {
                errorMsg = t('login.networkError');
            }
            setErrors({ form: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!formData.email.trim()) {
            setErrors({ email: t('login.forgotPasswordPrompt') });
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
                redirectTo: 'https://apppawmate.com/reset-password',
            });
            if (error) throw error;
            Alert.alert(t('login.linkSent'), t('login.checkEmail'));
        } catch (error) {
            Alert.alert(t('common.error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            // Custom scheme — iOS intercepts this redirect before any page loads
            const redirectTo = 'pawmate://login';
            console.log('Google OAuth redirect URI:', redirectTo);
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
            console.log('OAuth URL:', data.url);

            const result = await WebBrowser.openAuthSessionAsync(data.url, 'pawmate://');
            console.log('Auth result:', result.type, result.url);
            if (result.type === 'success' && result.url) {
                const url = result.url;
                // PKCE: extract code from query params
                const codeMatch = url.match(/[?&]code=([^&#]+)/);
                if (codeMatch) {
                    const code = decodeURIComponent(codeMatch[1]);
                    console.log('Got auth code, exchanging for session...');
                    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
                    if (sessionError) throw sessionError;
                } else {
                    // Fallback: try fragment tokens (implicit flow)
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
            console.error('Google login error:', error);
            Alert.alert(t('common.error'), error.message || t('login.googleError'));
        } finally {
            setLoading(false);
        }
    };

    const handleMagicLink = async () => {
        if (!formData.email.trim()) {
            setErrors({ email: t('login.magicLinkPrompt') });
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({ email: formData.email });
            if (error) throw error;
            Alert.alert(t('login.magicLinkSent'), t('login.magicLinkCheck'));
        } catch (error) {
            Alert.alert(t('common.error'), error.message);
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
                                <Icon name="paw" size={40} color={COLORS.background} />
                            </View>
                            <Text style={styles.title}>{t('login.title')}</Text>
                            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
                        </View>

                        <View style={styles.formContainer}>
                            {savedAccounts.length > 0 && (
                                <View style={styles.savedAccountsBox}>
                                    <Text style={styles.savedAccountsTitle}>Cuentas guardadas</Text>
                                    {savedAccounts.map((email) => {
                                        const isActive = formData.email.toLowerCase() === email.toLowerCase();
                                        return (
                                            <View key={email} style={[styles.savedAccountRow, isActive && styles.savedAccountRowActive]}>
                                                <TouchableOpacity
                                                    style={styles.savedAccountMain}
                                                    onPress={() => pickAccount(email)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.savedAccountAvatar}>
                                                        <Text style={styles.savedAccountInitial}>{email.charAt(0).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={styles.savedAccountEmail} numberOfLines={1}>{email}</Text>
                                                    {isActive && <Icon name="checkmark-circle" size={18} color={COLORS.primary} />}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.savedAccountRemove}
                                                    onPress={() => removeAccount(email)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Icon name="close" size={16} color={COLORS.textLight} />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                    <TouchableOpacity
                                        style={styles.useAnotherAccount}
                                        onPress={() => { setFormData({ email: '', password: '' }); setErrors({}); }}
                                    >
                                        <Icon name="add-circle-outline" size={16} color={COLORS.primary} />
                                        <Text style={styles.useAnotherAccountText}>Usar otra cuenta</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

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
                                inputRef={passwordInputRef}
                            />

                            <TouchableOpacity style={styles.forgotPassword} onPress={handleResetPassword}>
                                <Text style={styles.forgotPasswordText}>{t('login.forgotPassword')}</Text>
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
                                    <Text style={styles.submitButtonText}>{t('login.enter')}</Text>
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
                                    <Text style={[styles.submitButtonText, { color: COLORS.primary }]}>{t('login.sendMagicLink')}</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.switchFlow}>
                                <Text style={styles.switchText}>{t('login.noAccount')} </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                    <Text style={styles.switchLink}>{t('login.signupHere')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.oauthSection}>
                                <View style={styles.oauthDivider}>
                                    <View style={styles.line} />
                                    <Text style={styles.oauthText}>{t('login.continueWith')}</Text>
                                    <View style={styles.line} />
                                </View>

                                <View style={styles.oauthButtonsRow}>
                                    <TouchableOpacity style={styles.oauthBtn} onPress={handleGoogleLogin} disabled={loading}>
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
    savedAccountsBox: { marginBottom: 18, padding: 12, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
    savedAccountsTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textLight, marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    savedAccountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
    savedAccountRowActive: { borderColor: COLORS.primary, backgroundColor: '#FFF7ED' },
    savedAccountMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 },
    savedAccountAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    savedAccountInitial: { color: '#fff', fontWeight: '800', fontSize: 14 },
    savedAccountEmail: { flex: 1, fontSize: 13, color: COLORS.secondary, fontWeight: '600' },
    savedAccountRemove: { padding: 12 },
    useAnotherAccount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 8 },
    useAnotherAccountText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
});