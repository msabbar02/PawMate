import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CustomMultiSelect = ({
    label,
    options,
    selectedValues,
    onSelectionChange,
    theme,
    allowCustom = true
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [customInput, setCustomInput] = useState('');

    const toggleSelection = (item) => {
        if (selectedValues.includes(item)) {
            onSelectionChange(selectedValues.filter(val => val !== item));
        } else {
            onSelectionChange([...selectedValues, item]);
        }
    };

    const addCustom = () => {
        if (customInput.trim() && !selectedValues.includes(customInput.trim())) {
            onSelectionChange([...selectedValues, customInput.trim()]);
            setCustomInput('');
        }
    };

    const removeSelection = (item) => {
        onSelectionChange(selectedValues.filter(val => val !== item));
    };

    const styles = getStyles(theme);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>

            <View style={styles.chipsContainer}>
                {selectedValues.map((item, index) => (
                    <View key={index} style={styles.chip}>
                        <Text style={styles.chipText}>{item}</Text>
                        <TouchableOpacity onPress={() => removeSelection(item)} style={styles.chipRemove}>
                            <Ionicons name="close-circle" size={16} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setModalVisible(true)}
                >
                    <Ionicons name="add" size={18} color={theme.textSecondary} />
                    <Text style={styles.addBtnText}>Añadir</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar {label.toLowerCase()}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={options}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => {
                                const isSelected = selectedValues.includes(item);
                                return (
                                    <TouchableOpacity
                                        style={[styles.optionRow, isSelected && styles.optionSelected]}
                                        onPress={() => toggleSelection(item)}
                                    >
                                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item}</Text>
                                        {isSelected && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        {allowCustom && (
                            <View style={styles.customRow}>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder="Otro (especificar...)"
                                    placeholderTextColor={theme.textSecondary}
                                    value={customInput}
                                    onChangeText={setCustomInput}
                                />
                                <TouchableOpacity style={styles.customAddBtn} onPress={addCustom}>
                                    <Text style={styles.customAddBtnText}>Agregar</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity style={styles.doneBtn} onPress={() => setModalVisible(false)}>
                            <Text style={styles.doneBtnText}>Hecho</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        marginBottom: 15,
    },
    label: {
        color: theme.textSecondary,
        fontSize: 14,
        marginBottom: 8,
        marginLeft: 5,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 10,
        backgroundColor: theme.cardBackground,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        minHeight: 50,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primary + '20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.primary + '40',
    },
    chipText: {
        color: theme.text,
        fontSize: 13,
        fontWeight: '500',
        marginRight: 4,
    },
    chipRemove: {
        padding: 2,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
        borderStyle: 'dashed',
    },
    addBtnText: {
        color: theme.textSecondary,
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: theme.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    optionSelected: {
        backgroundColor: theme.primary + '11',
        paddingHorizontal: 10,
        borderRadius: 8,
        borderBottomWidth: 0,
        marginBottom: 5,
    },
    optionText: {
        fontSize: 16,
        color: theme.text,
    },
    optionTextSelected: {
        color: theme.primary,
        fontWeight: 'bold',
    },
    customRow: {
        flexDirection: 'row',
        marginTop: 15,
        gap: 10,
    },
    customInput: {
        flex: 1,
        backgroundColor: theme.cardBackground,
        color: theme.text,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    customAddBtn: {
        backgroundColor: theme.primary,
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    customAddBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    doneBtn: {
        backgroundColor: theme.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    doneBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default CustomMultiSelect;
