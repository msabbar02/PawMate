import { useState, useMemo, useEffect, useRef, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal,
    Image, Dimensions, Platform, TextInput, KeyboardAvoidingView,
    ActivityIndicator, Animated, Alert, Share
} from 'react-native';
import {
    Flame, Clock, Plus, QrCode, X, PenSquare, Bell, Map,
    Share2, ChevronRight, Phone, User
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { uploadImageToStorage } from '../utils/storageHelpers';

const { width } = Dimensions.get('window');

const SPECIES_OPTIONS = [
    { value: 'dog', label: 'Perro', emoji: '🐕' },
    { value: 'cat', label: 'Gato', emoji: '🐈' },
    { value: 'bird', label: 'Ave', emoji: '🐦' },
    { value: 'rabbit', label: 'Conejo', emoji: '🐇' },
    { value: 'other', label: 'Otro', emoji: '🐾' },
];

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
const getSpeciesEmoji = (species) => {
    const sp = SPECIES_OPTIONS.find(s => s.value === species);
    return sp ? sp.emoji : '🐾';
};

const getSpeciesLabel = (species) => {
    const sp = SPECIES_OPTIONS.find(s => s.value === species);
    return sp ? sp.label : 'Mascota';
};

const getAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    if (years === 0) return `${Math.max(0, months)} meses`;
    return `${years} año${years !== 1 ? 's' : ''}`;
};

const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const getRouteRegion = (route) => {
    if (!route || route.length === 0) return null;
    const bounds = route.reduce((acc, p) => ({
        minLat: Math.min(acc.minLat, p.latitude),
        maxLat: Math.max(acc.maxLat, p.latitude),
        minLon: Math.min(acc.minLon, p.longitude),
        maxLon: Math.max(acc.maxLon, p.longitude),
    }), {
        minLat: route[0].latitude, maxLat: route[0].latitude,
        minLon: route[0].longitude, maxLon: route[0].longitude,
    });
    return {
        latitude: (bounds.minLat + bounds.maxLat) / 2,
        longitude: (bounds.minLon + bounds.maxLon) / 2,
        latitudeDelta: Math.max((bounds.maxLat - bounds.minLat) * 2.2, 0.006),
        longitudeDelta: Math.max((bounds.maxLon - bounds.minLon) * 2.2, 0.006),
    };
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─────────────────────────────────────────────────
// EMPTY FORM STATE
// ─────────────────────────────────────────────────
const EMPTY_FORM = {
    name: '', species: 'dog', breed: '', weight: '',
    gender: 'male', birthdate: '', color: '', sterilized: false,
    chipId: '', allergies: '', medications: '', medicalConditions: '',
    insurance: '', vetName: '', vetPhone: '', image: null,
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function PawMatePetsCenter() {
    const { user } = useContext(AuthContext);
    const { theme, isDarkMode } = require('react').useContext(require('../context/ThemeContext').ThemeContext);

    // ── Core State ──────────────────────────────────
    const [pets, setPets] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
    const [selectedPet, setSelectedPet] = useState(null);
    const [isLoadingSync, setIsLoadingSync] = useState(true);
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'walks' | 'health'

    // ── Modal Flags ──────────────────────────────────
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPassportVisible, setIsPassportVisible] = useState(false);
    const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);

    // ── Form State (Extended) ────────────────────────
    const [formParams, setFormParams] = useState({ ...EMPTY_FORM });

    // ── Reminder State ───────────────────────────────
    const [editingReminder, setEditingReminder] = useState(null);
    const [reminderForm, setReminderForm] = useState({
        title: '', description: '', eventTime: new Date(), notificationAdvance: 15,
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // ── Walk Tracking ────────────────────────────────
    const [isWalking, setIsWalking] = useState(false);
    const [walkRoute, setWalkRoute] = useState([]);
    const [walkDistance, setWalkDistance] = useState(0);
    const [walkTimer, setWalkTimer] = useState(0);
    const [walks, setWalks] = useState([]); // ALL walks from Firestore

    const locationSub = useRef(null);
    const timerRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // ─────────────────────────────────────────────────
    // SUPABASE: Pets Collection
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) { setIsLoadingSync(false); return; }
        
        const fetchPets = async () => {
            const { data } = await supabase.from('pets').select('*').eq('ownerId', user.id);
            if (data) {
                setPets(data);
                if (selectedPet) {
                    const live = data.find(p => p.id === selectedPet.id);
                    if (live) setSelectedPet(live);
                }
            }
            setIsLoadingSync(false);
        };
        fetchPets();

        const channel = supabase
            .channel('pets_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pets', filter: `ownerId=eq.${user.id}` }, () => {
                fetchPets();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedPet?.id, user?.id]);

    // ─────────────────────────────────────────────────
    // SUPABASE: All Walks for Selected Pet
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!selectedPet || viewMode !== 'detail') { setWalks([]); return; }
        
        const fetchWalks = async () => {
            const { data } = await supabase
                .from('walks')
                .select('*')
                .eq('petId', selectedPet.id)
                .order('endTime', { ascending: false });
            if (data) setWalks(data);
        };
        fetchWalks();

        const channel = supabase
            .channel('walks_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'walks', filter: `petId=eq.${selectedPet.id}` }, () => {
                fetchWalks();
            })
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [selectedPet?.id, viewMode]);

    // ─────────────────────────────────────────────────
    // NOTIFICATION PERMISSIONS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        Notifications.requestPermissionsAsync();
    }, []);

    // ─────────────────────────────────────────────────
    // TOTAL STATS (computed from all walks)
    // ─────────────────────────────────────────────────
    const totalStats = useMemo(() => {
        const km = walks.reduce((s, w) => s + (w.totalKm || 0), 0);
        const kcal = walks.reduce((s, w) => s + (w.calories || 0), 0);
        const secs = walks.reduce((s, w) => s + (w.durationSeconds || 0), 0);
        const avgPace = walks.length > 0 && secs > 0
            ? (km / (secs / 3600)).toFixed(1)
            : '0';
        return { km: km.toFixed(2), kcal, count: walks.length, avgPace };
    }, [walks]);

    // ─────────────────────────────────────────────────
    // QR PAYLOAD (rich biometric data)
    // ─────────────────────────────────────────────────
    const qrPayload = useMemo(() => {
        if (!selectedPet) return '{}';
        return JSON.stringify({
            id: selectedPet.id,
            name: selectedPet.name,
            species: getSpeciesLabel(selectedPet.species),
            breed: selectedPet.breed || '',
            chip: selectedPet.chipId || 'Sin chip',
            weight: selectedPet.weight ? `${selectedPet.weight} kg` : '',
            gender: selectedPet.gender === 'female' ? 'Hembra' : 'Macho',
            color: selectedPet.color || '',
            allergies: selectedPet.allergies || 'Ninguna',
            medications: selectedPet.medications || 'Ninguna',
            conditions: selectedPet.medicalConditions || 'Ninguna',
            vet: selectedPet.vetName || '',
            vetPhone: selectedPet.vetPhone || '',
            owner: user?.email || '',
            app: 'PawMate',
        });
    }, [selectedPet, user?.email]);

    // ─────────────────────────────────────────────────
    // NAVIGATION with fade transition
    // ─────────────────────────────────────────────────
    const navigateTo = (mode, pet = null) => {
        fadeAnim.setValue(0);
        setSelectedPet(pet);
        setViewMode(mode);
        setActiveTab('profile');
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    };

    // ─────────────────────────────────────────────────
    // WALK CONTROL
    // ─────────────────────────────────────────────────
    const startWalk = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Error', 'Permiso GPS denegado');
        setWalkRoute([]); setWalkDistance(0); setWalkTimer(0); setIsWalking(true);
        timerRef.current = setInterval(() => setWalkTimer(t => t + 1), 1000);
        locationSub.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
            ({ coords: { latitude, longitude } }) => {
                setWalkRoute(prev => {
                    const next = [...prev, { latitude, longitude }];
                    if (prev.length > 0) {
                        const last = prev[prev.length - 1];
                        setWalkDistance(d => d + haversineKm(last.latitude, last.longitude, latitude, longitude));
                    }
                    return next;
                });
            }
        );
    };

    const stopWalk = async () => {
        locationSub.current?.remove();
        locationSub.current = null;
        clearInterval(timerRef.current);
        setIsWalking(false);

        const totalKm = parseFloat(walkDistance.toFixed(2));
        const weight = parseFloat(selectedPet?.weight) || 0;
        const calories = Math.round(weight * totalKm * 0.6);

        try {
            await supabase.from('walks').insert({
                petId: selectedPet.id,
                route: walkRoute,
                totalKm,
                calories,
                durationSeconds: walkTimer,
                startTime: new Date(Date.now() - walkTimer * 1000).toISOString(),
                endTime: new Date().toISOString(),
            });

            const newTotal = (selectedPet.activity?.km || 0) + totalKm;
            const newActivity = { ...(selectedPet.activity || {}), km: newTotal };
            await supabase.from('pets').update({ activity: newActivity }).eq('id', selectedPet.id);
            
            Alert.alert('¡Paseo completado! 🐾', `${totalKm} km · ${calories} kcal quemadas`);
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar el paseo');
        }
    };

    // ─────────────────────────────────────────────────
    // SHARE WALK
    // ─────────────────────────────────────────────────
    const shareWalk = async (walk) => {
        const mins = Math.round((walk.durationSeconds || 0) / 60);
        const date = walk.endTime
            ? new Date(walk.endTime).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
            : '';
        const message =
            `🐾 ¡${selectedPet?.name} completó un paseo con PawMate!\n\n` +
            `📍 Distancia: ${walk.totalKm} km\n` +
            `⏱️ Duración: ${mins} min\n` +
            `🔥 Calorías: ${walk.calories || 0} kcal\n` +
            `📅 ${date}\n\n` +
            `¡Descarga PawMate y lleva el control de la salud de tus mascotas! 🐶`;
        try {
            await Share.share({ message, title: `Paseo de ${selectedPet?.name}` });
        } catch {
            Alert.alert('Error', 'No se pudo compartir');
        }
    };

    // ─────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────
    const scheduleReminder = async (title, body, triggerDate) => {
        try {
            await Notifications.scheduleNotificationAsync({
                content: { title: `🐾 ${title}`, body: body || 'Abre PawMate', sound: true },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
            });
            Alert.alert('Alarma lista', `Te avisaremos: "${title}"`);
        } catch (e) { console.error(e); }
    };

    // ─────────────────────────────────────────────────
    // PET CRUD
    // ─────────────────────────────────────────────────
    const handleSavePet = async () => {
        if (!formParams.name.trim()) return Alert.alert('Error', 'El nombre es obligatorio');
        try {
            let imageUrl = formParams.image;
            // Upload image to Supabase/Firebase Storage if it's a local URI
            if (formParams.image && !formParams.image.startsWith('http')) {
                const uid = user?.id;
                const timestamp = Date.now();
                const path = `pets/${uid}/${timestamp}.jpg`;
                imageUrl = await uploadImageToStorage(formParams.image, path);
            }
            const dataToSave = { ...formParams, image: imageUrl };

            if (isEditing && selectedPet) {
                await supabase.from('pets').update(dataToSave).eq('id', selectedPet.id);
            } else {
                await supabase.from('pets').insert({
                    ...dataToSave,
                    ownerId: user?.id,
                    activity: { km: 0 },
                    vaccines: [],
                    reminders: [],
                });
            }
            setIsFormVisible(false);
            resetForm();
        } catch (e) {
            console.error('handleSavePet error:', e);
            Alert.alert('Error', 'No se pudo guardar la mascota');
        }
    };

    const resetForm = () => {
        setFormParams({ ...EMPTY_FORM });
        setIsEditing(false);
    };

    const openEditModal = (pet) => {
        setFormParams({
            name: pet.name || '',
            species: pet.species || 'dog',
            breed: pet.breed || '',
            weight: pet.weight?.toString() || '',
            gender: pet.gender || 'male',
            birthdate: pet.birthdate || '',
            color: pet.color || '',
            sterilized: pet.sterilized || false,
            chipId: pet.chipId || '',
            allergies: pet.allergies || '',
            medications: pet.medications || '',
            medicalConditions: pet.medicalConditions || '',
            insurance: pet.insurance || '',
            vetName: pet.vetName || '',
            vetPhone: pet.vetPhone || '',
            image: pet.image || null,
        });
        setSelectedPet(pet);
        setIsEditing(true);
        setIsFormVisible(true);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true, aspect: [1, 1], quality: 0.6,
        });
        if (!result.canceled) setFormParams(p => ({ ...p, image: result.assets[0].uri }));
    };

    // ─────────────────────────────────────────────────
    // REMINDER CRUD
    // ─────────────────────────────────────────────────
    const openReminderForm = (reminder = null) => {
        if (reminder) {
            setEditingReminder(reminder);
            setReminderForm({
                title: reminder.title, description: reminder.description,
                eventTime: reminder.eventTime ? new Date(reminder.eventTime) : new Date(),
                notificationAdvance: reminder.notificationAdvance ?? 15,
            });
        } else {
            setEditingReminder(null);
            setReminderForm({ title: '', description: '', eventTime: new Date(), notificationAdvance: 15 });
        }
        setIsReminderModalVisible(true);
    };

    const saveReminder = async () => {
        if (!reminderForm.title.trim()) return Alert.alert('Error', 'Escribe un título');
        const triggerTime = new Date(reminderForm.eventTime);
        triggerTime.setMinutes(triggerTime.getMinutes() - reminderForm.notificationAdvance);
        const data = {
            title: reminderForm.title,
            description: reminderForm.description,
            notificationAdvance: reminderForm.notificationAdvance,
            eventTime: reminderForm.eventTime.toISOString(),
        };
        const currentReminders = selectedPet.reminders || [];
        const newReminders = editingReminder
            ? currentReminders.map(r => r.id === editingReminder.id ? { ...r, ...data } : r)
            : [...currentReminders, { id: Date.now().toString(), ...data }];
        try {
            await supabase.from('pets').update({ reminders: newReminders }).eq('id', selectedPet.id);
            setIsReminderModalVisible(false);
            if (triggerTime.getTime() > Date.now()) {
                scheduleReminder(reminderForm.title, reminderForm.description, triggerTime);
            } else {
                Alert.alert('Guardado', 'Recordatorio guardado (sin alarma, fecha en el pasado).');
            }
        } catch { Alert.alert('Error', 'No se pudo guardar el recordatorio'); }
    };

    const deleteReminder = async (id) => {
        const filtered = (selectedPet.reminders || []).filter(r => r.id !== id);
        try {
            await supabase.from('pets').update({ reminders: filtered }).eq('id', selectedPet.id);
            setIsReminderModalVisible(false);
        } catch { Alert.alert('Error', 'No se pudo eliminar'); }
    };

    // ═══════════════════════════════════════════════════
    // RENDER: LIST VIEW
    // ═══════════════════════════════════════════════════
    const renderListView = () => (
        <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={styles.scrollList}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.listHeaderRow}>
                <Text style={[styles.screenTitle, { color: theme.text }]}>Mis Mascotas</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => { resetForm(); setIsFormVisible(true); }}
                >
                    <Plus size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {pets.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={{ fontSize: 64, textAlign: 'center' }}>🐾</Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin Mascotas</Text>
                    <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                        Añade tu primera mascota para gestionar su perfil, paseos y salud.
                    </Text>
                    <TouchableOpacity
                        style={[styles.addBtn, { width: '100%', borderRadius: 16, height: 52, marginTop: 20 }]}
                        onPress={() => { resetForm(); setIsFormVisible(true); }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>+ Añadir Mascota</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                pets.map(pet => (
                    <TouchableOpacity
                        key={pet.id}
                        style={[styles.petCard, { backgroundColor: theme.cardBackground }]}
                        onPress={() => navigateTo('detail', pet)}
                        activeOpacity={0.82}
                    >
                        <View style={styles.petCardTop}>
                            {/* Avatar */}
                            <View style={[styles.petAvatarWrap, { backgroundColor: theme.primaryBg }]}>
                                {pet.image
                                    ? <Image source={{ uri: pet.image }} style={styles.petAvatarImg} />
                                    : <Text style={{ fontSize: 34 }}>{getSpeciesEmoji(pet.species)}</Text>
                                }
                            </View>

                            {/* Info */}
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={[styles.petCardName, { color: theme.text }]}>{pet.name}</Text>
                                <Text style={[styles.petCardSub, { color: theme.textSecondary }]}>
                                    {getSpeciesEmoji(pet.species)} {getSpeciesLabel(pet.species)}
                                    {pet.breed ? ` · ${pet.breed}` : ''}
                                </Text>
                                {pet.activity?.km > 0 && (
                                    <View style={styles.petBadge}>
                                        <Text style={styles.petBadgeText}>
                                            🏃 {parseFloat(pet.activity.km).toFixed(1)} km
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <ChevronRight size={20} color={theme.textSecondary} />
                        </View>

                        {/* Actions */}
                        <View style={[styles.petCardBottom, { borderTopColor: theme.border }]}>
                            <TouchableOpacity
                                style={[styles.editChip, { backgroundColor: theme.primaryBg }]}
                                onPress={() => openEditModal(pet)}
                            >
                                <PenSquare size={14} color={COLORS.primary} />
                                <Text style={styles.editChipText}>Editar</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))
            )}
            <View style={{ height: 120 }} />
        </Animated.ScrollView>
    );

    // ═══════════════════════════════════════════════════
    // RENDER: PROFILE TAB
    // ═══════════════════════════════════════════════════
    const renderProfileTab = () => {
        const age = getAge(selectedPet?.birthdate);
        return (
            <View>
                {/* General Info */}
                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.infoCardTitle, { color: theme.text }]}>Información General</Text>
                    <View style={styles.infoGrid}>
                        <InfoItem label="Especie" value={`${getSpeciesEmoji(selectedPet?.species)} ${getSpeciesLabel(selectedPet?.species)}`} />
                        <InfoItem label="Raza" value={selectedPet?.breed || '—'} />
                        <InfoItem label="Sexo" value={selectedPet?.gender === 'female' ? '♀ Hembra' : '♂ Macho'} />
                        <InfoItem label="Peso" value={selectedPet?.weight ? `${selectedPet.weight} kg` : '—'} />
                        {age && <InfoItem label="Edad" value={age} />}
                        {selectedPet?.birthdate && (
                            <InfoItem label="Nacimiento" value={new Date(selectedPet.birthdate).toLocaleDateString('es-ES')} />
                        )}
                        {selectedPet?.color && <InfoItem label="Color" value={selectedPet.color} />}
                        <InfoItem label="Esterilizado" value={selectedPet?.sterilized ? '✅ Sí' : '❌ No'} />
                    </View>
                </View>

                {/* Medical Data */}
                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.infoCardTitle, { color: theme.text }]}>🏥 Datos Médicos</Text>
                    <InfoItemFull
                        label="Nº Microchip"
                        value={selectedPet?.chipId || 'Sin microchip registrado'}
                        mono
                    />
                    {selectedPet?.allergies && (
                        <InfoItemFull label="⚠️ Alergias" value={selectedPet.allergies} danger />
                    )}
                    {selectedPet?.medications && (
                        <InfoItemFull label="💊 Medicamentos" value={selectedPet.medications} />
                    )}
                    {selectedPet?.medicalConditions && (
                        <InfoItemFull label="📋 Condiciones" value={selectedPet.medicalConditions} />
                    )}
                    {selectedPet?.insurance && (
                        <InfoItemFull label="🛡️ Seguro / Póliza" value={selectedPet.insurance} />
                    )}
                </View>

                {/* Vet Contact */}
                {(selectedPet?.vetName || selectedPet?.vetPhone) && (
                    <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.infoCardTitle, { color: theme.text }]}>🩺 Veterinario</Text>
                        {selectedPet?.vetName && (
                            <View style={styles.vetRow}>
                                <User size={17} color={COLORS.secondary} />
                                <Text style={styles.vetText}>{selectedPet.vetName}</Text>
                            </View>
                        )}
                        {selectedPet?.vetPhone && (
                            <View style={styles.vetRow}>
                                <Phone size={17} color={COLORS.success} />
                                <Text style={styles.vetText}>{selectedPet.vetPhone}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* QR Paw-Port */}
                <TouchableOpacity
                    style={styles.passportBanner}
                    onPress={() => setIsPassportVisible(true)}
                    activeOpacity={0.88}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.passportIconBox}>
                            <QrCode size={24} color={COLORS.primary} />
                        </View>
                        <View style={{ marginLeft: 14 }}>
                            <Text style={styles.passportTitle}>Paw-Port QR Biométrico</Text>
                            <Text style={styles.passportSub}>ID de emergencia digital</Text>
                        </View>
                    </View>
                    <View style={styles.passportChevron}>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                    </View>
                </TouchableOpacity>

                {/* Edit Button */}
                <TouchableOpacity
                    style={styles.fullEditBtn}
                    onPress={() => openEditModal(selectedPet)}
                    activeOpacity={0.85}
                >
                    <PenSquare size={20} color="#FFF" />
                    <Text style={styles.fullEditBtnText}>Editar Perfil Completo</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // ═══════════════════════════════════════════════════
    // RENDER: WALKS TAB (Strava-style)
    // ═══════════════════════════════════════════════════
    const renderWalksTab = () => {
        const isDog = selectedPet?.species === 'dog';

        return (
            <View>
                {/* Walk Start/Stop Banner */}
                {isDog && (
                    isWalking ? (
                        <View style={[styles.walkBanner, { backgroundColor: COLORS.danger }]}>
                            <View>
                                <Text style={styles.walkBannerTitle}>🏃 Paseo en Curso</Text>
                                <Text style={styles.walkBannerRunning}>
                                    {walkDistance.toFixed(2)} km  ·  {formatDuration(walkTimer)}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.walkStopBtn} onPress={stopWalk}>
                                <Text style={{ color: COLORS.danger, fontWeight: '800', fontSize: 14 }}>
                                    ■  Terminar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.walkBanner} onPress={startWalk} activeOpacity={0.85}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.playCircle}>
                                    <Ionicons name="play" size={18} color={COLORS.primary} />
                                </View>
                                <View style={{ marginLeft: 14 }}>
                                    <Text style={styles.walkBannerTitle}>Iniciar Nuevo Paseo</Text>
                                    <Text style={styles.walkBannerSub}>GPS activo · Ruta y biometría</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                    )
                )}

                {/* Global Stats */}
                {walks.length > 0 && (
                    <View style={[styles.globalStatsRow, { backgroundColor: theme.cardBackground }]}>
                        <GlobalStat value={totalStats.km} label="km totales" />
                        <View style={styles.statDivider} />
                        <GlobalStat value={totalStats.kcal} label="kcal" />
                        <View style={styles.statDivider} />
                        <GlobalStat value={totalStats.count} label="paseos" />
                        <View style={styles.statDivider} />
                        <GlobalStat value={`${totalStats.avgPace}`} label="km/h avg" />
                    </View>
                )}

                {/* Walks List */}
                {walks.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, marginTop: 0 }]}>
                        <Text style={{ fontSize: 52, textAlign: 'center' }}>🗺️</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin Paseos</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                            Los paseos con GPS aparecerán aquí con mapa, distancia y calorías.
                        </Text>
                    </View>
                ) : (
                    walks.map((walk) => {
                        const hasRoute = walk.route && walk.route.length > 1;
                        const region = hasRoute ? getRouteRegion(walk.route) : null;
                        const mins = Math.round((walk.durationSeconds || 0) / 60);
                        const walkDate = walk.endTime ? new Date(walk.endTime) : null;

                        return (
                            <View key={walk.id} style={[styles.walkCard, { backgroundColor: theme.cardBackground }]}>
                                {/* Map Thumbnail */}
                                {hasRoute && region && (
                                    <View style={styles.walkMapBox}>
                                        <MapView
                                            style={StyleSheet.absoluteFillObject}
                                            provider={PROVIDER_GOOGLE}
                                            initialRegion={region}
                                            zoomEnabled={false}
                                            scrollEnabled={false}
                                            pitchEnabled={false}
                                            rotateEnabled={false}
                                        >
                                            <Polyline
                                                coordinates={walk.route}
                                                strokeColor={COLORS.primary}
                                                strokeWidth={4}
                                            />
                                            <Marker coordinate={walk.route[0]} pinColor="green" />
                                            <Marker coordinate={walk.route[walk.route.length - 1]} pinColor="red" />
                                        </MapView>
                                        {/* Distance overlay on map */}
                                        <View style={styles.mapDistBadge}>
                                            <Text style={styles.mapDistText}>{walk.totalKm} km</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Walk Stats */}
                                <View style={styles.walkInfo}>
                                    {walkDate && (
                                        <Text style={styles.walkDate}>
                                            {walkDate.toLocaleDateString('es-ES', {
                                                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                        </Text>
                                    )}
                                    <View style={styles.walkStatsRow}>
                                        <WalkStat icon={<Map size={15} color={COLORS.primary} />} value={`${walk.totalKm} km`} />
                                        <WalkStat icon={<Clock size={15} color={COLORS.secondary} />} value={`${mins} min`} />
                                        <WalkStat icon={<Flame size={15} color={COLORS.danger} />} value={`${walk.calories || 0} kcal`} />
                                        {walk.durationSeconds > 0 && walk.totalKm > 0 && (
                                            <WalkStat
                                                icon={<Ionicons name="speedometer-outline" size={15} color={COLORS.success} />}
                                                value={`${(walk.totalKm / (walk.durationSeconds / 3600)).toFixed(1)} km/h`}
                                            />
                                        )}
                                    </View>

                                    {/* Share Button */}
                                    <TouchableOpacity
                                        style={styles.shareBtn}
                                        onPress={() => shareWalk(walk)}
                                        activeOpacity={0.8}
                                    >
                                        <Share2 size={15} color={COLORS.secondary} />
                                        <Text style={styles.shareBtnText}>Compartir en Redes Sociales</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {!isDog && (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, marginTop: 0 }]}>
                        <Text style={{ fontSize: 48, textAlign: 'center' }}>🐾</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>Solo para perros</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                            El seguimiento GPS de paseos está disponible para perros.
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // ═══════════════════════════════════════════════════
    // RENDER: HEALTH TAB
    // ═══════════════════════════════════════════════════
    const renderHealthTab = () => (
        <View>
            <View style={[styles.listHeaderRow, { paddingHorizontal: 2 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>📅 Recordatorios</Text>
                <TouchableOpacity
                    style={[styles.addBtn, { width: 34, height: 34, borderRadius: 17 }]}
                    onPress={() => openReminderForm()}
                >
                    <Plus size={16} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={[styles.agendaCard, { backgroundColor: theme.cardBackground }]}>
                {(!selectedPet?.reminders || selectedPet.reminders.length === 0) ? (
                    <View style={{ padding: 30, alignItems: 'center' }}>
                        <Text style={{ fontSize: 44 }}>🔔</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>Sin recordatorios activos.</Text>
                        <TouchableOpacity onPress={() => openReminderForm()} style={{ marginTop: 10 }}>
                            <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Añadir recordatorio</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    selectedPet.reminders.map((rem, i) => (
                        <TouchableOpacity
                            key={rem.id}
                            style={[styles.agendaItem, i === selectedPet.reminders.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => openReminderForm(rem)}
                        >
                            <View style={styles.agendaIconBox}>
                                <Bell size={17} color={COLORS.secondary} />
                            </View>
                            <View style={styles.agendaTextWrap}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.agendaTitle}>{rem.title}</Text>
                                    <Text style={styles.agendaDate}>
                                        {rem.eventTime
                                            ? new Date(rem.eventTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                            : ''}
                                    </Text>
                                </View>
                                <Text style={styles.agendaDesc}>{rem.description || 'Sin descripción'}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>
        </View>
    );

    // ═══════════════════════════════════════════════════
    // RENDER: DETAIL VIEW
    // ═══════════════════════════════════════════════════
    const renderDetailView = () => {
        if (!selectedPet) return null;
        const age = getAge(selectedPet?.birthdate);

        return (
            <Animated.ScrollView
                style={{ opacity: fadeAnim }}
                contentContainerStyle={styles.scrollDetail}
                showsVerticalScrollIndicator={false}
            >
                {/* ── HERO ───────────────────────────────── */}
                <View style={[styles.heroSection, { backgroundColor: theme.cardBackground }]}>
                    {/* Back */}
                    <TouchableOpacity style={[styles.heroBackBtn, { backgroundColor: theme.background }]} onPress={() => navigateTo('list')}>
                        <Ionicons name="chevron-back" size={21} color={theme.text} />
                    </TouchableOpacity>

                    {/* Edit shortcut */}
                    <TouchableOpacity style={[styles.heroEditBtn, { backgroundColor: theme.background }]} onPress={() => openEditModal(selectedPet)}>
                        <PenSquare size={17} color={theme.text} />
                    </TouchableOpacity>

                    {/* Photo */}
                    <View style={styles.heroAvatarRing}>
                        <View style={styles.heroAvatarInner}>
                            {selectedPet.image
                                ? <Image source={{ uri: selectedPet.image }} style={styles.heroAvatarImg} />
                                : <Text style={{ fontSize: 60 }}>{getSpeciesEmoji(selectedPet.species)}</Text>
                            }
                        </View>
                    </View>

                    {/* Name */}
                    <Text style={[styles.heroName, { color: theme.text }]}>{selectedPet.name}</Text>

                    {/* Badges */}
                    <View style={styles.heroBadgesRow}>
                        <Badge label={`${getSpeciesEmoji(selectedPet.species)} ${getSpeciesLabel(selectedPet.species)}`} color="amber" />
                        {selectedPet.breed && <Badge label={selectedPet.breed} color="blue" />}
                        {age && <Badge label={age} color="green" />}
                        {selectedPet.gender && (
                            <Badge label={selectedPet.gender === 'female' ? '♀ Hembra' : '♂ Macho'} color="purple" />
                        )}
                    </View>

                    {/* Stats Row */}
                    <View style={[styles.heroStatsRow, { backgroundColor: theme.background }]}>
                        <HeroStat value={parseFloat(totalStats.km) > 0 ? totalStats.km : '—'} label="km" />
                        <View style={styles.heroStatDiv} />
                        <HeroStat value={totalStats.kcal > 0 ? totalStats.kcal : '—'} label="kcal" />
                        <View style={styles.heroStatDiv} />
                        <HeroStat value={totalStats.count > 0 ? totalStats.count : '—'} label="paseos" />
                        <View style={styles.heroStatDiv} />
                        <HeroStat value={selectedPet.weight ? `${selectedPet.weight}` : '—'} label="kg" />
                    </View>
                </View>

                {/* ── TAB BAR ────────────────────────────── */}
                <View style={[styles.tabBar, { backgroundColor: theme.cardBackground }]}>
                    {[
                        { key: 'profile', label: '🐾 Perfil' },
                        { key: 'walks', label: '🗺️ Paseos' },
                        { key: 'health', label: '🏥 Salud' },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── TAB CONTENT ────────────────────────── */}
                <View style={styles.tabContent}>
                    {activeTab === 'profile' && renderProfileTab()}
                    {activeTab === 'walks' && renderWalksTab()}
                    {activeTab === 'health' && renderHealthTab()}
                </View>

                <View style={{ height: 120 }} />
            </Animated.ScrollView>
        );
    };

    // ═══════════════════════════════════════════════════
    // LOADING
    // ═══════════════════════════════════════════════════
    if (isLoadingSync) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ color: theme.textSecondary, marginTop: 12, fontWeight: '600' }}>
                    Cargando mascotas...
                </Text>
            </View>
        );
    }

    // ═══════════════════════════════════════════════════
    // MAIN RETURN
    // ═══════════════════════════════════════════════════
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {viewMode === 'list' ? renderListView() : renderDetailView()}

            {/* ── MODAL: CREAR / EDITAR MASCOTA ──────── */}
            <Modal visible={isFormVisible} animationType="slide" presentationStyle="formSheet">
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: theme.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[styles.formHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <Text style={[styles.formTitle, { color: theme.text }]}>
                            {isEditing ? 'Editar Mascota' : 'Nueva Mascota'}
                        </Text>
                        <TouchableOpacity onPress={() => { setIsFormVisible(false); resetForm(); }}>
                            <X size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={[styles.formBody, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>

                        {/* Foto */}
                        <TouchableOpacity style={[styles.photoPicker, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} onPress={pickImage}>
                            {formParams.image ? (
                                <Image source={{ uri: formParams.image }} style={styles.photoPickerImg} />
                            ) : (
                                <View style={{ alignItems: 'center', gap: 6 }}>
                                    <Text style={{ fontSize: 42 }}>📷</Text>
                                    <Text style={{ color: COLORS.secondary, fontWeight: '700', fontSize: 13 }}>
                                        Toca para añadir foto
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* ── BÁSICO ── */}
                        <FormSection label="Datos Básicos" />

                        <FormLabel text="Nombre *" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.name}
                            onChangeText={t => setFormParams(p => ({ ...p, name: t }))}
                            placeholder="Ej. Max"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Especie" />
                        <View style={styles.speciesGrid}>
                            {SPECIES_OPTIONS.map(sp => (
                                <TouchableOpacity
                                    key={sp.value}
                                    style={[styles.speciesChip, formParams.species === sp.value && styles.speciesChipActive]}
                                    onPress={() => setFormParams(p => ({ ...p, species: sp.value }))}
                                >
                                    <Text style={{ fontSize: 24 }}>{sp.emoji}</Text>
                                    <Text style={[
                                        styles.speciesChipLabel,
                                        formParams.species === sp.value && { color: COLORS.primary },
                                    ]}>
                                        {sp.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel text="Raza" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.breed}
                            onChangeText={t => setFormParams(p => ({ ...p, breed: t }))}
                            placeholder="Ej. Golden Retriever"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Sexo" />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.genderBtn, formParams.gender === 'male' && styles.genderBtnMaleActive]}
                                onPress={() => setFormParams(p => ({ ...p, gender: 'male' }))}
                            >
                                <Text style={[styles.genderBtnText, formParams.gender === 'male' && { color: COLORS.primary }]}>
                                    ♂ Macho
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.genderBtn, formParams.gender === 'female' && styles.genderBtnFemaleActive]}
                                onPress={() => setFormParams(p => ({ ...p, gender: 'female' }))}
                            >
                                <Text style={[styles.genderBtnText, formParams.gender === 'female' && { color: '#EC4899' }]}>
                                    ♀ Hembra
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <FormLabel text="Peso (kg)" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            keyboardType="numeric"
                            value={formParams.weight}
                            onChangeText={t => setFormParams(p => ({ ...p, weight: t }))}
                            placeholder="Ej. 12.5"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Fecha de Nacimiento (YYYY-MM-DD)" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.birthdate}
                            onChangeText={t => setFormParams(p => ({ ...p, birthdate: t }))}
                            placeholder="Ej. 2022-05-14"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Color del pelaje" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.color}
                            onChangeText={t => setFormParams(p => ({ ...p, color: t }))}
                            placeholder="Ej. Dorado con blanco"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <View style={styles.switchRow}>
                            <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>
                                Esterilizado/a
                            </Text>
                            <TouchableOpacity
                                style={[styles.toggleBtn, formParams.sterilized && styles.toggleBtnOn]}
                                onPress={() => setFormParams(p => ({ ...p, sterilized: !p.sterilized }))}
                            >
                                <Text style={[styles.toggleBtnText, formParams.sterilized && { color: COLORS.success }]}>
                                    {formParams.sterilized ? '✅ Sí' : '❌ No'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── MÉDICO ── */}
                        <FormSection label="Datos Médicos" />

                        <FormLabel text="Nº Microchip" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.chipId}
                            onChangeText={t => setFormParams(p => ({ ...p, chipId: t }))}
                            placeholder="Ej. 941000024583921"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="⚠️ Alergias" />
                        <TextInput
                            style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            multiline
                            value={formParams.allergies}
                            onChangeText={t => setFormParams(p => ({ ...p, allergies: t }))}
                            placeholder="Ej. Polen, pollo, penicilina..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="💊 Medicamentos actuales" />
                        <TextInput
                            style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            multiline
                            value={formParams.medications}
                            onChangeText={t => setFormParams(p => ({ ...p, medications: t }))}
                            placeholder="Ej. Apoquel 16mg/día"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="📋 Condiciones médicas" />
                        <TextInput
                            style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            multiline
                            value={formParams.medicalConditions}
                            onChangeText={t => setFormParams(p => ({ ...p, medicalConditions: t }))}
                            placeholder="Ej. Displasia de cadera, diabetes..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="🛡️ Nº Seguro / Póliza" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.insurance}
                            onChangeText={t => setFormParams(p => ({ ...p, insurance: t }))}
                            placeholder="Ej. AXA-2024-001234"
                            placeholderTextColor={theme.textSecondary}
                        />

                        {/* ── VETERINARIO ── */}
                        <FormSection label="Veterinario" />

                        <FormLabel text="Nombre del veterinario" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={formParams.vetName}
                            onChangeText={t => setFormParams(p => ({ ...p, vetName: t }))}
                            placeholder="Ej. Dr. García"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Teléfono de contacto" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            keyboardType="phone-pad"
                            value={formParams.vetPhone}
                            onChangeText={t => setFormParams(p => ({ ...p, vetPhone: t }))}
                            placeholder="Ej. +34 912 345 678"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={handleSavePet}>
                            <Text style={styles.submitText}>
                                {isEditing ? 'Guardar Cambios' : 'Registrar Mascota'}
                            </Text>
                        </TouchableOpacity>
                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── MODAL: PAW-PORT QR ─────────────────── */}
            <Modal visible={isPassportVisible} animationType="fade" transparent>
                <View style={styles.qrOverlay}>
                    <View style={styles.qrCard}>
                        <TouchableOpacity style={styles.qrClose} onPress={() => setIsPassportVisible(false)}>
                            <X size={20} color={COLORS.textLight} />
                        </TouchableOpacity>

                        <Text style={styles.qrBrand}>PAW-PORT BIOMÉTRICO</Text>
                        <Text style={styles.qrPetName}>{selectedPet?.name}</Text>

                        <View style={styles.qrBox}>
                            <QRCode value={qrPayload} size={200} color={COLORS.text} backgroundColor={COLORS.surface} />
                        </View>

                        {selectedPet?.chipId && (
                            <Text style={styles.qrChipLabel}>
                                CHIP: {selectedPet.chipId.toUpperCase()}
                            </Text>
                        )}

                        <View style={styles.qrInfoGrid}>
                            {selectedPet?.allergies && (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>⚠️ Alergias</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.allergies}</Text>
                                </View>
                            )}
                            {selectedPet?.vetPhone && (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>🩺 Vet</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.vetPhone}</Text>
                                </View>
                            )}
                            {selectedPet?.medications && (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>💊 Medicación</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.medications}</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.qrFooter}>PROTEGIDO POR PAWMATE · Escanea para emergencias</Text>
                    </View>
                </View>
            </Modal>

            {/* ── MODAL: RECORDATORIO ─────────────────── */}
            <Modal visible={isReminderModalVisible} animationType="slide" presentationStyle="pageSheet">
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: theme.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[styles.formHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <Text style={[styles.formTitle, { color: theme.text }]}>
                            {editingReminder ? 'Editar Aviso' : 'Nuevo Aviso'}
                        </Text>
                        <TouchableOpacity onPress={() => setIsReminderModalVisible(false)}>
                            <X size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={[styles.formBody, { backgroundColor: theme.background }]}>
                        <FormLabel text="Título" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={reminderForm.title}
                            onChangeText={t => setReminderForm(r => ({ ...r, title: t }))}
                            placeholder="Ej. Vacuna Rabia"
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Descripción" />
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            multiline
                            value={reminderForm.description}
                            onChangeText={t => setReminderForm(r => ({ ...r, description: t }))}
                            placeholder="Notas adicionales..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Fecha y hora del evento" />
                        {Platform.OS === 'ios' ? (
                            <DateTimePicker
                                value={reminderForm.eventTime}
                                mode="datetime"
                                display="spinner"
                                textColor={COLORS.text}
                                themeVariant="light"
                                onChange={(_, date) => { if (date) setReminderForm(r => ({ ...r, eventTime: date })); }}
                                style={{ height: 120, marginLeft: -10 }}
                            />
                        ) : (
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                <Text style={{ color: theme.text, fontWeight: '600' }}>
                                        {reminderForm.eventTime.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                                    onPress={() => setShowTimePicker(true)}
                                >
                                <Text style={{ color: theme.text, fontWeight: '600' }}>
                                        {reminderForm.eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {showDatePicker && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={reminderForm.eventTime}
                                mode="date"
                                display="default"
                                onChange={(_, date) => {
                                    setShowDatePicker(false);
                                    if (date) setReminderForm(r => ({ ...r, eventTime: date }));
                                }}
                            />
                        )}
                        {showTimePicker && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={reminderForm.eventTime}
                                mode="time"
                                display="default"
                                onChange={(_, date) => {
                                    setShowTimePicker(false);
                                    if (date) setReminderForm(r => ({ ...r, eventTime: date }));
                                }}
                            />
                        )}

                        <FormLabel text="Avisarme con antelación" />
                        <View style={{ borderWidth: 1.5, borderColor: '#e2ede8', borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.surface }}>
                            <Picker
                                selectedValue={reminderForm.notificationAdvance}
                                onValueChange={v => setReminderForm(r => ({ ...r, notificationAdvance: v }))}
                                style={{ color: COLORS.text }}
                                itemStyle={{ color: COLORS.text, fontSize: 16 }}
                            >
                                <Picker.Item label="A la hora exacta" value={0} />
                                <Picker.Item label="5 minutos antes" value={5} />
                                <Picker.Item label="15 minutos antes" value={15} />
                                <Picker.Item label="30 minutos antes" value={30} />
                                <Picker.Item label="1 hora antes" value={60} />
                                <Picker.Item label="1 día antes" value={1440} />
                            </Picker>
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={saveReminder}>
                            <Text style={styles.submitText}>
                                {editingReminder ? 'Guardar Cambios' : 'Agendar Aviso'}
                            </Text>
                        </TouchableOpacity>

                        {editingReminder && (
                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: '#ffebee', marginTop: 12 }]}
                                onPress={() => deleteReminder(editingReminder.id)}
                            >
                                <Text style={[styles.submitText, { color: COLORS.danger }]}>
                                    Eliminar Recordatorio
                                </Text>
                            </TouchableOpacity>
                        )}
                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────
// MINI COMPONENTS
// ─────────────────────────────────────────────────
const InfoItem = ({ label, value }) => (
    <View style={styles.infoItem}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

const InfoItemFull = ({ label, value, mono, danger }) => (
    <View style={styles.infoItemFull}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[
            styles.infoValue,
            mono && { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
            danger && { color: COLORS.danger },
        ]}>
            {value}
        </Text>
    </View>
);

const Badge = ({ label, color }) => {
    const bg = { amber: '#e8f5ee', blue: '#EFF6FF', green: '#e8f5ee', purple: '#F5F3FF' };
    const fg = { amber: COLORS.primary, blue: COLORS.secondary, green: COLORS.success, purple: COLORS.purple };
    return (
        <View style={[styles.heroBadge, { backgroundColor: bg[color] || bg.amber }]}>
            <Text style={[styles.heroBadgeText, { color: fg[color] || fg.amber }]}>{label}</Text>
        </View>
    );
};

const HeroStat = ({ value, label }) => (
    <View style={styles.heroStat}>
        <Text style={styles.heroStatVal}>{value}</Text>
        <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
);

const GlobalStat = ({ value, label }) => (
    <View style={styles.globalStatItem}>
        <Text style={styles.globalStatVal}>{value}</Text>
        <Text style={styles.globalStatLabel}>{label}</Text>
    </View>
);

const WalkStat = ({ icon, value }) => (
    <View style={styles.walkStat}>
        {icon}
        <Text style={styles.walkStatText}>{value}</Text>
    </View>
);

const FormSection = ({ label }) => (
    <Text style={styles.formSection}>{label}</Text>
);

const FormLabel = ({ text }) => (
    <Text style={styles.inputLabel}>{text}</Text>
);

// ���────────────────────────────────────────────────
// STYLESHEET
// ─────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    // ── List View ──────────────────────────────────
    scrollList: { padding: 20, paddingTop: Platform.OS === 'ios' ? 70 : 40 },
    listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    screenTitle: { fontSize: 34, fontWeight: '900', color: COLORS.text, letterSpacing: -0.8 },
    addBtn: {
        width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    },

    petCard: {
        backgroundColor: COLORS.surface, borderRadius: 24, padding: 18, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    },
    petCardTop: { flexDirection: 'row', alignItems: 'center' },
    petAvatarWrap: {
        width: 66, height: 66, borderRadius: 33,
        backgroundColor: '#e8f5ee', justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden', borderWidth: 2.5, borderColor: `${COLORS.primary}55`,
    },
    petAvatarImg: { width: 66, height: 66, borderRadius: 33, resizeMode: 'cover' },
    petCardName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
    petCardSub: { fontSize: 13, color: COLORS.textLight, fontWeight: '500', marginTop: 2 },
    petBadge: {
        backgroundColor: '#e8f5ee', paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 20, marginTop: 6, alignSelf: 'flex-start',
    },
    petBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
    petCardBottom: {
        borderTopWidth: 1, borderTopColor: '#e2ede8',
        marginTop: 14, paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end',
    },
    editChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#e8f5ee', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
    },
    editChipText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

    emptyCard: {
        backgroundColor: COLORS.surface, borderRadius: 24, padding: 40,
        alignItems: 'center', marginTop: 20,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 12 },
    emptyDesc: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // ── Detail View ────────────────────────────────
    scrollDetail: { paddingBottom: 30 },

    // HERO
    heroSection: {
        backgroundColor: COLORS.surface,
        paddingTop: Platform.OS === 'ios' ? 64 : 40,
        paddingBottom: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
        marginBottom: 12,
    },
    heroBackBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 64 : 40,
        left: 18,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.background,
        justifyContent: 'center', alignItems: 'center', zIndex: 10,
    },
    heroEditBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 64 : 40,
        right: 18,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.background,
        justifyContent: 'center', alignItems: 'center', zIndex: 10,
    },
    heroAvatarRing: {
        width: 138, height: 138, borderRadius: 69,
        borderWidth: 3.5, borderColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 18, marginBottom: 16,
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
    },
    heroAvatarInner: {
        width: 128, height: 128, borderRadius: 64,
        backgroundColor: '#e8f5ee', justifyContent: 'center',
        alignItems: 'center', overflow: 'hidden',
    },
    heroAvatarImg: { width: 128, height: 128, borderRadius: 64, resizeMode: 'cover' },
    heroName: { fontSize: 32, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
    heroBadgesRow: {
        flexDirection: 'row', flexWrap: 'wrap',
        justifyContent: 'center', gap: 7, marginTop: 10,
    },
    heroBadge: { paddingHorizontal: 13, paddingVertical: 5, borderRadius: 20 },
    heroBadgeText: { fontSize: 13, fontWeight: '700' },
    heroStatsRow: {
        flexDirection: 'row', backgroundColor: COLORS.background,
        borderRadius: 20, paddingVertical: 18, paddingHorizontal: 8,
        marginTop: 20, width: '100%',
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatVal: { fontSize: 19, fontWeight: '900', color: COLORS.text },
    heroStatLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', marginTop: 2 },
    heroStatDiv: { width: 1, backgroundColor: '#e2ede8' },

    // TAB BAR
    tabBar: {
        flexDirection: 'row', backgroundColor: COLORS.surface,
        marginHorizontal: 18, borderRadius: 20, padding: 5,
        marginBottom: 14,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 16 },
    tabBtnActive: { backgroundColor: COLORS.primary },
    tabLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
    tabLabelActive: { color: '#FFF' },
    tabContent: { paddingHorizontal: 18 },

    // INFO CARDS (PROFILE TAB)
    infoCard: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        padding: 20, marginBottom: 14,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    infoCardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    infoItem: { width: '50%', marginBottom: 14 },
    infoItemFull: { width: '100%', marginBottom: 12 },
    infoLabel: {
        fontSize: 10, fontWeight: '700', color: COLORS.textLight,
        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3,
    },
    infoValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    vetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    vetText: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginLeft: 10 },

    // PASSPORT BANNER
    passportBanner: {
        flexDirection: 'row', backgroundColor: COLORS.surface,
        borderRadius: 20, padding: 18, alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 14,
        borderWidth: 2, borderColor: `${COLORS.primary}30`,
        shadowColor: COLORS.primary, shadowOpacity: 0.1,
        shadowRadius: 8, elevation: 3,
    },
    passportIconBox: {
        width: 46, height: 46, borderRadius: 15,
        backgroundColor: '#e8f5ee', justifyContent: 'center', alignItems: 'center',
    },
    passportTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
    passportSub: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
    passportChevron: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#e8f5ee', justifyContent: 'center', alignItems: 'center',
    },
    fullEditBtn: {
        backgroundColor: COLORS.text, borderRadius: 18,
        paddingVertical: 16, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, marginBottom: 4,
    },
    fullEditBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    // WALKS TAB
    walkBanner: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        padding: 18, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 14,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    walkBannerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.surface },
    walkBannerRunning: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
    walkBannerSub: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginTop: 2 },
    walkStopBtn: {
        backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    },
    playCircle: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#e8f5ee', justifyContent: 'center', alignItems: 'center',
    },

    globalStatsRow: {
        flexDirection: 'row', backgroundColor: COLORS.surface,
        borderRadius: 20, paddingVertical: 18, marginBottom: 18,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    globalStatItem: { flex: 1, alignItems: 'center' },
    globalStatVal: { fontSize: 18, fontWeight: '900', color: COLORS.text },
    globalStatLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', marginTop: 2 },
    statDivider: { width: 1, backgroundColor: '#e2ede8' },

    walkCard: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        marginBottom: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
    },
    walkMapBox: { width: '100%', height: 165, backgroundColor: '#e2ede8', position: 'relative' },
    mapDistBadge: {
        position: 'absolute', bottom: 10, right: 10,
        backgroundColor: 'rgba(15,23,42,0.82)',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    },
    mapDistText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    walkInfo: { padding: 16 },
    walkDate: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginBottom: 10 },
    walkStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    walkStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    walkStatText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    shareBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 11,
    },
    shareBtnText: { color: COLORS.secondary, fontWeight: '700', fontSize: 13 },

    // HEALTH TAB
    sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
    agendaCard: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        overflow: 'hidden', marginBottom: 14,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    agendaItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2ede8',
    },
    agendaIconBox: {
        width: 40, height: 40, borderRadius: 13,
        backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center',
    },
    agendaTextWrap: { flex: 1, marginLeft: 13 },
    agendaTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    agendaDate: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
    agendaDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

    // FORM MODAL
    formHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        padding: 24, paddingTop: Platform.OS === 'ios' ? 58 : 24,
        borderBottomWidth: 1, borderBottomColor: '#e2ede8', backgroundColor: COLORS.surface,
    },
    formTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
    formBody: { padding: 22, backgroundColor: COLORS.background },
    formSection: {
        fontSize: 16, fontWeight: '900', color: COLORS.text,
        marginTop: 28, marginBottom: 2,
        paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: '#e2ede8',
    },
    inputLabel: {
        fontSize: 11, fontWeight: '700', color: COLORS.textLight,
        marginTop: 16, marginBottom: 8,
        textTransform: 'uppercase', letterSpacing: 0.5,
    },
    input: {
        backgroundColor: COLORS.surface, borderWidth: 1.5,
        borderColor: '#e2ede8', borderRadius: 14,
        paddingHorizontal: 15, paddingVertical: 12,
        fontSize: 15, color: COLORS.text,
    },
    photoPicker: {
        backgroundColor: COLORS.surface, height: 130, borderRadius: 20,
        borderWidth: 2, borderColor: '#e2ede8', borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 4,
    },
    photoPickerImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    speciesChip: {
        width: (width - 88) / 3, paddingVertical: 12,
        borderRadius: 14, borderWidth: 2, borderColor: '#e2ede8',
        backgroundColor: COLORS.surface, alignItems: 'center',
    },
    speciesChipActive: { borderColor: COLORS.primary, backgroundColor: '#e8f5ee' },
    speciesChipLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 5 },
    genderBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 14,
        borderWidth: 2, borderColor: '#e2ede8', alignItems: 'center',
        backgroundColor: COLORS.surface,
    },
    genderBtnMaleActive: { borderColor: COLORS.primary, backgroundColor: '#e8f5ee' },
    genderBtnFemaleActive: { borderColor: '#EC4899', backgroundColor: '#FDF2F8' },
    genderBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textLight },
    switchRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 18,
    },
    toggleBtn: {
        paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
        borderWidth: 2, borderColor: '#e2ede8', backgroundColor: COLORS.surface,
    },
    toggleBtnOn: { borderColor: COLORS.success, backgroundColor: '#e8f5ee' },
    toggleBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textLight },
    submitBtn: {
        backgroundColor: COLORS.text, height: 56, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center', marginTop: 28,
    },
    submitText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    // QR MODAL
    qrOverlay: {
        flex: 1, backgroundColor: 'rgba(15,23,42,0.90)',
        justifyContent: 'center', padding: 22,
    },
    qrCard: {
        backgroundColor: COLORS.surface, borderRadius: 30,
        padding: 28, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 25, elevation: 20,
    },
    qrClose: {
        position: 'absolute', top: 18, right: 18,
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#e2ede8', justifyContent: 'center', alignItems: 'center',
        zIndex: 10,
    },
    qrBrand: {
        fontSize: 13, fontWeight: '900', color: COLORS.textLight,
        letterSpacing: 2, textTransform: 'uppercase', marginTop: 8,
    },
    qrPetName: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginTop: 4, marginBottom: 18 },
    qrBox: {
        padding: 16, backgroundColor: COLORS.surface,
        borderWidth: 2, borderColor: '#e2ede8', borderRadius: 20,
    },
    qrChipLabel: {
        marginTop: 16,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: '800', color: COLORS.textLight, fontSize: 12,
    },
    qrInfoGrid: { width: '100%', marginTop: 14 },
    qrInfoRow: {
        backgroundColor: '#f0f7f4', borderRadius: 12,
        padding: 11, marginBottom: 7,
    },
    qrInfoKey: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 2 },
    qrInfoVal: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    qrFooter: {
        fontSize: 10, fontWeight: '700', color: COLORS.textLight,
        textAlign: 'center', marginTop: 14, letterSpacing: 0.5,
    },
});