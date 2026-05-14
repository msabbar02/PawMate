import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    Linking,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { useTranslation } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

export default function ConfirmScreen({ navigation }) {
    const { t } = useTranslation();

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />

            <View style={styles.card}>
                {/* Icon */}
                <View style={styles.iconWrap}>
                    <Icon name="mail" size={44} color="#fff" />
                </View>

                <Text style={styles.title}>¡Revisa tu correo!</Text>
                <Text style={styles.subtitle}>
                    Te hemos enviado un enlace de confirmación. Ábrelo para activar tu cuenta y comenzar a usar PawMate.
                </Text>

                <View style={styles.stepsBox}>
                    <StepRow number="1" text="Abre tu aplicación de correo" />
                    <StepRow number="2" text="Busca un email de PawMate" />
                    <StepRow number="3" text="Haz clic en «Confirmar cuenta»" />
                </View>

                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => Linking.openURL('mailto:')}
                >
                    <Icon name="mail-open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Abrir correo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => navigation.replace('Login')}
                >
                    <Text style={styles.secondaryBtnText}>Volver al inicio de sesión</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/**
 * Fila de paso numerado que se muestra en la tarjeta de confirmación.
 *
 * @param {object} props
 * @param {string} props.number Número de paso.
 * @param {string} props.text   Descripción del paso.
 */
function StepRow({ number, text }) {
    return (
        <View style={styles.stepRow}>
            <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{number}</Text>
            </View>
            <Text style={styles.stepText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    decorativeCircle1: {
        position: 'absolute', top: -120, right: -60,
        width: 280, height: 280, borderRadius: 140,
        backgroundColor: COLORS.primary, opacity: 0.08,
    },
    decorativeCircle2: {
        position: 'absolute', bottom: -140, left: -80,
        width: 350, height: 350, borderRadius: 175,
        backgroundColor: COLORS.primaryLight, opacity: 0.06,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: COLORS.background,
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 24,
        elevation: 12,
    },
    iconWrap: {
        width: 88,
        height: 88,
        backgroundColor: COLORS.primary,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 10,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.secondary,
        letterSpacing: -0.5,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textLight,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        fontWeight: '500',
    },
    stepsBox: {
        width: '100%',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 28,
        gap: 12,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumber: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 13,
    },
    stepText: {
        fontSize: 14,
        color: COLORS.secondary,
        fontWeight: '600',
        flex: 1,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        height: 54,
        marginBottom: 12,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 8,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    secondaryBtn: {
        paddingVertical: 12,
    },
    secondaryBtnText: {
        color: COLORS.textLight,
        fontSize: 14,
        fontWeight: '700',
    },
});
