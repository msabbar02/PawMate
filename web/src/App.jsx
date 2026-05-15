/**
 * Landing principal de PawMate.
 *
 * Componente raíz que monta el router (`/`, `/confirm`, `/reset-password`),
 * la landing animada con escenas Three.js (fiber/drei), Framer Motion para
 * transiciones, i18next para idiomas y un toggle de tema oscuro/claro
 * persistente en `localStorage`.
 */
import { useState, useEffect, useRef, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import {
  Download, Menu, X, Sun, Moon, ArrowDown, MapPin,
  Shield, Star, Heart, Brain, Users,
  Mail, Globe, ChevronRight, Sparkles, Target,
  Rocket, Zap, Clock, Phone, Smartphone, Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './App.css';
import ConfirmPage from './pages/ConfirmPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

const APK_URL = 'https://expo.dev/accounts/msabbar/projects/pawmate/builds/a8f2a2ea-285a-4fdb-8f80-ffdf7ab03aa0';

/** Variantes de animación de Framer Motion reutilizadas en toda la landing. */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = (delay = 0.1) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

/**
 * Envuelve un bloque para animarlo cuando entra en viewport (una sola vez).
 * Usa `react-intersection-observer` con un umbral muy bajo para disparar
 * la animación en cuanto asoma cualquier píxel de la sección.
 */
function AnimatedSection({ children, className, delay = 0.1 }) {
  const [ref, inView] = useInView({ threshold: 0.06, triggerOnce: true });
  return (
    <motion.div ref={ref} variants={stagger(delay)} initial="hidden" animate={inView ? 'show' : 'hidden'} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Hook que sustituye el cursor del documento por una huellita SVG
 * embebida (data URI). Se restaura al desmontar.
 */
function usePawCursor() {
  useEffect(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 100 100'><circle cx='35' cy='22' r='10' fill='%23F5A623'/><circle cx='65' cy='22' r='10' fill='%23F5A623'/><circle cx='18' cy='46' r='8' fill='%23FF6B35'/><circle cx='82' cy='46' r='8' fill='%23FF6B35'/><ellipse cx='50' cy='64' rx='20' ry='18' fill='%23F5A623'/></svg>`;
    document.body.style.cursor = `url("data:image/svg+xml,${svg}") 14 14, auto`;
    return () => { document.body.style.cursor = ''; };
  }, []);
}

/**
 * Hook que gestiona el tema oscuro/claro persistido en `localStorage`
 * y aplicado mediante el atributo `data-theme` del `<html>`.
 *
 * @returns {[string, () => void]} Tupla `[tema, toggle]`.
 */
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('pawmate-theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pawmate-theme', theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return [theme, toggle];
}

/* ===================================================
   COMPONENTES 3D (THREE.JS)
   =================================================== */

/**
 * Caché a nivel de módulo de las posiciones de partículas para evitar
 * recalcularlas en cada render. La clave es el número de partículas.
 */
const _particleCache = new Map();
/** Devuelve un `Float32Array` con `count*3` posiciones aleatorias cacheadas. */
function getParticlePositions(count) {
  if (!_particleCache.has(count)) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    _particleCache.set(count, pos);
  }
  return _particleCache.get(count);
}

/**
 * Almohadilla 3D animada (huella) compuesta por una esfera principal y
 * cuatro "dedos". Flota suavemente con `useFrame`.
 */
function PawPad({ position, scale = 1, speed = 1, color = '#F5A623' }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.5) * 0.3;
      ref.current.rotation.y = state.clock.elapsedTime * speed * 0.3;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
    }
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {/* Almohadilla principal */}
      <mesh position={[0, -0.15, 0]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Almohadilla principal */}
      {/* Dedos de la huella */}
      {[[-0.35, 0.35, 0.1], [0.35, 0.35, 0.1], [-0.2, 0.55, 0.15], [0.2, 0.55, 0.15]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={i < 2 ? '#FF6B35' : color} roughness={0.3} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/** Esfera con material distorsionado y flotación suave (efecto "orb"). */
function GlowOrb({ position, color = '#F5A623', size = 1 }) {
  return (
    <Float speed={2} floatIntensity={1.5} rotationIntensity={0.5}>
      <Sphere args={[size, 64, 64]} position={position}>
        <MeshDistortMaterial
          color={color}
          roughness={0.15}
          metalness={0.3}
          distort={0.4}
          speed={2}
          transparent
          opacity={0.6}
        />
      </Sphere>
    </Float>
  );
}

/** Sistema de partículas que gira lentamente sobre sí mismo. */
function Particles({ count = 60 }) {
  const points = useRef();
  const positions = getParticlePositions(count);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.02;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#F5A623" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

/** Escena 3D principal del hero (varias huellas, orbs y partículas). */
function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 60 }} style={{ position: 'absolute', inset: 0 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#FFF3E0" />
      <pointLight position={[-3, 2, 3]} intensity={0.5} color="#FF6B35" />
      <pointLight position={[3, -2, 2]} intensity={0.4} color="#F5A623" />

      <PawPad position={[-3.5, 1.5, -1]} scale={0.6} speed={0.8} />
      <PawPad position={[3.8, -1, -2]} scale={0.5} speed={0.6} color="#FF6B35" />
      <PawPad position={[-2, -2, -1.5]} scale={0.4} speed={1.1} />
      <PawPad position={[2.5, 2.5, -3]} scale={0.35} speed={0.7} color="#FF6B35" />

      <GlowOrb position={[-4, 0, -3]} color="#F5A623" size={1.2} />
      <GlowOrb position={[4.5, -1.5, -4]} color="#FF6B35" size={0.9} />
      <GlowOrb position={[0, 3, -5]} color="#F5A623" size={0.7} />

      <Particles count={80} />
    </Canvas>
  );
}

/** Fondo 3D abstracto reutilizado por secciones secundarias. */
function SectionScene({ color1 = '#F5A623', color2 = '#FF6B35' }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={0.4} color={color1} />
      <GlowOrb position={[-3, 1, -2]} color={color1} size={0.8} />
      <GlowOrb position={[3, -1, -3]} color={color2} size={0.6} />
      <Particles count={30} />
    </Canvas>
  );
}

/* ===================================================
   COMPONENTES DE PÁGINA
   =================================================== */

/** Barra de navegación con scroll-spy, menú móvil y selector de tema/idioma. */
function Navbar({ theme, toggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const isES = i18n.language === 'es';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const links = [
    [t('nav.home'), 'hero'],
    [t('nav.about'), 'about'],
    [t('nav.mission'), 'mission'],
    [t('nav.future'), 'future'],
    [t('nav.contact'), 'contact'],
  ];

  return (
    <motion.nav
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="navbar-inner">
        <div className="nav-logo" onClick={() => scrollTo('hero')}>
          <img src="/icon.png" alt="PawMate" style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: '50%' }} />
        </div>
        <ul className="nav-links">
          {links.map(([label, id]) => (
            <li key={id}><a onClick={() => scrollTo(id)}>{label}</a></li>
          ))}
        </ul>
        <div className="nav-actions">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>
          </button>
          <button className="lang-flag-btn" onClick={() => i18n.changeLanguage(isES ? 'en' : 'es')} aria-label="Language">
            <span className={`fi fi-${isES ? 'gb' : 'es'}`} style={{ borderRadius: 3 }}></span>
            <span>{isES ? 'EN' : 'ES'}</span>
          </button>
          <motion.button className="btn-primary btn-sm" onClick={() => scrollTo('download')} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Download size={16} /> {t('nav.download')}
          </motion.button>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div className="mobile-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
            {links.map(([label, id]) => (
              <a key={id} className="mobile-link" onClick={() => scrollTo(id)}>{label}</a>
            ))}
            <div className="mobile-row">
              <a className="mobile-link" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              </a>
              <a className="mobile-link" onClick={() => i18n.changeLanguage(isES ? 'en' : 'es')}>
                <span className={`fi fi-${isES ? 'gb' : 'es'}`} style={{ borderRadius: 3 }}></span>
                {isES ? 'English' : 'Español'}
              </a>
            </div>
            <button className="btn-primary mobile-cta" onClick={() => scrollTo('download')}>
              <Download size={16} /> {t('nav.download')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

/** Sección hero con escena 3D, título, CTAs y barra de estadísticas. */
function Hero() {
  const { t } = useTranslation();
  const stats = [
    { num: '100%', label: t('hero.statVerified') },
    { num: 'GPS', label: t('hero.statGps') },
    { num: 'SOS', label: t('hero.statSos') },
    { num: '5★', label: t('hero.statRating') },
  ];
  return (
    <section className="hero" id="hero">
      <div className="hero-3d">
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      </div>
      <div className="hero-gradient-overlay" />
      <div className="hero-inner">
        <AnimatedSection className="hero-content">
          <motion.div className="hero-badge" variants={fadeUp}>
            <Sparkles size={14} />
            <span>{t('hero.tagline')}</span>
          </motion.div>
          <motion.h1 variants={fadeUp}>
            {t('hero.title1')}<br />
            <span className="text-gradient">{t('hero.title2')}</span>
          </motion.h1>
          <motion.p className="hero-desc" variants={fadeUp}>
            {t('hero.desc')}
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp}>
            <motion.a
              className="btn-primary btn-lg btn-glow"
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
            >
              <Download size={20} /> {t('hero.downloadBtn')}
            </motion.a>
            <motion.button
              className="btn-glass btn-lg"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t('hero.learnMore')} <ChevronRight size={18} />
            </motion.button>
          </motion.div>
          <motion.div className="hero-stats" variants={fadeUp}>
            {stats.map((s, i) => (
              <div key={i} className="hero-stat">
                <div className="hero-stat-num">{s.num}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </AnimatedSection>
      </div>
      <motion.div
        className="hero-scroll"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <ArrowDown size={22} />
      </motion.div>
    </section>
  );
}

/** Sección "Sobre nosotros" con imágenes y dos tarjetas descriptivas. */
function About() {
  const { t } = useTranslation();
  return (
    <section className="section about-section" id="about">
      <div className="container">
        <AnimatedSection className="section-header">
          <motion.div variants={fadeUp} className="section-badge">
            <Heart size={14} /> {t('about.label')}
          </motion.div>
          <motion.h2 variants={fadeUp}>
            {t('about.title1')}<br /><span className="text-gradient">{t('about.title2')}</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="section-desc">{t('about.desc')}</motion.p>
        </AnimatedSection>

        <AnimatedSection className="about-grid">
          <motion.div className="about-image-group" variants={scaleIn}>
            <div className="about-img-single">
              <img src="/hero_dog_walk.png" alt="PawMate" />
            </div>
          </motion.div>
          <div className="about-cards">
            <motion.div className="glass-card" variants={fadeUp}>
              <div className="card-icon"><Heart size={24} /></div>
              <h3>{t('about.card1Title')}</h3>
              <p>{t('about.card1Desc')}</p>
            </motion.div>
            <motion.div className="glass-card" variants={fadeUp}>
              <div className="card-icon"><Users size={24} /></div>
              <h3>{t('about.card2Title')}</h3>
              <p>{t('about.card2Desc')}</p>
            </motion.div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

/** Sección de misión/objetivo con imagen, descripción y lista de puntos clave. */
function Mission() {
  const { t } = useTranslation();
  const points = [
    { icon: <Shield size={22} />, text: t('mission.point1') },
    { icon: <MapPin size={22} />, text: t('mission.point2') },
    { icon: <Star size={22} />, text: t('mission.point3') },
    { icon: <Zap size={22} />, text: t('mission.point4') },
    { icon: <Clock size={22} />, text: t('mission.point5') },
    { icon: <Phone size={22} />, text: t('mission.point6') },
  ];
  return (
    <section className="section mission-section" id="mission">
      <div className="section-3d-bg">
        <Suspense fallback={null}>
          <SectionScene />
        </Suspense>
      </div>
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="mission-layout">
          <AnimatedSection className="mission-visual">
            <motion.div className="mission-img-wrap" variants={scaleIn}>
              <img src="/active_lifestyle.png" alt="Active lifestyle with dog" />
            </motion.div>
          </AnimatedSection>
          <AnimatedSection className="mission-content">
            <motion.div variants={fadeUp} className="section-badge">
              <Target size={14} /> {t('mission.label')}
            </motion.div>
            <motion.h2 variants={fadeUp}>
              {t('mission.title1')}<br /><span className="text-gradient">{t('mission.title2')}</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mission-desc">{t('mission.desc')}</motion.p>
            <motion.ul className="mission-points" variants={stagger(0.08)}>
              {points.map((p, i) => (
                <motion.li key={i} variants={fadeUp} className="mission-point">
                  <div className="point-icon">{p.icon}</div>
                  <span>{p.text}</span>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/** Sección con tarjetas de funcionalidades futuras ("Próximamente"). */
function Future() {
  const { t } = useTranslation();
  const ideas = [
    { icon: <Brain size={28} />, title: t('future.idea1Title'), desc: t('future.idea1Desc'), color: '#F5A623' },
    { icon: <Smartphone size={28} />, title: t('future.idea2Title'), desc: t('future.idea2Desc'), color: '#FF6B35' },
    { icon: <Zap size={28} />, title: t('future.idea3Title'), desc: t('future.idea3Desc'), color: '#E8951A' },
  ];
  return (
    <section className="section future-section" id="future">
      <div className="container">
        <AnimatedSection className="section-header">
          <motion.div variants={fadeUp} className="section-badge">
            <Rocket size={14} /> {t('future.label')}
          </motion.div>
          <motion.h2 variants={fadeUp}>
            {t('future.title1')}<br /><span className="text-gradient">{t('future.title2')}</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="section-desc">{t('future.desc')}</motion.p>
        </AnimatedSection>
        <AnimatedSection className="future-grid">
          {ideas.map((idea, i) => (
            <motion.div key={i} className="future-card glass-card" variants={fadeUp} whileHover={{ y: -8, transition: { duration: 0.25 } }}>
              <div className="future-icon" style={{ color: idea.color, background: `${idea.color}18` }}>
                {idea.icon}
              </div>
              <h3>{idea.title}</h3>
              <p>{idea.desc}</p>
              <div className="future-tag">Coming Soon</div>
            </motion.div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

/** Sección de contacto: email, redes sociales y ubicación. */
function Contact() {
  const { t } = useTranslation();
  return (
    <section className="section contact-section" id="contact">
      <div className="container">
        <AnimatedSection className="section-header">
          <motion.div variants={fadeUp} className="section-badge">
            <Mail size={14} /> {t('contact.label')}
          </motion.div>
          <motion.h2 variants={fadeUp}>
            {t('contact.title1')}<br /><span className="text-gradient">{t('contact.title2')}</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="section-desc">{t('contact.desc')}</motion.p>
        </AnimatedSection>
        <AnimatedSection className="contact-grid">
          <motion.a href="mailto:noreply@apppawmate.com" className="contact-card glass-card" variants={fadeUp} whileHover={{ y: -4 }}>
            <div className="contact-icon"><Mail size={28} /></div>
            <h3>{t('contact.emailLabel')}</h3>
            <p>{t('contact.emailGeneral')}</p>
            <p className="contact-sub">{t('contact.emailSupport')}</p>
          </motion.a>
          <motion.a href="https://instagram.com/apppawmate" target="_blank" rel="noopener" className="contact-card glass-card" variants={fadeUp} whileHover={{ y: -4 }}>
            <div className="contact-icon"><Globe size={28} /></div>
            <h3>{t('contact.socialLabel')}</h3>
            <p>@apppawmate</p>
          </motion.a>
          <motion.div className="contact-card glass-card" variants={fadeUp} whileHover={{ y: -4 }}>
            <div className="contact-icon"><MapPin size={28} /></div>
            <h3>{t('contact.locationLabel')}</h3>
            <p>{t('contact.location')}</p>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}

/** Llamada a la acción final con escena 3D y botón de descarga del APK. */
function DownloadSection() {
  const { t } = useTranslation();
  const features = [
    t('download.feat1'), t('download.feat2'), t('download.feat3'), t('download.feat4'),
  ].filter(Boolean);
  return (
    <section className="download-section" id="download">
      <div className="download-3d">
        <Suspense fallback={null}>
          <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
            <ambientLight intensity={0.3} />
            <pointLight position={[3, 3, 3]} color="#F5A623" intensity={0.8} />
            <PawPad position={[0, 0, 0]} scale={1.2} speed={0.5} />
            <GlowOrb position={[-3, 1, -2]} color="#FF6B35" size={0.6} />
            <GlowOrb position={[3, -1, -2]} color="#F5A623" size={0.5} />
            <Particles count={40} />
          </Canvas>
        </Suspense>
      </div>
      <div className="container download-inner">
        <AnimatedSection>
          <motion.div className="section-badge download-badge" variants={fadeUp}>
            <Download size={14} /> {t('nav.download')}
          </motion.div>
          <motion.h2 variants={fadeUp}>
            {t('download.title1')}<br />{t('download.title2')}
          </motion.h2>
          <motion.p variants={fadeUp} className="download-desc">
            {t('download.desc')}
          </motion.p>
          {features.length > 0 && (
            <motion.ul className="download-features" variants={fadeUp}>
              {features.map((f, i) => (
                <li key={i}><Check size={15} style={{ color: '#F5A623', flexShrink: 0 }} /> {f}</li>
              ))}
            </motion.ul>
          )}
          <motion.div className="download-badges" variants={fadeUp}>
            <motion.a
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="badge-android"
              whileHover={{ scale: 1.04, y: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C14.15 1.23 13.1 1 12 1c-1.1 0-2.15.23-3.1.63L7.43.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.45 3.28 5 5.52 5 8h14c0-2.48-1.45-4.72-3.47-5.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
              <div className="badge-android-label">
                <span className="badge-android-sub">{t('download.btnSub') || 'Android APK'}</span>
                <span className="badge-android-main">{t('download.btn')}</span>
              </div>
            </motion.a>
          </motion.div>
          <motion.p className="download-note" variants={fadeUp}>{t('download.note')}</motion.p>
        </AnimatedSection>
      </div>
    </section>
  );
}

/** Pie de página con logo, copyright y descripción breve. */
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <div className="container footer-simple">
        <img src="/icon.png" alt="PawMate" style={{ height: 36, width: 36, objectFit: 'cover', borderRadius: '50%' }} />
        <span>{t('footer.copyright')}</span>
        <span>{t('footer.desc')}</span>
      </div>
    </footer>
  );
}

/** Composición de la landing (orden de secciones). */
function LandingPage() {
  usePawCursor();
  const [theme, toggleTheme] = useTheme();
  return (
    <>
      <Navbar theme={theme} toggleTheme={toggleTheme} />
      <Hero />
      <About />
      <Mission />
      <Future />
      <Contact />
      <DownloadSection />
      <Footer />
    </>
  );
}

/** Componente raíz de la web. Define las rutas públicas. */
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
