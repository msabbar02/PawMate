import React, { useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const WalkSummaryScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);
    const { walkData } = route.params;
    const viewShotRef = useRef();

    const handleShare = async () => {
        try {
            const uri = await viewShotRef.current.capture();
            await Sharing.shareAsync(uri, {
                dialogTitle: 'Comparte tu paseo con PawMate',
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('HomeMain')} style={styles.closeBtn}>
                        <Ionicons name="close" size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Resumen de Paseo</Text>
                </View>

                {/* ViewShot captures this component for image sharing */}
                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
                    <View style={styles.summaryCard}>
                        <View style={styles.brandingRow}>
                            <Ionicons name="paw" size={24} color={theme.primary} />
                            <Text style={styles.appName}>PawMate</Text>
                        </View>

                        <View style={styles.petHeader}>
                            <View style={styles.petAvatar}>
                                <Ionicons name="paw" size={30} color="#FFF" />
                            </View>
                            <Text style={styles.petName}>{walkData?.petName ?? 'Mascota'}</Text>
                            <Text style={styles.tagline}>¡Ha completado un gran paseo!</Text>
                        </View>

                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{walkData?.distanceKm != null ? String(walkData.distanceKm) : '0'} km</Text>
                                <Text style={styles.statLabel}>Distancia</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{walkData?.durationMins != null ? String(walkData.durationMins) : '0'} min</Text>
                                <Text style={styles.statLabel}>Tiempo</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{walkData?.distanceKm != null ? String(Math.round(walkData.distanceKm * 60)) : '0'}</Text>
                                <Text style={styles.statLabel}>Kcal Pet</Text>
                            </View>
                        </View>

                        <View style={styles.mapGraphic}>
                            <Ionicons name="map-outline" size={60} color={theme.primary + '80'} />
                            <Text style={styles.mapText}>Ruta Trazada</Text>
                        </View>
                    </View>
                </ViewShot>

                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={24} color="#FFF" />
                    <Text style={styles.shareBtnText}>Compartir Externo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: theme.primary, marginTop: -5 }]}
                    onPress={() => {
                        // In a real app we'd pass the walk data or image to CreatePostScreen
                        navigation.navigate('CreatePost');
                    }}
                >
                    <Ionicons name="people-outline" size={24} color="#FFF" />
                    <Text style={styles.shareBtnText}>Compartir en Comunidad</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('HomeMain')}>
                    <Text style={styles.doneBtnText}>Volver al Inicio</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center' },
    closeBtn: { padding: 5, marginRight: 20 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: theme.text },
    summaryCard: {
        backgroundColor: theme.cardBackground, margin: 20, borderRadius: 20, padding: 25,
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10,
        borderWidth: 1, borderColor: theme.border,
    },
    brandingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' },
    appName: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginLeft: 10, letterSpacing: 1 },
    petHeader: { alignItems: 'center', marginBottom: 25 },
    petAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    petName: { fontSize: 24, fontWeight: 'bold', color: theme.text },
    tagline: { fontSize: 16, color: theme.textSecondary, marginTop: 5 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: theme.background, padding: 20, borderRadius: 15, marginBottom: 25 },
    statBox: { alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: 'bold', color: theme.primary },
    statLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 5, textTransform: 'uppercase', fontWeight: 'bold' },
    mapGraphic: { height: 120, backgroundColor: theme.primary + '11', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary + '33', borderStyle: 'dashed' },
    mapText: { color: theme.primary, fontWeight: 'bold', marginTop: 10 },
    shareBtn: { backgroundColor: '#FF4081', marginHorizontal: 20, paddingVertical: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    shareBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    doneBtn: { marginHorizontal: 20, paddingVertical: 18, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    doneBtnText: { color: theme.textSecondary, fontSize: 16, fontWeight: 'bold' }
});

export default WalkSummaryScreen;
