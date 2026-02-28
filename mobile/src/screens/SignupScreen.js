import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Keyboard,
    Image,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const SignupScreen = ({ navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const styles = getStyles(theme);

    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        confirmPassword: '',
        city: '',
        street: '',
        door: '',
        floor: '',
        province: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (name, value) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSignup = async () => {
        const {
            name,
            surname,
            email,
            password,
            confirmPassword,
            city,
            street,
            door,
            floor,
            province,
        } = formData;

        if (
            !name ||
            !surname ||
            !email ||
            !password ||
            !confirmPassword ||
            !city ||
            !street ||
            !door ||
            !floor ||
            !province
        ) {
            Alert.alert('Error', 'All fields are mandatory');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }

        setIsLoading(true);
        try {
            // 1. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Save additional user data in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                name,
                surname,
                email,
                avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
                address: {
                    city,
                    province,
                    street,
                    door,
                    floor
                },
                role: 'user', // Default role is normal user
                createdAt: new Date().toISOString()
            });

            Alert.alert('Éxito', '¡Cuenta creada correctamente!', [
                { text: 'OK', onPress: () => navigation.replace('HomeMain') }, // Navigate to HomeMain
            ]);
        } catch (error) {
            let msg = 'Error al crear la cuenta';
            if (error.code === 'auth/email-already-in-use') msg = 'El correo ya está en uso';
            if (error.code === 'auth/invalid-email') msg = 'Correo inválido';
            if (error.code === 'auth/weak-password') msg = 'La contraseña es muy débil (mínimo 6 caracteres)';
            Alert.alert('Error', msg);
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Account</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.logoContainer}>
                    <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                </View>

                <Text style={styles.sectionTitle}>Personal Info</Text>

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Name"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.name}
                            onChangeText={(text) => handleChange('name', text)}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Surname</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Surname"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.surname}
                            onChangeText={(text) => handleChange('surname', text)}
                        />
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="example@email.com"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={formData.email}
                        onChangeText={(text) => handleChange('email', text)}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Create a password"
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry={!showPassword}
                            value={formData.password}
                            onChangeText={(text) => handleChange('password', text)}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Text style={styles.showHideText}>
                                {showPassword ? 'Hide' : 'Show'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm your password"
                        placeholderTextColor={theme.textSecondary}
                        secureTextEntry={!showPassword}
                        value={formData.confirmPassword}
                        onChangeText={(text) => handleChange('confirmPassword', text)}
                    />
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Address</Text>
                <Text style={styles.sectionSubtitle}>
                    To find communities near you
                </Text>

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>City</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="City"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.city}
                            onChangeText={(text) => handleChange('city', text)}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Province</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Province"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.province}
                            onChangeText={(text) => handleChange('province', text)}
                        />
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Street</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Street Name"
                        placeholderTextColor={theme.textSecondary}
                        value={formData.street}
                        onChangeText={(text) => handleChange('street', text)}
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Door</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Door"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.door}
                            onChangeText={(text) => handleChange('door', text)}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Floor</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Floor"
                            placeholderTextColor={theme.textSecondary}
                            value={formData.floor}
                            onChangeText={(text) => handleChange('floor', text)}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.button, isLoading && { opacity: 0.7 }]}
                    onPress={handleSignup}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.buttonText}>Registrarse</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.loginContainer}>
                    <Text style={styles.loginText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.loginLink}>Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
    },
    backButton: {
        marginRight: 15,
    },
    backButtonText: {
        color: theme.text,
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.primary,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.cardBackground,
        overflow: 'hidden',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 5,
        marginTop: 10,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 15,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    inputContainer: {
        marginBottom: 15,
    },
    label: {
        color: theme.text,
        fontSize: 14,
        marginBottom: 5,
        marginLeft: 5,
    },
    input: {
        backgroundColor: theme.cardBackground,
        color: theme.text,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    passwordInput: {
        flex: 1,
        color: theme.text,
        padding: 12,
    },
    showHideText: {
        color: theme.primary,
        padding: 10,
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: theme.primary,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 20,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
    },
    loginText: {
        color: theme.textSecondary,
    },
    loginLink: {
        color: theme.primary,
        fontWeight: 'bold',
    },
});

export default SignupScreen;
