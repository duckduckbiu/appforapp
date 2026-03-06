import { Navigate } from "react-router-dom";

// Old admin page → now redirects to the new admin dashboard
export default function Admin() {
  return <Navigate to="/admin/overview" replace />;
}
