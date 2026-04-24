import { useState, useMemo, useEffect, useRef, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal,
    Image, Dimensions, Platform, TextInput, KeyboardAvoidingView,
    ActivityIndicator, Animated, Alert, Share
} from 'react-native';
// Icons: using Ionicons consistently across the app
import QRCode from 'react-native-qrcode-svg';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from '../components/Icon';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { SPECIES_OPTIONS as SHARED_SPECIES } from '../constants/appConstants';
import { uploadPetImage } from '../utils/storageHelpers';
import { logActivity, logSystemAction } from '../utils/logger';

const { width } = Dimensions.get('window');

const SPECIES_OPTIONS = SHARED_SPECIES;

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

const getSpeciesLabel = (species, t) => {
    return t ? t(`species.${species}`) : species;
};

const getAge = (birthdate, t) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    if (years === 0) return `${Math.max(0, months)} ${t ? t('pets.months') : 'months'}`;
    return `${years} ${years !== 1 ? (t ? t('pets.years') : 'years') : (t ? t('pets.year') : 'year')}`;
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
    insurance: '', vetName: '', vetPhone: '', image: null, images: [],
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function PawMatePetsCenter() {
    const { user, userData } = useContext(AuthContext);
    const { theme, isDarkMode, isLeftHanded } = require('react').useContext(require('../context/ThemeContext').ThemeContext);
    const { t } = useTranslation();

    // ── Birthdate picker state ──
    const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);

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
        category: 'general',
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // ── Walk Tracking ────────────────────────────────
    const [isWalking, setIsWalking] = useState(false);
    const [walkRoute, setWalkRoute] = useState([]);
    const [walkDistance, setWalkDistance] = useState(0);
    const [walkTimer, setWalkTimer] = useState(0);
    const [walks, setWalks] = useState([]); // ALL walks from Supabase

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
            .channel(`pets_changes_${Date.now()}`)
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
            .channel(`walks_changes_${Date.now()}`)
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
            chip: selectedPet.chipId || t('pets.noChipPdf'),
            weight: selectedPet.weight ? `${selectedPet.weight} kg` : '',
            gender: selectedPet.gender === 'female' ? t('pets.femalePdf') : t('pets.malePdf'),
            color: selectedPet.color || '',
            allergies: selectedPet.allergies || t('pets.noneAllergies'),
            medications: selectedPet.medications || t('common.none'),
            conditions: selectedPet.medicalConditions || t('common.none'),
            vet: selectedPet.vetName || '',
            vetPhone: selectedPet.vetPhone || '',
            owner: user?.email || '',
            app: 'PawMate',
        });
    }, [selectedPet, user?.email]);

    const generatePawPortPDF = async () => {
        if (!selectedPet) return;
        try {
            const age = getAge(selectedPet?.birthdate, t) || t('common.notSpecified');
            const genderStr = selectedPet.gender === 'female' ? t('pets.femalePdf') : t('pets.malePdf');
            const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; background-color: #f0fdf4; color: #1e293b; }
                    .passport-container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 2px solid #22c55e; }
                    .header { background: linear-gradient(135deg, #15803d, #22c55e); color: white; padding: 30px 40px; display: flex; align-items: center; justify-content: space-between; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
                    .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
                    .header-logo { font-size: 40px; }
                    .content { padding: 40px; display: flex; gap: 40px; }
                    .avatar-section { flex: 0 0 200px; text-align: center; }
                    .avatar { width: 180px; height: 180px; border-radius: 90px; object-fit: cover; border: 6px solid #f0fdf4; box-shadow: 0 4px 15px rgba(0,0,0,0.1); background: #e2e8f0; font-size: 80px; line-height: 180px; margin: 0 auto 20px; }
                    .pet-name { font-size: 32px; font-weight: 900; margin: 0 0 5px; color: #166534; }
                    .pet-tag { display: inline-block; background: #dcfce7; color: #166534; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; }
                    .info-section { flex: 1; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .info-box { background: #f8fafc; padding: 15px; border-radius: 12px; border-left: 4px solid #22c55e; }
                    .info-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 5px; }
                    .info-val { font-size: 16px; font-weight: 600; color: #0f172a; margin: 0; }
                    .medical-section { background: #fee2e2; border-radius: 16px; padding: 25px; border: 1px solid #fecaca; }
                    .medical-title { color: #b91c1c; font-size: 18px; font-weight: 800; margin: 0 0 20px; display: flex; align-items: center; gap: 10px; }
                    .medical-item { margin-bottom: 15px; }
                    .medical-item:last-child { margin-bottom: 0; }
                    .medical-label { font-size: 13px; color: #991b1b; font-weight: bold; margin-bottom: 3px; }
                    .medical-val { font-size: 15px; color: #7f1d1d; margin: 0; }
                    .footer { text-align: center; padding: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="passport-container">
                    <div class="header">
                        <div>
                            <h1>${t('pets.pawPortTitle')}</h1>
                            <p>${t('pets.pawPortSubtitle')}</p>
                        </div>
                        <div class="header-logo">🐾</div>
                    </div>
                    <div class="content">
                        <div class="avatar-section">
                            ${selectedPet.image 
                                ? `<img src="${selectedPet.image}" class="avatar" />`
                                : `<div class="avatar">${getSpeciesEmoji(selectedPet.species)}</div>`
                            }
                            <h2 class="pet-name">${selectedPet.name}</h2>
                            <div class="pet-tag">${getSpeciesLabel(selectedPet.species)}</div>
                        </div>
                        <div class="info-section">
                            <h3 style="color: #166534; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0;">${t('pets.animalData')}</h3>
                            <div class="info-grid">
                                <div class="info-box"><div class="info-label">${t('pets.breed')}</div><p class="info-val">${selectedPet.breed || '—'}</p></div>
                                <div class="info-box"><div class="info-label">${t('pets.sexAndAge')}</div><p class="info-val">${genderStr} • ${age}</p></div>
                                <div class="info-box"><div class="info-label">${t('pets.chipNumber')}</div><p class="info-val" style="font-family: monospace; letter-spacing: 1px;">${selectedPet.chipId || t('pets.noChipPdf')}</p></div>
                                <div class="info-box"><div class="info-label">${t('pets.weightColor')}</div><p class="info-val">${selectedPet.weight ? selectedPet.weight + ' kg' : '—'} • ${selectedPet.color || '—'}</p></div>
                                <div class="info-box"><div class="info-label">${t('pets.ownerResponsible')}</div><p class="info-val">${user?.email || '—'}</p></div>
                                <div class="info-box"><div class="info-label">${t('pets.ownerPhone')}</div><p class="info-val">${userData?.phone || '—'}</p></div>
                                <div class="info-box"><div class="info-label">${t('pets.sterilized')}</div><p class="info-val">${selectedPet.sterilized ? t('common.yes') : t('common.no')}</p></div>
                            </div>
                            
                            <div class="medical-section">
                                <h3 class="medical-title">🏥 ${t('pets.medicalInfo')}</h3>
                                <div class="medical-item">
                                    <div class="medical-label">${t('pets.allergies')}</div>
                                    <p class="medical-val">${selectedPet.allergies || t('common.noneDoc')}</p>
                                </div>
                                <div class="medical-item">
                                    <div class="medical-label">${t('pets.currentMeds')}</div>
                                    <p class="medical-val">${selectedPet.medications || t('common.none')}</p>
                                </div>
                                <div class="medical-item">
                                    <div class="medical-label">${t('pets.medicalConditions')}</div>
                                    <p class="medical-val">${selectedPet.medicalConditions || t('common.none')}</p>
                                </div>
                                <div style="display: flex; gap: 20px; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #fca5a5;">
                                    <div style="flex: 1;">
                                        <div class="medical-label">${t('pets.mainVet')}</div>
                                        <p class="medical-val">${selectedPet.vetName || t('common.notSpecified')}</p>
                                    </div>
                                    <div style="flex: 1;">
                                        <div class="medical-label">${t('pets.emergencyPhone')}</div>
                                        <p class="medical-val">${selectedPet.vetPhone || t('common.notSpecified')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        ${t('pets.pawPortFooter')}
                    </div>
                </div>
            </body>
            </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert(t('common.error'), t('pets.shareNotSupported'));
            }
        } catch (e) {
            Alert.alert(t('common.error'), t('pets.pdfError'));
        }
    };

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
        if (userData?.isWalking) {
            Alert.alert(t('pets.activeWalk'), t('pets.activeWalkAlert'));
            return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return Alert.alert(t('common.error'), t('pets.gpsPermission'));
        setWalkRoute([]); setWalkDistance(0); setWalkTimer(0); setIsWalking(true);
        await supabase.from('users').update({ isWalking: true, walkingPetId: selectedPet?.id }).eq('id', user.id);
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
        await supabase.from('users').update({ isWalking: false, walkingPetId: null }).eq('id', user.id);

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
            
            await logActivity(user?.id, 'Paseo Completado', `${totalKm} km en la saca con ${selectedPet?.name}`, 'walk', 'walk');
            await logSystemAction(user?.id, userData?.email || 'Desconocido', 'WALK_COMPLETED', 'Reservations/Walks', { totalKm, calories, petName: selectedPet?.name });

            Alert.alert(t('pets.walkCompletedAlert'), `${totalKm} km · ${calories} kcal`);
        } catch (e) {
            Alert.alert(t('common.error'), t('pets.walkSaveError'));
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
            Alert.alert(t('common.error'), t('pets.shareError'));
        }
    };

    // ─────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────
    const scheduleReminder = async (title, body, triggerDate) => {
        try {
            await Notifications.scheduleNotificationAsync({
                content: { title: `🐾 ${title}`, body: body || t('pets.openPawMate'), sound: true },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
            });
            Alert.alert(t('pets.alarmReady'), `${t('pets.weWillNotify')}: "${title}"`);
        } catch (e) { console.error(e); }
    };

    // ─────────────────────────────────────────────────
    // PET CRUD
    // ─────────────────────────────────────────────────
    const handleSavePet = async () => {
        if (!formParams.name.trim()) return Alert.alert(t('common.error'), t('pets.nameRequired'));
        try {
            // Upload all images
            const uploadedImages = [];
            const allImages = formParams.images || (formParams.image ? [formParams.image] : []);
            for (const img of allImages) {
                if (img.startsWith('http') || img.startsWith('data:')) {
                    uploadedImages.push(img);
                } else {
                    const uid = user?.id;
                    const timestamp = Date.now();
                    const idx = uploadedImages.length;
                    const path = `pets/${uid}/${timestamp}_${idx}.jpg`;
                    const url = await uploadPetImage(img, path);
                    uploadedImages.push(url);
                }
            }
            const mainImage = uploadedImages[0] || formParams.image;

            // Build data object with only valid schema columns
            const dataToSave = {
                name: formParams.name.trim(),
                species: formParams.species,
                breed: formParams.breed || null,
                weight: formParams.weight ? parseFloat(formParams.weight) : null,
                gender: formParams.gender || null,
                sex: formParams.gender === 'female' ? 'female' : 'male',
                birthdate: formParams.birthdate || null,
                color: formParams.color || null,
                sterilized: formParams.sterilized || false,
                chipId: formParams.chipId || null,
                allergies: formParams.allergies || null,
                medications: formParams.medications || null,
                medicalConditions: formParams.medicalConditions || null,
                insurance: formParams.insurance || null,
                vetName: formParams.vetName || null,
                vetPhone: formParams.vetPhone || null,
                image: mainImage,
                photoURL: mainImage,
            };

            if (isEditing && selectedPet) {
                const prevActivity = selectedPet.activity || {};
                dataToSave.activity = { ...prevActivity, images: uploadedImages };
                const { error } = await supabase.from('pets').update(dataToSave).eq('id', selectedPet.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('pets').insert({
                    ...dataToSave,
                    ownerId: user?.id,
                    activity: { km: 0, images: uploadedImages },
                    vaccines: [],
                    reminders: [],
                });
                if (error) throw error;
            }

            // Re-fetch immediately so the pet shows up right away
            const { data } = await supabase.from('pets').select('*').eq('ownerId', user?.id);
            if (data) setPets(data);

            setIsFormVisible(false);
            resetForm();

            // Log activity in background (don't block UI)
            if (isEditing) {
                logActivity(user?.id, 'Mascota Actualizada', `Perfil de ${dataToSave.name} editado con éxito`, 'pet', 'create-outline').catch(() => {});
                logSystemAction(user?.id, userData?.email || 'Desconocido', 'PET_UPDATED', 'Pets', { petName: dataToSave.name }).catch(() => {});
            } else {
                logActivity(user?.id, 'Nueva Mascota', `Damos la bienvenida a ${dataToSave.name} 🐾`, 'pet', 'paw').catch(() => {});
                logSystemAction(user?.id, userData?.email || 'Desconocido', 'PET_CREATED', 'Pets', { petName: dataToSave.name }).catch(() => {});
            }
        } catch (e) {
            console.error('handleSavePet error:', e);
            Alert.alert(t('common.error'), t('pets.saveError'));
        }
    };

    const handleDeletePet = (petId) => {
        Alert.alert(t('pets.deletePet'), t('pets.deletePetConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'), style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('pets').delete().eq('id', petId);
                        setPets(prev => prev.filter(p => p.id !== petId));
                        if (selectedPet?.id === petId) setViewMode('list');
                        Alert.alert(t('pets.petDeleted'));
                    } catch (e) { Alert.alert(t('common.error'), t('pets.deleteError')); }
                }
            }
        ]);
    };

    const handleDeleteWalk = (walkId) => {
        Alert.alert(t('pets.deleteWalk'), t('pets.deleteWalkConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'), style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('walks').delete().eq('id', walkId);
                        setWalks(prev => prev.filter(w => w.id !== walkId));
                    } catch (e) { Alert.alert(t('common.error'), t('pets.walkDeleteError')); }
                }
            }
        ]);
    };

    // ── Wizard Step State ─────────────────────────
    const [wizardStep, setWizardStep] = useState(0);
    const WIZARD_STEPS = isEditing
        ? ['photo', 'name', 'species', 'breed', 'gender', 'details', 'medical', 'vet']
        : ['photo', 'name', 'species', 'breed', 'gender', 'details', 'medical', 'vet'];
    const TOTAL_STEPS = WIZARD_STEPS.length;

    const resetForm = () => {
        setFormParams({ ...EMPTY_FORM });
        setIsEditing(false);
        setWizardStep(0);
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
            images: pet.activity?.images || (pet.image ? [pet.image] : []),
        });
        setSelectedPet(pet);
        setIsEditing(true);
        setWizardStep(0);
        setIsFormVisible(true);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 5,
            quality: 0.6,
        });
        if (!result.canceled && result.assets?.length > 0) {
            const newUris = result.assets.map(a => a.uri);
            setFormParams(p => {
                const existing = p.images || [];
                const combined = [...existing, ...newUris].slice(0, 5);
                return { ...p, images: combined, image: combined[0] || p.image };
            });
        }
    };

    const removeImage = (index) => {
        setFormParams(p => {
            const updated = [...(p.images || [])];
            updated.splice(index, 1);
            return { ...p, images: updated, image: updated[0] || null };
        });
    };

    // ─────────────────────────────────────────────────
    // REMINDER CRUD
    // ─────────────────────────────────────────────────

    // Smart category detector based on keywords in title/description
    const REMINDER_CATEGORIES = [
        { key: 'vaccine',  label: '💉 Vacuna',     color: '#3b82f6', icon: 'medkit-outline',
          keywords: ['vacuna', 'vaccine', 'rabia', 'parvo', 'moquillo', 'leptospirosis', 'puppy', 'refuerzo', 'recuerdo', 'booster'] },
        { key: 'medical',  label: '🩺 Médico',     color: '#ef4444', icon: 'medical-outline',
          keywords: ['vet', 'veterinario', 'medico', 'médico', 'cita', 'revisión', 'revision', 'consulta', 'cirugía', 'cirugia', 'dolor', 'sangre', 'analítica', 'analisis', 'análisis', 'ecograf', 'rayos', 'castración', 'castracion', 'esteriliz'] },
        { key: 'parasite', label: '🐛 Antiparasitario', color: '#a855f7', icon: 'bug-outline',
          keywords: ['antiparasit', 'desparasit', 'pulga', 'garrapata', 'gusano', 'pipeta', 'collar', 'flea', 'tick', 'frontline'] },
        { key: 'food',     label: '🍖 Comida',     color: '#f59e0b', icon: 'restaurant-outline',
          keywords: ['comida', 'pienso', 'food', 'alimento', 'snack', 'premio'] },
        { key: 'walk',     label: '🦮 Paseo',      color: '#22c55e', icon: 'walk-outline',
          keywords: ['paseo', 'walk', 'ejercicio', 'parque', 'playa', 'correr'] },
        { key: 'grooming', label: '✂️ Aseo',       color: '#06b6d4', icon: 'cut-outline',
          keywords: ['baño', 'baño', 'bath', 'peluquería', 'peluqueria', 'corte', 'uñas', 'unas', 'pelo', 'cepill'] },
        { key: 'birthday', label: '🎂 Cumpleaños', color: '#ec4899', icon: 'gift-outline',
          keywords: ['cumple', 'cumpleaños', 'cumpleanos', 'birthday', 'aniversario'] },
        { key: 'general',  label: '📌 General',    color: '#94a3b8', icon: 'bookmark-outline', keywords: [] },
    ];

    const detectReminderCategory = (title = '', description = '') => {
        const text = `${title} ${description}`.toLowerCase();
        for (const cat of REMINDER_CATEGORIES) {
            if (cat.keywords.some(kw => text.includes(kw))) return cat.key;
        }
        return 'general';
    };

    const REMINDER_TEMPLATES = [
        { title: 'Vacuna anual',         category: 'vaccine',  daysAhead: 365 },
        { title: 'Antiparasitario',      category: 'parasite', daysAhead: 30 },
        { title: 'Revisión veterinaria', category: 'medical',  daysAhead: 180 },
        { title: 'Baño',                 category: 'grooming', daysAhead: 14 },
        { title: 'Corte de uñas',        category: 'grooming', daysAhead: 21 },
    ];

    const applyTemplate = (tpl) => {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + tpl.daysAhead);
        newDate.setHours(10, 0, 0, 0);
        setReminderForm(r => ({
            ...r,
            title: tpl.title,
            category: tpl.category,
            eventTime: newDate,
        }));
    };

    // Append a vaccine entry to pets.vaccines (jsonb array)
    const addToHealthRecord = async (reminder) => {
        if (!selectedPet) return;
        try {
            if (reminder.category === 'vaccine') {
                const vaccines = selectedPet.vaccines || [];
                const newVaccine = {
                    id: Date.now().toString(),
                    name: reminder.title,
                    notes: reminder.description || '',
                    date: new Date().toISOString(),
                    nextDueDate: reminder.eventTime,
                };
                const updated = [...vaccines, newVaccine];
                await supabase.from('pets').update({ vaccines: updated }).eq('id', selectedPet.id);
                setPets(prev => prev.map(p => p.id === selectedPet.id ? { ...p, vaccines: updated } : p));
                setSelectedPet(p => p ? { ...p, vaccines: updated } : p);
                Alert.alert('✅ Añadido', `"${reminder.title}" se añadió al historial de vacunas de ${selectedPet.name}.`);
            } else if (reminder.category === 'medical' || reminder.category === 'parasite') {
                // Append to medicalConditions (text). Prefix the entry with the date.
                const stamp = new Date().toLocaleDateString();
                const entry = `[${stamp}] ${reminder.title}${reminder.description ? ` — ${reminder.description}` : ''}`;
                const newConditions = selectedPet.medicalConditions
                    ? `${selectedPet.medicalConditions}\n${entry}`
                    : entry;
                await supabase.from('pets').update({ medicalConditions: newConditions }).eq('id', selectedPet.id);
                setPets(prev => prev.map(p => p.id === selectedPet.id ? { ...p, medicalConditions: newConditions } : p));
                setSelectedPet(p => p ? { ...p, medicalConditions: newConditions } : p);
                Alert.alert('✅ Añadido', `Se añadió al historial médico de ${selectedPet.name}.`);
            }
        } catch (e) {
            console.error('addToHealthRecord error:', e);
            Alert.alert(t('common.error'), 'No se pudo añadir al historial.');
        }
    };

    const promptAddToHealth = (reminder) => {
        const labels = {
            vaccine:  { title: '💉 ¿Añadir al historial de vacunas?', msg: `Detectamos que es una vacuna. ¿Quieres registrar "${reminder.title}" en las vacunas de ${selectedPet?.name}?` },
            medical:  { title: '🩺 ¿Añadir al historial médico?',     msg: `¿Quieres registrar "${reminder.title}" en las condiciones médicas de ${selectedPet?.name}?` },
            parasite: { title: '🐛 ¿Añadir al historial?',             msg: `¿Quieres registrar este antiparasitario en el historial de ${selectedPet?.name}?` },
        };
        const meta = labels[reminder.category];
        if (!meta) return;
        Alert.alert(meta.title, meta.msg, [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Sí, añadir', onPress: () => addToHealthRecord(reminder) },
        ]);
    };

    const openReminderForm = (reminder = null) => {
        if (reminder) {
            setEditingReminder(reminder);
            setReminderForm({
                title: reminder.title, description: reminder.description,
                eventTime: reminder.eventTime ? new Date(reminder.eventTime) : new Date(),
                notificationAdvance: reminder.notificationAdvance ?? 15,
                category: reminder.category || detectReminderCategory(reminder.title, reminder.description),
            });
        } else {
            setEditingReminder(null);
            setReminderForm({ title: '', description: '', eventTime: new Date(), notificationAdvance: 15, category: 'general' });
        }
        setIsReminderModalVisible(true);
    };

    const saveReminder = async () => {
        if (!reminderForm.title.trim()) return Alert.alert(t('common.error'), t('pets.reminderTitle'));
        const triggerTime = new Date(reminderForm.eventTime);
        triggerTime.setMinutes(triggerTime.getMinutes() - reminderForm.notificationAdvance);
        // Auto-detect category if user did not pick one
        const finalCategory = reminderForm.category && reminderForm.category !== 'general'
            ? reminderForm.category
            : detectReminderCategory(reminderForm.title, reminderForm.description);
        const data = {
            title: reminderForm.title,
            description: reminderForm.description,
            notificationAdvance: reminderForm.notificationAdvance,
            eventTime: reminderForm.eventTime.toISOString(),
            category: finalCategory,
        };
        const currentReminders = selectedPet.reminders || [];
        const newReminders = editingReminder
            ? currentReminders.map(r => r.id === editingReminder.id ? { ...r, ...data } : r)
            : [...currentReminders, { id: Date.now().toString(), ...data }];
        try {
            await supabase.from('pets').update({ reminders: newReminders }).eq('id', selectedPet.id);
            // Sync local state immediately so UI reflects the change
            setPets(prev => prev.map(p => p.id === selectedPet.id ? { ...p, reminders: newReminders } : p));
            setSelectedPet(p => p ? { ...p, reminders: newReminders } : p);
            setIsReminderModalVisible(false);
            if (triggerTime.getTime() > Date.now()) {
                scheduleReminder(reminderForm.title, reminderForm.description, triggerTime);
            } else {
                Alert.alert(t('pets.reminderSaved'), t('pets.reminderSavedMsg'));
            }
            // 🩺 Smart prompt: ask user to add to health record if relevant (only on create, not edit)
            if (!editingReminder && ['vaccine', 'medical', 'parasite'].includes(finalCategory)) {
                setTimeout(() => promptAddToHealth({ ...data }), 600);
            }
        } catch { Alert.alert(t('common.error'), t('pets.reminderSaveError')); }
    };

    const deleteReminder = async (id) => {
        const filtered = (selectedPet.reminders || []).filter(r => r.id !== id);
        try {
            await supabase.from('pets').update({ reminders: filtered }).eq('id', selectedPet.id);
            setPets(prev => prev.map(p => p.id === selectedPet.id ? { ...p, reminders: filtered } : p));
            setSelectedPet(p => p ? { ...p, reminders: filtered } : p);
            setIsReminderModalVisible(false);
        } catch { Alert.alert(t('common.error'), t('pets.reminderDeleteError')); }
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
                <Text style={[styles.screenTitle, { color: theme.text }]}>{t('pets.title')}</Text>
            </View>

            {pets.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={{ fontSize: 64, textAlign: 'center' }}>🐾</Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('pets.noPets')}</Text>
                    <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                        {t('pets.noPetsDesc')}
                    </Text>
                    <TouchableOpacity
                        style={[styles.addBtn, { width: '100%', borderRadius: 16, height: 52, marginTop: 20 }]}
                        onPress={() => { resetForm(); setIsFormVisible(true); }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>+ {t('pets.addPet')}</Text>
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
                            <Icon name="chevron-forward" size={20} color={theme.textSecondary} />
                        </View>

                        {/* Actions */}
                        <View style={[styles.petCardBottom, { borderTopColor: theme.border }]}>
                            <TouchableOpacity
                                style={[styles.actionChip, { backgroundColor: theme.primaryBg, marginRight: 8 }]}
                                onPress={() => openEditModal(pet)}
                            >
                                <Icon name="create-outline" size={14} color={COLORS.primary} />
                                <Text style={[styles.actionChipText, { color: COLORS.primary }]}>{t('common.edit')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionChip, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border, marginRight: 8 }]}
                                onPress={() => navigateTo('detail', pet)}
                            >
                                <Icon name="eye-outline" size={14} color={theme.textSecondary} />
                                <Text style={[styles.actionChipText, { color: theme.textSecondary }]}>{t('pets.viewDetails')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionChip, { backgroundColor: '#FEE2E2', marginLeft: 'auto' }]}
                                onPress={() => handleDeletePet(pet.id)}
                            >
                                <Icon name="trash-outline" size={14} color="#EF4444" />
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
        const age = getAge(selectedPet?.birthdate, t);
        return (
            <View>
                {/* General Info */}
                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.infoCardTitle, { color: theme.text }]}>{t('pets.generalInfo')}</Text>
                    <View style={styles.infoGrid}>
                        <InfoItem label={t('pets.speciesLabel')} value={`${getSpeciesEmoji(selectedPet?.species)} ${getSpeciesLabel(selectedPet?.species)}`} />
                        <InfoItem label={t('pets.breed')} value={selectedPet?.breed || '—'} />
                        <InfoItem label={t('pets.sex')} value={selectedPet?.gender === 'female' ? `♀ ${t('pets.female')}` : `♂ ${t('pets.male')}`} />
                        <InfoItem label={t('pets.weight')} value={selectedPet?.weight ? `${selectedPet.weight} kg` : '—'} />
                        {age && <InfoItem label={t('pets.age')} value={age} />}
                        {selectedPet?.birthdate && (
                            <InfoItem label={t('pets.birthday')} value={new Date(selectedPet.birthdate).toLocaleDateString('es-ES')} />
                        )}
                        {selectedPet?.color ? <InfoItem label={t('pets.color')} value={selectedPet.color} /> : null}
                        <InfoItem label={t('pets.sterilized')} value={selectedPet?.sterilized ? `✅ ${t('common.yes')}` : `❌ ${t('common.no')}`} />
                    </View>
                </View>

                {/* Medical Data */}
                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.infoCardTitle, { color: theme.text }]}>{t('pets.medicalData')}</Text>
                    <InfoItemFull
                        label={t('pets.chipNumber')}
                        value={selectedPet?.chipId || t('pets.noChip')}
                        mono
                    />
                    {selectedPet?.allergies ? (
                        <InfoItemFull label={`⚠️ ${t('pets.allergies')}`} value={selectedPet.allergies} danger />
                    ) : null}
                    {selectedPet?.medications ? (
                        <InfoItemFull label={`💊 ${t('pets.medications')}`} value={selectedPet.medications} />
                    ) : null}
                    {selectedPet?.medicalConditions ? (
                        <InfoItemFull label={`📋 ${t('pets.conditions')}`} value={selectedPet.medicalConditions} />
                    ) : null}
                    {selectedPet?.insurance ? (
                        <InfoItemFull label={`🛡️ ${t('pets.insurance')}`} value={selectedPet.insurance} />
                    ) : null}
                </View>

                {/* Vet Contact */}
                {(selectedPet?.vetName || selectedPet?.vetPhone) && (
                    <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.infoCardTitle, { color: theme.text }]}>{`🩺 ${t('pets.vet')}`}</Text>
                        {selectedPet?.vetName ? (
                            <View style={styles.vetRow}>
                                <Icon name="person-outline" size={17} color={COLORS.secondary} />
                                <Text style={styles.vetText}>{selectedPet.vetName}</Text>
                            </View>
                        ) : null}
                        {selectedPet?.vetPhone ? (
                            <View style={styles.vetRow}>
                                <Icon name="call-outline" size={17} color={COLORS.success} />
                                <Text style={styles.vetText}>{selectedPet.vetPhone}</Text>
                            </View>
                        ) : null}
                    </View>
                )}

                {/* QR Paw-Port / PDF */}
                <TouchableOpacity
                    style={[styles.passportBanner, { backgroundColor: isDarkMode ? '#1e293b' : '#1e1b4b', padding: 22, borderRadius: 24, marginTop: 16, shadowColor: '#312e81', shadowOpacity: 0.3, shadowRadius: 15, elevation: 8, borderWidth: 1, borderColor: '#4338ca', overflow: 'hidden', justifyContent: 'center' }]}
                    onPress={generatePawPortPDF}
                    activeOpacity={0.88}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 2, paddingRight: 40 }}>
                        <View style={[styles.passportIconBox, { backgroundColor: '#4f46e5', width: 50, height: 50, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }]}>
                            <Icon name="document-text" size={26} color="#FFF" />
                        </View>
                        <View style={{ marginLeft: 16, flex: 1 }}>
                            <Text style={[styles.passportTitle, { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }]}>{t('pets.pawPort')}</Text>
                            <Text style={[styles.passportSub, { color: '#a5b4fc', fontSize: 13, marginTop: 2 }]}>{t('pets.pawPortDesc')}</Text>
                        </View>
                    </View>
                    <View style={[styles.passportChevron, { position: 'absolute', right: 22, backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', zIndex: 3 }]}>
                        <Icon name="download-outline" size={20} color="#FFF" />
                    </View>
                    <View style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1, zIndex: 1, transform: [{ rotate: '-15deg' }] }}>
                        <Icon name="shield-checkmark" size={130} color="#FFF" />
                    </View>
                </TouchableOpacity>

                {/* Edit Button */}
                <TouchableOpacity
                    style={styles.fullEditBtn}
                    onPress={() => openEditModal(selectedPet)}
                    activeOpacity={0.85}
                >
                    <Icon name="create-outline" size={20} color="#FFF" />
                    <Text style={styles.fullEditBtnText}>{t('pets.editFullProfile')}</Text>
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
                                <Text style={styles.walkBannerTitle}>🏃 {t('pets.activeWalk')}</Text>
                                <Text style={styles.walkBannerRunning}>
                                    {walkDistance.toFixed(2)} km  ·  {formatDuration(walkTimer)}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.walkStopBtn} onPress={stopWalk}>
                                <Text style={{ color: COLORS.danger, fontWeight: '800', fontSize: 14 }}>
                                    ■  {t('pets.endWalk')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.walkBanner} onPress={startWalk} activeOpacity={0.85}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.playCircle}>
                                    <Icon name="play" size={18} color={COLORS.primary} />
                                </View>
                                <View style={{ marginLeft: 14 }}>
                                    <Text style={styles.walkBannerTitle}>{t('pets.startNewWalk')}</Text>
                                    <Text style={styles.walkBannerSub}>{t('pets.gpsActive')}</Text>
                                </View>
                            </View>
                            <Icon name="chevron-forward" size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                    )
                )}

                {/* Global Stats */}
                {walks.length > 0 && (
                    <View style={[styles.globalStatsRow, { backgroundColor: theme.cardBackground }]}>
                        <GlobalStat value={totalStats.km} label={t('pets.totalKm')} />
                        <View style={styles.statDivider} />
                        <GlobalStat value={totalStats.kcal} label={t('pets.kcal')} />
                        <View style={styles.statDivider} />
                        <GlobalStat value={totalStats.count} label={t('pets.walksCount')} />
                        <View style={styles.statDivider} />
                        <GlobalStat value={`${totalStats.avgPace}`} label={t('pets.avgSpeed')} />
                    </View>
                )}

                {/* Walks List */}
                {walks.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, marginTop: 0 }]}>
                        <Text style={{ fontSize: 52, textAlign: 'center' }}>🗺️</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('pets.noWalks')}</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                            {t('pets.noWalksDesc')}
                        </Text>
                    </View>
                ) : (
                    walks.map((walk) => {
                        const hasRoute = walk.route && walk.route.length > 1;
                        const region = hasRoute ? getRouteRegion(walk.route) : null;
                        const mins = Math.round((walk.durationSeconds || 0) / 60);
                        const walkDate = walk.endTime ? new Date(walk.endTime) : null;
                        const totalKm = parseFloat(walk.totalKm) || 0;
                        const paceMin = (walk.durationSeconds > 0 && totalKm > 0)
                            ? Math.floor((walk.durationSeconds / 60) / totalKm)
                            : 0;
                        const paceSec = (walk.durationSeconds > 0 && totalKm > 0)
                            ? Math.round(((walk.durationSeconds / 60) / totalKm - paceMin) * 60)
                            : 0;
                        const speedKmh = (walk.durationSeconds > 0 && totalKm > 0)
                            ? (totalKm / (walk.durationSeconds / 3600)).toFixed(1)
                            : '0.0';

                        return (
                            <View key={walk.id} style={{ marginBottom: 18, borderRadius: 22, overflow: 'hidden', backgroundColor: theme.cardBackground, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: isDarkMode ? 0 : 1, borderColor: theme.border }}>
                                {/* Map Thumbnail */}
                                {hasRoute && region && (
                                    <View style={{ height: 200, position: 'relative' }}>
                                        <MapView
                                            style={StyleSheet.absoluteFillObject}
                                            provider={PROVIDER_GOOGLE}
                                            initialRegion={region}
                                            zoomEnabled={false}
                                            scrollEnabled={false}
                                            pitchEnabled={false}
                                            rotateEnabled={false}
                                            customMapStyle={!isDarkMode ? [] : [
                                                { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
                                                { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
                                                { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
                                                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
                                                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
                                            ]}
                                        >
                                            <Polyline
                                                coordinates={walk.route}
                                                strokeColor="#FF6B35"
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
                                        <Text style={[styles.walkDate, { color: theme.textSecondary }]}>
                                            {walkDate.toLocaleDateString('es-ES', {
                                                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                        </Text>
                                    )}
                                    <View style={styles.walkStatsRow}>
                                        <WalkStat icon={<Icon name="map-outline" size={15} color={COLORS.primary} />} value={`${walk.totalKm} km`} />
                                        <WalkStat icon={<Icon name="time-outline" size={15} color={COLORS.secondary} />} value={`${mins} min`} />
                                        <WalkStat icon={<Icon name="flame-outline" size={15} color={COLORS.danger} />} value={`${walk.calories || 0} kcal`} />
                                        {walk.durationSeconds > 0 && walk.totalKm > 0 && (
                                            <WalkStat
                                                icon={<Icon name="speedometer-outline" size={15} color={COLORS.success} />}
                                                value={`${(walk.totalKm / (walk.durationSeconds / 3600)).toFixed(1)} km/h`}
                                            />
                                        )}
                                    </View>
                                    {/* Action Buttons Row */}
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity
                                            style={[styles.shareBtn, { flex: 1, backgroundColor: isDarkMode ? '#282942' : '#F3F4F6' }]}
                                            onPress={() => shareWalk(walk)}
                                            activeOpacity={0.8}
                                        >
                                            <Icon name="share-outline" size={15} color={COLORS.secondary} />
                                            <Text style={[styles.shareBtnText, { color: theme.text }]}>{t('pets.share')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.shareBtn, { backgroundColor: '#FEE2E2', paddingHorizontal: 16 }]}
                                            onPress={() => handleDeleteWalk(walk.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Icon name="trash-outline" size={15} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}

                {!isDog && (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, marginTop: 0 }]}>
                        <Text style={{ fontSize: 48, textAlign: 'center' }}>🐾</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('pets.dogsOnly')}</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                            {t('pets.dogsOnlyDesc')}
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
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{`📅 ${t('pets.reminders')}`}</Text>
                <TouchableOpacity
                    style={[styles.addBtn, { width: 34, height: 34, borderRadius: 17 }]}
                    onPress={() => openReminderForm()}
                >
                    <Icon name="add" size={16} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={[styles.agendaCard, { backgroundColor: theme.cardBackground }]}>
                {(!selectedPet?.reminders || selectedPet.reminders.length === 0) ? (
                    <View style={{ padding: 30, alignItems: 'center' }}>
                        <Text style={{ fontSize: 44 }}>🔔</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>{t('pets.noReminders')}</Text>
                        <TouchableOpacity onPress={() => openReminderForm()} style={{ marginTop: 10 }}>
                            <Text style={{ color: theme.primary, fontWeight: '700' }}>+ {t('pets.addReminder')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    selectedPet.reminders.map((rem, i) => {
                        const cat = REMINDER_CATEGORIES.find(c => c.key === (rem.category || 'general')) || REMINDER_CATEGORIES[REMINDER_CATEGORIES.length - 1];
                        return (
                        <TouchableOpacity
                            key={rem.id}
                            style={[styles.agendaItem, i === selectedPet.reminders.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => openReminderForm(rem)}
                        >
                            <View style={[styles.agendaIconBox, { backgroundColor: `${cat.color}22`, borderLeftWidth: 3, borderLeftColor: cat.color }]}>
                                <Icon name={cat.icon} size={17} color={cat.color} />
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
                                <Text style={[styles.agendaDesc, { color: cat.color, fontWeight: '600', fontSize: 11, marginTop: 2 }]}>
                                    {cat.label}
                                </Text>
                                <Text style={styles.agendaDesc}>{rem.description || t('pets.noDescription')}</Text>
                            </View>
                        </TouchableOpacity>
                        );
                    })
                )}
            </View>

            {/* ── Registered vaccines (synced from reminders or added manually) ── */}
            {selectedPet?.vaccines && selectedPet.vaccines.length > 0 && (
                <>
                    <View style={[styles.listHeaderRow, { paddingHorizontal: 2, marginTop: 18 }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{`💉 ${t('pets.vaccines') || 'Vacunas'}`}</Text>
                    </View>
                    <View style={[styles.agendaCard, { backgroundColor: theme.cardBackground }]}>
                        {selectedPet.vaccines.map((vac, i) => (
                            <View
                                key={vac.id}
                                style={[styles.agendaItem, i === selectedPet.vaccines.length - 1 && { borderBottomWidth: 0 }]}
                            >
                                <View style={[styles.agendaIconBox, { backgroundColor: '#3b82f622', borderLeftWidth: 3, borderLeftColor: '#3b82f6' }]}>
                                    <Icon name="medkit-outline" size={17} color="#3b82f6" />
                                </View>
                                <View style={styles.agendaTextWrap}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={styles.agendaTitle}>{vac.name}</Text>
                                        <TouchableOpacity
                                            onPress={() => Alert.alert(
                                                'Eliminar vacuna',
                                                `¿Eliminar "${vac.name}" del historial?`,
                                                [
                                                    { text: 'Cancelar', style: 'cancel' },
                                                    { text: 'Eliminar', style: 'destructive', onPress: async () => {
                                                        const updated = selectedPet.vaccines.filter(v => v.id !== vac.id);
                                                        await supabase.from('pets').update({ vaccines: updated }).eq('id', selectedPet.id);
                                                        setPets(prev => prev.map(p => p.id === selectedPet.id ? { ...p, vaccines: updated } : p));
                                                        setSelectedPet(p => p ? { ...p, vaccines: updated } : p);
                                                    } },
                                                ]
                                            )}
                                        >
                                            <Icon name="trash-outline" size={15} color={COLORS.danger} />
                                        </TouchableOpacity>
                                    </View>
                                    {vac.nextDueDate && (
                                        <Text style={styles.agendaDesc}>
                                            Próxima dosis: {new Date(vac.nextDueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Text>
                                    )}
                                    {vac.notes ? <Text style={styles.agendaDesc}>{vac.notes}</Text> : null}
                                </View>
                            </View>
                        ))}
                    </View>
                </>
            )}
        </View>
    );

    // ═══════════════════════════════════════════════════
    // RENDER: DETAIL VIEW
    // ═══════════════════════════════════════════════════
    const renderDetailView = () => {
        if (!selectedPet) return null;
        const age = getAge(selectedPet?.birthdate, t);

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
                        <Icon name="chevron-back" size={21} color={theme.text} />
                    </TouchableOpacity>

                    {/* Edit shortcut */}
                    <TouchableOpacity style={[styles.heroEditBtn, { backgroundColor: theme.background }]} onPress={() => openEditModal(selectedPet)}>
                        <Icon name="create-outline" size={17} color={theme.text} />
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
                        {selectedPet.breed ? <Badge label={selectedPet.breed} color="blue" /> : null}
                        {age ? <Badge label={age} color="green" /> : null}
                        {selectedPet.gender ? (
                            <Badge label={selectedPet.gender === 'female' ? t('pets.female') : t('pets.male')} color="purple" />
                        ) : null}
                    </View>

                    {/* Stats Row */}
                    <View style={[styles.heroStatsRow, { backgroundColor: theme.background }]}>
                        <HeroStat value={parseFloat(totalStats.km) > 0 ? totalStats.km : '—'} label="km" />
                        <View style={styles.heroStatDiv} />
                        <HeroStat value={totalStats.kcal > 0 ? totalStats.kcal : '—'} label="kcal" />
                        <View style={styles.heroStatDiv} />
                        <HeroStat value={totalStats.count > 0 ? totalStats.count : '—'} label={t('pets.walksCount')} />
                        <View style={styles.heroStatDiv} />
                        <HeroStat value={selectedPet.weight ? `${selectedPet.weight}` : '—'} label="kg" />
                    </View>
                </View>

                {/* ── TAB BAR ────────────────────────────── */}
                <View style={[styles.tabBar, { backgroundColor: theme.cardBackground }]}>
                    {[
                        { key: 'profile', label: t('pets.profileTab') },
                        { key: 'walks', label: t('pets.walksTab') },
                        { key: 'health', label: t('pets.healthTab') },
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
                    {t('pets.petsLoading')}
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
            {!isFormVisible && viewMode === 'list' && (
                <TouchableOpacity
                    style={[
                        styles.fabBtn,
                        isLeftHanded ? { left: 20 } : { right: 20 }
                    ]}
                    onPress={() => { resetForm(); setIsFormVisible(true); }}
                >
                    <Icon name="add" size={24} color="#FFF" />
                </TouchableOpacity>
            )}

            <Modal visible={isFormVisible} animationType="slide" presentationStyle="fullScreen">
                <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
                    {/* Wizard Header */}
                    <View style={wizStyles.header}>
                        <TouchableOpacity
                            style={wizStyles.backBtn}
                            onPress={() => {
                                if (wizardStep === 0) { setIsFormVisible(false); resetForm(); }
                                else setWizardStep(s => s - 1);
                            }}
                        >
                            <Icon name="chevron-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={wizStyles.headerCenter}>
                            <Text style={wizStyles.brandText}>🐾 PawMate</Text>
                            <Text style={wizStyles.stepCounter}>{wizardStep + 1}/{TOTAL_STEPS}</Text>
                        </View>
                        <TouchableOpacity onPress={() => { setIsFormVisible(false); resetForm(); }}>
                            <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View style={wizStyles.progressBar}>
                        <View style={[wizStyles.progressFill, { width: `${((wizardStep + 1) / TOTAL_STEPS) * 100}%` }]} />
                    </View>

                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <ScrollView
                            contentContainerStyle={wizStyles.stepContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* ── STEP 0: PHOTO ── */}
                            {WIZARD_STEPS[wizardStep] === 'photo' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}>📸</Text>
                                    <Text style={wizStyles.stepTitle}>
                                        {isEditing ? t('pets.updatePhotos') : t('pets.addPhotos')}
                                    </Text>
                                    <Text style={wizStyles.stepDesc}>{t('pets.photosDesc')}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                                        {(formParams.images || []).map((uri, i) => (
                                            <TouchableOpacity key={i} onPress={() => removeImage(i)} style={{ position: 'relative' }}>
                                                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 16 }} />
                                                <View style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Icon name="close" size={14} color="#FFF" />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                        {(formParams.images || []).length < 5 && (
                                            <TouchableOpacity style={[wizStyles.photoCircle, { width: 90, height: 90, borderRadius: 16 }]} onPress={pickImage}>
                                                <View style={[wizStyles.photoPlaceholder, { width: 90, height: 90, borderRadius: 16 }]}>
                                                    <Icon name="add-circle" size={32} color="rgba(255,255,255,0.5)" />
                                                    <Text style={[wizStyles.photoPlaceholderText, { fontSize: 10 }]}>{t('pets.addLabel')}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* ── STEP 1: NAME ── */}
                            {WIZARD_STEPS[wizardStep] === 'name' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}>✏️</Text>
                                    <Text style={wizStyles.stepTitle}>{t('pets.whatsName')}</Text>
                                    <Text style={wizStyles.stepDesc}>{t('pets.namePlaceholder')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.name}
                                        onChangeText={t => setFormParams(p => ({ ...p, name: t }))}
                                        placeholder="Ej. Max, Luna, Coco..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        autoFocus
                                    />
                                </View>
                            )}

                            {/* ── STEP 2: SPECIES ── */}
                            {WIZARD_STEPS[wizardStep] === 'species' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepTitle}>{t('pets.whatsSpecies')}</Text>
                                    <Text style={wizStyles.stepDesc}>{t('pets.selectSpecies')}</Text>
                                    <View style={wizStyles.speciesGrid}>
                                        {SPECIES_OPTIONS.map(sp => (
                                            <TouchableOpacity
                                                key={sp.value}
                                                style={[
                                                    wizStyles.speciesCircle,
                                                    formParams.species === sp.value && wizStyles.speciesCircleActive
                                                ]}
                                                onPress={() => setFormParams(p => ({ ...p, species: sp.value }))}
                                            >
                                                <View style={[
                                                    wizStyles.speciesIconWrap,
                                                    formParams.species === sp.value && { borderColor: '#F5A623', borderWidth: 3 }
                                                ]}>
                                                    <Text style={{ fontSize: 40 }}>{sp.emoji}</Text>
                                                </View>
                                                <Text style={[
                                                    wizStyles.speciesLabel,
                                                    formParams.species === sp.value && { color: '#F5A623', fontWeight: '800' }
                                                ]}>{sp.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* ── STEP 3: BREED ── */}
                            {WIZARD_STEPS[wizardStep] === 'breed' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}>{getSpeciesEmoji(formParams.species)}</Text>
                                    <Text style={wizStyles.stepTitle}>{t('pets.whatsBreed')}</Text>
                                    <Text style={wizStyles.stepDesc}>Escribe la raza de tu {getSpeciesLabel(formParams.species).toLowerCase()}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.breed}
                                        onChangeText={t => setFormParams(p => ({ ...p, breed: t }))}
                                        placeholder="Ej. Golden Retriever, Siamés..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        autoFocus
                                    />
                                </View>
                            )}

                            {/* ── STEP 4: GENDER ── */}
                            {WIZARD_STEPS[wizardStep] === 'gender' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepTitle}>{t('pets.whatsSex')}</Text>
                                    <Text style={wizStyles.stepDesc}>Selecciona el sexo de {formParams.name || 'tu mascota'}</Text>
                                    <View style={wizStyles.genderRow}>
                                        <TouchableOpacity
                                            style={[
                                                wizStyles.genderCircle,
                                                formParams.gender === 'male' && { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.15)' }
                                            ]}
                                            onPress={() => setFormParams(p => ({ ...p, gender: 'male' }))}
                                        >
                                            <Icon name="male" size={44} color={formParams.gender === 'male' ? '#3B82F6' : 'rgba(255,255,255,0.4)'} />
                                            <Text style={[wizStyles.genderLabel, formParams.gender === 'male' && { color: '#3B82F6' }]}>{t('pets.maleLabel')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                wizStyles.genderCircle,
                                                formParams.gender === 'female' && { borderColor: '#EC4899', backgroundColor: 'rgba(236,72,153,0.15)' }
                                            ]}
                                            onPress={() => setFormParams(p => ({ ...p, gender: 'female' }))}
                                        >
                                            <Icon name="female" size={44} color={formParams.gender === 'female' ? '#EC4899' : 'rgba(255,255,255,0.4)'} />
                                            <Text style={[wizStyles.genderLabel, formParams.gender === 'female' && { color: '#EC4899' }]}>{t('pets.femaleLabel')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity onPress={() => setFormParams(p => ({ ...p, gender: '' }))}>
                                        <Text style={wizStyles.skipText}>{t('pets.dontKnow')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* ── STEP 5: DETAILS ── */}
                            {WIZARD_STEPS[wizardStep] === 'details' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}>📋</Text>
                                    <Text style={wizStyles.stepTitle}>{t('pets.additionalDetails')}</Text>
                                    <Text style={wizStyles.stepDesc}>{t('pets.optionalData')}</Text>

                                    <Text style={wizStyles.fieldLabel}>{t('pets.weightKg')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        keyboardType="numeric"
                                        value={formParams.weight}
                                        onChangeText={t => setFormParams(p => ({ ...p, weight: t }))}
                                        placeholder={t('pets.weightPlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>{t('pets.birthdateLabel')}</Text>
                                    <TouchableOpacity
                                        style={wizStyles.wizardInput}
                                        onPress={() => setShowBirthdatePicker(true)}
                                    >
                                        <Text style={{ color: formParams.birthdate ? '#FFF' : 'rgba(255,255,255,0.3)', fontSize: 16 }}>
                                            {formParams.birthdate
                                                ? new Date(formParams.birthdate).toLocaleDateString()
                                                : t('pets.birthdateLabel')}
                                        </Text>
                                    </TouchableOpacity>
                                    {showBirthdatePicker && (
                                        <DateTimePicker
                                            value={formParams.birthdate ? new Date(formParams.birthdate) : new Date()}
                                            mode="date"
                                            maximumDate={new Date()}
                                            onChange={(event, selectedDate) => {
                                                setShowBirthdatePicker(Platform.OS === 'ios');
                                                if (selectedDate) {
                                                    setFormParams(p => ({ ...p, birthdate: selectedDate.toISOString().split('T')[0] }));
                                                }
                                                if (Platform.OS === 'android') setShowBirthdatePicker(false);
                                            }}
                                        />
                                    )}

                                    <Text style={wizStyles.fieldLabel}>{t('pets.colorLabel')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.color}
                                        onChangeText={t => setFormParams(p => ({ ...p, color: t }))}
                                        placeholder={t('pets.colorPlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <View style={wizStyles.switchRow}>
                                        <Text style={wizStyles.fieldLabel}>{t('pets.sterilizedLabel')}</Text>
                                        <TouchableOpacity
                                            style={[wizStyles.togglePill, formParams.sterilized && { backgroundColor: '#22C55E' }]}
                                            onPress={() => setFormParams(p => ({ ...p, sterilized: !p.sterilized }))}
                                        >
                                            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                                                {formParams.sterilized ? `✅ ${t('common.yes')}` : `❌ ${t('common.no')}`}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* ── STEP 6: MEDICAL ── */}
                            {WIZARD_STEPS[wizardStep] === 'medical' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}>🏥</Text>
                                    <Text style={wizStyles.stepTitle}>{t('pets.medicalTitle')}</Text>
                                    <Text style={wizStyles.stepDesc}>{t('pets.medicalDesc')}</Text>

                                    <Text style={wizStyles.fieldLabel}>{t('pets.chipNumber')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.chipId}
                                        onChangeText={t => setFormParams(p => ({ ...p, chipId: t }))}
                                        placeholder={t('pets.chipPlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>{t('pets.allergies')}</Text>
                                    <TextInput
                                        style={[wizStyles.wizardInput, { height: 70, textAlignVertical: 'top', paddingTop: 14 }]}
                                        multiline
                                        value={formParams.allergies}
                                        onChangeText={t => setFormParams(p => ({ ...p, allergies: t }))}
                                        placeholder={t('pets.allergiesPlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>{t('pets.medications')}</Text>
                                    <TextInput
                                        style={[wizStyles.wizardInput, { height: 70, textAlignVertical: 'top', paddingTop: 14 }]}
                                        multiline
                                        value={formParams.medications}
                                        onChangeText={t => setFormParams(p => ({ ...p, medications: t }))}
                                        placeholder={t('pets.medicationsPlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>{t('pets.conditionsLabel')}</Text>
                                    <TextInput
                                        style={[wizStyles.wizardInput, { height: 70, textAlignVertical: 'top', paddingTop: 14 }]}
                                        multiline
                                        value={formParams.medicalConditions}
                                        onChangeText={t => setFormParams(p => ({ ...p, medicalConditions: t }))}
                                        placeholder={t('pets.conditionsPlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>{t('pets.insurance')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.insurance}
                                        onChangeText={t => setFormParams(p => ({ ...p, insurance: t }))}
                                        placeholder={t('pets.insurancePlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />
                                </View>
                            )}

                            {/* ── STEP 7: VET ── */}
                            {WIZARD_STEPS[wizardStep] === 'vet' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}>🩺</Text>
                                    <Text style={wizStyles.stepTitle}>{t('pets.vetTitle')}</Text>
                                    <Text style={wizStyles.stepDesc}>{t('pets.vetDesc')}</Text>

                                    <Text style={wizStyles.fieldLabel}>{t('pets.vetNameLabel')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.vetName}
                                        onChangeText={t => setFormParams(p => ({ ...p, vetName: t }))}
                                        placeholder={t('pets.vetNamePlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>{t('pets.vetPhoneLabel')}</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        keyboardType="phone-pad"
                                        value={formParams.vetPhone}
                                        onChangeText={t => setFormParams(p => ({ ...p, vetPhone: t }))}
                                        placeholder={t('pets.vetPhonePlaceholder')}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />
                                </View>
                            )}
                        </ScrollView>

                        {/* Bottom Action */}
                        <View style={wizStyles.bottomBar}>
                            {wizardStep < TOTAL_STEPS - 1 ? (
                                <TouchableOpacity
                                    style={wizStyles.nextBtn}
                                    onPress={() => {
                                        if (WIZARD_STEPS[wizardStep] === 'name' && !formParams.name.trim()) {
                                            Alert.alert(t('common.error'), t('pets.nameRequired'));
                                            return;
                                        }
                                        setWizardStep(s => s + 1);
                                    }}
                                >
                                    <Text style={wizStyles.nextBtnText}>
                                        {WIZARD_STEPS[wizardStep] === 'species' ? t('pets.nextBreed') :
                                         WIZARD_STEPS[wizardStep] === 'breed' ? t('pets.nextGender') :
                                         WIZARD_STEPS[wizardStep] === 'gender' ? t('pets.nextDetails') :
                                         WIZARD_STEPS[wizardStep] === 'photo' ? t('pets.nextName') :
                                         WIZARD_STEPS[wizardStep] === 'name' ? t('pets.nextSpecies') :
                                         WIZARD_STEPS[wizardStep] === 'details' ? t('pets.nextMedical') :
                                         t('pets.nextVet')}
                                    </Text>
                                    <Icon name="arrow-forward" size={20} color="#1A1A2E" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={wizStyles.saveBtn} onPress={handleSavePet}>
                                    <Text style={wizStyles.saveBtnText}>
                                        {isEditing ? t('pets.saveChanges') : t('pets.registerPet')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {WIZARD_STEPS[wizardStep] !== 'name' && WIZARD_STEPS[wizardStep] !== 'photo' && wizardStep < TOTAL_STEPS - 1 && (
                                <TouchableOpacity
                                    style={wizStyles.skipBtn}
                                    onPress={() => setWizardStep(s => s + 1)}
                                >
                                    <Text style={wizStyles.skipBtnText}>{t('pets.skipStep')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* ── MODAL: PAW-PORT QR ─────────────────── */}
            <Modal visible={isPassportVisible} animationType="fade" transparent>
                <View style={styles.qrOverlay}>
                    <View style={styles.qrCard}>
                        <TouchableOpacity style={styles.qrClose} onPress={() => setIsPassportVisible(false)}>
                            <Icon name="close" size={20} color={COLORS.textLight} />
                        </TouchableOpacity>

                        <Text style={styles.qrBrand}>{t('pets.pawPortTitle')}</Text>
                        <Text style={styles.qrPetName}>{selectedPet?.name}</Text>

                        <View style={styles.qrBox}>
                            <QRCode value={qrPayload} size={200} color={COLORS.text} backgroundColor={COLORS.surface} />
                        </View>

                        {selectedPet?.chipId ? (
                            <Text style={styles.qrChipLabel}>
                                CHIP: {selectedPet.chipId.toUpperCase()}
                            </Text>
                        ) : null}

                        <View style={styles.qrInfoGrid}>
                            {selectedPet?.allergies ? (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>{t('pets.allergies')}</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.allergies}</Text>
                                </View>
                            ) : null}
                            {selectedPet?.vetPhone ? (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>{t('pets.qrVet')}</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.vetPhone}</Text>
                                </View>
                            ) : null}
                            {selectedPet?.medications ? (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>{t('pets.qrMedication')}</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.medications}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={styles.qrFooter}>{t('pets.qrFooter')}</Text>
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
                            {editingReminder ? t('pets.editReminder') : t('pets.newReminder')}
                        </Text>
                        <TouchableOpacity onPress={() => setIsReminderModalVisible(false)}>
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={[styles.formBody, { backgroundColor: theme.background }]}>
                        <FormLabel text={t('pets.reminderTitleLabel')} />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={reminderForm.title}
                            onChangeText={txt => setReminderForm(r => ({
                                ...r,
                                title: txt,
                                // Auto-detect category as user types (only if user hasn't manually picked a non-general one)
                                category: r.category === 'general' || !r.category
                                    ? detectReminderCategory(txt, r.description)
                                    : r.category,
                            }))}
                            placeholder={t('pets.reminderTitlePlaceholder')}
                            placeholderTextColor={theme.textSecondary}
                        />

                        {/* Quick templates — only shown when creating a new reminder */}
                        {!editingReminder && (
                            <>
                                <FormLabel text="⚡ Plantillas rápidas" />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                    {REMINDER_TEMPLATES.map(tpl => (
                                        <TouchableOpacity
                                            key={tpl.title}
                                            onPress={() => applyTemplate(tpl)}
                                            style={{
                                                paddingHorizontal: 14, paddingVertical: 8,
                                                borderRadius: 18, marginRight: 8,
                                                backgroundColor: theme.cardBackground,
                                                borderWidth: 1, borderColor: theme.border,
                                            }}
                                        >
                                            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{tpl.title}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        {/* Category chips */}
                        <FormLabel text="🏷️ Categoría" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                            {REMINDER_CATEGORIES.map(cat => {
                                const active = reminderForm.category === cat.key;
                                return (
                                    <TouchableOpacity
                                        key={cat.key}
                                        onPress={() => setReminderForm(r => ({ ...r, category: cat.key }))}
                                        style={{
                                            paddingHorizontal: 14, paddingVertical: 8,
                                            borderRadius: 18, marginRight: 8,
                                            backgroundColor: active ? cat.color : theme.cardBackground,
                                            borderWidth: 1.5,
                                            borderColor: active ? cat.color : theme.border,
                                        }}
                                    >
                                        <Text style={{ color: active ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <FormLabel text={t('pets.descriptionLabel')} />
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            multiline
                            value={reminderForm.description}
                            onChangeText={txt => setReminderForm(r => ({
                                ...r,
                                description: txt,
                                category: r.category === 'general' || !r.category
                                    ? detectReminderCategory(r.title, txt)
                                    : r.category,
                            }))}
                            placeholder={t('pets.additionalNotesPlaceholder')}
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text={t('pets.eventDateTime')} />
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

                        <FormLabel text={t('pets.notifyInAdvance')} />
                        <View style={{ borderWidth: 1.5, borderColor: '#e2ede8', borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.surface }}>
                            <Picker
                                selectedValue={reminderForm.notificationAdvance}
                                onValueChange={v => setReminderForm(r => ({ ...r, notificationAdvance: v }))}
                                style={{ color: COLORS.text }}
                                itemStyle={{ color: COLORS.text, fontSize: 16 }}
                            >
                                <Picker.Item label={t('pets.atExactTime')} value={0} />
                                <Picker.Item label={t('pets.fiveMinBefore')} value={5} />
                                <Picker.Item label={t('pets.fifteenMinBefore')} value={15} />
                                <Picker.Item label={t('pets.thirtyMinBefore')} value={30} />
                                <Picker.Item label={t('pets.oneHourBefore')} value={60} />
                                <Picker.Item label={t('pets.oneDayBefore')} value={1440} />
                            </Picker>
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={saveReminder}>
                            <Text style={styles.submitText}>
                                {editingReminder ? t('pets.saveChanges') : t('pets.scheduleReminder')}
                            </Text>
                        </TouchableOpacity>

                        {editingReminder && (
                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: '#ffebee', marginTop: 12 }]}
                                onPress={() => deleteReminder(editingReminder.id)}
                            >
                                <Text style={[styles.submitText, { color: COLORS.danger }]}>
                                    {t('pets.deleteReminder')}
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
        marginTop: 14, paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8,
    },
    actionChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    },
    actionChipText: { fontWeight: '700', fontSize: 13 },
    editChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#e8f5ee', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    },
    editChipText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
    fabBtn: {
        position: 'absolute', bottom: 90,
        backgroundColor: COLORS.primary, width: 60, height: 60, borderRadius: 30,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
        zIndex: 100,
    },

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

// ─────────────────────────────────────────────────
// WIZARD STYLES (Petazy-inspired dark theme)
// ─────────────────────────────────────────────────
const wizStyles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 12,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerCenter: { alignItems: 'center' },
    brandText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
    stepCounter: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    progressBar: {
        height: 4, backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 24, borderRadius: 2, marginBottom: 10,
    },
    progressFill: {
        height: 4, backgroundColor: '#F5A623', borderRadius: 2,
    },
    stepContent: {
        flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 20,
    },
    stepContainer: { alignItems: 'center', flex: 1 },
    stepEmoji: { fontSize: 56, marginBottom: 16 },
    stepTitle: {
        fontSize: 26, fontWeight: '900', color: '#FFF',
        textAlign: 'center', marginBottom: 8, letterSpacing: -0.3,
    },
    stepDesc: {
        fontSize: 15, color: 'rgba(255,255,255,0.5)',
        textAlign: 'center', marginBottom: 30, lineHeight: 22,
    },
    // Photo step
    photoCircle: {
        width: 180, height: 180, borderRadius: 90,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)',
        borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
    },
    photoCircleImg: { width: 180, height: 180, borderRadius: 90 },
    photoPlaceholder: { alignItems: 'center', gap: 8 },
    photoPlaceholderText: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 13 },
    // Input
    wizardInput: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
        fontSize: 17, color: '#FFF', fontWeight: '600',
    },
    fieldLabel: {
        alignSelf: 'flex-start',
        fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase', letterSpacing: 0.6,
        marginTop: 18, marginBottom: 8,
    },
    // Species
    speciesGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        justifyContent: 'center', gap: 20,
    },
    speciesCircle: { alignItems: 'center', width: (width - 120) / 3 },
    speciesCircleActive: {},
    speciesIconWrap: {
        width: 85, height: 85, borderRadius: 42.5,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 8,
    },
    speciesLabel: {
        fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)',
    },
    // Gender
    genderRow: {
        flexDirection: 'row', gap: 24, marginBottom: 20,
    },
    genderCircle: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },
    genderLabel: {
        fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: 6,
    },
    skipText: {
        fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
        textDecorationLine: 'underline',
    },
    // Switch row
    switchRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', width: '100%', marginTop: 18,
    },
    togglePill: {
        paddingHorizontal: 18, paddingVertical: 10,
        borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // Bottom bar
    bottomBar: {
        paddingHorizontal: 28, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        paddingTop: 12,
    },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F5A623', height: 56, borderRadius: 28,
        gap: 8,
        shadowColor: '#F5A623', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    nextBtnText: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
    saveBtn: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#22C55E', height: 56, borderRadius: 28,
        shadowColor: '#22C55E', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
    skipBtn: { alignItems: 'center', marginTop: 12 },
    skipBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
});