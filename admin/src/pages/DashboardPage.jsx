/**
 * Página del panel principal del administrador.
 *
 * Carga en paralelo usuarios, mascotas, reservas y reportes; permite
 * filtrar por ventana temporal (1h/24h/7d/30d/all/personalizada) y por
 * roles, especies, estados, tipos de servicio y verificación. Calcula
 * KPIs (totales, deltas, tendencia vs período anterior, conversión,
 * cancelaciones, ticket medio, ingresos), construye series temporales
 * y un mapa de calor de actividad, y muestra un feed unificado de
 * eventos. Se suscribe a Realtime para refrescos automáticos con
 * debounce y se reactiva tras `pawmate:wake`.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers, faDog, faCalendarDays, faTriangleExclamation, faWifi,
    faArrowTrendUp, faArrowTrendDown, faMinus, faShieldHalved, faBan,
    faMagnifyingGlass, faDownload, faTrophy, faCircleExclamation,
    faFilter, faXmark, faCalendarPlus,
} from '@fortawesome/free-solid-svg-icons';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    PieChart, Pie, Cell, Bar,
    ComposedChart,
} from 'recharts';
import './DashboardPage.css';

// Opciones de ventana temporal (en milisegundos).
const WINDOWS = [
    { key: '1h',  ms: 60 * 60 * 1000 },
    { key: '24h', ms: 24 * 60 * 60 * 1000 },
    { key: '7d',  ms: 7  * 24 * 60 * 60 * 1000 },
    { key: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
    { key: 'all', ms: Number.POSITIVE_INFINITY },
];

const SPECIES_COLORS = {
    dog: '#3b82f6', perro: '#3b82f6',
    cat: '#a855f7', gato: '#a855f7',
    bird: '#f59e0b', ave: '#f59e0b', pajaro: '#f59e0b',
    rabbit: '#10b981', conejo: '#10b981',
    other: '#64748b', otro: '#64748b',
};
const ROLE_COLORS = {
    normal: '#64748b', owner: '#3b82f6',
    caregiver: '#10b981', admin: '#a855f7',
};
const STATUS_COLORS = {
    pendiente: '#f59e0b', aceptada: '#10b981', activa: '#06b6d4',
    in_progress: '#06b6d4', completada: '#3b82f6', cancelada: '#94a3b8',
    rechazada: '#ef4444',
};

/**
 * Devuelve `true` si la fecha ISO cae dentro de la ventana definida por
 * `sinceMs` (timestamp inferior). `Number.POSITIVE_INFINITY` significa
 * "sin límite" (toda la historia).
 *
 * @param {string|null|undefined} iso     Fecha ISO 8601.
 * @param {number}                sinceMs Marca temporal mínima en ms.
 * @returns {boolean}
 */
const inWindow = (iso, sinceMs) => {
    if (!iso) return false;
    if (!Number.isFinite(sinceMs)) return true;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= sinceMs;
};

/**
 * Normaliza una fecha al inicio de su día local (00:00:00.000).
 * @param {Date|string|number} d
 * @returns {Date}
 */
const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

/**
 * Construye buckets diarios de los últimos `days` días con conteos de
 * usuarios, reservas y mascotas según su `created_at`.
 *
 * @param {number}   days         Número de días hacia atrás.
 * @param {Object[]} users        Usuarios.
 * @param {Object[]} reservations Reservas.
 * @param {Object[]} pets         Mascotas.
 * @returns {Array<{date:string,label:string,users:number,reservations:number,pets:number}>}
 */
const buildDailySeries = (days, users, reservations, pets) => {
    const today = startOfDay(new Date());
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        buckets.push({
            date: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            users: 0, reservations: 0, pets: 0,
        });
    }
    const indexFor = (iso) => {
        if (!iso) return -1;
        const t = startOfDay(new Date(iso)).getTime();
        const first = new Date(buckets[0].date).getTime();
        const idx = Math.round((t - first) / (24 * 3600 * 1000));
        return (idx >= 0 && idx < buckets.length) ? idx : -1;
    };
    users.forEach(u => { const i = indexFor(u.created_at); if (i >= 0) buckets[i].users++; });
    reservations.forEach(r => { const i = indexFor(r.created_at); if (i >= 0) buckets[i].reservations++; });
    pets.forEach(p => { const i = indexFor(p.created_at); if (i >= 0) buckets[i].pets++; });
    return buckets;
};

/**
 * Agrupa una colección por una propiedad y devuelve `{name, value}`.
 * @param {Object[]} arr
 * @param {string}   key
 * @returns {Array<{name:string,value:number}>}
 */
const groupBy = (arr, key) => {
    const out = {};
    arr.forEach(it => {
        const k = (it[key] || 'unknown').toString().toLowerCase();
        out[k] = (out[k] || 0) + 1;
    });
    return Object.entries(out).map(([name, value]) => ({ name, value }));
};

/**
 * Construye una serie de N días para una sparkline contando creaciones.
 * @param {Object[]} items
 * @param {number}   [days=14]
 * @returns {Array<{v:number,t:number}>}
 */
const sparkSeries = (items, days = 14) => {
    const today = startOfDay(new Date());
    const arr = Array.from({ length: days }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (days - 1 - i));
        return { v: 0, t: d.getTime() };
    });
    items.forEach(it => {
        if (!it.created_at) return;
        const t = startOfDay(new Date(it.created_at)).getTime();
        const idx = Math.round((t - arr[0].t) / (24 * 3600 * 1000));
        if (idx >= 0 && idx < arr.length) arr[idx].v++;
    });
    return arr;
};

/**
 * Tarjeta de KPI reutilizable: muestra total, delta en ventana, %
 * sobre el total, sparkline opcional y tendencia vs período anterior.
 */
function StatCard({ icon, color, bg, title, total, inWindowCount, prevWindowCount, windowKey, sparkline, onClick }) {
    const { t } = useTranslation();
    const pct = total > 0 ? Math.round((inWindowCount / total) * 100) : 0;
    // Tendencia respecto al período anterior.
    let trendPct = null;
    if (prevWindowCount != null) {
        if (prevWindowCount === 0 && inWindowCount > 0) trendPct = 100;
        else if (prevWindowCount === 0) trendPct = 0;
        else trendPct = Math.round(((inWindowCount - prevWindowCount) / prevWindowCount) * 100);
    }
    const isUp = trendPct != null && trendPct > 0;
    const isDown = trendPct != null && trendPct < 0;
    const trendIcon = isUp ? faArrowTrendUp : isDown ? faArrowTrendDown : faMinus;
    const trendColor = isUp ? '#10b981' : isDown ? '#ef4444' : '#94a3b8';
    return (
        <div className="stat-card glass-panel" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            <div className="stat-card-top">
                <div className="stat-icon-wrapper" style={{ backgroundColor: bg, color }}>
                    <FontAwesomeIcon icon={icon} style={{ fontSize: 22 }} />
                </div>
                {sparkline && sparkline.length > 0 && (
                    <div className="stat-spark">
                        <ResponsiveContainer width="100%" height={36}>
                            <AreaChart data={sparkline} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.18} strokeWidth={1.6} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
            <div className="stat-info">
                <h3>{title}</h3>
                <p className="stat-value">{total.toLocaleString()}</p>
                <div className="stat-delta">
                    <FontAwesomeIcon icon={faArrowTrendUp} style={{ fontSize: 11, color: inWindowCount > 0 ? '#10b981' : '#94a3b8' }} />
                    <span style={{ color: inWindowCount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        +{inWindowCount}
                    </span>
                    <span className="stat-delta-meta">{t('dashboard.deltaInWindow', { key: windowKey, pct })}</span>
                </div>
                {trendPct != null && (
                    <div className="stat-trend" style={{ color: trendColor }}>
                        <FontAwesomeIcon icon={trendIcon} style={{ fontSize: 10 }} />
                        <span>{trendPct > 0 ? '+' : ''}{trendPct}%</span>
                        <span className="stat-trend-meta">{t('dashboard.vsPrev')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Grupo de chips de filtro multi-selección. Pulsar `all` resetea el
 * grupo; pulsar otro chip lo añade/quita y desactiva `all`.
 */
function FilterGroup({ label, options, selected, onChange }) {
    const toggle = (v) => {
        const next = new Set(selected);
        if (v === 'all') {
            onChange(new Set(['all']));
            return;
        }
        next.delete('all');
        if (next.has(v)) next.delete(v); else next.add(v);
        if (next.size === 0) next.add('all');
        onChange(next);
    };
    return (
        <div className="subfilter-group">
            <span className="subfilter-label">{label}</span>
            <div className="subfilter-chips">
                {options.map(o => (
                    <button key={o.v}
                        className={`chip-sm ${selected.has(o.v) ? 'chip-active' : ''}`}
                        onClick={() => toggle(o.v)}>
                        {o.l}
                    </button>
                ))}
            </div>
        </div>
    );
}

/**
 * Tarjeta con ranking de mejores cuidadores/dueños y barras de ingresos.
 */
function TopPerformersCard({ caregivers, owners, onSelect }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('caregivers');
    const list = tab === 'caregivers' ? caregivers : owners;
    const max = Math.max(1, ...list.map(x => x.revenue || 0));
    const accent = tab === 'caregivers' ? '#f59e0b' : '#3b82f6';
    return (
        <div className="chart-card glass-panel">
            <div className="chart-header">
                <div>
                    <h3>
                        <FontAwesomeIcon icon={faTrophy} style={{ color: accent, marginRight: 8 }} />
                        {tab === 'caregivers' ? t('dashboard.topCaregivers') : t('dashboard.topOwners')}
                    </h3>
                    <span className="chart-sub">{t('dashboard.topPerformersSub')}</span>
                </div>
                <div className="top-tabs">
                    <button className={`top-tab ${tab === 'caregivers' ? 'active' : ''}`} onClick={() => setTab('caregivers')}>
                        {t('dashboard.topCaregivers')}
                    </button>
                    <button className={`top-tab ${tab === 'owners' ? 'active' : ''}`} onClick={() => setTab('owners')}>
                        {t('dashboard.topOwners')}
                    </button>
                </div>
            </div>
            {list.length === 0 ? (
                <div className="empty-chart">{t('dashboard.noData')}</div>
            ) : (
                <div className="top-list top-list-bars">
                    {list.map((it, i) => {
                        const pct = ((it.revenue || 0) / max) * 100;
                        return (
                            <div key={it.id} className="top-row top-row-bar" onClick={() => onSelect(it.id)}>
                                <span className={`top-rank top-rank-${i+1}`}>{i+1}</span>
                                <div className="top-bar-wrap">
                                    <div className="top-bar-row">
                                        <span className="top-name">{it.name}</span>
                                        <span className="top-meta">€{(it.revenue || 0).toFixed(0)} · {it.count}</span>
                                    </div>
                                    <div className="top-bar-track">
                                        <div className="top-bar-fill" style={{ width: `${pct}%`, background: accent }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [windowKey, setWindowKey] = useState('24h');
    const [customRange, setCustomRange] = useState({ from: '', to: '' }); // YYYY-MM-DD
    const [userRoleFilter, setUserRoleFilter] = useState(new Set(['all']));
    const [petSpeciesFilter, setPetSpeciesFilter] = useState(new Set(['all']));
    const [resStatusFilter, setResStatusFilter] = useState(new Set(['all']));
    const [serviceTypeFilter, setServiceTypeFilter] = useState(new Set(['all']));
    const [verifFilter, setVerifFilter] = useState(new Set(['all']));
    const [activitySearch, setActivitySearch] = useState('');
    const [activityTypeFilter, setActivityTypeFilter] = useState('all'); // all|user|pet|reservation|report
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'users' | 'pets' | 'reservations'

    const [users, setUsers] = useState([]);
    const [pets, setPets] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    /**
     * Carga en paralelo las cuatro colecciones del panel.
     * @param {{silent?: boolean}} [opts]
     */
    const fetchAll = useCallback(async (opts = {}) => {
        if (opts.silent) setRefreshing(true);
        try {
            const [u, p, r, rep] = await Promise.all([
                supabase.from('users').select('id, role, created_at, "isOnline", "fullName", "firstName", email, "verificationStatus", is_banned'),
                supabase.from('pets').select('id, name, species, created_at, "ownerId"'),
                supabase.from('reservations').select('id, status, "serviceType", created_at, "ownerId", "caregiverId", "ownerName", "caregiverName", "totalPrice"'),
                supabase.from('reports').select('id, status, created_at'),
            ]);
            if (!u.error) setUsers(u.data || []);
            if (!p.error) setPets(p.data || []);
            if (!r.error) setReservations(r.data || []);
            if (!rep.error) setReports(rep.data || []);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();

        // Recarga automática en tiempo real (con debounce).
        let debounceTimer = null;
        const debouncedFetch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchAll({ silent: true }), 1500);
        };
        const channels = ['users', 'pets', 'reservations', 'reports'].map(table =>
            supabase
                .channel(`admin:dash:${table}`)
                .on('postgres_changes', { event: '*', schema: 'public', table }, debouncedFetch)
                .subscribe()
        );

        // Recarga al volver al foco tras estar inactivo.
        const onWake = () => fetchAll({ silent: true });
        window.addEventListener('pawmate:wake', onWake);

        return () => {
            clearTimeout(debounceTimer);
            channels.forEach(ch => supabase.removeChannel(ch));
            window.removeEventListener('pawmate:wake', onWake);
        };
    }, [fetchAll]);

    // Datos derivados del estado principal.
    const usingCustomRange = !!(customRange.from && customRange.to);

    const sinceMs = useMemo(() => {
        if (usingCustomRange) return new Date(customRange.from + 'T00:00:00').getTime();
        const w = WINDOWS.find(x => x.key === windowKey) || WINDOWS[1];
        return Number.isFinite(w.ms) ? Date.now() - w.ms : -Infinity;
    }, [windowKey, customRange, usingCustomRange]);

    const untilMs = useMemo(() => {
        if (usingCustomRange) return new Date(customRange.to + 'T23:59:59').getTime();
        return Date.now();
    }, [customRange, usingCustomRange]);

    /** Filtro de rango temporal cerrado [sinceMs, untilMs]. */
    const inRange = (iso) => {
        if (!iso) return false;
        if (!Number.isFinite(sinceMs)) return true;
        const t = new Date(iso).getTime();
        return Number.isFinite(t) && t >= sinceMs && t <= untilMs;
    };

    // Límites del período anterior para comparación de tendencias.
    const prevWindow = useMemo(() => {
        if (usingCustomRange) {
            const span = untilMs - sinceMs;
            return { from: sinceMs - span, to: sinceMs };
        }
        const w = WINDOWS.find(x => x.key === windowKey) || WINDOWS[1];
        if (!Number.isFinite(w.ms)) return null;
        return { from: Date.now() - 2 * w.ms, to: Date.now() - w.ms };
    }, [windowKey, usingCustomRange, sinceMs, untilMs]);
    /** True si la fecha cae en el período anterior (para tendencias). */
    const inPrev = (iso) => {
        if (!prevWindow || !iso) return false;
        const t = new Date(iso).getTime();
        return t >= prevWindow.from && t < prevWindow.to;
    };

    /** Comprueba si un valor pasa por un Set con semántica `all` = todos. */
    const matchSet = (set, value) => set.has('all') || set.has(value);

    const filteredUsers = useMemo(() => (
        userRoleFilter.has('all') ? users : users.filter(u => matchSet(userRoleFilter, u.role || 'normal'))
    ), [users, userRoleFilter]);

    const filteredPets = useMemo(() => (
        petSpeciesFilter.has('all')
            ? pets
            : pets.filter(p => matchSet(petSpeciesFilter, (p.species || '').toLowerCase()))
    ), [pets, petSpeciesFilter]);

    const filteredReservations = useMemo(() => (
        reservations.filter(r =>
            matchSet(resStatusFilter, r.status || 'pendiente') &&
            matchSet(serviceTypeFilter, r.serviceType || 'unknown')
        )
    ), [reservations, resStatusFilter, serviceTypeFilter]);

    const filteredVerifUsers = useMemo(() => (
        verifFilter.has('all') ? filteredUsers
            : filteredUsers.filter(u => matchSet(verifFilter, u.verificationStatus || 'unverified'))
    ), [filteredUsers, verifFilter]);

    const usersInWindow = useMemo(() => filteredVerifUsers.filter(u => inRange(u.created_at)), [filteredVerifUsers, sinceMs, untilMs]); // eslint-disable-line
    const petsInWindow = useMemo(() => filteredPets.filter(p => inRange(p.created_at)), [filteredPets, sinceMs, untilMs]); // eslint-disable-line
    const reservationsInWindow = useMemo(() => filteredReservations.filter(r => inRange(r.created_at)), [filteredReservations, sinceMs, untilMs]); // eslint-disable-line
    const reportsInWindow = useMemo(() => reports.filter(r => inRange(r.created_at)), [reports, sinceMs, untilMs]); // eslint-disable-line
    const onlineCaregivers = useMemo(() => users.filter(u => u.role === 'caregiver' && u.isOnline).length, [users]);

    // Conteos del período anterior (para el % de tendencia).
    const prevUsers = useMemo(() => prevWindow ? filteredVerifUsers.filter(u => inPrev(u.created_at)).length : null, [prevWindow, filteredVerifUsers]); // eslint-disable-line
    const prevPets = useMemo(() => prevWindow ? filteredPets.filter(p => inPrev(p.created_at)).length : null, [prevWindow, filteredPets]); // eslint-disable-line
    const prevReservations = useMemo(() => prevWindow ? filteredReservations.filter(r => inPrev(r.created_at)).length : null, [prevWindow, filteredReservations]); // eslint-disable-line
    const prevReports = useMemo(() => prevWindow ? reports.filter(r => inPrev(r.created_at)).length : null, [prevWindow, reports]); // eslint-disable-line

    // Alertas (contadores siempre actuales).
    const pendingVerifications = useMemo(() => users.filter(u => u.verificationStatus === 'pending').length, [users]);
    const pendingReports = useMemo(() => reports.filter(r => (r.status || 'pending') === 'pending').length, [reports]);
    const bannedUsers = useMemo(() => users.filter(u => u.is_banned).length, [users]);
    const pendingReservations = useMemo(() => reservations.filter(r => r.status === 'pendiente').length, [reservations]);

    const speciesData = useMemo(() => groupBy(filteredPets, 'species').sort((a, b) => b.value - a.value), [filteredPets]);

    const dailySeries = useMemo(() => {
        const days = windowKey === '7d' ? 7 : windowKey === '30d' ? 30 : windowKey === 'all' ? 30 : 14;
        return buildDailySeries(days, filteredVerifUsers, filteredReservations, filteredPets);
    }, [windowKey, filteredVerifUsers, filteredReservations, filteredPets]);

    // Serie de ingresos diarios para el gráfico compuesto.
    const dailyRevenue = useMemo(() => {
        const map = new Map(dailySeries.map(d => [d.date, 0]));
        filteredReservations.forEach(r => {
            if (!r.created_at) return;
            const d = startOfDay(new Date(r.created_at)).toISOString().slice(0, 10);
            if (map.has(d)) map.set(d, map.get(d) + (Number(r.totalPrice) || 0));
        });
        return dailySeries.map(d => ({ ...d, revenue: Number((map.get(d.date) || 0).toFixed(2)) }));
    }, [dailySeries, filteredReservations]);

    const recentReservations = useMemo(() => {
        const q = activitySearch.trim().toLowerCase();
        const sorted = [...reservations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const filtered = q
            ? sorted.filter(r =>
                (r.ownerName || '').toLowerCase().includes(q) ||
                (r.caregiverName || '').toLowerCase().includes(q) ||
                (r.status || '').toLowerCase().includes(q) ||
                (r.serviceType || '').toLowerCase().includes(q)
            )
            : sorted;
        return filtered.slice(0, 8);
    }, [reservations, activitySearch]);

    // Feed de actividad unificado (usuarios, mascotas, reservas, reportes, pagos).
    const activityFeed = useMemo(() => {
        const events = [];
        users.forEach(u => events.push({
            id: `u-${u.id}`, type: 'user', ts: u.created_at,
            title: u.fullName || u.firstName || u.email || '—',
            subtitle: `${t('dashboard.evtUserSignup')} · ${u.role || 'normal'}`,
            entityId: u.id,
        }));
        pets.forEach(p => events.push({
            id: `p-${p.id}`, type: 'pet', ts: p.created_at,
            title: p.name || t('dashboard.pets'),
            subtitle: `${t('dashboard.evtPetAdded')} · ${p.species || '—'}`,
            entityId: p.id,
        }));
        reservations.forEach(r => {
            events.push({
                id: `r-${r.id}`, type: 'reservation', ts: r.created_at,
                title: `${r.ownerName || '—'} → ${r.caregiverName || '—'}`,
                subtitle: `${t('dashboard.evtReservation')} · ${r.serviceType === 'walking' ? t('dashboard.walkService') : t('dashboard.stayService')} · ${r.status || 'pendiente'}`,
                status: r.status,
                entityId: r.id,
            });
            // Evento de pago cuando totalPrice > 0 y la reserva fue aceptada/completada.
            if ((r.status === 'aceptada' || r.status === 'completada' || r.status === 'completed') && Number(r.totalPrice) > 0) {
                events.push({
                    id: `pay-${r.id}`, type: 'payment', ts: r.created_at,
                    title: `€${Number(r.totalPrice).toFixed(2)}`,
                    subtitle: `${t('dashboard.evtPayment')} · ${r.ownerName || '—'}`,
                    entityId: r.id,
                });
            }
        });
        reports.forEach(rp => events.push({
            id: `rp-${rp.id}`, type: 'report', ts: rp.created_at,
            title: t('dashboard.evtReport'),
            subtitle: `${t('dashboard.statusLabel')} ${rp.status || 'pending'}`,
            entityId: rp.id,
        }));

        const q = activitySearch.trim().toLowerCase();
        return events
            .filter(e => activityTypeFilter === 'all' || e.type === activityTypeFilter)
            .filter(e => !q || (e.title + ' ' + e.subtitle).toLowerCase().includes(q))
            .sort((a, b) => new Date(b.ts) - new Date(a.ts))
            .slice(0, 25);
    }, [users, pets, reservations, reports, activitySearch, activityTypeFilter, t]);

    const revenueInWindow = useMemo(() => (
        reservationsInWindow.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0)
    ), [reservationsInWindow]);

    // KPIs principales.
    const completedRes = useMemo(() => reservations.filter(r => r.status === 'completada' || r.status === 'aceptada' || r.status === 'completed'), [reservations]);
    const cancelledRes = useMemo(() => reservations.filter(r => r.status === 'cancelada' || r.status === 'rechazada' || r.status === 'cancelled'), [reservations]);
    const conversionRate = reservations.length > 0
        ? Math.round((completedRes.length / reservations.length) * 100) : 0;
    const cancelRate = reservations.length > 0
        ? Math.round((cancelledRes.length / reservations.length) * 100) : 0;
    const avgTicket = completedRes.length > 0
        ? completedRes.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0) / completedRes.length : 0;

    // Mejores cuidadores y dueños.
    const topCaregivers = useMemo(() => {
        const map = new Map();
        reservations.forEach(r => {
            if (!r.caregiverId) return;
            const cur = map.get(r.caregiverId) || { id: r.caregiverId, name: r.caregiverName || '—', count: 0, revenue: 0 };
            cur.count++;
            cur.revenue += Number(r.totalPrice) || 0;
            map.set(r.caregiverId, cur);
        });
        return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    }, [reservations]);
    const topOwners = useMemo(() => {
        const map = new Map();
        reservations.forEach(r => {
            if (!r.ownerId) return;
            const cur = map.get(r.ownerId) || { id: r.ownerId, name: r.ownerName || '—', count: 0, revenue: 0 };
            cur.count++;
            cur.revenue += Number(r.totalPrice) || 0;
            map.set(r.ownerId, cur);
        });
        return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    }, [reservations]);

    // Mapa de calor de actividad: 7 días × 24 horas (conteo de reservas creadas).
    const heatmap = useMemo(() => {
        const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
        reservations.forEach(r => {
            if (!r.created_at) return;
            const d = new Date(r.created_at);
            const day = (d.getDay() + 6) % 7; // Lunes=0
            const hour = d.getHours();
            grid[day][hour]++;
        });
        const max = Math.max(1, ...grid.flat());
        return { grid, max };
    }, [reservations]);

    /** Descarga la serie diaria como CSV. */
    const exportCsv = () => {
        const rows = [['date', 'users', 'reservations', 'pets']];
        dailySeries.forEach(d => rows.push([d.date, d.users, d.reservations, d.pets]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pawmate-dashboard-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return <div className="loading-state"><div className="spinner"></div><p>{t('dashboard.loading')}</p></div>;
    }

    return (
        <div className="dashboard-container">
            <div className="dash-header">
                <h2 className="page-title">{t('dashboard.pageTitle')}</h2>
                <div className="dash-window-filters">
                    <div className="window-dropdown">
                        <select
                            value={usingCustomRange ? 'custom' : windowKey}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'custom') {
                                    const today = new Date().toISOString().slice(0, 10);
                                    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
                                    setCustomRange({ from: weekAgo, to: today });
                                } else {
                                    setCustomRange({ from: '', to: '' });
                                    setWindowKey(v);
                                }
                            }}
                            className="window-select"
                        >
                            {WINDOWS.map(w => (
                                <option key={w.key} value={w.key}>
                                    {w.key === 'all' ? t('dashboard.windowAll') : t('dashboard.windowLast', { key: w.key })}
                                </option>
                            ))}
                            <option value="custom">{t('dashboard.windowCustom')}</option>
                        </select>
                    </div>
                    {usingCustomRange && (
                        <div className="chip chip-range chip-active">
                            <FontAwesomeIcon icon={faCalendarPlus} style={{ fontSize: 11, marginRight: 6 }} />
                            <input type="date" value={customRange.from}
                                onChange={(e) => setCustomRange(p => ({ ...p, from: e.target.value }))} />
                            <span style={{ margin: '0 4px' }}>→</span>
                            <input type="date" value={customRange.to}
                                onChange={(e) => setCustomRange(p => ({ ...p, to: e.target.value }))} />
                            <button className="chip-clear" onClick={() => setCustomRange({ from: '', to: '' })} title={t('dashboard.clear')}>
                                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} />
                            </button>
                        </div>
                    )}
                    {refreshing && <span className="dash-refreshing" title={t('dashboard.refreshing')}></span>}
                </div>
            </div>

            {/* Tarjetas superiores de KPIs */}
            <div className="stats-grid">
                <StatCard icon={faUsers} color="#3b82f6" bg="rgba(59,130,246,0.18)"
                    title={t('dashboard.totalUsers')} total={filteredVerifUsers.length}
                    inWindowCount={usersInWindow.length} prevWindowCount={prevUsers} windowKey={windowKey}
                    sparkline={sparkSeries(filteredVerifUsers)}
                    onClick={() => navigate('/users')} />
                <StatCard icon={faDog} color="#10b981" bg="rgba(16,185,129,0.18)"
                    title={t('dashboard.pets')} total={filteredPets.length}
                    inWindowCount={petsInWindow.length} prevWindowCount={prevPets} windowKey={windowKey}
                    sparkline={sparkSeries(filteredPets)}
                    onClick={() => navigate('/pets')} />
                <StatCard icon={faCalendarDays} color="#a855f7" bg="rgba(168,85,247,0.18)"
                    title={t('dashboard.totalReservations')} total={filteredReservations.length}
                    inWindowCount={reservationsInWindow.length} prevWindowCount={prevReservations} windowKey={windowKey}
                    sparkline={sparkSeries(filteredReservations)}
                    onClick={() => navigate('/reservations')} />
                <StatCard icon={faTriangleExclamation} color="#f59e0b" bg="rgba(245,158,11,0.18)"
                    title={t('dashboard.reports')} total={reports.length}
                    inWindowCount={reportsInWindow.length} prevWindowCount={prevReports} windowKey={windowKey}
                    sparkline={sparkSeries(reports)}
                    onClick={() => navigate('/reports')} />
                <StatCard icon={faWifi} color="#22c55e" bg="rgba(34,197,94,0.18)"
                    title={t('dashboard.onlineCaregivers')} total={onlineCaregivers}
                    inWindowCount={onlineCaregivers} prevWindowCount={null} windowKey={windowKey} />
                <StatCard icon={faShieldHalved} color="#06b6d4" bg="rgba(6,182,212,0.18)"
                    title={t('dashboard.revenue', { key: windowKey })} total={Math.round(revenueInWindow)}
                    inWindowCount={reservationsInWindow.length} prevWindowCount={null} windowKey={windowKey}
                    onClick={() => navigate('/reservations')} />
            </div>

            {/* Distribución en 4 cuadrantes */}
            <div className="quad-grid">

                {/* ─── Q1 · USUARIOS (azul) ────────────────────────────── */}
                <section className="quad quad-users">
                    <header className="quad-header">
                        <div className="quad-icon-wrap">
                            <FontAwesomeIcon icon={faUsers} />
                        </div>
                        <div>
                            <h3 className="quad-title">{t('dashboard.tabUsers')}</h3>
                            <p className="quad-sub">{filteredVerifUsers.length} {t('dashboard.totalUsers').toLowerCase()}</p>
                        </div>
                        <div className="quad-trend">
                            <span className="quad-big">+{usersInWindow.length}</span>
                            <span className="quad-meta">{t('dashboard.deltaInWindow', { key: windowKey, pct: filteredVerifUsers.length > 0 ? Math.round((usersInWindow.length / filteredVerifUsers.length) * 100) : 0 })}</span>
                        </div>
                    </header>
                    <div className="quad-body">
                        <div className="quad-mini-stats">
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.onlineCaregivers')}</span>
                                <span className="mini-value" style={{ color: '#22c55e' }}>{onlineCaregivers}</span>
                            </div>
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.pendingVerifications')}</span>
                                <span className="mini-value" style={{ color: '#f59e0b' }}>{pendingVerifications}</span>
                            </div>
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.bannedUsers')}</span>
                                <span className="mini-value" style={{ color: '#64748b' }}>{bannedUsers}</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={170}>
                            <AreaChart data={dailySeries} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="qUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.12)" />
                                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                                <YAxis stroke="var(--text-muted)" fontSize={10} allowDecimals={false} />
                                <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                                <Area type="monotone" dataKey="users" name={t('dashboard.seriesUsers')} stroke="#3b82f6" fill="url(#qUsers)" strokeWidth={2.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* ─── Q2 · MASCOTAS (verde) ────────────────────────────── */}
                <section className="quad quad-pets">
                    <header className="quad-header">
                        <div className="quad-icon-wrap">
                            <FontAwesomeIcon icon={faDog} />
                        </div>
                        <div>
                            <h3 className="quad-title">{t('dashboard.tabPets')}</h3>
                            <p className="quad-sub">{filteredPets.length} {t('dashboard.pets').toLowerCase()}</p>
                        </div>
                        <div className="quad-trend">
                            <span className="quad-big">+{petsInWindow.length}</span>
                            <span className="quad-meta">{t('dashboard.deltaInWindow', { key: windowKey, pct: filteredPets.length > 0 ? Math.round((petsInWindow.length / filteredPets.length) * 100) : 0 })}</span>
                        </div>
                    </header>
                    <div className="quad-body quad-body-center">
                        {speciesData.length === 0 ? (
                            <div className="empty-chart">{t('dashboard.noData')}</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={230}>
                                <PieChart>
                                    <Pie data={speciesData} dataKey="value" nameKey="name" outerRadius={85} innerRadius={50} paddingAngle={3}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {speciesData.map((s, i) => (
                                            <Cell key={i} fill={SPECIES_COLORS[s.name] || `hsl(${(i * 53) % 360}, 60%, 55%)`} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </section>

                {/* ─── Q3 · RESERVAS + INGRESOS (morado) ─────────────────── */}
                <section className="quad quad-bookings">
                    <header className="quad-header">
                        <div className="quad-icon-wrap">
                            <FontAwesomeIcon icon={faCalendarDays} />
                        </div>
                        <div>
                            <h3 className="quad-title">{t('dashboard.tabReservations')} & €</h3>
                            <p className="quad-sub">{filteredReservations.length} · €{revenueInWindow.toFixed(0)}</p>
                        </div>
                        <div className="quad-trend">
                            <span className="quad-big">+{reservationsInWindow.length}</span>
                            <span className="quad-meta">{t('dashboard.deltaInWindow', { key: windowKey, pct: filteredReservations.length > 0 ? Math.round((reservationsInWindow.length / filteredReservations.length) * 100) : 0 })}</span>
                        </div>
                        <button className="icon-btn icon-btn-ghost" title={t('dashboard.exportCsv')} onClick={exportCsv}>
                            <FontAwesomeIcon icon={faDownload} style={{ fontSize: 13 }} />
                        </button>
                    </header>
                    <div className="quad-body">
                        <div className="quad-mini-stats">
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.kpiConversion')}</span>
                                <span className="mini-value" style={{ color: '#10b981' }}>{conversionRate}%</span>
                            </div>
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.kpiCancel')}</span>
                                <span className="mini-value" style={{ color: '#ef4444' }}>{cancelRate}%</span>
                            </div>
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.kpiAvgTicket')}</span>
                                <span className="mini-value">€{avgTicket.toFixed(0)}</span>
                            </div>
                            <div className="mini-stat">
                                <span className="mini-label">{t('dashboard.pendingReservations')}</span>
                                <span className="mini-value" style={{ color: '#f59e0b' }}>{pendingReservations}</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={170}>
                            <ComposedChart data={dailyRevenue} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="qRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.12)" />
                                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={10} allowDecimals={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} />
                                <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                                <Bar yAxisId="left" dataKey="reservations" name={t('dashboard.seriesReservations')} fill="#a855f7" radius={[4, 4, 0, 0]} barSize={14} />
                                <Area yAxisId="right" type="monotone" dataKey="revenue" name="€" stroke="#10b981" fill="url(#qRevenue)" strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* ─── Q4 · OPERACIÓN — Heatmap + Alertas (ámbar) ───────── */}
                <section className="quad quad-ops">
                    <header className="quad-header">
                        <div className="quad-icon-wrap">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                        </div>
                        <div>
                            <h3 className="quad-title">{t('dashboard.heatmapTitle')}</h3>
                            <p className="quad-sub">{t('dashboard.heatmapSub')}</p>
                        </div>
                        <div className="quad-trend">
                            <span className="quad-big">{reports.length}</span>
                            <span className="quad-meta">{t('dashboard.reports').toLowerCase()}</span>
                        </div>
                    </header>
                    <div className="quad-body">
                        <div className="heatmap heatmap-compact">
                            <div className="heatmap-hours">
                                <span></span>
                                {Array.from({ length: 24 }, (_, h) => (
                                    <span key={h} className="heatmap-hour">{h % 4 === 0 ? h : ''}</span>
                                ))}
                            </div>
                            {[t('dashboard.dayMon'), t('dashboard.dayTue'), t('dashboard.dayWed'), t('dashboard.dayThu'), t('dashboard.dayFri'), t('dashboard.daySat'), t('dashboard.daySun')].map((dayLabel, dayIdx) => (
                                <div key={dayIdx} className="heatmap-row">
                                    <span className="heatmap-day">{dayLabel}</span>
                                    {heatmap.grid[dayIdx].map((v, h) => {
                                        const intensity = v / heatmap.max;
                                        const bg = v === 0
                                            ? 'rgba(245, 158, 11, 0.06)'
                                            : `rgba(245, 158, 11, ${0.18 + intensity * 0.82})`;
                                        return (
                                            <div key={h} className="heatmap-cell"
                                                style={{ background: bg }}
                                                title={`${dayLabel} ${h}:00 — ${v}`}>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

            </div>

            {/* Actividad reciente */}
            <div className="dashboard-sections">
                <div className="recent-activity glass-panel">
                    <div className="section-header section-header-row">
                        <h3>{t('dashboard.recentActivity')}</h3>
                        <div className="activity-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder={t('dashboard.searchPlaceholder')}
                                value={activitySearch}
                                onChange={(e) => setActivitySearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="activity-type-chips">
                        {[
                            { k: 'all', label: t('dashboard.all'), icon: faFilter, color: '#64748b' },
                            { k: 'user', label: t('dashboard.tabUsers'), icon: faUsers, color: '#3b82f6' },
                            { k: 'pet', label: t('dashboard.tabPets'), icon: faDog, color: '#10b981' },
                            { k: 'reservation', label: t('dashboard.tabReservations'), icon: faCalendarDays, color: '#a855f7' },
                            { k: 'payment', label: '€ ' + t('dashboard.kpiAvgTicket').split(' ')[0], icon: faDownload, color: '#06b6d4' },
                            { k: 'report', label: t('dashboard.reports'), icon: faTriangleExclamation, color: '#f59e0b' },
                        ].map(opt => (
                            <button
                                key={opt.k}
                                className={`act-chip ${activityTypeFilter === opt.k ? 'act-chip-active' : ''}`}
                                style={activityTypeFilter === opt.k ? { background: opt.color, color: '#fff', borderColor: opt.color } : { color: opt.color, borderColor: 'var(--border-color)' }}
                                onClick={() => setActivityTypeFilter(opt.k)}
                            >
                                <FontAwesomeIcon icon={opt.icon} style={{ fontSize: 11 }} />
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                    {activityFeed.length === 0 ? (
                        <div className="empty-state">
                            <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 40 }} />
                            <p>{t('dashboard.noRecentActivity')}</p>
                        </div>
                    ) : (
                        <div className="activity-list">
                            {activityFeed.map(ev => {
                                const typeColor = { user: '#3b82f6', pet: '#10b981', reservation: '#a855f7', payment: '#06b6d4', report: '#f59e0b' }[ev.type] || '#64748b';
                                const typeIcon = { user: faUsers, pet: faDog, reservation: faCalendarDays, payment: faDownload, report: faTriangleExclamation }[ev.type] || faCircleExclamation;
                                const route = { user: `/users/${ev.entityId}`, pet: `/pets/${ev.entityId}`, reservation: `/reservations/${ev.entityId}`, payment: `/reservations/${ev.entityId}`, report: `/reports/${ev.entityId}` }[ev.type];
                                return (
                                    <div className="activity-item" key={ev.id}
                                        onClick={() => route && navigate(route)}
                                        style={{ cursor: route ? 'pointer' : 'default' }}>
                                        <div className="activity-avatar" style={{ background: `${typeColor}22`, color: typeColor }}>
                                            <FontAwesomeIcon icon={typeIcon} style={{ fontSize: 14 }} />
                                        </div>
                                        <div className="activity-details">
                                            <p className="activity-text">
                                                <strong>{ev.title}</strong>
                                            </p>
                                            <span className="activity-meta">
                                                {ev.subtitle}
                                                {ev.ts && (<>{' · '}{new Date(ev.ts).toLocaleString()}</>)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}