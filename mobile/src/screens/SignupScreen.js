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
    Platform,
    Image,
} from 'react-native';

const SignupScreen = ({ navigation }) => {
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

    const handleChange = (name, value) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSignup = () => {
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
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        // Placeholder for actual signup logic
        console.log('Signup data:', formData);
        Alert.alert('Success', 'Account created successfully!', [
            { text: 'OK', onPress: () => navigation.navigate('Home') }, // Navigate to Home
        ]);
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
                            placeholderTextColor="#888"
                            value={formData.name}
                            onChangeText={(text) => handleChange('name', text)}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Surname</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Surname"
                            placeholderTextColor="#888"
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
                        placeholderTextColor="#888"
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
                            placeholderTextColor="#888"
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
                        placeholderTextColor="#888"
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
                            placeholderTextColor="#888"
                            value={formData.city}
                            onChangeText={(text) => handleChange('city', text)}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Province</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Province"
                            placeholderTextColor="#888"
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
                        placeholderTextColor="#888"
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
                            placeholderTextColor="#888"
                            value={formData.door}
                            onChangeText={(text) => handleChange('door', text)}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Floor</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Floor"
                            placeholderTextColor="#888"
                            value={formData.floor}
                            onChangeText={(text) => handleChange('floor', text)}
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleSignup}>
                    <Text style={styles.buttonText}>Sign Up</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101820',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#101820',
    },
    backButton: {
        marginRight: 15,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a7a4c',
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
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
        marginTop: 10,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#888',
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
        color: '#ccc',
        fontSize: 14,
        marginBottom: 5,
        marginLeft: 5,
    },
    input: {
        backgroundColor: '#1c2a35',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1c2a35',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    passwordInput: {
        flex: 1,
        color: '#fff',
        padding: 12,
    },
    showHideText: {
        color: '#1a7a4c',
        padding: 10,
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#1a7a4c',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 20,
        shadowColor: '#1a7a4c',
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
        color: '#ccc',
    },
    loginLink: {
        color: '#1a7a4c',
        fontWeight: 'bold',
    },
});

export default SignupScreen;
