import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

const QRGeneratorScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);

    // reservationId and type ('start' or 'end')
    const { reservationId, type } = route.params;

    // The data we encode in the QR code
    // A simple JSON object with the reservation ID and the action type
    const qrData = JSON.stringify({
        reservationId,
        action: type
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>
                    {type === 'start' ? 'Iniciar Reserva' : 'Finalizar Reserva'}
                </Text>
                <Text style={styles.subtitle}>
                    Muestra este código al dueño de la mascota para que lo escanee desde su aplicación y pueda verificar el {type === 'start' ? 'inicio' : 'fin'} del servicio de forma segura.
                </Text>

                <View style={[styles.qrContainer, { backgroundColor: '#FFF' }]}>
                    <QRCode
                        value={qrData}
                        size={250}
                        color="black"
                        backgroundColor="white"
                    />
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
                    <Text style={styles.infoText}>
                        Este proceso garantiza la seguridad de la mascota y verifica que se ha realizado la entrega correctamente.
                    </Text>
                </View>

                {/* Optional: Dev button to simulate scan if physical devices aren't used */}
                {/* <TouchableOpacity style={styles.devBtn} onPress={() => navigation.goBack()}>
                    <Text style={{color: '#FFF'}}>Simular Escaneo Exitoso (Dev)</Text>
                </TouchableOpacity> */}
            </View>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: 20, paddingTop: 50, alignItems: 'flex-end' },
    content: { flex: 1, alignItems: 'center', paddingHorizontal: 30, paddingTop: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, marginBottom: 15, textAlign: 'center' },
    subtitle: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 40, lineHeight: 24 },
    qrContainer: { padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 8, marginBottom: 40 },
    infoBox: { flexDirection: 'row', backgroundColor: theme.cardBackground, padding: 20, borderRadius: 15, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
    infoText: { flex: 1, marginLeft: 15, fontSize: 14, color: theme.text, lineHeight: 20 },
    devBtn: { marginTop: 30, backgroundColor: 'red', padding: 10, borderRadius: 8 }
});

export default QRGeneratorScreen;
