/**
 * PrivateRoute — Authentication guard for protected pages.
 *
 * Wrap any route element with this component to require authentication:
 *   <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
 *
 * If no token is present, redirects to /login. The original destination is
 * passed via `state.from` so the login page can bounce the user back after
 * a successful login (future enhancement).
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../services/api';

// TEMP: set to true while testing the frontend with no backend running.
// Set this back to false before using real login/signup.
const SKIP_AUTH_FOR_TESTING = false;

function PrivateRoute({ children }) {
  const location = useLocation();
  const token = getToken();

  if (!token && !SKIP_AUTH_FOR_TESTING) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default PrivateRoute;