import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

const MOCK_GROUPS = [
    { id: 'golden_club', name: 'Club Golden Retriever', type: 'Privado', members: 120, isMember: true },
    { id: 'madrid_paseos', name: 'Paseos Madrid Centro', type: 'Público', members: 450, isMember: false },
    { id: 'gatos_locos', name: 'Amantes de Gatos', type: 'Público', members: 320, isMember: false },
    { id: 'entrenamiento_pro', name: 'Entrenamiento Avanzado', type: 'Privado', members: 50, isMember: false },
];

const SearchGroupsScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);

    const [searchQuery, setSearchQuery] = useState('');
    const [groups, setGroups] = useState(MOCK_GROUPS);

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleJoin = (group) => {
        if (group.type === 'Privado') {
            console.log('Solicitud enviada a', group.name);
            // Simulate changing state to "Pending"
        } else {
            console.log('Unido a', group.name);
            // Simulate changing state to "Joined"
        }
    };

    const renderGroup = ({ item }) => (
        <TouchableOpacity
            style={styles.groupCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GroupDetails', { groupId: item.id })}
        >
            <View style={styles.groupInfo}>
                <View style={styles.avatarPlaceholder}>
                    <Ionicons name={item.type === 'Privado' ? "lock-closed" : "people"} size={24} color="#FFF" />
                </View>
                <View style={styles.textData}>
                    <Text style={styles.groupName}>{item.name}</Text>
                    <Text style={styles.groupMeta}>
                        {item.type} • {item.members} miembros
                    </Text>
                </View>
            </View>

            {item.isMember ? (
                <TouchableOpacity style={[styles.joinButton, styles.memberButton]}>
                    <Text style={styles.memberButtonText}>Miembro</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[styles.joinButton, item.type === 'Privado' && styles.requestButton]}
                    onPress={() => handleJoin(item)}
                >
                    <Text style={[styles.joinButtonText, item.type === 'Privado' && { color: theme.primary }]}>
                        {item.type === 'Privado' ? 'Solicitar' : 'Unirme'}
                    </Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Buscar Grupos</Text>
                <TouchableOpacity onPress={() => console.log('Crear Grupo')} style={styles.createBtn}>
                    <Ionicons name="add" size={24} color={theme.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Encuentra un grupo para tu mascota..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredGroups}
                keyExtractor={item => item.id}
                renderItem={renderGroup}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center' }}>No hay resultados.</Text>}
            />
        </SafeAreaView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.text,
    },
    createBtn: {
        padding: 5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        margin: 15,
        paddingHorizontal: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 10,
        color: theme.text,
        fontSize: 16,
    },
    listContainer: {
        paddingHorizontal: 15,
        paddingBottom: 20,
    },
    groupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.cardBackground,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    groupInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    textData: {
        flex: 1,
    },
    groupName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 2,
    },
    groupMeta: {
        fontSize: 13,
        color: theme.textSecondary,
    },
    joinButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    joinButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    requestButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.primary,
    },
    memberButton: {
        backgroundColor: theme.border,
    },
    memberButtonText: {
        color: theme.textSecondary,
        fontWeight: 'bold',
    }
});

export default SearchGroupsScreen;
