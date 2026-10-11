import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Editor from './pages/Editor.jsx';

const project = { id: 'p1', name: 'P', width: 1080, height: 1920, fps: 30, updatedAt: new Date().toISOString(), markers: [], tracks: ['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'].map((type, i) => ({ id: `t${i}`, type, order: i, locked: false, hidden: false, muted: false, clips: [] })) };
beforeAll(() => {
  globalThis.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('/media') ? [] : String(url).includes('/projects/') ? project : {}) }));
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  window.PointerEvent ||= class extends MouseEvent { constructor(t, i) { super(t, i); this.pointerId = 1; } };
  if (!globalThis.crypto?.randomUUID) globalThis.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
});
test('desktop: panels can be resized with the splitters, are clamped, remembered, and reset on double-click', async () => {
  localStorage.clear();
  const { container: c } = render(<MemoryRouter initialEntries={['/editor/p1']}><Routes><Route path="/editor/:id" element={<Editor />} /></Routes></MemoryRouter>);
  await waitFor(() => expect(c.querySelector('.split.l')).toBeTruthy());
  const ed = c.querySelector('.editor'), L = c.querySelector('.split.l'), H = c.querySelector('.split.h');
  expect(ed.style.getPropertyValue('--lw')).toBe('320px');
  fireEvent.pointerDown(L, { clientX: 320 }); fireEvent.pointerMove(window, { clientX: 420 }); fireEvent.pointerUp(window);
  expect(ed.style.getPropertyValue('--lw')).toBe('420px');
  fireEvent.pointerDown(L, { clientX: 420 }); fireEvent.pointerMove(window, { clientX: 5000 }); fireEvent.pointerUp(window); expect(ed.style.getPropertyValue('--lw')).toBe('520px');   // max
  fireEvent.pointerDown(H, { clientY: 600 }); fireEvent.pointerMove(window, { clientY: 500 }); fireEvent.pointerUp(window); expect(ed.style.getPropertyValue('--th')).toBe('350px');     // drag up = taller timeline
  expect(JSON.parse(localStorage.getItem('rvs_panels'))).toMatchObject({ lw: 520, th: 350 });
  fireEvent.doubleClick(L); expect(ed.style.getPropertyValue('--lw')).toBe('320px');
});
