import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faArrowRight, faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

export default function ConfirmPage() {
  const { t } = useTranslation();
  const [dark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pawmate-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-icon-wrap">
          <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 64 }} className="confirm-check-icon" />
        </div>

        <div className="confirm-paw"></div>

        <h1 className="confirm-title">{t('confirm.title')}</h1>
        <p className="confirm-desc" dangerouslySetInnerHTML={{ __html: t('confirm.desc1') + '<br/>' + t('confirm.desc2') }} />

        <div className="confirm-steps">
          <div className="confirm-step">
            <div className="confirm-step-num">1</div>
            <span dangerouslySetInnerHTML={{ __html: t('confirm.step1') }} />
          </div>
          <div className="confirm-step">
            <div className="confirm-step-num">2</div>
            <span dangerouslySetInnerHTML={{ __html: t('confirm.step2') }} />
          </div>
          <div className="confirm-step">
            <div className="confirm-step-num">3</div>
            <span dangerouslySetInnerHTML={{ __html: t('confirm.step3') }} />
          </div>
        </div>

        <a href="/" className="confirm-home-btn">
          <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 18 }} />
          {t('confirm.goHome')}
        </a>

        <p className="confirm-footer-text">
          <FontAwesomeIcon icon={faMobileScreenButton} style={{ fontSize: 14 }} />
          {t('confirm.canClose')}
        </p>
      </div>
    </div>
  );
}
