import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../../services/authService';

export default function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/signin" replace />;
  }
  return <Outlet />;
}
