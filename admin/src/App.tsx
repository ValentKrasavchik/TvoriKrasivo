import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Layout from './Layout';
import Calendar from './pages/Calendar';
import Bookings from './pages/Bookings';
import Workshops from './pages/Workshops';
import Reviews from './pages/Reviews';
import Gallery from './pages/Gallery';
import { getMe } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    getMe()
      .then(() => setOk(true))
      .catch(() => setOk(false));
  }, []);
  if (ok === null) return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  if (!ok) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/calendar" replace />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="workshops" element={<Workshops />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="gallery" element={<Gallery />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
