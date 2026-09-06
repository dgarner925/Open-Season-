import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

// Tell react-query when the app is actually in front of the user — without
// this, "refetch on focus" never fires in React Native, and a query that
// failed once (say, at cold start while the auth token was still refreshing)
// stayed failed until a force-quit. That looked like a wiped account on
// David's phone one Sunday morning (2026-09-06); never again.
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reference data changes rarely (admin-published). Cache generously —
      // but coming back to the app re-checks anything stale or failed.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: true,
    },
  },
});
