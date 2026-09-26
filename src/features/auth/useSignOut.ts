import { useNavigate } from 'react-router';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Leaves the protected area first, then ends the session, so route guards do
 * not bounce the user to /login?next=… on the way out.
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return () => {
    navigate('/', { replace: true });
    void signOut();
  };
}
