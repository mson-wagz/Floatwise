import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "../auth";

// Set VITE_REQUIRE_AUTH=1 in your frontend .env once login works.
// While it's unset, the private pages open without a token (dev mode).
const AUTH_ON = import.meta.env.VITE_REQUIRE_AUTH === "1";

export default function RequireAuth() {
  if (AUTH_ON && !getToken()) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}