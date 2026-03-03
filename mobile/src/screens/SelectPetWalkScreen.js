import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const SelectPetWalkScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [pets, setPets] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            setPets(list);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const togglePet = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const startWalk = () => {
        if (selectedIds.length === 0) return;
        const firstId = selectedIds[0];
        const pet = pets.find((p) => p.id === firstId);
        navigation.replace('WalkTracking', { petId: firstId, petName: pet?.name || 'Mascota' });
    };

    const renderPet = ({ item }) => {
        const isSelected = selectedIds.includes(item.id);
        return (
            <TouchableOpacity
                style={[styles.petRow, isSelected && styles.petRowSelected]}
                onPress={() => togglePet(item.id)}
                activeOpacity={0.8}
            >
                <Image
                    source={{ uri: item.image || item.photo || 'https://via.placeholder.com/60' }}
                    style={styles.petThumb}
                />
                <Text style={styles.petName}>{item.name}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected ? <Ionicons name="checkmark" size={20} color="#FFF" /> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Iniciar paseo</Text>
                <View style={{ width: 40 }} />
            </View>
            <Text style={styles.subtitle}>Elige una o más mascotas para pasear</Text>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : pets.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="paw-outline" size={64} color={theme.border} />
                    <Text style={styles.emptyText}>No tienes mascotas. Añade una en la pestaña Mascotas.</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.primaryBtnText}>Volver</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <FlatList
                        data={pets}
                        keyExtractor={(item) => item.id}
                        renderItem={renderPet}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                    />
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.primaryBtn, selectedIds.length === 0 && styles.primaryBtnDisabled]}
                            onPress={startWalk}
                            disabled={selectedIds.length === 0}
                        >
                            <Ionicons name="walk" size={22} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryBtnText}>Comenzar paseo</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
    subtitle: { fontSize: 14, color: theme.textSecondary, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    list: { padding: 20, paddingBottom: 100 },
    petRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    petRowSelected: { borderColor: theme.primary, backgroundColor: theme.primary + '0D' },
    petThumb: { width: 50, height: 50, borderRadius: 25, marginRight: 14 },
    petName: { flex: 1, fontSize: 17, fontWeight: '600', color: theme.text },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primary,
        paddingVertical: 16,
        borderRadius: 14,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { marginTop: 16, fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 24 },
});

export default SelectPetWalkScreen;
