import { useEffect, useRef } from 'react';
import { useEditor } from '../store/editor.js';

const NAMES = { ' ': 'space', ArrowLeft: 'left', ArrowRight: 'right', Delete: 'delete', Backspace: 'delete' };
const combo = (e) => [e.ctrlKey || e.metaKey ? 'mod' : '', e.shiftKey && e.key.length > 1 ? 'shift' : e.shiftKey && (e.ctrlKey || e.metaKey) ? 'shift' : '', NAMES[e.key] || e.key.toLowerCase()].filter(Boolean).join('+');

// Default shortcuts live here; pass `extra` ({ 'mod+s': fn, ... }) from a component to add or override.
export function useShortcuts(extra = {}) {
  const ref = useRef(extra); ref.current = extra;
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target, typing = t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'color', 'checkbox'].includes(t.type));
      if (typing) return;
      const c = combo(e);
      if (t.type === 'range' && /left|right/.test(c)) return; // keep native slider arrows
      const s = useEditor.getState();
      const map = {
        space: () => s.setPlaying(!s.playing),
        delete: () => s.selected && s.removeClip(s.selected),
        'mod+c': s.copy, 'mod+x': s.cut, 'mod+v': s.paste, 'mod+d': s.duplicate, m: s.addMarker, 'shift+delete': () => s.selected && s.rippleDelete(s.selected),
        'mod+z': s.undo, 'mod+shift+z': s.redo, 'mod+y': s.redo, s: s.splitClip,
        ...ref.current,
      };
      const fn = map[c];
      if (fn) { e.preventDefault(); fn(e); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
