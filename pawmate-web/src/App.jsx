import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart, faShield, faBell, faUsers, faLocationArrow,
  faArrowRight, faCircleCheck, faDownload,
  faBars, faXmark, faStar, faQrcode,
  faWandMagicSparkles, faArrowDown, faPaw,
  faMoon, faSun
} from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const links = [[t('nav.home'), 'hero'], [t('nav.features'), 'features'], [t('nav.app'), 'showcase'], [t('nav.testimonials'), 'testimonials']];

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
          <button className="theme-toggle" onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')} aria-label="Language">{i18n.language === 'es' ? 'EN' : 'ES'}</button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? <FontAwesomeIcon icon={faSun} style={{ fontSize: 18 }} /> : <FontAwesomeIcon icon={faMoon} style={{ fontSize: 18 }} />}
          </button>
          <motion.button className="btn-nav-cta" onClick={() => scrollTo('cta')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {t('nav.downloadApp')}
          </motion.button>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <FontAwesomeIcon icon={faXmark} style={{ fontSize: 22 }} /> : <FontAwesomeIcon icon={faBars} style={{ fontSize: 22 }} />}
        </button>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div className="mobile-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
            {links.map(([label, id]) => (
              <a key={id} className="mobile-link" onClick={() => scrollTo(id)}>{label}</a>
            ))}
            <a className="mobile-link" onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')}>
              🌐 {i18n.language === 'es' ? 'EN' : 'ES'}
            </a>
            <a className="mobile-link" onClick={toggleTheme}>
              {dark ? <FontAwesomeIcon icon={faSun} style={{ fontSize: 16 }} /> : <FontAwesomeIcon icon={faMoon} style={{ fontSize: 16 }} />} {dark ? t('nav.lightMode') : t('nav.darkMode')}
            </a>
            <button className="btn-primary mobile-cta" onClick={() => scrollTo('cta')}>
              <FontAwesomeIcon icon={faDownload} style={{ fontSize: 16 }} /> {t('nav.downloadApp')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

/* ─── Hero ─────────────────────────────────────── */
function Hero() {
  const { t } = useTranslation();
  const words = [t('hero.word1'), t('hero.word2'), t('hero.word3'), t('hero.word4')];
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
                <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 14 }} />
                <span>{t('hero.badge')}</span>
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp}>
              {t('hero.titlePrefix')}{' '}
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
              {t('hero.desc')}
            </motion.p>
            <motion.div className="hero-buttons" variants={fadeUp}>
              <motion.button className="btn-primary btn-lg" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <FontAwesomeIcon icon={faDownload} style={{ fontSize: 20 }} /> {t('hero.downloadFree')}
              </motion.button>
              <motion.button className="btn-ghost" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {t('hero.learnMore')} <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 16 }} />
              </motion.button>
            </motion.div>
            <motion.div className="hero-metrics" variants={fadeUp}>
              <div className="metric">
                <div className="metric-value">10K+</div>
                <div className="metric-label">{t('hero.activeUsers')}</div>
              </div>
              <div className="metric-divider" />
              <div className="metric">
                <div className="metric-value">4.9</div>
                <div className="metric-stars">
                  {[...Array(5)].map((_, i) => <FontAwesomeIcon key={i} icon={faStar} style={{ fontSize: 14, color: 'var(--gold)' }} />)}
                </div>
              </div>
              <div className="metric-divider" />
              <div className="metric">
                <div className="metric-value">50K+</div>
                <div className="metric-label">{t('hero.trackedWalks')}</div>
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
                <div><div className="float-title">{t('hero.gpsActive')}</div><div className="float-sub">{t('hero.gpsPrecision')}</div></div>
              </motion.div>
              <motion.div className="hero-float-card hero-float-bottom"
                animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <div className="float-icon">🧡</div>
                <div><div className="float-title">{t('hero.healthUpToDate')}</div><div className="float-sub">{t('hero.healthSub')}</div></div>
              </motion.div>
            </motion.div>
          </AnimatedSection>
        </div>
      </div>

      <div className="hero-scroll-hint">
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 20 }} />
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Marquee Trust Band ───────────────────────── */
function TrustBand() {
  const { t } = useTranslation();
  const items = [
    ['🔒', t('trust.secureData')], ['⚡', t('trust.realSync')], ['🐾', t('trust.allSpecies')],
    ['🌍', t('trust.leaderSpain')], ['📱', t('trust.nativeApp')], ['🏥', t('trust.vetHistory')],
    ['🎯', t('trust.highPrecisionGps')], ['👥', t('trust.activeCommunity')],
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
function Features() {
  const { t } = useTranslation();
  const features = [
    { icon: <FontAwesomeIcon icon={faLocationArrow} style={{ fontSize: 26 }} />, title: t('features.gpsTitle'), desc: t('features.gpsDesc'), color: '#F5A623', bg: 'rgba(245, 166, 35, 0.1)' },
    { icon: <FontAwesomeIcon icon={faHeart} style={{ fontSize: 26 }} />, title: t('features.healthTitle'), desc: t('features.healthDesc'), color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.1)' },
    { icon: <FontAwesomeIcon icon={faQrcode} style={{ fontSize: 26 }} />, title: t('features.qrTitle'), desc: t('features.qrDesc'), color: '#1A1A2E', bg: 'rgba(26, 26, 46, 0.08)' },
    { icon: <FontAwesomeIcon icon={faBell} style={{ fontSize: 26 }} />, title: t('features.remindersTitle'), desc: t('features.remindersDesc'), color: '#E8941E', bg: 'rgba(232, 148, 30, 0.1)' },
    { icon: <FontAwesomeIcon icon={faShield} style={{ fontSize: 26 }} />, title: t('features.caregiversTitle'), desc: t('features.caregiversDesc'), color: '#F5A623', bg: 'rgba(245, 166, 35, 0.1)' },
    { icon: <FontAwesomeIcon icon={faUsers} style={{ fontSize: 26 }} />, title: t('features.communityTitle'), desc: t('features.communityDesc'), color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.1)' },
  ];
  return (
    <section className="features-section" id="features">
      <div className="container">
        <AnimatedSection className="features-header">
          <motion.div variants={fadeUp} className="section-label"><FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 14 }} /> {t('features.label')}</motion.div>
          <motion.h2 variants={fadeUp}>{t('features.title1')}<br /><span className="text-accent">{t('features.title2')}</span></motion.h2>
          <motion.p variants={fadeUp} className="section-desc">{t('features.desc')}</motion.p>
        </AnimatedSection>
        <AnimatedSection className="features-grid">
          {features.map((f, i) => (
            <motion.div key={i} className="feature-card" variants={fadeUp} whileHover={{ y: -8, transition: { duration: 0.3 } }}>
              <div className="feature-icon" style={{ background: f.bg, color: f.color }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div className="feature-link">{t('features.learnMore')} <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 14 }} /></div>
            </motion.div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Showcase ──────────────────────────────────── */
function Showcase() {
  const { t } = useTranslation();
  return (
    <section className="showcase-section" id="showcase">
      <div className="container">
        <div className="showcase-grid">
          <AnimatedSection className="showcase-content">
            <motion.div variants={fadeUp} className="section-label"><FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 14 }} /> {t('showcase.label')}</motion.div>
            <motion.h2 variants={fadeUp}>{t('showcase.title1')}<br /><span className="text-accent">{t('showcase.title2')}</span></motion.h2>
            <motion.p variants={fadeUp} className="showcase-desc">
              {t('showcase.desc')}
            </motion.p>
            <motion.ul className="showcase-checks" variants={stagger(0.1)}>
              {[t('showcase.check1'), t('showcase.check2'), t('showcase.check3'), t('showcase.check4'), t('showcase.check5')].map((item) => (
                <motion.li key={item} variants={fadeUp}>
                  <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 18 }} className="check-icon" /><span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
            <motion.div variants={fadeUp}>
              <motion.button className="btn-primary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {t('showcase.exploreFeatures')} <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 16 }} />
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
  const { t } = useTranslation();
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });
  const c1 = useCounter(10000, 2000, inView);
  const c2 = useCounter(500, 1500, inView);
  const c3 = useCounter(50000, 2000, inView);
  const c4 = useCounter(98, 1200, inView);
  const stats = [
    { value: c1.toLocaleString(), suffix: '+', label: t('stats.activePets'), icon: <FontAwesomeIcon icon={faPaw} style={{ fontSize: 24 }} /> },
    { value: c2.toLocaleString(), suffix: '+', label: t('stats.proCaregivers'), icon: <FontAwesomeIcon icon={faShield} style={{ fontSize: 24 }} /> },
    { value: c3.toLocaleString(), suffix: '+', label: t('stats.trackedWalks'), icon: <FontAwesomeIcon icon={faLocationArrow} style={{ fontSize: 24 }} /> },
    { value: c4.toString(), suffix: '%', label: t('stats.satisfaction'), icon: <FontAwesomeIcon icon={faHeart} style={{ fontSize: 24 }} /> },
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
function Testimonials() {
  const { t } = useTranslation();
  const testimonials = [
    { text: t('testimonials.t1'), name: t('testimonials.t1name'), role: t('testimonials.t1role'), rating: 5 },
    { text: t('testimonials.t2'), name: t('testimonials.t2name'), role: t('testimonials.t2role'), rating: 5 },
    { text: t('testimonials.t3'), name: t('testimonials.t3name'), role: t('testimonials.t3role'), rating: 5 },
    { text: t('testimonials.t4'), name: t('testimonials.t4name'), role: t('testimonials.t4role'), rating: 5 },
    { text: t('testimonials.t5'), name: t('testimonials.t5name'), role: t('testimonials.t5role'), rating: 5 },
  ];
  return (
    <section className="testimonials-section" id="testimonials">
      <div className="container">
        <AnimatedSection className="testimonials-header">
          <motion.div variants={fadeUp} className="section-label"><FontAwesomeIcon icon={faStar} style={{ fontSize: 14 }} /> {t('testimonials.label')}</motion.div>
          <motion.h2 variants={fadeUp}>{t('testimonials.title1')} <span className="text-accent">{t('testimonials.title2')}</span></motion.h2>
          <motion.p variants={fadeUp} className="section-desc">{t('testimonials.desc')}</motion.p>
        </AnimatedSection>
        <AnimatedSection className="testimonials-grid">
          {testimonials.map((t, i) => (
            <motion.div key={i} className="testimonial-card" variants={fadeUp} whileHover={{ y: -6 }}>
              <div className="testimonial-stars">
                {[...Array(t.rating)].map((_, j) => <FontAwesomeIcon key={j} icon={faStar} style={{ fontSize: 16, color: 'var(--gold)' }} />)}
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
  const { t } = useTranslation();
  return (
    <section className="cta-section" id="cta">
      <div className="cta-bg-pattern" />
      <div className="cta-glow" />
      <div className="container cta-inner">
        <AnimatedSection>
          <motion.div className="section-label cta-label" variants={fadeUp}><FontAwesomeIcon icon={faDownload} style={{ fontSize: 14 }} /> {t('cta.label')}</motion.div>
          <motion.h2 variants={fadeUp}>{t('cta.title1')}<br />{t('cta.title2')}</motion.h2>
          <motion.p variants={fadeUp} className="cta-desc">
            {t('cta.desc')}
          </motion.p>
          <motion.div className="cta-buttons" variants={fadeUp}>
            <motion.button className="btn-white btn-lg" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <FontAwesomeIcon icon={faDownload} style={{ fontSize: 18 }} /> App Store
            </motion.button>
            <motion.button className="btn-white-outline btn-lg" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <FontAwesomeIcon icon={faDownload} style={{ fontSize: 18 }} /> Google Play
            </motion.button>
          </motion.div>
          <motion.div className="cta-badges" variants={fadeUp}>
            <div className="cta-badge">⭐ {t('cta.reviews')}</div>
            <div className="cta-badge">🔥 {t('cta.downloads')}</div>
            <div className="cta-badge">🛡️ {t('cta.secure')}</div>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────── */
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="nav-logo"><span className="logo-icon">🐾</span><span className="logo-text">PawMate</span></div>
            <p>{t('footer.desc')}</p>
            <div className="footer-socials">
              {[['📷', 'Instagram'], ['🐦', 'Twitter'], ['💼', 'LinkedIn']].map(([icon, label], i) => (
                <a key={i} className="social-btn" title={label}>{icon}</a>
              ))}
            </div>
          </div>
          <div className="footer-col">
            <h4>{t('footer.product')}</h4>
            <ul><li><a href="#">GPS Tracking</a></li><li><a href="#">{t('features.healthTitle')}</a></li><li><a href="#">Paw-Port QR</a></li><li><a href="#">{t('features.communityTitle')}</a></li></ul>
          </div>
          <div className="footer-col">
            <h4>{t('footer.company')}</h4>
            <ul><li><a href="#">{t('footer.aboutUs')}</a></li><li><a href="#">{t('footer.contact')}</a></li><li><a href="#">{t('footer.blog')}</a></li><li><a href="#">{t('footer.press')}</a></li></ul>
          </div>
          <div className="footer-col">
            <h4>{t('footer.legal')}</h4>
            <ul><li><a href="#">{t('footer.privacy')}</a></li><li><a href="#">{t('footer.terms')}</a></li><li><a href="#">{t('footer.cookies')}</a></li><li><a href="#">GDPR</a></li></ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t('footer.copyright')} <strong>Mohamed Sabbar</strong></span>
          <span className="footer-made">{t('footer.madeWith')}</span>
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
