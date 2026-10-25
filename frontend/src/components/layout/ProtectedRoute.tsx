import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../types/auth";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FA] gap-3">
        <div className="w-10 h-10 border-3 border-[#0070E0] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-[#001C64]">Authenticating session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Role mismatch redirect to authorized domain
    if (role === "customer") {
      return <Navigate to="/customer/dashboard" replace />;
    }
    return <Navigate to="/load" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
