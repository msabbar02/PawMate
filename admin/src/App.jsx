import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import PetsPage from './pages/PetsPage';
import ReservationsPage from './pages/ReservationsPage';
import MessagesPage from './pages/MessagesPage';
import CommunityPage from './pages/CommunityPage';
import ReportsPage from './pages/ReportsPage';
import LogsPage from './pages/LogsPage';
import ProfilePage from './pages/ProfilePage';
import AdminsPage from './pages/AdminsPage';
import VerificationsPage from './pages/VerificationsPage';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useContext(AuthContext);
    if (!isAuthenticated) return <Navigate to="/login" />;
    return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
           <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="pets" element={<PetsPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="verifications" element={<VerificationsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
