// src/pages/AdminLogin.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginAdmin(email, password);
      toast.success('Welcome back, Admin 🌍');
      navigate('/admin');
    } catch {
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center" style={{ background: '#07130F' }}>
      {/* Glow orb */}
      <div className="absolute w-96 h-96 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(46,204,113,0.12) 0%, transparent 70%)',
                    top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        className="glass p-10 w-full max-w-md relative z-10"
        style={{ boxShadow: '0 0 60px rgba(46,204,113,0.15)' }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🌍</div>
          <h1 style={{ fontFamily: 'Orbitron', color: '#2ECC71', fontSize: '1.4rem', letterSpacing: 3 }}>
            ECOLEDGER
          </h1>
          <p className="text-textMuted text-sm mt-2" style={{ fontFamily: 'Poppins' }}>
            Admin Portal — Restricted Access
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#6B7A76' }} />
            <input
              type="email" placeholder="Admin Email" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'rgba(10,24,20,0.8)',
                border    : '1px solid #1E3A34',
                color     : '#EAEAEA',
                fontFamily: 'Inter',
              }}
              onFocus={e  => { e.target.style.borderColor = '#2ECC71'; }}
              onBlur={e   => { e.target.style.borderColor = '#1E3A34'; }}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#6B7A76' }} />
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required
              className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'rgba(10,24,20,0.8)',
                border    : '1px solid #1E3A34',
                color     : '#EAEAEA',
                fontFamily: 'Inter',
              }}
              onFocus={e => { e.target.style.borderColor = '#2ECC71'; }}
              onBlur={e  => { e.target.style.borderColor = '#1E3A34'; }}
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#6B7A76', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? '🔄 Authenticating...' : '🔐 Login to Admin Panel'}
          </button>
        </form>

        <p className="text-textDim text-xs text-center mt-6" style={{ fontFamily: 'Poppins' }}>
          Not an admin?{' '}
          <a href="/citizen" style={{ color: '#00C9A7' }}>Go to Citizen Dashboard →</a>
        </p>
      </motion.div>
    </div>
  );
}
