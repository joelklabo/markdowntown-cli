import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForkButton } from '@/components/artifact/ForkButton';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('ForkButton', () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ push: pushMock });
    global.fetch = vi.fn();
    global.alert = vi.fn();
  });

  it('renders button', () => {
    render(<ForkButton artifactId="123" />);
    expect(screen.getByText('Fork / Edit')).toBeInTheDocument();
  });

  it('calls api and redirects on success', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-fork-id' }),
    });

    render(<ForkButton artifactId="123" />);
    fireEvent.click(screen.getByText('Fork / Edit'));

    expect(screen.getByText('Forking...')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/artifacts/fork', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ artifactId: '123' }),
      }));
      expect(pushMock).toHaveBeenCalledWith('/workbench?id=new-fork-id');
    });
  });

  it('handles error', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    });

    render(<ForkButton artifactId="123" />);
    fireEvent.click(screen.getByText('Fork / Edit'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Failed'));
      expect(screen.getByText('Fork / Edit')).toBeInTheDocument(); // Reset loading
    });
  });

  it('redirects to sign-in when unauthorized', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(<ForkButton artifactId="123" />);
    fireEvent.click(screen.getByText('Fork / Edit'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/signin');
      expect(global.alert).not.toHaveBeenCalled();
    });
  });
});
