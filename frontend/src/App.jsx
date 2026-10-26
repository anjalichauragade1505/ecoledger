// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing     from './pages/Landing';
import AdminLogin  from './pages/AdminLogin';
import AdminDash   from './pages/AdminDash';
import Arena       from './pages/Arena';
import Citizen     from './pages/Citizen';

function ProtectedRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/admin-login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#10241D',
              color: '#EAEAEA',
              border: '1px solid #1E3A34',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />
        <Routes>
          <Route path="/"             element={<Landing />} />
          <Route path="/admin-login"  element={<AdminLogin />} />
          <Route path="/admin"        element={<ProtectedRoute><AdminDash /></ProtectedRoute>} />
          <Route path="/arena"        element={<Arena />} />
          <Route path="/citizen"      element={<Citizen />} />
          <Route path="*"             element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
