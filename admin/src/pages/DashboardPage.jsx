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
    BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
    ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Treemap,
} from 'recharts';
import './DashboardPage.css';

// ── Time-window options (in ms) ────────────────────────────────────────────
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

const inWindow = (iso, sinceMs) => {
    if (!iso) return false;
    if (!Number.isFinite(sinceMs)) return true;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= sinceMs;
};

const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

// Build [{date, label, users, reservations, pets}] for the last N days
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

const groupBy = (arr, key) => {
    const out = {};
    arr.forEach(it => {
        const k = (it[key] || 'unknown').toString().toLowerCase();
        out[k] = (out[k] || 0) + 1;
    });
    return Object.entries(out).map(([name, value]) => ({ name, value }));
};

// Build a 14-day spark series for a given collection (counting created_at)
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

// ── Reusable stat card with window delta + previous period + sparkline ──
function StatCard({ icon, color, bg, title, total, inWindowCount, prevWindowCount, windowKey, sparkline, onClick }) {
    const { t } = useTranslation();
    const pct = total > 0 ? Math.round((inWindowCount / total) * 100) : 0;
    // Trend vs previous period
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

// Multi-select filter group: clicking a non-"all" chip toggles it; "all" clears
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

    const [users, setUsers] = useState([]);
    const [pets, setPets] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAll = useCallback(async (opts = {}) => {
        if (opts.silent) setRefreshing(true);
        try {
            const [u, p, r, rep] = await Promise.all([
                supabase.from('users').select('id, role, created_at, "isOnline", "fullName", "firstName", email, "verificationStatus", is_banned'),
                supabase.from('pets').select('id, species, created_at, "ownerId"'),
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

        // ── Realtime auto-refresh (debounced) ──
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

        // Refetch when the tab wakes up after being idle
        const onWake = () => fetchAll({ silent: true });
        window.addEventListener('pawmate:wake', onWake);

        return () => {
            clearTimeout(debounceTimer);
            channels.forEach(ch => supabase.removeChannel(ch));
            window.removeEventListener('pawmate:wake', onWake);
        };
    }, [fetchAll]);

    // ── Derived data ───────────────────────────────────────────────────────
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

    // Updated inWindow that respects [sinceMs, untilMs]
    const inRange = (iso) => {
        if (!iso) return false;
        if (!Number.isFinite(sinceMs)) return true;
        const t = new Date(iso).getTime();
        return Number.isFinite(t) && t >= sinceMs && t <= untilMs;
    };

    // Previous-period boundaries for trend comparison
    const prevWindow = useMemo(() => {
        if (usingCustomRange) {
            const span = untilMs - sinceMs;
            return { from: sinceMs - span, to: sinceMs };
        }
        const w = WINDOWS.find(x => x.key === windowKey) || WINDOWS[1];
        if (!Number.isFinite(w.ms)) return null;
        return { from: Date.now() - 2 * w.ms, to: Date.now() - w.ms };
    }, [windowKey, usingCustomRange, sinceMs, untilMs]);
    const inPrev = (iso) => {
        if (!prevWindow || !iso) return false;
        const t = new Date(iso).getTime();
        return t >= prevWindow.from && t < prevWindow.to;
    };

    // Multi-set helpers
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

    // Previous-period counts (for trend % vs previous window)
    const prevUsers = useMemo(() => prevWindow ? filteredVerifUsers.filter(u => inPrev(u.created_at)).length : null, [prevWindow, filteredVerifUsers]); // eslint-disable-line
    const prevPets = useMemo(() => prevWindow ? filteredPets.filter(p => inPrev(p.created_at)).length : null, [prevWindow, filteredPets]); // eslint-disable-line
    const prevReservations = useMemo(() => prevWindow ? filteredReservations.filter(r => inPrev(r.created_at)).length : null, [prevWindow, filteredReservations]); // eslint-disable-line
    const prevReports = useMemo(() => prevWindow ? reports.filter(r => inPrev(r.created_at)).length : null, [prevWindow, reports]); // eslint-disable-line

    // Alerts (always-current counters)
    const pendingVerifications = useMemo(() => users.filter(u => u.verificationStatus === 'pending').length, [users]);
    const pendingReports = useMemo(() => reports.filter(r => (r.status || 'pending') === 'pending').length, [reports]);
    const bannedUsers = useMemo(() => users.filter(u => u.is_banned).length, [users]);
    const pendingReservations = useMemo(() => reservations.filter(r => r.status === 'pendiente').length, [reservations]);

    const speciesData = useMemo(() => groupBy(filteredPets, 'species').sort((a, b) => b.value - a.value), [filteredPets]);
    const roleData = useMemo(() => groupBy(filteredUsers, 'role').sort((a, b) => b.value - a.value), [filteredUsers]);
    const statusData = useMemo(() => groupBy(filteredReservations, 'status').sort((a, b) => b.value - a.value), [filteredReservations]);

    const dailySeries = useMemo(() => {
        const days = windowKey === '7d' ? 7 : windowKey === '30d' ? 30 : windowKey === 'all' ? 30 : 14;
        return buildDailySeries(days, filteredVerifUsers, filteredReservations, filteredPets);
    }, [windowKey, filteredVerifUsers, filteredReservations, filteredPets]);

    // Daily revenue series (for ComposedChart)
    const dailyRevenue = useMemo(() => {
        const map = new Map(dailySeries.map(d => [d.date, 0]));
        filteredReservations.forEach(r => {
            if (!r.created_at) return;
            const d = startOfDay(new Date(r.created_at)).toISOString().slice(0, 10);
            if (map.has(d)) map.set(d, map.get(d) + (Number(r.totalPrice) || 0));
        });
        return dailySeries.map(d => ({ ...d, revenue: Number((map.get(d.date) || 0).toFixed(2)) }));
    }, [dailySeries, filteredReservations]);

    // Hour-of-day distribution for radar chart (00–23)
    const hourRadar = useMemo(() => {
        const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, value: 0 }));
        filteredReservations.forEach(r => {
            if (!r.created_at) return;
            const h = new Date(r.created_at).getHours();
            buckets[h].value++;
        });
        // Group into 8 × 3-hour bins for cleaner radar
        const bins = [];
        for (let i = 0; i < 24; i += 3) {
            const sum = buckets.slice(i, i + 3).reduce((s, b) => s + b.value, 0);
            bins.push({ hour: `${i}-${i+2}h`, value: sum });
        }
        return bins;
    }, [filteredReservations]);

    // Treemap of pets per species
    const treemapPets = useMemo(() => speciesData.map(s => ({ name: s.name, size: s.value })), [speciesData]);

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

    const revenueInWindow = useMemo(() => (
        reservationsInWindow.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0)
    ), [reservationsInWindow]);

    // ── KPIs ─────────────────────────────────────────────────────────────
    const completedRes = useMemo(() => reservations.filter(r => r.status === 'completada' || r.status === 'aceptada' || r.status === 'completed'), [reservations]);
    const cancelledRes = useMemo(() => reservations.filter(r => r.status === 'cancelada' || r.status === 'rechazada' || r.status === 'cancelled'), [reservations]);
    const conversionRate = reservations.length > 0
        ? Math.round((completedRes.length / reservations.length) * 100) : 0;
    const cancelRate = reservations.length > 0
        ? Math.round((cancelledRes.length / reservations.length) * 100) : 0;
    const avgTicket = completedRes.length > 0
        ? completedRes.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0) / completedRes.length : 0;

    // ── Top performers (caregivers / owners) ──────────────────────────────────────
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

    // ── Activity heatmap: 7 days × 24 hours (booking creation count) ──────
    const heatmap = useMemo(() => {
        const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
        reservations.forEach(r => {
            if (!r.created_at) return;
            const d = new Date(r.created_at);
            const day = (d.getDay() + 6) % 7; // Monday=0
            const hour = d.getHours();
            grid[day][hour]++;
        });
        const max = Math.max(1, ...grid.flat());
        return { grid, max };
    }, [reservations]);

    // ── Export CSV (daily series) ───────────────────────────────────────────────
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
                    {WINDOWS.map(w => (
                        <button
                            key={w.key}
                            className={`chip ${!usingCustomRange && windowKey === w.key ? 'chip-active' : ''}`}
                            onClick={() => { setCustomRange({ from: '', to: '' }); setWindowKey(w.key); }}
                        >
                            {w.key === 'all' ? t('dashboard.windowAll') : t('dashboard.windowLast', { key: w.key })}
                        </button>
                    ))}
                    <div className={`chip chip-range ${usingCustomRange ? 'chip-active' : ''}`}>
                        <FontAwesomeIcon icon={faCalendarPlus} style={{ fontSize: 11, marginRight: 6 }} />
                        <input type="date" value={customRange.from}
                            onChange={(e) => setCustomRange(p => ({ ...p, from: e.target.value }))} />
                        <span style={{ margin: '0 4px' }}>→</span>
                        <input type="date" value={customRange.to}
                            onChange={(e) => setCustomRange(p => ({ ...p, to: e.target.value }))} />
                        {usingCustomRange && (
                            <button className="chip-clear" onClick={() => setCustomRange({ from: '', to: '' })} title={t('dashboard.clear')}>
                                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} />
                            </button>
                        )}
                    </div>
                    {refreshing && <span className="dash-refreshing" title={t('dashboard.refreshing')}>⟳</span>}
                </div>
            </div>

            {/* ── Stat cards ─────────────────────────────────────────────── */}
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
                <StatCard icon={faTriangleExclamation} color="#ef4444" bg="rgba(239,68,68,0.18)"
                    title={t('dashboard.reports')} total={reports.length}
                    inWindowCount={reportsInWindow.length} prevWindowCount={prevReports} windowKey={windowKey}
                    sparkline={sparkSeries(reports)}
                    onClick={() => navigate('/reports')} />
                <StatCard icon={faWifi} color="#22c55e" bg="rgba(34,197,94,0.18)"
                    title={t('dashboard.onlineCaregivers')} total={onlineCaregivers}
                    inWindowCount={onlineCaregivers} windowKey={t('dashboard.windowNow')} />
                <div className="stat-card glass-panel">
                    <div className="stat-card-top">
                        <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}>
                            <span style={{ fontSize: 22, fontWeight: 800 }}>€</span>
                        </div>
                    </div>
                    <div className="stat-info">
                        <h3>{t('dashboard.revenue', { key: windowKey })}</h3>
                        <p className="stat-value">€{revenueInWindow.toFixed(2)}</p>
                        <div className="stat-delta">
                            <span className="stat-delta-meta">{t('dashboard.revenueMeta', { count: reservationsInWindow.length })}</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* ── Alerts row ─────────────────────────────────────────────── */}
            <div className="alerts-grid">
                <div className={`alert-card glass-panel ${pendingVerifications > 0 ? 'alert-warn' : ''}`}
                    onClick={() => navigate('/verifications')}>
                    <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 20, color: '#f59e0b' }} />
                    <div>
                        <p className="alert-num">{pendingVerifications}</p>
                        <p className="alert-label">{t('dashboard.pendingVerifications')}</p>
                    </div>
                </div>
                <div className={`alert-card glass-panel ${pendingReports > 0 ? 'alert-danger' : ''}`}
                    onClick={() => navigate('/reports')}>
                    <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 20, color: '#ef4444' }} />
                    <div>
                        <p className="alert-num">{pendingReports}</p>
                        <p className="alert-label">{t('dashboard.pendingReports')}</p>
                    </div>
                </div>
                <div className={`alert-card glass-panel ${pendingReservations > 0 ? 'alert-info' : ''}`}
                    onClick={() => navigate('/reservations')}>
                    <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 20, color: '#3b82f6' }} />
                    <div>
                        <p className="alert-num">{pendingReservations}</p>
                        <p className="alert-label">{t('dashboard.pendingReservations')}</p>
                    </div>
                </div>
                <div className={`alert-card glass-panel ${bannedUsers > 0 ? 'alert-muted' : ''}`}
                    onClick={() => navigate('/users')}>
                    <FontAwesomeIcon icon={faBan} style={{ fontSize: 20, color: '#64748b' }} />
                    <div>
                        <p className="alert-num">{bannedUsers}</p>
                        <p className="alert-label">{t('dashboard.bannedUsers')}</p>
                    </div>
                </div>
            </div>

            {/* ── KPI mini-row ──────────────────────────────────────────────── */}
            <div className="kpi-row glass-panel">
                <div className="kpi-cell">
                    <span className="kpi-label">{t('dashboard.kpiConversion')}</span>
                    <span className="kpi-value" style={{ color: '#10b981' }}>{conversionRate}%</span>
                </div>
                <div className="kpi-cell">
                    <span className="kpi-label">{t('dashboard.kpiCancel')}</span>
                    <span className="kpi-value" style={{ color: '#ef4444' }}>{cancelRate}%</span>
                </div>
                <div className="kpi-cell">
                    <span className="kpi-label">{t('dashboard.kpiAvgTicket')}</span>
                    <span className="kpi-value">€{avgTicket.toFixed(2)}</span>
                </div>
                <div className="kpi-cell">
                    <span className="kpi-label">{t('dashboard.kpiTotalRevenue')}</span>
                    <span className="kpi-value">€{completedRes.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0).toFixed(2)}</span>
                </div>
            </div>
            {/* ── Sub-filters (multi-select) ─────────────────────────────── */}
            <div className="dash-subfilters">
                <FilterGroup
                    label={t('dashboard.filterUsers')}
                    options={[
                        { v: 'all', l: t('dashboard.all') },
                        { v: 'normal', l: t('dashboard.roleNormal') },
                        { v: 'owner', l: t('dashboard.roleOwners') },
                        { v: 'caregiver', l: t('dashboard.roleCaregivers') },
                        { v: 'admin', l: t('dashboard.roleAdmins') },
                    ]}
                    selected={userRoleFilter} onChange={setUserRoleFilter}
                />
                <FilterGroup
                    label={t('dashboard.filterVerification')}
                    options={[
                        { v: 'all', l: t('dashboard.all') },
                        { v: 'verified', l: t('dashboard.verifVerified') },
                        { v: 'pending', l: t('dashboard.verifPending') },
                        { v: 'rejected', l: t('dashboard.verifRejected') },
                        { v: 'unverified', l: t('dashboard.verifUnverified') },
                    ]}
                    selected={verifFilter} onChange={setVerifFilter}
                />
                <FilterGroup
                    label={t('dashboard.filterPets')}
                    options={[
                        { v: 'all', l: t('dashboard.allFem') },
                        ...speciesData.slice(0, 6).map(s => ({ v: s.name, l: `${s.name} (${s.value})` })),
                    ]}
                    selected={petSpeciesFilter} onChange={setPetSpeciesFilter}
                />
                <FilterGroup
                    label={t('dashboard.filterStatus')}
                    options={[
                        { v: 'all', l: t('dashboard.allFem') },
                        { v: 'pendiente', l: 'Pendiente' },
                        { v: 'aceptada', l: 'Aceptada' },
                        { v: 'activa', l: 'Activa' },
                        { v: 'completada', l: 'Completada' },
                        { v: 'cancelada', l: 'Cancelada' },
                    ]}
                    selected={resStatusFilter} onChange={setResStatusFilter}
                />
                <FilterGroup
                    label={t('dashboard.filterService')}
                    options={[
                        { v: 'all', l: t('dashboard.allMasc') },
                        { v: 'walking', l: t('dashboard.serviceWalk') },
                        { v: 'stay', l: t('dashboard.serviceStay') },
                    ]}
                    selected={serviceTypeFilter} onChange={setServiceTypeFilter}
                />
                <button className="clear-filters-btn" onClick={() => {
                    setUserRoleFilter(new Set(['all']));
                    setPetSpeciesFilter(new Set(['all']));
                    setResStatusFilter(new Set(['all']));
                    setServiceTypeFilter(new Set(['all']));
                    setVerifFilter(new Set(['all']));
                }}>
                    <FontAwesomeIcon icon={faFilter} style={{ marginRight: 6, fontSize: 11 }} />
                    {t('dashboard.clearFilters')}
                </button>
            </div>

            {/* ── Charts grid ────────────────────────────────────────────── */}
            <div className="charts-grid">
                <div className="chart-card glass-panel chart-wide">
                    <div className="chart-header">
                        <h3>{t('dashboard.chartDailyTitle')}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="chart-sub">{t('dashboard.chartDailySub', { count: dailySeries.length })}</span>
                            <button className="icon-btn" title={t('dashboard.exportCsv')} onClick={exportCsv}>
                                <FontAwesomeIcon icon={faDownload} style={{ fontSize: 13 }} />
                            </button>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={dailySeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradRes" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradPets" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                            <Legend />
                            <Area type="monotone" dataKey="users" name={t('dashboard.seriesUsers')} stroke="#3b82f6" fill="url(#gradUsers)" strokeWidth={2} />
                            <Area type="monotone" dataKey="reservations" name={t('dashboard.seriesReservations')} stroke="#a855f7" fill="url(#gradRes)" strokeWidth={2} />
                            <Area type="monotone" dataKey="pets" name={t('dashboard.seriesPets')} stroke="#10b981" fill="url(#gradPets)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card glass-panel">
                    <div className="chart-header"><h3>{t('dashboard.chartSpecies')}</h3></div>
                    {speciesData.length === 0 ? (
                        <div className="empty-chart">{t('dashboard.noData')}</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={speciesData} dataKey="value" nameKey="name" outerRadius={85} innerRadius={45} paddingAngle={2}>
                                    {speciesData.map((s, i) => (
                                        <Cell key={i} fill={SPECIES_COLORS[s.name] || `hsl(${(i * 53) % 360}, 60%, 55%)`} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="chart-card glass-panel">
                    <div className="chart-header"><h3>{t('dashboard.chartRoles')}</h3></div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={roleData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {roleData.map((r, i) => (
                                    <Cell key={i} fill={ROLE_COLORS[r.name] || '#64748b'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card glass-panel">
                    <div className="chart-header"><h3>{t('dashboard.chartStatuses')}</h3></div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={statusData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis type="number" stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                            <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} width={90} />
                            <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                {statusData.map((s, i) => (
                                    <Cell key={i} fill={STATUS_COLORS[s.name] || '#64748b'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* ── Top performers + Heatmap row ────────────────────────────────────── */}
            <div className="charts-grid">
                <div className="chart-card glass-panel">
                    <div className="chart-header">
                        <h3><FontAwesomeIcon icon={faTrophy} style={{ color: '#f59e0b', marginRight: 8 }} />{t('dashboard.topCaregivers')}</h3>
                    </div>
                    {topCaregivers.length === 0 ? (
                        <div className="empty-chart">{t('dashboard.noData')}</div>
                    ) : (
                        <div className="top-list">
                            {topCaregivers.map((c, i) => (
                                <div key={c.id} className="top-row" onClick={() => navigate(`/users/${c.id}`)}>
                                    <span className={`top-rank top-rank-${i+1}`}>{i+1}</span>
                                    <span className="top-name">{c.name}</span>
                                    <span className="top-meta">{c.count} · €{c.revenue.toFixed(0)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="chart-card glass-panel">
                    <div className="chart-header">
                        <h3><FontAwesomeIcon icon={faTrophy} style={{ color: '#3b82f6', marginRight: 8 }} />{t('dashboard.topOwners')}</h3>
                    </div>
                    {topOwners.length === 0 ? (
                        <div className="empty-chart">{t('dashboard.noData')}</div>
                    ) : (
                        <div className="top-list">
                            {topOwners.map((o, i) => (
                                <div key={o.id} className="top-row" onClick={() => navigate(`/users/${o.id}`)}>
                                    <span className={`top-rank top-rank-${i+1}`}>{i+1}</span>
                                    <span className="top-name">{o.name}</span>
                                    <span className="top-meta">{o.count} · €{o.revenue.toFixed(0)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="chart-card glass-panel chart-wide">
                    <div className="chart-header">
                        <h3>{t('dashboard.heatmapTitle')}</h3>
                        <span className="chart-sub">{t('dashboard.heatmapSub')}</span>
                    </div>
                    <div className="heatmap">
                        <div className="heatmap-hours">
                            <span></span>
                            {Array.from({ length: 24 }, (_, h) => (
                                <span key={h} className="heatmap-hour">{h % 3 === 0 ? h : ''}</span>
                            ))}
                        </div>
                        {[t('dashboard.dayMon'), t('dashboard.dayTue'), t('dashboard.dayWed'), t('dashboard.dayThu'), t('dashboard.dayFri'), t('dashboard.daySat'), t('dashboard.daySun')].map((dayLabel, dayIdx) => (
                            <div key={dayIdx} className="heatmap-row">
                                <span className="heatmap-day">{dayLabel}</span>
                                {heatmap.grid[dayIdx].map((v, h) => {
                                    const intensity = v / heatmap.max;
                                    const bg = v === 0
                                        ? 'var(--surface-hover)'
                                        : `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`;
                                    return (
                                        <div key={h} className="heatmap-cell"
                                            style={{ background: bg }}
                                            title={`${dayLabel} ${h}:00 — ${v} reservas`}>
                                            {v > 0 && intensity > 0.5 ? v : ''}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Power charts row: ComposedChart + Radar + Treemap ─────── */}
            <div className="charts-grid">
                <div className="chart-card glass-panel chart-wide">
                    <div className="chart-header">
                        <h3>{t('dashboard.composedTitle')}</h3>
                        <span className="chart-sub">{t('dashboard.composedSub')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={dailyRevenue}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} />
                            <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="reservations" name={t('dashboard.seriesReservations')} fill="#a855f7" radius={[6, 6, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="revenue" name="€ Revenue" stroke="#10b981" strokeWidth={2.5} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card glass-panel">
                    <div className="chart-header">
                        <h3>{t('dashboard.radarTitle')}</h3>
                        <span className="chart-sub">{t('dashboard.radarSub')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={hourRadar}>
                            <PolarGrid stroke="var(--border-color)" />
                            <PolarAngleAxis dataKey="hour" stroke="var(--text-muted)" fontSize={11} />
                            <PolarRadiusAxis stroke="var(--text-muted)" fontSize={10} />
                            <Radar name={t('dashboard.seriesReservations')} dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.45} />
                            <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card glass-panel">
                    <div className="chart-header">
                        <h3>{t('dashboard.treemapTitle')}</h3>
                        <span className="chart-sub">{t('dashboard.treemapSub')}</span>
                    </div>
                    {treemapPets.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <Treemap data={treemapPets} dataKey="size" stroke="#fff" fill="#10b981"
                                content={({ x, y, width, height, name, value, index }) => {
                                    const colors = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
                                    if (width < 4 || height < 4) return null;
                                    return (
                                        <g>
                                            <rect x={x} y={y} width={width} height={height}
                                                fill={colors[index % colors.length]} stroke="var(--card-bg)" strokeWidth={2} />
                                            {width > 60 && height > 28 && (
                                                <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="600">
                                                    {name} ({value})
                                                </text>
                                            )}
                                        </g>
                                    );
                                }} />
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)' }}>
                            {t('dashboard.noData')}
                        </div>
                    )}
                </div>
            </div>
            {/* ── Recent activity ────────────────────────────────────────── */}
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
                    {recentReservations.length === 0 ? (
                        <div className="empty-state">
                            <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 40 }} />
                            <p>{t('dashboard.noRecentActivity')}</p>
                        </div>
                    ) : (
                        <div className="activity-list">
                            {recentReservations.map(activity => (
                                <div className="activity-item" key={activity.id}
                                    onClick={() => navigate(`/reservations/${activity.id}`)}
                                    style={{ cursor: 'pointer' }}>
                                    <div className="activity-avatar">
                                        {activity.ownerName?.charAt(0) || '?'}
                                    </div>
                                    <div className="activity-details">
                                        <p className="activity-text">
                                            <strong>{activity.ownerName || t('dashboard.userFallback')}</strong>{' '}
                                            {t('dashboard.hasBooked')}{' '}
                                            {activity.serviceType === 'walking' ? t('dashboard.walkService') : t('dashboard.stayService')}{' '}
                                            con <strong>{activity.caregiverName || t('dashboard.caregiverFallback')}</strong>
                                        </p>
                                        <span className="activity-meta">
                                            {t('dashboard.statusLabel')}{' '}
                                            <span className={`status-badge ${activity.status || 'pendiente'}`}>
                                                {activity.status || t('dashboard.pendingStatus')}
                                            </span>
                                            {' · '}{new Date(activity.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
