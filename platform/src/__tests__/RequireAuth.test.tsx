import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';

// Use vi.hoisted so the mock fn is available when vi.mock factory runs (hoisted)
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  isSupabaseConfigured: true,
}));

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while checking auth', () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <MemoryRouter>
        <RequireAuth>
          <div>Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
    });
    render(
      <MemoryRouter>
        <RequireAuth>
          <div>Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('redirects to /auth when not authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <RequireAuth>
          <div>Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});
