// src/components/shared/Navbar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Leaf, Swords, Users, LogOut, LogIn, LayoutDashboard } from 'lucide-react';
import { motion } from 'framer-motion';

const links = [
  { to: '/',        label: 'Home',    icon: Leaf },
  { to: '/arena',   label: 'Arena',   icon: Swords },
  { to: '/citizen', label: 'Citizen', icon: Users },
];

export default function Navbar() {
  const { isAdmin, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
      style={{
        background: 'rgba(10,24,20,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(46,204,113,0.15)',
      }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2">
        <span className="text-primary text-2xl">🌍</span>
        <span style={{ fontFamily: 'Orbitron', fontWeight: 700, fontSize: '1.1rem', color: '#2ECC71', letterSpacing: 2 }}>
          ECOLEDGER
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                color     : active ? '#2ECC71' : '#A7B3AF',
                background: active ? 'rgba(46,204,113,0.1)' : 'transparent',
                fontFamily: 'Poppins',
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link to="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              color     : location.pathname === '/admin' ? '#00D1FF' : '#A7B3AF',
              background: location.pathname === '/admin' ? 'rgba(0,209,255,0.1)' : 'transparent',
              fontFamily: 'Poppins',
            }}
          >
            <LayoutDashboard size={15} /> Admin
          </Link>
        )}
      </div>

      {/* Auth button */}
      {isAdmin ? (
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
          style={{ color: '#E74C3C', border: '1px solid rgba(231,76,60,0.3)', fontFamily: 'Poppins' }}
        >
          <LogOut size={15} /> Logout
        </button>
      ) : (
        <Link to="/admin-login"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
          style={{ color: '#2ECC71', border: '1px solid rgba(46,204,113,0.3)', fontFamily: 'Poppins' }}
        >
          <LogIn size={15} /> Admin Login
        </Link>
      )}
    </motion.nav>
  );
}
