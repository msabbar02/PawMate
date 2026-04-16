import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Search, Edit2, Trash2, X, Cat, Dog, Bird, FileText, Eye, AlertCircle } from 'lucide-react';
import './UsersPage.css'; // Inheriting shared table styles

export default function PetsPage() {
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [speciesFilter, setSpeciesFilter] = useState('all');
    
    // Modal state
    const [selectedPet, setSelectedPet] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', breed: '', weight: '', gender: '' });
    const [ownerName, setOwnerName] = useState('');

    useEffect(() => {
        fetchPets();
    }, []);

    const fetchPets = async () => {
        setLoading(true);
        try {
            const { data: petsList } = await supabase.from('pets').select('*');
            
            // Fetch owner names for all pets concurrently
            if (petsList) {
                const petsData = await Promise.all(petsList.map(async (pet) => {
                    let owner = 'Desconocido';
                    if (pet.ownerId) {
                        try {
                            const { data: userDoc } = await supabase.from('users').select('*').eq('id', pet.ownerId).single();
                            if (userDoc) {
                                owner = userDoc.fullName || userDoc.email || 'Usuario';
                            }
                        } catch (e) {
                            console.warn("Could not fetch owner", e);
                        }
                    }
                    return { ...pet, ownerName: owner };
                }));
                setPets(petsData);
            }
        } catch (error) {
            console.error("Error fetching pets:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePet = async (petId) => {
        if (window.confirm('¿Seguro que deseas eliminar esta mascota?')) {
            try {
                await supabase.from('pets').delete().eq('id', petId);
                setPets(pets.filter(p => p.id !== petId));
            } catch (error) {
                alert("Error al eliminar la mascota");
            }
        }
    };

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

    const openViewModal = (pet) => {
        setSelectedPet(pet);
        setOwnerName(pet.ownerName);
        setIsViewModalOpen(true);
    };

    const closeViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedPet(null);
    };

    const handleSaveEdit = async () => {
        try {
            await supabase.from('pets').update(editForm).eq('id', selectedPet.id);
            setPets(pets.map(p => p.id === selectedPet.id ? { ...p, ...editForm } : p));
            setIsEditModalOpen(false);
        } catch (error) {
            alert("Error al actualizar mascota");
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
                <h1 className="page-title">Gestión de Mascotas</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre de mascota o dueño..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="filter-select" 
                    value={speciesFilter} 
                    onChange={(e) => setSpeciesFilter(e.target.value)}
                >
                    <option value="all">Todas las especies</option>
                    <option value="dog">Perros</option>
                    <option value="cat">Gatos</option>
                    <option value="other">Otros</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando mascotas...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Mascota</th>
                                <th>Dueño</th>
                                <th>Especie / Raza</th>
                                <th>Detalles</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPets.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">No se encontraron mascotas</td>
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
                                                        <Dog size={20} color="white" />
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
                                                <span style={{ textTransform: 'capitalize' }}>{pet.species || 'Desconocido'}</span>
                                                <span className="text-muted">{pet.breed || 'Sin raza especificada'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span>{pet.weight ? `${pet.weight} kg` : '-'} · {pet.gender || '-'}</span>
                                                <span className="text-muted">{pet.birthdate || 'Edad desconocida'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn view" onClick={() => openViewModal(pet)} title="Ver detalles" style={{ color: '#3b82f6' }}>
                                                    <Eye size={18} />
                                                </button>
                                                <button className="action-btn edit" onClick={() => openEditModal(pet)} title="Editar mascota">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button className="action-btn delete" onClick={() => handleDeletePet(pet.id)} title="Eliminar mascota">
                                                    <Trash2 size={18} />
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
                            <h2>Editar Mascota</h2>
                            <button className="close-btn" onClick={() => setIsEditModalOpen(false)}><X size={24} /></button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="user-profile-preview">
                                {selectedPet.image ? (
                                    <img src={selectedPet.image} alt="pet" className="preview-avatar" />
                                ) : (
                                    <div className="preview-avatar-placeholder" style={{ backgroundColor: '#10b981' }}>
                                        <Dog size={24} color="white" />
                                    </div>
                                )}
                                <div>
                                    <h3>{selectedPet.name}</h3>
                                    <p className="text-muted">Dueño: {ownerName}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Nombre</label>
                                <input 
                                    className="form-control"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Raza</label>
                                <input 
                                    className="form-control"
                                    value={editForm.breed}
                                    onChange={(e) => setEditForm({...editForm, breed: e.target.value})}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Peso (kg)</label>
                                    <input 
                                        type="number"
                                        className="form-control"
                                        value={editForm.weight}
                                        onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Género</label>
                                    <select 
                                        className="form-control"
                                        value={editForm.gender}
                                        onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="Macho">Macho</option>
                                        <option value="Hembra">Hembra</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveEdit}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedPet && (
                <div className="modal-overlay" onClick={closeViewModal}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>Perfil Detallado de Mascota</h2>
                            <button className="close-btn" onClick={closeViewModal}><X size={24} /></button>
                        </div>
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            
                            <div className="premium-profile-header">
                                {selectedPet.image ? (
                                    <img src={selectedPet.image} alt="pet" className="premium-avatar" />
                                ) : (
                                    <div className="premium-avatar-placeholder" style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
                                        <Dog size={36} color="white" />
                                    </div>
                                )}
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{selectedPet.name}</h3>
                                    <p className="premium-profile-subtitle">Dueño: <span style={{color: 'white', fontWeight: '500'}}>{ownerName}</span></p>
                                </div>
                                <div className="premium-top-right-badge">
                                    <span style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '14px', fontWeight: 'bold', textTransform: 'capitalize', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                        {selectedPet.species || 'Mascota'}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '10px'}}>
                                <FileText size={20} color="#8b5cf6"/> Detalles Generales
                            </h3>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">ID Mascota</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedPet.id}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">ID Dueño</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedPet.ownerId || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Raza</span>
                                    <span className="premium-detail-value">{selectedPet.breed || 'No especificada'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Género</span>
                                    <span className="premium-detail-value">{selectedPet.gender || 'No especificado'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Peso</span>
                                    <span className="premium-detail-value">{selectedPet.weight ? `${selectedPet.weight} kg` : 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Edad / Nacimiento</span>
                                    <span className="premium-detail-value">{selectedPet.birthdate || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '20px'}}>
                                <AlertCircle size={20} color="#ef4444"/> Información Médica y Notas
                            </h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px', transition: 'background 0.2s' }}>
                                    <span style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: '#fca5a5', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.5px' }}>Condiciones Médicas</span>
                                    <span style={{ color: 'white', fontSize: '15px' }}>{selectedPet.medicalConditions || 'Ninguna condición reportada.'}</span>
                                </div>
                                <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px', padding: '16px', transition: 'background 0.2s' }}>
                                    <span style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: '#c4b5fd', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.5px' }}>Notas Adicionales / Descripción</span>
                                    <span style={{ color: 'white', fontSize: '15px' }}>{selectedPet.notes || selectedPet.description || 'Sin información adicional provista por el dueño.'}</span>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
