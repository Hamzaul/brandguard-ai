import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import "./styles.css";

// Shows the app only to signed-in users; everyone else sees the login / signup page.
function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="boot-message">Loading...</p>;
  return user ? <App key={user.id} /> : <AuthPage />;
}

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <Gate />
  </AuthProvider>
);
