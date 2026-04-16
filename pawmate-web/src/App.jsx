import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import {
  Heart, Shield, Bell, Users, Navigation2,
  ArrowRight, CheckCircle2, Download,
  Menu, X, Star, QrCode,
  Sparkles, ArrowDown, PawPrint,
  Moon, Sun
} from 'lucide-react';
import './App.css';
import ConfirmPage from './pages/ConfirmPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

/* ─── Animation Variants ──────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = (delay = 0.12) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

function AnimatedSection({ children, className, delay = 0.12 }) {
  const [ref, inView] = useInView({ threshold: 0.08, triggerOnce: true });
  return (
    <motion.div ref={ref} variants={stagger(delay)} initial="hidden" animate={inView ? 'show' : 'hidden'} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Counter Hook ─────────────────────────────── */
function useCounter(end, duration = 2000, inView) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);
  return count;
}

/* ─── Theme Hook ───────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pawmate-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('pawmate-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, () => setDark(prev => !prev)];
}

/* ─── Navbar ───────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, toggleTheme] = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const links = [['Inicio', 'hero'], ['Funciones', 'features'], ['App', 'showcase'], ['Testimonios', 'testimonials']];

  return (
    <motion.nav
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="navbar-inner">
        <div className="nav-logo" onClick={() => scrollTo('hero')}>
          <span className="logo-icon">🐾</span>
          <span className="logo-text">PawMate</span>
        </div>
        <ul className="nav-links">
          {links.map(([label, id]) => (
            <li key={id}><a onClick={() => scrollTo(id)}>{label}</a></li>
          ))}
        </ul>
        <div className="nav-actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <motion.button className="btn-nav-cta" onClick={() => scrollTo('cta')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            Descargar App
          </motion.button>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div className="mobile-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
            {links.map(([label, id]) => (
              <a key={id} className="mobile-link" onClick={() => scrollTo(id)}>{label}</a>
            ))}
            <a className="mobile-link" onClick={toggleTheme}>
              {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Modo claro' : 'Modo oscuro'}
            </a>
            <button className="btn-primary mobile-cta" onClick={() => scrollTo('cta')}>
              <Download size={16} /> Descargar App
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

/* ─── Hero ─────────────────────────────────────── */
function Hero() {
  const words = ['inteligente.', 'conectado.', 'seguro.', 'moderno.'];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setWordIndex(prev => (prev + 1) % words.length), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero" id="hero">
      <div className="hero-bg-grid" />
      <div className="hero-paw-pattern" />
      <div className="hero-glow hero-glow-1" />
      <div className="hero-glow hero-glow-2" />

      <div className="hero-inner">
        <div className="hero-text">
          <AnimatedSection>
            <motion.div variants={fadeUp}>
              <div className="hero-badge">
                <Sparkles size={14} />
                <span>La App de Mascotas #1 en España</span>
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp}>
              El cuidado de tu mascota,{' '}
              <span className="hero-accent-wrapper">
                <AnimatePresence mode="wait">
                  <motion.span key={words[wordIndex]} className="accent"
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4 }}
                  >
                    {words[wordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.h1>
            <motion.p className="hero-desc" variants={fadeUp}>
              PawMate es la plataforma definitiva para dueños de mascotas. GPS en vivo,
              historial médico, red de cuidadores verificados y pasaporte biométrico digital.
            </motion.p>
            <motion.div className="hero-buttons" variants={fadeUp}>
              <motion.button className="btn-primary btn-lg" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Download size={20} /> Descargar Gratis
              </motion.button>
              <motion.button className="btn-ghost" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                Saber más <ArrowDown size={16} />
              </motion.button>
            </motion.div>
            <motion.div className="hero-metrics" variants={fadeUp}>
              <div className="metric">
                <div className="metric-value">10K+</div>
                <div className="metric-label">Usuarios activos</div>
              </div>
              <div className="metric-divider" />
              <div className="metric">
                <div className="metric-value">4.9</div>
                <div className="metric-stars">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="var(--gold)" color="var(--gold)" />)}
                </div>
              </div>
              <div className="metric-divider" />
              <div className="metric">
                <div className="metric-value">50K+</div>
                <div className="metric-label">Paseos rastreados</div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>

        <div className="hero-visual">
          <AnimatedSection>
            <motion.div className="hero-phone-wrapper" variants={scaleIn}>
              <img src="/premium_hero.png" alt="PawMate App" className="hero-phone-img" />
              <motion.div className="hero-float-card hero-float-top"
                animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="float-icon">📍</div>
                <div><div className="float-title">GPS Activo</div><div className="float-sub">Precisión milimétrica</div></div>
              </motion.div>
              <motion.div className="hero-float-card hero-float-bottom"
                animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <div className="float-icon">🧡</div>
                <div><div className="float-title">Salud al día</div><div className="float-sub">Vacunas · Peso · Alergias</div></div>
              </motion.div>
            </motion.div>
          </AnimatedSection>
        </div>
      </div>

      <div className="hero-scroll-hint">
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ArrowDown size={20} />
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Marquee Trust Band ───────────────────────── */
function TrustBand() {
  const items = [
    ['🔒', 'Datos 100% Seguros'], ['⚡', 'Sincronización Real'], ['🐾', 'Todas las Especies'],
    ['🌍', 'Líder en España'], ['📱', 'App Nativa Fluida'], ['🏥', 'Historial Veterinario'],
    ['🎯', 'GPS de Alta Precisión'], ['👥', 'Comunidad Activa'],
  ];
  return (
    <div className="marquee-band">
      <div className="marquee-track">
        {[...items, ...items].map(([icon, text], i) => (
          <div key={i} className="marquee-item">
            <span className="marquee-icon">{icon}</span><span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Features ─────────────────────────────────── */
const features = [
  { icon: <Navigation2 size={26} />, title: 'GPS Tracking', desc: 'Registra cada paseo con precisión milimétrica. Rutas, distancia y calorías en tiempo real.', color: '#F5A623', bg: 'rgba(245, 166, 35, 0.1)' },
  { icon: <Heart size={26} />, title: 'Historial Médico', desc: 'Peso, vacunas, alergias, cirugías y contactos veterinarios sincronizados en la nube.', color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.1)' },
  { icon: <QrCode size={26} />, title: 'Paw-Port QR', desc: 'Un QR único con todo el historial de tu mascota. Escaneable en urgencias veterinarias.', color: '#1A1A2E', bg: 'rgba(26, 26, 46, 0.08)' },
  { icon: <Bell size={26} />, title: 'Recordatorios', desc: 'Notificaciones push inteligentes para vacunas, medicación y citas veterinarias.', color: '#E8941E', bg: 'rgba(232, 148, 30, 0.1)' },
  { icon: <Shield size={26} />, title: 'Cuidadores Verificados', desc: 'Red de paseadores y cuidadores certificados con verificación KYC y reseñas reales.', color: '#F5A623', bg: 'rgba(245, 166, 35, 0.1)' },
  { icon: <Users size={26} />, title: 'Comunidad', desc: 'Conecta con otros dueños, comparte experiencias y encuentra compañeros de paseo.', color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.1)' },
];

function Features() {
  return (
    <section className="features-section" id="features">
      <div className="container">
        <AnimatedSection className="features-header">
          <motion.div variants={fadeUp} className="section-label"><Sparkles size={14} /> Funcionalidades</motion.div>
          <motion.h2 variants={fadeUp}>Todo lo que necesitas,<br /><span className="text-accent">en una sola app</span></motion.h2>
          <motion.p variants={fadeUp} className="section-desc">Diseñada para el bienestar animal con tecnología de última generación.</motion.p>
        </AnimatedSection>
        <AnimatedSection className="features-grid">
          {features.map((f, i) => (
            <motion.div key={i} className="feature-card" variants={fadeUp} whileHover={{ y: -8, transition: { duration: 0.3 } }}>
              <div className="feature-icon" style={{ background: f.bg, color: f.color }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div className="feature-link">Saber más <ArrowRight size={14} /></div>
            </motion.div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Showcase ──────────────────────────────────── */
function Showcase() {
  return (
    <section className="showcase-section" id="showcase">
      <div className="container">
        <div className="showcase-grid">
          <AnimatedSection className="showcase-content">
            <motion.div variants={fadeUp} className="section-label"><Sparkles size={14} /> Experiencia Premium</motion.div>
            <motion.h2 variants={fadeUp}>Creada para dueños<br /><span className="text-accent">exigentes</span></motion.h2>
            <motion.p variants={fadeUp} className="showcase-desc">
              PawMate eleva el estándar de las aplicaciones para mascotas.
              Rendimiento nativo, diseño cuidado al detalle y una experiencia que enamora desde el primer tap.
            </motion.p>
            <motion.ul className="showcase-checks" variants={stagger(0.1)}>
              {['Desarrollo nativo ultra rápido', 'Sincronización en la nube en tiempo real', 'Interfaz impecable en Dark y Light Mode', 'Soporte offline inteligente', 'Cifrado de datos end-to-end'].map((item) => (
                <motion.li key={item} variants={fadeUp}>
                  <CheckCircle2 size={18} className="check-icon" /><span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
            <motion.div variants={fadeUp}>
              <motion.button className="btn-primary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                Explorar Funciones <ArrowRight size={16} />
              </motion.button>
            </motion.div>
          </AnimatedSection>
          <AnimatedSection className="showcase-visual">
            <motion.div className="showcase-img-wrap" variants={scaleIn}>
              <img src="/premium_lifestyle.png" alt="PawMate Lifestyle" />
              <div className="showcase-img-overlay" />
            </motion.div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ────────────────────────────────────── */
function Stats() {
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });
  const c1 = useCounter(10000, 2000, inView);
  const c2 = useCounter(500, 1500, inView);
  const c3 = useCounter(50000, 2000, inView);
  const c4 = useCounter(98, 1200, inView);
  const stats = [
    { value: c1.toLocaleString(), suffix: '+', label: 'Mascotas Activas', icon: <PawPrint size={24} /> },
    { value: c2.toLocaleString(), suffix: '+', label: 'Cuidadores PRO', icon: <Shield size={24} /> },
    { value: c3.toLocaleString(), suffix: '+', label: 'Paseos Rastreados', icon: <Navigation2 size={24} /> },
    { value: c4.toString(), suffix: '%', label: 'Satisfacción', icon: <Heart size={24} /> },
  ];
  return (
    <section className="stats-section" ref={ref}>
      <div className="container">
        <AnimatedSection className="stats-grid">
          {stats.map((s, i) => (
            <motion.div key={i} className="stat-card" variants={fadeUp}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-number">{s.value}{s.suffix}</div>
              <div className="stat-label">{s.label}</div>
            </motion.div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Testimonials ─────────────────────────────── */
const testimonials = [
  { text: 'PawMate cambió completamente cómo cuido a Luna. El GPS es increíblemente preciso y la interfaz es una obra de arte.', name: 'Laura Gómez', role: 'Dueña de Luna 🐕', rating: 5 },
  { text: 'El Paw-Port revolucionó nuestras visitas al veterinario. Todo el historial escaneable en un segundo, sin papeleos.', name: 'Andrés Silva', role: 'Dueño de Coco 🐱', rating: 5 },
  { text: 'Como cuidadora profesional, PawMate me ha facilitado la gestión de mis paseos. Los dueños confían más gracias a la app.', name: 'María Costa', role: 'Cuidadora Certificada 🦮', rating: 5 },
  { text: 'El recordatorio de vacunas me salvó más de una vez. Ya no se me olvida nada, todo automatizado y súper bonito.', name: 'Carlos Ruiz', role: 'Dueño de Thor 🐕‍🦺', rating: 5 },
  { text: 'La comunidad de PawMate es genial. He conocido gente del barrio con la que ahora paseamos juntos todos los días.', name: 'Elena Torres', role: 'Dueña de Max 🐶', rating: 5 },
];

function Testimonials() {
  return (
    <section className="testimonials-section" id="testimonials">
      <div className="container">
        <AnimatedSection className="testimonials-header">
          <motion.div variants={fadeUp} className="section-label"><Star size={14} /> Testimonios</motion.div>
          <motion.h2 variants={fadeUp}>La comunidad <span className="text-accent">nos adora</span></motion.h2>
          <motion.p variants={fadeUp} className="section-desc">Miles de pet-parents ya confían en PawMate para el cuidado de sus mascotas.</motion.p>
        </AnimatedSection>
        <AnimatedSection className="testimonials-grid">
          {testimonials.map((t, i) => (
            <motion.div key={i} className="testimonial-card" variants={fadeUp} whileHover={{ y: -6 }}>
              <div className="testimonial-stars">
                {[...Array(t.rating)].map((_, j) => <Star key={j} size={16} fill="var(--gold)" color="var(--gold)" />)}
              </div>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────── */
function CTA() {
  return (
    <section className="cta-section" id="cta">
      <div className="cta-bg-pattern" />
      <div className="cta-glow" />
      <div className="container cta-inner">
        <AnimatedSection>
          <motion.div className="section-label cta-label" variants={fadeUp}><Download size={14} /> Descarga Gratuita</motion.div>
          <motion.h2 variants={fadeUp}>Tu mascota merece<br />lo mejor.</motion.h2>
          <motion.p variants={fadeUp} className="cta-desc">
            Únete a más de 10.000 familias que ya cuidan a sus mascotas con PawMate.
            Disponible en iOS y Android.
          </motion.p>
          <motion.div className="cta-buttons" variants={fadeUp}>
            <motion.button className="btn-white btn-lg" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Download size={18} /> App Store
            </motion.button>
            <motion.button className="btn-white-outline btn-lg" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Download size={18} /> Google Play
            </motion.button>
          </motion.div>
          <motion.div className="cta-badges" variants={fadeUp}>
            <div className="cta-badge">⭐ 4.9/5 Reseñas</div>
            <div className="cta-badge">🔥 +10K Descargas</div>
            <div className="cta-badge">🛡️ 100% Seguro</div>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────── */
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="nav-logo"><span className="logo-icon">🐾</span><span className="logo-text">PawMate</span></div>
            <p>La plataforma integral, moderna e inteligente para el cuidado de mascotas en España.</p>
            <div className="footer-socials">
              {[['📷', 'Instagram'], ['🐦', 'Twitter'], ['💼', 'LinkedIn']].map(([icon, label], i) => (
                <a key={i} className="social-btn" title={label}>{icon}</a>
              ))}
            </div>
          </div>
          <div className="footer-col">
            <h4>Producto</h4>
            <ul><li><a href="#">GPS Tracking</a></li><li><a href="#">Historial Médico</a></li><li><a href="#">Paw-Port QR</a></li><li><a href="#">Comunidad</a></li></ul>
          </div>
          <div className="footer-col">
            <h4>Empresa</h4>
            <ul><li><a href="#">Sobre Nosotros</a></li><li><a href="#">Contacto</a></li><li><a href="#">Blog</a></li><li><a href="#">Prensa</a></li></ul>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <ul><li><a href="#">Privacidad</a></li><li><a href="#">Términos</a></li><li><a href="#">Cookies</a></li><li><a href="#">GDPR</a></li></ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 PawMate · Desarrollado por <strong>Mohamed Sabbar</strong></span>
          <span className="footer-made">Hecho con 🧡 para las mascotas</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Landing Page ─────────────────────────────── */
function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <TrustBand />
      <Features />
      <Showcase />
      <Stats />
      <Testimonials />
      <CTA />
      <Footer />
    </>
  );
}

/* ─── Main App ─────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/confirm" element={<ConfirmPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}
