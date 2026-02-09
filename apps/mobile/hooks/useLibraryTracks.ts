import { useQuery } from '@tanstack/react-query';
import { trackService, LibraryTrack } from '../services/trackService';
import { useAuthStore } from '../stores/authStore';

export function useLibraryTracks() {
  const user = useAuthStore((s) => s.user);

  return useQuery<LibraryTrack[]>({
    queryKey: ['library', user?.id],
    queryFn: () => {
      if (!user) return [];
      return trackService.fetchUserLibrary(user.id);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
