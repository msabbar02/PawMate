/**
 * Página de gestión de mascotas.
 *
 * Lista hasta 500 mascotas, resuelve los nombres de los dueños con una
 * única consulta `IN`, permite filtrar por especie y buscar por nombre
 * de mascota o dueño, y abre modales de visualización y edición con
 * persistencia directa a Supabase.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faPenToSquare, faTrash, faXmark, faDog, faFileLines, faEye, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import './UsersPage.css'; // Hereda los estilos de tabla compartidos.

export default function PetsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [speciesFilter, setSpeciesFilter] = useState('all');
    
    // Estado del modal.
    const [selectedPet, setSelectedPet] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', breed: '', weight: '', gender: '' });
    const [ownerName, setOwnerName] = useState('');

    useEffect(() => {
        fetchPets();
    }, []);

    // Refresco automático cada 10 s.
    useAutoRefresh(() => fetchPets({ silent: true }), 10000);

    /**
     * Carga las mascotas y resuelve el nombre de cada dueño en una
     * única consulta `IN` para evitar N+1.
     *
     * @param {{silent?: boolean}} [opts]
     */
    const fetchPets = async (opts = {}) => {
        if (!opts.silent) setLoading(true);
        try {
            const { data: petsList } = await supabase.from('pets').select('*').limit(500);
            
            if (petsList && petsList.length > 0) {
                // Carga en lote los nombres de dueños únicos en una sola consulta.
                const ownerIds = [...new Set(petsList.map(p => p.ownerId).filter(Boolean))];
                let ownerMap = {};
                if (ownerIds.length > 0) {
                    const { data: owners } = await supabase
                        .from('users')
                        .select('id, fullName, email')
                        .in('id', ownerIds);
                    if (owners) {
                        owners.forEach(o => { ownerMap[o.id] = o.fullName || o.email || t('pets.ownerUserFallback'); });
                    }
                }
                const petsData = petsList.map(pet => ({
                    ...pet,
                    ownerName: ownerMap[pet.ownerId] || t('pets.ownerUnknown'),
                }));
                setPets(petsData);
            } else {
                setPets(petsList || []);
            }
        } catch (error) {
            console.error("Error fetching pets:", error);
        } finally {
            setLoading(false);
        }
    };

    /** Borra una mascota previa confirmación del usuario. */
    const handleDeletePet = async (petId) => {
        if (window.confirm(t('pets.confirmDelete'))) {
            try {
                const { error } = await supabase.from('pets').delete().eq('id', petId);
                if (error) throw error;
                setPets(prev => prev.filter(p => p.id !== petId));
            } catch (error) {
                alert(t('pets.errorDelete'));
            }
        }
    };

    /** Abre el modal de edición con los valores actuales de la mascota. */
    const openEditModal = (pet) => {
        setSelectedPet(pet);
        setOwnerName(pet.ownerName);
        setEditForm({
            name: pet.name || '',
            breed: pet.breed || '',
            weight: pet.weight || '',
            gender: pet.gender || ''
        });
        setIsEditModalOpen(true);
    };

    /** Abre el modal de visualización. */
    const openViewModal = (pet) => {
        setSelectedPet(pet);
        setOwnerName(pet.ownerName);
        setIsViewModalOpen(true);
    };

    /** Cierra el modal de visualización y limpia la selección. */
    const closeViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedPet(null);
    };

    /** Persiste los cambios del modal de edición contra Supabase. */
    const handleSaveEdit = async () => {
        try {
            const { error } = await supabase.from('pets').update(editForm).eq('id', selectedPet.id);
            if (error) throw error;
            setPets(prev => prev.map(p => p.id === selectedPet.id ? { ...p, ...editForm } : p));
            setIsEditModalOpen(false);
        } catch (error) {
            alert(t('pets.errorUpdate'));
        }
    };

    const filteredPets = pets.filter(pet => {
        const matchesSearch = (pet.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (pet.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const sp = (pet.species || '').toLowerCase();
        let matchesSpecies = true;
        if (speciesFilter === 'dog') matchesSpecies = sp === 'perro' || sp === 'dog';
        else if (speciesFilter === 'cat') matchesSpecies = sp === 'gato' || sp === 'cat';
        else if (speciesFilter === 'other') matchesSpecies = sp !== 'perro' && sp !== 'dog' && sp !== 'gato' && sp !== 'cat';
        
        return matchesSearch && (speciesFilter === 'all' || matchesSpecies);
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{t('pets.pageTitle')}</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 18 }} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={t('pets.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="filter-select" 
                    value={speciesFilter} 
                    onChange={(e) => setSpeciesFilter(e.target.value)}
                >
                    <option value="all">{t('pets.allSpecies')}</option>
                    <option value="dog">{t('pets.dogs')}</option>
                    <option value="cat">{t('pets.cats')}</option>
                    <option value="other">{t('pets.others')}</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>{t('pets.loading')}</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('pets.colPet')}</th>
                                <th>{t('pets.colOwner')}</th>
                                <th>{t('pets.colSpeciesBreed')}</th>
                                <th>{t('pets.colDetails')}</th>
                                <th>{t('pets.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPets.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">{t('pets.noPetsFound')}</td>
                                </tr>
                            ) : (
                                filteredPets.map(pet => (
                                    <tr key={pet.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar" style={{ backgroundColor: 'var(--primary-color)' }}>
                                                    {pet.image ? (
                                                        <img src={pet.image} alt="pet" />
                                                    ) : (
                                                        <FontAwesomeIcon icon={faDog} style={{ fontSize: 20, color: 'white' }} />
                                                    )}
                                                </div>
                                                <div className="user-info">
                                                    <span className="user-name">{pet.name}</span>
                                                    <span className="user-id">ID: {pet.id.substring(0,8)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{pet.ownerName}</span>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span style={{ textTransform: 'capitalize' }}>{pet.species || t('pets.unknownSpecies')}</span>
                                                <span className="text-muted">{pet.breed || t('pets.noBreedSpecified')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span>{pet.weight ? `${pet.weight} kg` : '-'} · {pet.gender || '-'}</span>
                                                <span className="text-muted">{pet.birthdate || t('pets.unknownAge')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn view" onClick={() => navigate(`/pets/${pet.id}`)} title={t('pets.viewDetails')} style={{ color: '#3b82f6' }}>
                                                    <FontAwesomeIcon icon={faEye} style={{ fontSize: 18 }} />
                                                </button>
                                                <button className="action-btn edit" onClick={() => openEditModal(pet)} title={t('pets.editPet')}>
                                                    <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 18 }} />
                                                </button>
                                                <button className="action-btn delete" onClick={() => handleDeletePet(pet.id)} title={t('pets.deletePet')}>
                                                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 18 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && selectedPet && (
                <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('pets.editModalTitle')}</h2>
                            <button className="close-btn" onClick={() => setIsEditModalOpen(false)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="user-profile-preview">
                                {selectedPet.image ? (
                                    <img src={selectedPet.image} alt="pet" className="preview-avatar" />
                                ) : (
                                    <div className="preview-avatar-placeholder" style={{ backgroundColor: '#10b981' }}>
                                        <FontAwesomeIcon icon={faDog} style={{ fontSize: 24, color: 'white' }} />
                                    </div>
                                )}
                                <div>
                                    <h3>{selectedPet.name}</h3>
                                    <p className="text-muted">{t('pets.ownerLabel')} {ownerName}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('pets.nameLabel')}</label>
                                <input 
                                    className="form-control"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>{t('pets.breedLabel')}</label>
                                <input 
                                    className="form-control"
                                    value={editForm.breed}
                                    onChange={(e) => setEditForm({...editForm, breed: e.target.value})}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>{t('pets.weightLabel')}</label>
                                    <input 
                                        type="number"
                                        className="form-control"
                                        value={editForm.weight}
                                        onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>{t('pets.genderLabel')}</label>
                                    <select 
                                        className="form-control"
                                        value={editForm.gender}
                                        onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                                    >
                                        <option value="">{t('pets.selectOption')}</option>
                                        <option value="Macho">{t('pets.male')}</option>
                                        <option value="Hembra">{t('pets.female')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>{t('pets.cancel')}</button>
                            <button className="btn-primary" onClick={handleSaveEdit}>{t('pets.saveChanges')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedPet && (
                <div className="modal-overlay" onClick={closeViewModal}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>{t('pets.viewModalTitle')}</h2>
                            <button className="close-btn" onClick={closeViewModal}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
                        </div>
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            
                            <div className="premium-profile-header">
                                {selectedPet.image ? (
                                    <img src={selectedPet.image} alt="pet" className="premium-avatar" />
                                ) : (
                                    <div className="premium-avatar-placeholder" style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
                                        <FontAwesomeIcon icon={faDog} style={{ fontSize: 36, color: 'white' }} />
                                    </div>
                                )}
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{selectedPet.name}</h3>
                                    <p className="premium-profile-subtitle">{t('pets.ownerLabel')} <span style={{color: 'white', fontWeight: '500'}}>{ownerName}</span></p>
                                </div>
                                <div className="premium-top-right-badge">
                                    <span style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '14px', fontWeight: 'bold', textTransform: 'capitalize', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                        {selectedPet.species || t('pets.petFallback')}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '10px'}}>
                                <FontAwesomeIcon icon={faFileLines} style={{ fontSize: 20, color: '#8b5cf6' }} /> {t('pets.generalDetails')}
                            </h3>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('pets.petId')}</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedPet.id}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('pets.ownerId')}</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedPet.ownerId || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('pets.breed')}</span>
                                    <span className="premium-detail-value">{selectedPet.breed || t('pets.breedNotSpecified')}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('pets.gender')}</span>
                                    <span className="premium-detail-value">{selectedPet.gender || t('pets.genderNotSpecified')}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('pets.weight')}</span>
                                    <span className="premium-detail-value">{selectedPet.weight ? `${selectedPet.weight} kg` : 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('pets.ageBirth')}</span>
                                    <span className="premium-detail-value">{selectedPet.birthdate || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '20px'}}>
                                <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 20, color: '#ef4444' }} /> {t('pets.medicalInfoTitle')}
                            </h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px', transition: 'background 0.2s' }}>
                                    <span style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: '#fca5a5', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.5px' }}>{t('pets.medicalConditions')}</span>
                                    <span style={{ color: 'white', fontSize: '15px' }}>{selectedPet.medicalConditions || t('pets.noMedicalConditions')}</span>
                                </div>
                                <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px', padding: '16px', transition: 'background 0.2s' }}>
                                    <span style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: '#c4b5fd', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.5px' }}>{t('pets.additionalNotes')}</span>
                                    <span style={{ color: 'white', fontSize: '15px' }}>{selectedPet.notes || selectedPet.description || t('pets.noAdditionalInfo')}</span>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
