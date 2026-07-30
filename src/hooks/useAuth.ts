import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  return {
    isAuthenticated: !!session,
    profile,
    isLoading,
    isOnboarded,
    userId: session?.user?.id ?? null,
  };
}
