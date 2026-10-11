jest.mock('../src/services/api', () => { const api = { restore: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn(async () => {}), onSessionLost: jest.fn() }; return { api }; });
import { useAuth } from '../src/state/auth';
import { api } from '../src/services/api';
const user = { id: 'u1', name: 'Raj', plan: 'FREE' };
beforeEach(() => { useAuth.setState({ status: 'loading', user: null, offline: false }); jest.clearAllMocks(); });

test('starts in "loading" (splash) so the login screen never flashes', () => { expect(useAuth.getState().status).toBe('loading'); });
test('restore with a saved session -> authed without any login screen', async () => { api.restore.mockResolvedValue({ status: 'authed', user }); await useAuth.getState().restore(); expect(useAuth.getState()).toMatchObject({ status: 'authed', user }); });
test('restore without a session -> anon', async () => { api.restore.mockResolvedValue({ status: 'anon' }); await useAuth.getState().restore(); expect(useAuth.getState().status).toBe('anon'); });
test('offline restore keeps the user logged in', async () => { api.restore.mockResolvedValue({ status: 'authed', user, offline: true }); await useAuth.getState().restore(); expect(useAuth.getState()).toMatchObject({ status: 'authed', offline: true }); });
test('coming back from background with a revoked session logs out; a network blip does not', async () => {
  useAuth.setState({ status: 'authed', user }); api.restore.mockResolvedValue({ status: 'authed', user, offline: true }); await useAuth.getState().revalidate(); expect(useAuth.getState().status).toBe('authed');
  api.restore.mockResolvedValue({ status: 'anon' }); await useAuth.getState().revalidate(); expect(useAuth.getState().status).toBe('anon');
});
test('login / register / explicit logout', async () => {
  api.login.mockResolvedValue(user); await useAuth.getState().login(' a@b.c ', 'pw'); expect(api.login).toHaveBeenCalledWith('a@b.c', 'pw'); expect(useAuth.getState().status).toBe('authed');
  await useAuth.getState().logout(); expect(api.logout).toHaveBeenCalled(); expect(useAuth.getState().status).toBe('anon');
  api.register.mockResolvedValue(user); await useAuth.getState().register('Raj', 'a@b.c', 'password1'); expect(useAuth.getState().user).toEqual(user);
});
test('a failed login keeps the user on the login screen and throws the server message', async () => { api.login.mockRejectedValue(new Error('Wrong email or password')); await expect(useAuth.getState().login('a@b.c', 'x')).rejects.toThrow('Wrong email or password'); expect(useAuth.getState().status).not.toBe('authed'); });
