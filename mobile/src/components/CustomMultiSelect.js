import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import Icon from './Icon';
import { useTranslation } from '../context/LanguageContext';

/**
 * Selector múltiple con chips y modal. Permite escoger varias opciones de
 * una lista predefinida y, opcionalmente, añadir entradas personalizadas.
 *
 * @param {object}   props
 * @param {string}   props.label             Etiqueta visible encima del campo.
 * @param {string[]} props.options           Lista de opciones disponibles.
 * @param {string[]} props.selectedValues    Valores actualmente seleccionados.
 * @param {Function} props.onSelectionChange Callback `(nuevos) => void`.
 * @param {object}   props.theme             Tema activo de la app.
 * @param {boolean}  [props.allowCustom]     Permite añadir entradas libres.
 */
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
    const { t } = useTranslation();

    /**
     * Añade o quita un ítem del array de seleccionados.
     */
    const toggleSelection = (item) => {
        if (selectedValues.includes(item)) {
            onSelectionChange(selectedValues.filter(val => val !== item));
        } else {
            onSelectionChange([...selectedValues, item]);
        }
    };

    /**
     * Añade el texto introducido como nueva opción personalizada.
     */
    const addCustom = () => {
        if (customInput.trim() && !selectedValues.includes(customInput.trim())) {
            onSelectionChange([...selectedValues, customInput.trim()]);
            setCustomInput('');
        }
    };

    /**
     * Elimina un chip de la selección.
     */
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
                            <Icon name="close-circle" size={16} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setModalVisible(true)}
                >
                    <Icon name="add" size={18} color={theme.textSecondary} />
                    <Text style={styles.addBtnText}>{t('components.addBtn')}</Text>
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
                            <Text style={styles.modalTitle}>{t('components.selectLabel', { label: label.toLowerCase() })}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={theme.text} />
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
                                        {isSelected && <Icon name="checkmark" size={20} color={theme.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        {allowCustom && (
                            <View style={styles.customRow}>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder={t('components.otherSpecify')}
                                    placeholderTextColor={theme.textSecondary}
                                    value={customInput}
                                    onChangeText={setCustomInput}
                                />
                                <TouchableOpacity style={styles.customAddBtn} onPress={addCustom}>
                                    <Text style={styles.customAddBtnText}>{t('components.addCustom')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity style={styles.doneBtn} onPress={() => setModalVisible(false)}>
                            <Text style={styles.doneBtnText}>{t('components.done')}</Text>
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
