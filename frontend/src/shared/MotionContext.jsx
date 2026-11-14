import { createContext, useContext, useMemo, useState } from 'react';

const MotionContext = createContext(null);

export function MotionProvider({ children }) {
  const [paused, setPaused] = useState(false);
  const value = useMemo(() => ({ paused, setPaused }), [paused]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion() { return useContext(MotionContext); }
