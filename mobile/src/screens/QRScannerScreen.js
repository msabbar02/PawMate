import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const QRScannerScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);

    // We expect the user to scan a QR code for a specific reservation and purpose
    const { expectedId, purpose } = route.params;

    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        getCameraPermissions();
    }, []);

    const handleBarcodeScanned = async ({ type, data }) => {
        if (scanned || isProcessing) return;
        setScanned(true);
        setIsProcessing(true);

        try {
            const parsedData = JSON.parse(data);

            // Validate the QR code matches what we expect
            if (parsedData.reservationId !== expectedId || parsedData.action !== purpose) {
                Alert.alert('Error', 'El código QR no coincide con esta reserva o acción.', [
                    { text: 'Intentar de nuevo', onPress: () => setScanned(false) },
                    { text: 'Cancelar', onPress: () => navigation.goBack() }
                ]);
                setIsProcessing(false);
                return;
            }

            // If valid, update Firestore
            const newStatus = purpose === 'start' ? 'active' : 'completed';
            await updateDoc(doc(db, 'reservations', expectedId), { status: newStatus });

            let successMsg = purpose === 'start'
                ? 'El paseo/guardería ha comenzado oficialmente.'
                : 'El servicio ha finalizado correctamente. ¡Gracias!';

            Alert.alert('¡Verificado!', successMsg, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (error) {
            console.error(error);
            Alert.alert('Error QR', 'El formato del QR es inválido.', [
                { text: 'Intentar de nuevo', onPress: () => setScanned(false) }
            ]);
            setIsProcessing(false);
        }
    };

    if (hasPermission === null) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }
    if (hasPermission === false) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={{ color: theme.text }}>Sin acceso a la cámara</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: theme.primary }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Escanear QR</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.scannerContainer}>
                <CameraView
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Overlay UI */}
                <View style={styles.overlay}>
                    <View style={styles.scanTarget} />
                    <Text style={styles.instructionText}>
                        Apunta la cámara al código QR generado por el cuidador para verificar la acción.
                    </Text>
                </View>

                {isProcessing && (
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#FFF" />
                        <Text style={{ color: '#FFF', marginTop: 10, fontWeight: 'bold' }}>Verificando...</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, zIndex: 10 },
    headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
    scannerContainer: { flex: 1, position: 'relative' },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    scanTarget: { width: 250, height: 250, borderWidth: 2, borderColor: theme.primary, backgroundColor: 'transparent', borderRadius: 20 },
    instructionText: { color: '#FFF', textAlign: 'center', marginTop: 40, width: '80%', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.6)', padding: 15, borderRadius: 10 },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 20 }
});

export default QRScannerScreen;
