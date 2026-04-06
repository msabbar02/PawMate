import React, { useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { COLORS } from '../constants/colors';

export default function MessagesScreen({ navigation }) {
    const { theme } = useContext(ThemeContext);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Mensajes</Text>
            </View>

            <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textLight} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tienes mensajes recientes</Text>
                <Text style={[styles.emptySub, { color: COLORS.textLight }]}>Cuando contactes a un cuidador, aparecerán aquí.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    title: { fontSize: 24, fontWeight: '800' },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 18, fontWeight: '700', marginTop: 15 },
    emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
