import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  localStorage.clear();
  global.fetch = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});
test('Gatherly landing page links to sign in', () => {
  render(<App />);
  expect(screen.getByRole('heading', {
    name: 'Gatherly'
  })).toBeInTheDocument();
  expect(screen.getByRole('link', {
    name: 'Get Started'
  })).toHaveAttribute('href', '/auth');
});
test('protected home redirects anonymous users', async () => {
  window.history.replaceState({}, '', '/home');
  render(<App />);
  expect(await screen.findByRole('button', {
    name: 'Login'
  })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
test('network failures display a helpful error instead of crashing login', async () => {
  window.history.replaceState({}, '', '/auth');
  fetch.mockRejectedValue(new TypeError('Network failure'));
  render(<App />);
  fireEvent.change(screen.getByLabelText(/Username/), {
    target: {
      value: 'testuser'
    }
  });
  fireEvent.change(screen.getByLabelText(/Password/), {
    target: {
      value: 'testing123'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Login'
  }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach Gatherly');
});
test('successful login loads the authenticated home', async () => {
  window.history.replaceState({}, '', '/auth');
  fetch.mockImplementation(url => Promise.resolve({
    ok: true,
    status: 200,
    json: async () => url.endsWith('/login') ? {
      token: 'test-token',
      user: {
        name: 'Test User'
      }
    } : {
      name: 'Test User'
    }
  }));
  render(<App />);
  fireEvent.change(screen.getByLabelText(/Username/), {
    target: {
      value: 'testuser'
    }
  });
  fireEvent.change(screen.getByLabelText(/Password/), {
    target: {
      value: 'testing123'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Login'
  }));
  expect(await screen.findByRole('button', {
    name: 'New meeting'
  })).toBeInTheDocument();
  await waitFor(() => expect(localStorage.getItem('token')).toBe('test-token'));
});
