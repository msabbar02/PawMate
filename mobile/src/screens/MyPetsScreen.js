import { useState, useMemo, useEffect, useRef, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal,
    Image, Dimensions, Platform, TextInput, KeyboardAvoidingView,
    ActivityIndicator, Animated, Alert, Share
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Icon from '../components/Icon';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { uploadPetImage } from '../utils/storageHelpers';
import { logActivity, logSystemAction } from '../utils/logger';

const { width } = Dimensions.get('window');

const SPECIES_OPTIONS = [
    { value: 'dog', label: 'Perro', icon: 'dog' },
    { value: 'cat', label: 'Gato', icon: 'cat' },
    { value: 'bird', label: 'Ave', icon: 'dove' },
    { value: 'rabbit', label: 'Conejo', icon: 'rabbit' },
    { value: 'other', label: 'Otro', icon: 'paw' },
];

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Helpers de utilidad para especies y géneros.
const getSpeciesIcon = (species) => {
    const sp = SPECIES_OPTIONS.find(s => s.value === species);
    return sp ? sp.icon : 'paw';
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

// Estado inicial del formulario de mascota.
const EMPTY_FORM = {
    name: '', species: 'dog', breed: '', weight: '',
    gender: 'male', birthdate: '', color: '', sterilized: false,
    chipId: '', allergies: '', medications: '', medicalConditions: '',
    insurance: '', vetName: '', vetPhone: '', image: null, images: [],
};

// Componente principal del centro de mascotas.
export default function PawMatePetsCenter() {
    const { user, userData } = useContext(AuthContext);
    const { theme, isDarkMode, isLeftHanded } = useContext(ThemeContext);

    // Estado principal.
    const [pets, setPets] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
    const [selectedPet, setSelectedPet] = useState(null);
    const [isLoadingSync, setIsLoadingSync] = useState(true);
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'walks' | 'health'

    // Flags de modales.
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPassportVisible, setIsPassportVisible] = useState(false);
    const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
    const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);

    // Estado del formulario extendido.
    const [formParams, setFormParams] = useState({ ...EMPTY_FORM });

    // Estado de los recordatorios.
    const [editingReminder, setEditingReminder] = useState(null);
    const [reminderForm, setReminderForm] = useState({
        title: '', description: '', eventTime: new Date(), notificationAdvance: 15,
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Estado del historial de salud.
    const [editingHealthRecord, setEditingHealthRecord] = useState(null);
    const [healthRecordForm, setHealthRecordForm] = useState({
        type: 'vacuna', name: '', date: new Date(), notes: '',
    });
    const [showHealthDatePicker, setShowHealthDatePicker] = useState(false);

    // Estado del seguimiento de paseos.
    const [isWalking, setIsWalking] = useState(false);
    const [walkRoute, setWalkRoute] = useState([]);
    const [walkDistance, setWalkDistance] = useState(0);
    const [walkTimer, setWalkTimer] = useState(0);
    const [walks, setWalks] = useState([]); // ALL walks from Firestore

    const locationSub = useRef(null);
    const timerRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Carga y sincroniza en tiempo real la colección de mascotas del usuario.
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

    // Carga todos los paseos de la mascota seleccionada.
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

    // Solicita permisos de notificaciones.
    useEffect(() => {
        Notifications.requestPermissionsAsync();
    }, []);

    // Estadísticas totales calculadas a partir de todos los paseos.
    const totalStats = useMemo(() => {
        const km = walks.reduce((s, w) => s + (w.totalKm || 0), 0);
        const kcal = walks.reduce((s, w) => s + (w.calories || 0), 0);
        const secs = walks.reduce((s, w) => s + (w.durationSeconds || 0), 0);
        const avgPace = walks.length > 0 && secs > 0
            ? (km / (secs / 3600)).toFixed(1)
            : '0';
        return { km: km.toFixed(2), kcal, count: walks.length, avgPace };
    }, [walks]);

    // Payload QR con los datos biométricos de la mascota.
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

    const generatePawPortPDF = async () => {
        if (!selectedPet) return;
        try {
            const age = getAge(selectedPet?.birthdate) || 'Desconocida';
            const genderStr = selectedPet.gender === 'female' ? 'Hembra' : 'Macho';
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
                            <h1>Paw-Port Biométrico</h1>
                            <p>Documento de Identificación y Emergencia</p>
                        </div>
                        <div class="header-logo"></div>
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
                            <h3 style="color: #166534; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0;">Datos del Animal</h3>
                            <div class="info-grid">
                                <div class="info-box"><div class="info-label">Raza</div><p class="info-val">${selectedPet.breed || '—'}</p></div>
                                <div class="info-box"><div class="info-label">Sexo y Edad</div><p class="info-val">${genderStr} • ${age}</p></div>
                                <div class="info-box"><div class="info-label">Nº Microchip</div><p class="info-val" style="font-family: monospace; letter-spacing: 1px;">${selectedPet.chipId || 'Sin registrar'}</p></div>
                                <div class="info-box"><div class="info-label">Peso / Color</div><p class="info-val">${selectedPet.weight ? selectedPet.weight + ' kg' : '—'} • ${selectedPet.color || '—'}</p></div>
                                <div class="info-box"><div class="info-label">Dueño Responsable</div><p class="info-val">${user?.email || '—'}</p></div>
                                <div class="info-box"><div class="info-label">Teléfono del Dueño</div><p class="info-val">${userData?.phone || '—'}</p></div>
                                <div class="info-box"><div class="info-label">Esterilizado</div><p class="info-val">${selectedPet.sterilized ? 'Sí' : 'No'}</p></div>
                            </div>
                            
                            <div class="medical-section">
                                <h3 class="medical-title">Información Médica y Emergencias</h3>
                                <div class="medical-item">
                                    <div class="medical-label">Alergias</div>
                                    <p class="medical-val">${selectedPet.allergies || 'Ninguna documentada'}</p>
                                </div>
                                <div class="medical-item">
                                    <div class="medical-label">Medicamentos Actuales</div>
                                    <p class="medical-val">${selectedPet.medications || 'Ninguno'}</p>
                                </div>
                                <div class="medical-item">
                                    <div class="medical-label">Condiciones Médicas</div>
                                    <p class="medical-val">${selectedPet.medicalConditions || 'Ninguna'}</p>
                                </div>
                                <div style="display: flex; gap: 20px; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #fca5a5;">
                                    <div style="flex: 1;">
                                        <div class="medical-label">Veterinario Principal</div>
                                        <p class="medical-val">${selectedPet.vetName || 'No especificado'}</p>
                                    </div>
                                    <div style="flex: 1;">
                                        <div class="medical-label">Teléfono Emergencia</div>
                                        <p class="medical-val">${selectedPet.vetPhone || 'No especificado'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        Documento oficial generado por la aplicación <strong>PawMate</strong> en fecha ${new Date().toLocaleDateString('es-ES')}.<br/>
                        En caso de encontrar esta mascota, por favor contactar de inmediato con su dueño o veterinario habitual.
                    </div>
                </div>
            </body>
            </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Error', 'Tu dispositivo no soporta compartir este archivo.');
            }
        } catch (e) {
            Alert.alert('Error', 'No se pudo generar el PDF del pasaporte.');
        }
    };

    // Navega entre la lista y el detalle con transición de fundido.
    const navigateTo = (mode, pet = null) => {
        fadeAnim.setValue(0);
        setSelectedPet(pet);
        setViewMode(mode);
        setActiveTab('profile');
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    };

    // Control del paseo GPS (iniciar y detener).
    const startWalk = async () => {
        if (userData?.isWalking) {
            Alert.alert('Paseo activo', 'Ya tienes un paseo en curso. Termínalo antes de iniciar otro.');
            return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Error', 'Permiso GPS denegado');
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

            Alert.alert('¡Paseo completado! ', `${totalKm} km · ${calories} kcal quemadas`);
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar el paseo');
        }
    };

    // Comparte el resumen de un paseo.
    const shareWalk = async (walk) => {
        const mins = Math.round((walk.durationSeconds || 0) / 60);
        const date = walk.endTime
            ? new Date(walk.endTime).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
            : '';
        const message =
            `¡${selectedPet?.name} completó un paseo con PawMate!\n\n` +
            `Distancia: ${walk.totalKm} km\n` +
            `⏱Duración: ${mins} min\n` +
            `Calorías: ${walk.calories || 0} kcal\n` +
            `${date}\n\n` +
            `¡Descarga PawMate y lleva el control de la salud de tus mascotas! `;
        try {
            await Share.share({ message, title: `Paseo de ${selectedPet?.name}` });
        } catch {
            Alert.alert('Error', 'No se pudo compartir');
        }
    };

    // Programa una notificación local para un recordatorio.
    const scheduleReminder = async (title, body, triggerDate) => {
        try {
            await Notifications.scheduleNotificationAsync({
                content: { title: `${title}`, body: body || 'Abre PawMate', sound: true },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
            });
            Alert.alert('Alarma lista', `Te avisaremos: "${title}"`);
        } catch (e) { console.error(e); }
    };

    // Operaciones CRUD de mascotas (guardar, eliminar, fotos).
    const handleSavePet = async () => {
        if (!formParams.name.trim()) return Alert.alert('Error', 'El nombre es obligatorio');
        try {
            // Sube todas las imágenes al bucket de Supabase Storage.
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

            // Construye el objeto con solo las columnas válidas del esquema.
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
                logActivity(user?.id, 'Nueva Mascota', `Damos la bienvenida a ${dataToSave.name} `, 'pet', 'paw').catch(() => {});
                logSystemAction(user?.id, userData?.email || 'Desconocido', 'PET_CREATED', 'Pets', { petName: dataToSave.name }).catch(() => {});
            }
        } catch (e) {
            console.error('handleSavePet error:', e);
            Alert.alert('Error', 'No se pudo guardar la mascota');
        }
    };

    const handleDeletePet = (petId) => {
        Alert.alert('Eliminar mascota', '¿Seguro que quieres eliminar esta mascota? Esta acción es irreversible.', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('pets').delete().eq('id', petId);
                        setPets(prev => prev.filter(p => p.id !== petId));
                        if (selectedPet?.id === petId) setViewMode('list');
                        Alert.alert('Mascota eliminada');
                    } catch (e) { Alert.alert('Error', 'No se pudo eliminar la mascota'); }
                }
            }
        ]);
    };

    const handleDeleteWalk = (walkId) => {
        Alert.alert('Eliminar paseo', '¿Seguro que quieres eliminar este paseo del historial?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('walks').delete().eq('id', walkId);
                        setWalks(prev => prev.filter(w => w.id !== walkId));
                    } catch (e) { Alert.alert('Error', 'No se pudo eliminar el paseo'); }
                }
            }
        ]);
    };

    // Estado del asistente de creación de mascota.
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

    // Operaciones CRUD de recordatorios.
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

    // Operaciones CRUD del historial de salud.
    const HEALTH_TYPES = [
        { key: 'vacuna', label: 'Vacuna' },
        { key: 'visita_vet', label: 'Visita veterinaria' },
        { key: 'medicamento', label: 'Medicamento' },
        { key: 'desparasitacion', label: 'Desparasitación' },
        { key: 'otro', label: 'Otro' },
    ];

    const openHealthForm = (record = null) => {
        if (record) {
            setEditingHealthRecord(record);
            setHealthRecordForm({
                type: record.type || 'vacuna',
                name: record.name || '',
                date: record.date ? new Date(record.date) : new Date(),
                notes: record.notes || '',
            });
        } else {
            setEditingHealthRecord(null);
            setHealthRecordForm({ type: 'vacuna', name: '', date: new Date(), notes: '' });
        }
        setIsHealthModalVisible(true);
    };

    const saveHealthRecord = async () => {
        if (!healthRecordForm.name.trim()) return Alert.alert('Error', 'Escribe un nombre');
        const data = {
            type: healthRecordForm.type,
            name: healthRecordForm.name.trim(),
            date: healthRecordForm.date.toISOString(),
            notes: healthRecordForm.notes.trim(),
        };
        const current = selectedPet.vaccines || [];
        const updated = editingHealthRecord
            ? current.map(r => r.id === editingHealthRecord.id ? { ...r, ...data } : r)
            : [...current, { id: Date.now().toString(), ...data }];
        try {
            await supabase.from('pets').update({ vaccines: updated }).eq('id', selectedPet.id);
            setIsHealthModalVisible(false);
        } catch { Alert.alert('Error', 'No se pudo guardar el registro'); }
    };

    const deleteHealthRecord = async (id) => {
        const filtered = (selectedPet.vaccines || []).filter(r => r.id !== id);
        try {
            await supabase.from('pets').update({ vaccines: filtered }).eq('id', selectedPet.id);
            setIsHealthModalVisible(false);
        } catch { Alert.alert('Error', 'No se pudo eliminar'); }
    };

    // Vista en lista de mascotas.
    const renderListView = () => (
        <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={styles.scrollList}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.listHeaderRow}>
                <Text style={[styles.screenTitle, { color: theme.text }]}>Mis Mascotas</Text>
            </View>

            {pets.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={{ fontSize: 64, textAlign: 'center' }}></Text>
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
                                    : <Icon name={getSpeciesIcon(pet.species)} size={34} color={COLORS.primary} />
                                }
                            </View>

                            {/* Info */}
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={[styles.petCardName, { color: theme.text }]}>{pet.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Icon name={getSpeciesIcon(pet.species)} size={12} color={theme.textSecondary} />
                                    <Text style={[styles.petCardSub, { color: theme.textSecondary }]}>
                                        {getSpeciesLabel(pet.species)}{pet.breed ? ` · ${pet.breed}` : ''}
                                    </Text>
                                </View>
                                {pet.activity?.km > 0 && (
                                    <View style={styles.petBadge}>
                                        <Text style={styles.petBadgeText}>
                                            {parseFloat(pet.activity.km).toFixed(1)} km
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                        </View>

                        {/* Actions */}
                        <View style={[styles.petCardBottom, { borderTopColor: theme.border }]}>
                            <TouchableOpacity
                                style={[styles.actionChip, { backgroundColor: theme.primaryBg, marginRight: 8 }]}
                                onPress={() => openEditModal(pet)}
                            >
                                <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                                <Text style={[styles.actionChipText, { color: COLORS.primary }]}>Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionChip, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border, marginRight: 8 }]}
                                onPress={() => navigateTo('detail', pet)}
                            >
                                <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
                                <Text style={[styles.actionChipText, { color: theme.textSecondary }]}>Ver detalles</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionChip, { backgroundColor: '#FEE2E2', marginLeft: 'auto' }]}
                                onPress={() => handleDeletePet(pet.id)}
                            >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))
            )}
            <View style={{ height: 120 }} />
        </Animated.ScrollView>
    );

    // Pestaña de perfil de la mascota.
    const renderProfileTab = () => {
        const age = getAge(selectedPet?.birthdate);
        return (
            <View>
                {/* General Info */}
                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.infoCardTitle, { color: theme.text }]}>Información General</Text>
                    <View style={styles.infoGrid}>
                        <InfoItem label="Especie" value={getSpeciesLabel(selectedPet?.species)} />
                        <InfoItem label="Raza" value={selectedPet?.breed || '—'} />
                        <InfoItem label="Sexo" value={selectedPet?.gender === 'female' ? 'Hembra' : 'Macho'} />
                        <InfoItem label="Peso" value={selectedPet?.weight ? `${selectedPet.weight} kg` : '—'} />
                        {age && <InfoItem label="Edad" value={age} />}
                        {selectedPet?.birthdate && (
                            <InfoItem label="Nacimiento" value={new Date(selectedPet.birthdate).toLocaleDateString('es-ES')} />
                        )}
                        {selectedPet?.color && <InfoItem label="Color" value={selectedPet.color} />}
                        <InfoItem label="Esterilizado" value={selectedPet?.sterilized ? 'Sí' : 'No'} />
                    </View>
                </View>

                {/* Medical Data */}
                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.infoCardTitle, { color: theme.text }]}>Datos Médicos</Text>
                    <InfoItemFull
                        label="Nº Microchip"
                        value={selectedPet?.chipId || 'Sin microchip registrado'}
                        mono
                    />
                    {selectedPet?.allergies && (
                        <InfoItemFull label="Alergias" value={selectedPet.allergies} danger />
                    )}
                    {selectedPet?.medications && (
                        <InfoItemFull label="Medicamentos" value={selectedPet.medications} />
                    )}
                    {selectedPet?.medicalConditions && (
                        <InfoItemFull label="Condiciones" value={selectedPet.medicalConditions} />
                    )}
                    {selectedPet?.insurance && (
                        <InfoItemFull label="Seguro / Póliza" value={selectedPet.insurance} />
                    )}
                </View>

                {/* Vet Contact */}
                {(selectedPet?.vetName || selectedPet?.vetPhone) && (
                    <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.infoCardTitle, { color: theme.text }]}>Veterinario</Text>
                        {selectedPet?.vetName && (
                            <View style={styles.vetRow}>
                                <Ionicons name="person-outline" size={17} color={COLORS.secondary} />
                                <Text style={styles.vetText}>{selectedPet.vetName}</Text>
                            </View>
                        )}
                        {selectedPet?.vetPhone && (
                            <View style={styles.vetRow}>
                                <Ionicons name="call-outline" size={17} color={COLORS.success} />
                                <Text style={styles.vetText}>{selectedPet.vetPhone}</Text>
                            </View>
                        )}
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
                            <Ionicons name="document-text" size={26} color="#FFF" />
                        </View>
                        <View style={{ marginLeft: 16, flex: 1 }}>
                            <Text style={[styles.passportTitle, { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }]}>PREMIUM PAW-PORT</Text>
                            <Text style={[styles.passportSub, { color: '#a5b4fc', fontSize: 13, marginTop: 2 }]}>Documento oficial biométrico PDF</Text>
                        </View>
                    </View>
                    <View style={[styles.passportChevron, { position: 'absolute', right: 22, backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', zIndex: 3 }]}>
                        <Ionicons name="download-outline" size={20} color="#FFF" />
                    </View>
                    <View style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1, zIndex: 1, transform: [{ rotate: '-15deg' }] }}>
                        <Ionicons name="shield-checkmark" size={130} color="#FFF" />
                    </View>
                </TouchableOpacity>

                {/* Edit Button */}
                <TouchableOpacity
                    style={styles.fullEditBtn}
                    onPress={() => openEditModal(selectedPet)}
                    activeOpacity={0.85}
                >
                    <Ionicons name="create-outline" size={20} color="#FFF" />
                    <Text style={styles.fullEditBtnText}>Editar Perfil Completo</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Pestaña de paseos al estilo Strava.
    const renderWalksTab = () => {
        const isDog = selectedPet?.species === 'dog';

        return (
            <View>
                {/* Walk Start/Stop Banner */}
                {isDog && (
                    isWalking ? (
                        <View style={[styles.walkBanner, { backgroundColor: COLORS.danger }]}>
                            <View>
                                <Text style={styles.walkBannerTitle}>Paseo en Curso</Text>
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
                        <Text style={{ fontSize: 52, textAlign: 'center' }}></Text>
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
                                        <WalkStat icon={<Ionicons name="map-outline" size={15} color={COLORS.primary} />} value={`${walk.totalKm} km`} />
                                        <WalkStat icon={<Ionicons name="time-outline" size={15} color={COLORS.secondary} />} value={`${mins} min`} />
                                        <WalkStat icon={<Ionicons name="flame-outline" size={15} color={COLORS.danger} />} value={`${walk.calories || 0} kcal`} />
                                        {walk.durationSeconds > 0 && walk.totalKm > 0 && (
                                            <WalkStat
                                                icon={<Ionicons name="speedometer-outline" size={15} color={COLORS.success} />}
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
                                            <Ionicons name="share-outline" size={15} color={COLORS.secondary} />
                                            <Text style={[styles.shareBtnText, { color: theme.text }]}>Compartir</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.shareBtn, { backgroundColor: '#FEE2E2', paddingHorizontal: 16 }]}
                                            onPress={() => handleDeleteWalk(walk.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}

                {!isDog && (
                    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, marginTop: 0 }]}>
                        <Text style={{ fontSize: 48, textAlign: 'center' }}></Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>Solo para perros</Text>
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                            El seguimiento GPS de paseos está disponible para perros.
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // Pestaña de historial de salud.
    const renderHealthTab = () => (
        <View>
            {/* ── SECTION: RECORDATORIOS ── */}
            <View style={[styles.listHeaderRow, { paddingHorizontal: 2 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Recordatorios</Text>
                <TouchableOpacity
                    style={[styles.addBtn, { width: 34, height: 34, borderRadius: 17 }]}
                    onPress={() => openReminderForm()}
                >
                    <Ionicons name="add" size={16} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={[styles.agendaCard, { backgroundColor: theme.cardBackground }]}>
                {(!selectedPet?.reminders || selectedPet.reminders.length === 0) ? (
                    <View style={{ padding: 30, alignItems: 'center' }}>
                        <Text style={{ fontSize: 44 }}></Text>
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
                                <Ionicons name="notifications-outline" size={17} color={COLORS.secondary} />
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

            {/* ── SECTION: HISTORIAL DE SALUD ── */}
            <View style={[styles.listHeaderRow, { paddingHorizontal: 2, marginTop: 24 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Historial de Salud</Text>
                <TouchableOpacity
                    style={[styles.addBtn, { width: 34, height: 34, borderRadius: 17 }]}
                    onPress={() => openHealthForm()}
                >
                    <Ionicons name="add" size={16} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={[styles.agendaCard, { backgroundColor: theme.cardBackground }]}>
                {(!selectedPet?.vaccines || selectedPet.vaccines.length === 0) ? (
                    <View style={{ padding: 30, alignItems: 'center' }}>
                        <Icon name="heart-pulse" size={44} color={theme.textSecondary} />
                        <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>Sin registros de salud.</Text>
                        <TouchableOpacity onPress={() => openHealthForm()} style={{ marginTop: 10 }}>
                            <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Añadir registro</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    [...selectedPet.vaccines]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((rec, i, arr) => {
                            const typeIconNames = {
                                vacuna: 'syringe', visita_vet: 'stethoscope', medicamento: 'pills',
                                desparasitacion: 'bug', otro: 'notes-medical',
                            };
                            return (
                                <TouchableOpacity
                                    key={rec.id}
                                    style={[styles.agendaItem, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                                    onPress={() => openHealthForm(rec)}
                                >
                                    <View style={styles.agendaIconBox}>
                                        <Icon name={typeIconNames[rec.type] || 'notes-medical'} size={16} color={COLORS.primary} />
                                    </View>
                                    <View style={styles.agendaTextWrap}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.agendaTitle}>{rec.name}</Text>
                                            <Text style={styles.agendaDate}>
                                                {rec.date
                                                    ? new Date(rec.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
                                                    : ''}
                                            </Text>
                                        </View>
                                        {rec.notes ? (
                                            <Text style={styles.agendaDesc}>{rec.notes}</Text>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                )}
            </View>
        </View>
    );

    // Vista de detalle de la mascota.
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
                        <Ionicons name="create-outline" size={17} color={theme.text} />
                    </TouchableOpacity>

                    {/* Photo */}
                    <View style={styles.heroAvatarRing}>
                        <View style={styles.heroAvatarInner}>
                            {selectedPet.image
                                ? <Image source={{ uri: selectedPet.image }} style={styles.heroAvatarImg} />
                                : <Icon name={getSpeciesIcon(selectedPet.species)} size={60} color={COLORS.primary} />
                            }
                        </View>
                    </View>

                    {/* Name */}
                    <Text style={[styles.heroName, { color: theme.text }]}>{selectedPet.name}</Text>

                    {/* Badges */}
                    <View style={styles.heroBadgesRow}>
                        <Badge label={getSpeciesLabel(selectedPet.species)} color="amber" />
                        {selectedPet.breed && <Badge label={selectedPet.breed} color="blue" />}
                        {age && <Badge label={age} color="green" />}
                        {selectedPet.gender && (
                            <Badge label={selectedPet.gender === 'female' ? 'Hembra' : 'Macho'} color="purple" />
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
                        { key: 'profile', label: 'Perfil' },
                        { key: 'walks', label: 'Paseos' },
                        { key: 'health', label: 'Salud' },
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

    // Pantalla de carga inicial.
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

    // Renderizado principal del componente.
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
                    <Ionicons name="add" size={24} color="#FFF" />
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
                            <Ionicons name="chevron-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={wizStyles.headerCenter}>
                            <Text style={wizStyles.brandText}>PawMate</Text>
                            <Text style={wizStyles.stepCounter}>{wizardStep + 1}/{TOTAL_STEPS}</Text>
                        </View>
                        <TouchableOpacity onPress={() => { setIsFormVisible(false); resetForm(); }}>
                            <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
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
                                    <Text style={wizStyles.stepEmoji}></Text>
                                    <Text style={wizStyles.stepTitle}>
                                        {isEditing ? 'Actualiza las fotos' : 'Añade fotos'}
                                    </Text>
                                    <Text style={wizStyles.stepDesc}>Puedes añadir hasta 5 fotos de tu mascota</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                                        {(formParams.images || []).map((uri, i) => (
                                            <TouchableOpacity key={i} onPress={() => removeImage(i)} style={{ position: 'relative' }}>
                                                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 16 }} />
                                                <View style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Ionicons name="close" size={14} color="#FFF" />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                        {(formParams.images || []).length < 5 && (
                                            <TouchableOpacity style={[wizStyles.photoCircle, { width: 90, height: 90, borderRadius: 16 }]} onPress={pickImage}>
                                                <View style={[wizStyles.photoPlaceholder, { width: 90, height: 90, borderRadius: 16 }]}>
                                                    <Ionicons name="add-circle" size={32} color="rgba(255,255,255,0.5)" />
                                                    <Text style={[wizStyles.photoPlaceholderText, { fontSize: 10 }]}>Añadir</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* ── STEP 1: NAME ── */}
                            {WIZARD_STEPS[wizardStep] === 'name' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}></Text>
                                    <Text style={wizStyles.stepTitle}>¿Cómo se llama?</Text>
                                    <Text style={wizStyles.stepDesc}>Escribe el nombre de tu mascota</Text>
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
                                    <Text style={wizStyles.stepTitle}>¿Cuál es su especie?</Text>
                                    <Text style={wizStyles.stepDesc}>Selecciona el tipo de animal</Text>
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
                                                    <Icon name={sp.icon} size={40} color={formParams.species === sp.value ? '#F5A623' : COLORS.primary} />
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
                                    <Icon name={getSpeciesIcon(formParams.species)} size={60} color={COLORS.primary} />
                                    <Text style={wizStyles.stepTitle}>¿Cuál es su raza?</Text>
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
                                    <Text style={wizStyles.stepTitle}>¿Cuál es su sexo?</Text>
                                    <Text style={wizStyles.stepDesc}>Selecciona el sexo de {formParams.name || 'tu mascota'}</Text>
                                    <View style={wizStyles.genderRow}>
                                        <TouchableOpacity
                                            style={[
                                                wizStyles.genderCircle,
                                                formParams.gender === 'male' && { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.15)' }
                                            ]}
                                            onPress={() => setFormParams(p => ({ ...p, gender: 'male' }))}
                                        >
                                            <Ionicons name="male" size={44} color={formParams.gender === 'male' ? '#3B82F6' : 'rgba(255,255,255,0.4)'} />
                                            <Text style={[wizStyles.genderLabel, formParams.gender === 'male' && { color: '#3B82F6' }]}>Macho</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                wizStyles.genderCircle,
                                                formParams.gender === 'female' && { borderColor: '#EC4899', backgroundColor: 'rgba(236,72,153,0.15)' }
                                            ]}
                                            onPress={() => setFormParams(p => ({ ...p, gender: 'female' }))}
                                        >
                                            <Ionicons name="female" size={44} color={formParams.gender === 'female' ? '#EC4899' : 'rgba(255,255,255,0.4)'} />
                                            <Text style={[wizStyles.genderLabel, formParams.gender === 'female' && { color: '#EC4899' }]}>Hembra</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity onPress={() => setFormParams(p => ({ ...p, gender: '' }))}>
                                        <Text style={wizStyles.skipText}>No lo sé</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* ── STEP 5: DETAILS ── */}
                            {WIZARD_STEPS[wizardStep] === 'details' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}></Text>
                                    <Text style={wizStyles.stepTitle}>Detalles adicionales</Text>
                                    <Text style={wizStyles.stepDesc}>Estos datos son opcionales</Text>

                                    <Text style={wizStyles.fieldLabel}>Peso (kg)</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        keyboardType="numeric"
                                        value={formParams.weight}
                                        onChangeText={t => setFormParams(p => ({ ...p, weight: t }))}
                                        placeholder="Ej. 12.5"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>Fecha de Nacimiento</Text>
                                    <TouchableOpacity
                                        style={wizStyles.wizardInput}
                                        onPress={() => setShowBirthdatePicker(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: formParams.birthdate ? '#FFF' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>
                                            {formParams.birthdate
                                                ? new Date(formParams.birthdate).toLocaleDateString('es-ES')
                                                : 'Selecciona la fecha'}
                                        </Text>
                                    </TouchableOpacity>
                                    {showBirthdatePicker && (
                                        <DateTimePicker
                                            value={formParams.birthdate ? new Date(formParams.birthdate) : new Date()}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            maximumDate={new Date()}
                                            onChange={(_, date) => {
                                                setShowBirthdatePicker(Platform.OS === 'ios');
                                                if (date) {
                                                    const iso = date.toISOString().split('T')[0];
                                                    setFormParams(p => ({ ...p, birthdate: iso }));
                                                }
                                            }}
                                        />
                                    )}

                                    <Text style={wizStyles.fieldLabel}>Color del pelaje</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.color}
                                        onChangeText={t => setFormParams(p => ({ ...p, color: t }))}
                                        placeholder="Ej. Dorado con blanco"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <View style={wizStyles.switchRow}>
                                        <Text style={wizStyles.fieldLabel}>Esterilizado/a</Text>
                                        <TouchableOpacity
                                            style={[wizStyles.togglePill, formParams.sterilized && { backgroundColor: '#22C55E' }]}
                                            onPress={() => setFormParams(p => ({ ...p, sterilized: !p.sterilized }))}
                                        >
                                            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                                                {formParams.sterilized ? 'Sí' : 'No'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* ── STEP 6: MEDICAL ── */}
                            {WIZARD_STEPS[wizardStep] === 'medical' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}></Text>
                                    <Text style={wizStyles.stepTitle}>Datos médicos</Text>
                                    <Text style={wizStyles.stepDesc}>Información importante de salud (opcional)</Text>

                                    <Text style={wizStyles.fieldLabel}>Nº Microchip</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.chipId}
                                        onChangeText={t => setFormParams(p => ({ ...p, chipId: t }))}
                                        placeholder="Ej. 941000024583921"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>Alergias</Text>
                                    <TextInput
                                        style={[wizStyles.wizardInput, { height: 70, textAlignVertical: 'top', paddingTop: 14 }]}
                                        multiline
                                        value={formParams.allergies}
                                        onChangeText={t => setFormParams(p => ({ ...p, allergies: t }))}
                                        placeholder="Ej. Polen, pollo..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>Medicamentos actuales</Text>
                                    <TextInput
                                        style={[wizStyles.wizardInput, { height: 70, textAlignVertical: 'top', paddingTop: 14 }]}
                                        multiline
                                        value={formParams.medications}
                                        onChangeText={t => setFormParams(p => ({ ...p, medications: t }))}
                                        placeholder="Ej. Apoquel 16mg/día"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>Condiciones médicas</Text>
                                    <TextInput
                                        style={[wizStyles.wizardInput, { height: 70, textAlignVertical: 'top', paddingTop: 14 }]}
                                        multiline
                                        value={formParams.medicalConditions}
                                        onChangeText={t => setFormParams(p => ({ ...p, medicalConditions: t }))}
                                        placeholder="Ej. Displasia de cadera..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>Nº Seguro / Póliza</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.insurance}
                                        onChangeText={t => setFormParams(p => ({ ...p, insurance: t }))}
                                        placeholder="Ej. AXA-2024-001234"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />
                                </View>
                            )}

                            {/* ── STEP 7: VET ── */}
                            {WIZARD_STEPS[wizardStep] === 'vet' && (
                                <View style={wizStyles.stepContainer}>
                                    <Text style={wizStyles.stepEmoji}></Text>
                                    <Text style={wizStyles.stepTitle}>Veterinario</Text>
                                    <Text style={wizStyles.stepDesc}>Datos de contacto del veterinario (opcional)</Text>

                                    <Text style={wizStyles.fieldLabel}>Nombre del veterinario</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        value={formParams.vetName}
                                        onChangeText={t => setFormParams(p => ({ ...p, vetName: t }))}
                                        placeholder="Ej. Dr. García"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                    />

                                    <Text style={wizStyles.fieldLabel}>Teléfono de contacto</Text>
                                    <TextInput
                                        style={wizStyles.wizardInput}
                                        keyboardType="phone-pad"
                                        value={formParams.vetPhone}
                                        onChangeText={t => setFormParams(p => ({ ...p, vetPhone: t }))}
                                        placeholder="Ej. +34 912 345 678"
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
                                            Alert.alert('Error', 'El nombre es obligatorio');
                                            return;
                                        }
                                        setWizardStep(s => s + 1);
                                    }}
                                >
                                    <Text style={wizStyles.nextBtnText}>
                                        {WIZARD_STEPS[wizardStep] === 'species' ? 'Siguiente: Raza' :
                                         WIZARD_STEPS[wizardStep] === 'breed' ? 'Siguiente: Sexo' :
                                         WIZARD_STEPS[wizardStep] === 'gender' ? 'Siguiente: Detalles' :
                                         WIZARD_STEPS[wizardStep] === 'photo' ? 'Siguiente: Nombre' :
                                         WIZARD_STEPS[wizardStep] === 'name' ? 'Siguiente: Especie' :
                                         WIZARD_STEPS[wizardStep] === 'details' ? 'Siguiente: Médico' :
                                         'Siguiente'}
                                    </Text>
                                    <Ionicons name="arrow-forward" size={20} color="#1A1A2E" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={wizStyles.saveBtn} onPress={handleSavePet}>
                                    <Text style={wizStyles.saveBtnText}>
                                        {isEditing ? 'Guardar Cambios' : 'Registrar Mascota'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {WIZARD_STEPS[wizardStep] !== 'name' && WIZARD_STEPS[wizardStep] !== 'photo' && wizardStep < TOTAL_STEPS - 1 && (
                                <TouchableOpacity
                                    style={wizStyles.skipBtn}
                                    onPress={() => setWizardStep(s => s + 1)}
                                >
                                    <Text style={wizStyles.skipBtnText}>Saltar este paso</Text>
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
                            <Ionicons name="close" size={20} color={COLORS.textLight} />
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
                                    <Text style={styles.qrInfoKey}>Alergias</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.allergies}</Text>
                                </View>
                            )}
                            {selectedPet?.vetPhone && (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>Vet</Text>
                                    <Text style={styles.qrInfoVal}>{selectedPet.vetPhone}</Text>
                                </View>
                            )}
                            {selectedPet?.medications && (
                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoKey}>Medicación</Text>
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
                            <Ionicons name="close" size={24} color={theme.text} />
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

            {/* ── MODAL: HISTORIAL DE SALUD ─────────── */}
            <Modal visible={isHealthModalVisible} animationType="slide" presentationStyle="pageSheet">
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: theme.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[styles.formHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <Text style={[styles.formTitle, { color: theme.text }]}>
                            {editingHealthRecord ? 'Editar Registro' : 'Nuevo Registro de Salud'}
                        </Text>
                        <TouchableOpacity onPress={() => setIsHealthModalVisible(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={[styles.formBody, { backgroundColor: theme.background }]}>
                        <FormLabel text="Tipo de registro" />
                        <View style={{ borderWidth: 1.5, borderColor: theme.border, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.cardBackground, marginBottom: 16 }}>
                            <Picker
                                selectedValue={healthRecordForm.type}
                                onValueChange={v => setHealthRecordForm(r => ({ ...r, type: v }))}
                                style={{ color: theme.text }}
                                itemStyle={{ color: theme.text, fontSize: 16 }}
                            >
                                <Picker.Item label="Vacuna" value="vacuna" />
                                <Picker.Item label="Visita veterinaria" value="visita_vet" />
                                <Picker.Item label="Medicamento" value="medicamento" />
                                <Picker.Item label="Desparasitación" value="desparasitacion" />
                                <Picker.Item label="Otro" value="otro" />
                            </Picker>
                        </View>

                        <FormLabel text="Nombre / descripción breve" />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            value={healthRecordForm.name}
                            onChangeText={v => setHealthRecordForm(r => ({ ...r, name: v }))}
                            placeholder="Ej. Vacuna Rabia, Revisión anual..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <FormLabel text="Fecha" />
                        {Platform.OS === 'ios' ? (
                            <DateTimePicker
                                value={healthRecordForm.date}
                                mode="date"
                                display="spinner"
                                textColor={COLORS.text}
                                themeVariant="light"
                                onChange={(_, date) => { if (date) setHealthRecordForm(r => ({ ...r, date })); }}
                                style={{ height: 120, marginLeft: -10 }}
                            />
                        ) : (
                            <TouchableOpacity
                                style={[styles.input, { justifyContent: 'center' }]}
                                onPress={() => setShowHealthDatePicker(true)}
                            >
                                <Text style={{ color: theme.text, fontWeight: '600' }}>
                                    {healthRecordForm.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {showHealthDatePicker && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={healthRecordForm.date}
                                mode="date"
                                display="default"
                                onChange={(_, date) => {
                                    setShowHealthDatePicker(false);
                                    if (date) setHealthRecordForm(r => ({ ...r, date }));
                                }}
                            />
                        )}

                        <FormLabel text="Notas (opcional)" />
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                            multiline
                            value={healthRecordForm.notes}
                            onChangeText={v => setHealthRecordForm(r => ({ ...r, notes: v }))}
                            placeholder="Dosis, próxima cita, observaciones..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={saveHealthRecord}>
                            <Text style={styles.submitText}>
                                {editingHealthRecord ? 'Guardar Cambios' : 'Añadir Registro'}
                            </Text>
                        </TouchableOpacity>

                        {editingHealthRecord && (
                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: '#ffebee', marginTop: 12 }]}
                                onPress={() => deleteHealthRecord(editingHealthRecord.id)}
                            >
                                <Text style={[styles.submitText, { color: COLORS.danger }]}>
                                    Eliminar Registro
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

// Mini-componentes auxiliares de presentación.
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
// Estilos del componente principal.
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    // Vista en lista.
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

    // Vista de detalle.
    scrollDetail: { paddingBottom: 30 },

    // Hero.
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

    // Tarjetas de información (pestaña perfil).
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

    // Banner del pasaporte.
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

    // Pestaña de paseos.
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

    // Pestaña de salud.
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

    // Modal de formulario.
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

// Estilos del asistente de creación de mascota.
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
    // Paso de foto.
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
    // Campo de texto.
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
    // Especie.
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
    // Género.
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
    // Fila de switch.
    switchRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', width: '100%', marginTop: 18,
    },
    togglePill: {
        paddingHorizontal: 18, paddingVertical: 10,
        borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // Barra inferior.
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