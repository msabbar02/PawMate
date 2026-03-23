import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import {
  MapPin, Heart, Shield, Bell, Users, Zap, Navigation2,
  ArrowRight, CheckCircle2, Download, Smartphone, ChevronRight, Menu, X, Star
} from 'lucide-react';
import './App.css';

// ─── Animation Helpers ────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = (delay = 0.1) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

function AnimatedSection({ children, className, delay = 0.1 }) {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  return (
    <motion.div
      ref={ref}
      variants={stagger(delay)}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Navbar ───────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <div className="nav-logo">
          <span>🐾</span> PawMate
        </div>
        <ul className="nav-links">
          {[['Inicio', 'hero'], ['Funciones', 'features'], ['App', 'showcase'], ['Comunidad', 'community']].map(([label, id]) => (
            <li key={id}><a onClick={() => scrollTo(id)}>{label}</a></li>
          ))}
        </ul>
        <div className="nav-cta">
          <motion.button
            className="btn-primary"
            onClick={() => scrollTo('cta')}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          >
            Obtener App
          </motion.button>
        </div>
        <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} color="var(--forest)" /> : <Menu size={24} color="var(--forest)" />}
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 10, scale: 1 }} 
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ 
              position: 'absolute', top: '100%', left: 0, width: '100%',
              background: 'white', borderRadius: 24, padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid var(--mist)',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }}
          >
            {[['Inicio', 'hero'], ['Funciones', 'features'], ['App', 'showcase'], ['Comunidad', 'community'], ['Descargar', 'cta']].map(([label, id]) => (
              <div key={id} style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', padding: '8px 0' }}
                onClick={() => scrollTo(id)}>{label}</div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Hero Section ─────────────────────────────────
function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="hero-inner">
        <AnimatedSection>
          <motion.div variants={fadeUp}>
            <div className="hero-label">
              <span className="hero-label-dot" />
              La App de Mascotas #1 en España
            </div>
          </motion.div>
          <motion.h1 variants={fadeUp}>
            El cuidado de tu<br />mascota, <span className="accent">inteligente.</span>
          </motion.h1>
          <motion.p className="hero-desc" variants={fadeUp}>
            PawMate es la plataforma definitiva para dueños. GPS en vivo,
            historial médico completo, red de cuidadores y pasaporte biométrico.
          </motion.p>
          <motion.div className="hero-buttons" variants={fadeUp}>
            <motion.button className="btn-primary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Download size={18} /> Descargar Gratis
            </motion.button>
            <motion.button className="btn-outline" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              Ver Demo <ChevronRight size={18} />
            </motion.button>
          </motion.div>
          <motion.div className="hero-stats" variants={fadeUp}>
            {[['10k+', 'Usuarios'], ['4.9★', 'Valoración App Store']].map(([val, lbl]) => (
              <div key={lbl} className="hero-stat-item">
                <div className="hero-stat-value">{val}</div>
                <div className="hero-stat-label">{lbl}</div>
              </div>
            ))}
          </motion.div>
        </AnimatedSection>

        <AnimatedSection>
          <motion.div className="hero-visual" variants={fadeUp}>
            <div className="hero-img-wrap">
              {/* Premium 3D Hero Image */}
              <img src="/premium_hero.png" alt="PawMate App 3D Mockup" />
            </div>
            <motion.div
              className="hero-float-badge"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div style={{ fontSize: 24 }}>✨</div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--slate)', fontWeight: 600 }}>Diseño Ganador</div>
                <div style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 800 }}>UI/UX Excellence</div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ─── Trust Band ────────────────────────────────────
function TrustBand() {
  return (
    <div className="trust-band">
      <div className="trust-band-inner">
        {[
          ['🔒', 'Datos 100% seguros'],
          ['⚡', 'Sincronización real'],
          ['🐾', 'Todas las especies'],
          ['🌍', 'Líder en España'],
          ['📱', 'App Nativa Fluida']
        ].map(([icon, text]) => (
          <div key={text} className="trust-item">
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bento Grid Features ─────────────────────────
function BentoFeatures() {
  return (
    <section className="bento-section" id="features">
      <AnimatedSection>
        <motion.div className="bento-header" variants={fadeUp}>
          <h2>Todo lo que tu mascota necesita,<br /><span style={{ color: 'var(--forest)' }}>en una sola app</span></h2>
          <p>Potencia, diseño y simplicidad convergen en PawMate. Explora nuestro ecosistema de funcionalidades pensadas para el bienestar animal.</p>
        </motion.div>
      </AnimatedSection>

      <AnimatedSection>
        <motion.div className="bento-grid" variants={stagger(0.1)}>
          
          {/* Card 1: GPS Tracking (Large + Tall) */}
          <motion.div className="bento-item bento-large bento-tall" variants={fadeUp}>
            <div className="bento-content">
              <div className="bento-icon"><Navigation2 size={28} /></div>
              <h3>GPS Tracking Inteligente</h3>
              <p style={{ maxWidth: 400 }}>Registra cada paseo con precisión milimétrica. Nuestro mapa captura la ruta exacta, calcula la distancia y estima las calorías quemadas.</p>
            </div>
            <div className="bento-visual" style={{ marginTop: 40 }}>
              <img src="/premium_bento_map.png" alt="GPS Tracking Map" className="bento-img" />
            </div>
          </motion.div>

          {/* Card 2: Recordatorios */}
          <motion.div className="bento-item" variants={fadeUp}>
            <div className="bento-icon"><Bell size={24} /></div>
            <h3>Recordatorios Smart</h3>
            <p>Nunca vuelvas a olvidar una vacuna o pastilla. Notificaciones push automatizadas en tu móvil.</p>
          </motion.div>

          {/* Card 3: Paw-Port */}
          <motion.div className="bento-item dark" variants={fadeUp}>
            <div className="bento-icon"><Shield size={24} /></div>
            <h3>Paw-Port Biométrico</h3>
            <p>Un QR dinámico que contiene todo el historial médico de tu peludo. Escaneable en urgencias.</p>
          </motion.div>

          {/* Card 4: Salud */}
          <motion.div className="bento-item bento-large" variants={fadeUp} style={{ flexDirection: 'row', gap: 40, alignItems: 'center' }}>
            <div className="bento-content" style={{ flex: 1 }}>
              <div className="bento-icon"><Heart size={28} /></div>
              <h3>Historial de Salud Interactivo</h3>
              <p>Di adiós a los papeles. Mantén un registro limpio de peso, alergias, operaciones y contactos veterinarios sincronizados en la nube.</p>
            </div>
            <div className="bento-visual" style={{ flex: 1.2, marginTop: 0, alignSelf: 'stretch', alignItems: 'center' }}>
              <img src="/premium_bento_health.png" alt="Health Dashboard" className="bento-img" style={{ boxShadow: 'none' }} />
            </div>
          </motion.div>

          {/* Card 5: Cuidadores */}
          <motion.div className="bento-item" variants={fadeUp}>
            <div className="bento-icon"><Shield size={24} /></div>
            <h3>Cuidadores Certificados</h3>
            <p>Encuentra paseadores de confianza verificados mediante KYC y sistema de reseñas.</p>
          </motion.div>

        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── Lifestyle Showcase ───────────────────────────
function Lifestyle() {
  return (
    <section className="lifestyle-section" id="showcase">
      <AnimatedSection>
        <motion.div className="lifestyle-inner" variants={stagger(0.15)}>
          <motion.div className="lifestyle-visual" variants={fadeUp}>
            <img src="/premium_lifestyle.png" alt="Happy Dog with glowing collar" className="lifestyle-img" />
          </motion.div>
          <motion.div className="lifestyle-content" variants={fadeUp}>
            <div className="section-tag" style={{ background: 'var(--mint-light)', color: 'var(--forest)', padding: '6px 16px', borderRadius: 99, display: 'inline-block', marginBottom: 20, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
              Experiencia Premium
            </div>
            <h2>Creada para dueños<br />exigentes</h2>
            <p>
              PawMate eleva el estándar de las aplicaciones para mascotas. Nuestro diseño 
              minucioso y el rendimiento extremadamente fluido te enamorarán desde el primer tap.
            </p>
            <ul className="check-list">
              {[
                'Desarrollo nativo ultra rápido',
                'Integración con Firebase Cloud Services',
                'Experiencia impecable en Dark y Light Mode',
                'Soporte offline inteligente'
              ].map(item => (
                <li key={item}>
                  <div className="check-icon"><CheckCircle2 size={16} /></div>
                  {item}
                </li>
              ))}
            </ul>
            <motion.button className="btn-primary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
               Explorar Funciones <ArrowRight size={16} />
            </motion.button>
          </motion.div>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── Stats Section ────────────────────────────────
function Stats() {
  return (
    <section className="stats-section">
      <AnimatedSection>
        <motion.div className="stats-grid" variants={stagger(0.1)}>
          {[
            { value: '10K', label: 'Mascotas Activas' },
            { value: '500+', label: 'Cuidadores PRO' },
            { value: '50K', label: 'Paseos' },
            { value: '98%', label: 'Satisfacción' },
          ].map((s) => (
            <motion.div key={s.label} className="stat-block" variants={fadeUp}>
              <div className="stat-block-value">
                {s.value}
              </div>
              <div className="stat-block-label">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── Testimonials Section ─────────────────────────
const testimonials = [
  { text: 'PawMate es increíble. El diseño es simplemente espectacular y súper fluido. Nunca había usado una app tan bien construida para mascotas.', name: 'Laura Gómez', pet: 'Dueña de Luna', avatar: '👩' },
  { text: 'La función de Paw-Port revolucionó nuestras visitas al veterinario. Todo está ahí, escaneable en un segundo.', name: 'Andrés Silva', pet: 'Dueño de Coco', avatar: '👨🏼' },
  { text: 'El GPS funciona perfecto. La precisión es brutal y el renderizado del mapa es precioso. Una obra maestra.', name: 'María Costa', pet: 'Dueña de Thor', avatar: '👩🏾' },
];

function Testimonials() {
  return (
    <section className="testimonials-section" id="community">
      <AnimatedSection>
        <motion.div className="testimonials-header" variants={fadeUp}>
          <h2>Amados por la comunidad</h2>
          <p>La opción número uno para pet-parents en España.</p>
        </motion.div>
      </AnimatedSection>
      <AnimatedSection>
        <motion.div className="testimonials-grid" variants={stagger(0.1)}>
          {testimonials.map((t, i) => (
            <motion.div key={i} className="testimonial-card" variants={fadeUp} whileHover={{ y: -6 }}>
              <div className="testimonial-stars">
                {Array(5).fill(0).map((_, j) => <span key={j} className="star">★</span>)}
              </div>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.avatar}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-pet">{t.pet}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── CTA Section ──────────────────────────────────
function CTA() {
  return (
    <section className="cta-section" id="cta">
      <AnimatedSection>
        <motion.div variants={fadeUp}>
          <h2>Tu mascota merece<br />lo mejor.</h2>
          <p>Únete a la nueva era del cuidado animal. Descarga PawMate hoy.</p>
          <div className="cta-buttons">
            <motion.button className="btn-white" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Download size={18} /> Consíguela en App Store
            </motion.button>
          </div>
          <div className="app-badges">
            <div className="app-badge"><span style={{ fontSize: 20 }}>⭐</span> 4.9/5 Reseñas</div>
            <div className="app-badge"><span style={{ fontSize: 20 }}>🔥</span> +10k Descargas</div>
          </div>
        </motion.div>
      </AnimatedSection>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="nav-logo" style={{ marginBottom: 0 }}>
            <span>🐾</span> PawMate
          </div>
          <p>La plataforma integral, moderna e inteligente para el cuidado de mascotas en España.</p>
        </div>
        <div className="footer-col">
          <h4>Producto</h4>
          <ul>
            <li><a href="#">Tracking GPS</a></li>
            <li><a href="#">Historial Médico</a></li>
            <li><a href="#">Comunidad</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Empresa</h4>
          <ul>
            <li><a href="#">Sobre Nosotros</a></li>
            <li><a href="#">Contacto</a></li>
            <li><a href="#">Prensa</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Privacidad</a></li>
            <li><a href="#">Términos</a></li>
            <li><a href="#">Cookies</a></li>
          </ul>
        </div>
      </div>
      <hr className="footer-divider" />
      <div className="footer-bottom">
        <div className="footer-bottom-left">
          © 2026 PawMate · Desarrollado por <strong>Mohamed Sabbar</strong>
        </div>
        <div className="footer-socials">
          {['📷', '🐦', '💼'].map((icon, i) => (
            <div key={i} className="social-btn">{icon}</div>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Main App ─────────────────────────────────────
export default function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <TrustBand />
      <BentoFeatures />
      <Lifestyle />
      <Stats />
      <Testimonials />
      <CTA />
      <Footer />
    </>
  );
}
