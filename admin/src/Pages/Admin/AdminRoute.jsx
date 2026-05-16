import React from "react";
import { Navigate } from "react-router-dom";

const AdminRoute = ({ children, requiredRoles = ["owner", "admin", "staff", "inventory_staff"] }) => {
  const token = sessionStorage.getItem("admin-token");
  const roles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");

  if (!token) return <Navigate to="/login" replace />;

  const hasRole = requiredRoles.some(r => roles.includes(r));
  if (!hasRole) return <Navigate to="/login" replace />;

  return children;
};

export default AdminRoute;
