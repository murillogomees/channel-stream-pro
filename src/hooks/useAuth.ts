/**
 * useAuth Hook - Re-export from AuthContext
 * 
 * This file provides backward compatibility for components
 * that import useAuth from hooks folder.
 */

export { useAuth, AuthProvider } from '@/contexts/AuthContext';

// Alias for backward compatibility
export { useAuth as useAuthContext } from '@/contexts/AuthContext';
