import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api.js';

export function usePublicAnnouncements(id = null) {
  const [state, setState] = useState({ announcements: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ announcements: [], loading: true, error: '' });
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const result = await api.get(id ? `/public/announcements/${id}` : '/public/announcements', { signal: controller.signal });
        if (!controller.signal.aborted) setState({ announcements: id ? [result] : result.announcements, loading: false, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message }));
      } finally { pending = false; }
    }
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [id, revision]);
  return { ...state, retry };
}
