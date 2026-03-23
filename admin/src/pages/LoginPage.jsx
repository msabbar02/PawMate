import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, Lock, User, Eye, EyeOff } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        const success = await login(email, password);
        if (success) {
            navigate('/');
        } else {
            setError('Credenciales incorrectas o acceso denegado');
        }
        setIsLoggingIn(false);
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel">
                <div className="login-header">
                    <ShieldAlert size={48} className="login-icon" />
                    <h1>PawMate Admin</h1>
                    <p>Panel de Administración</p>
                </div>
                
                {error && <div className="login-error">{error}</div>}
                
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <User size={20} className="input-icon" />
                        <input 
                            type="email" 
                            placeholder="Email Administrador" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="input-group">
                        <Lock size={20} className="input-icon" />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Contraseña" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button 
                            type="button" 
                            className="toggle-password-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    
                    <button type="submit" className="login-button" disabled={isLoggingIn}>
                        {isLoggingIn ? 'Iniciando sesión...' : 'Acceder al sistema'}
                    </button>
                </form>
            </div>
        </div>
    );
}
