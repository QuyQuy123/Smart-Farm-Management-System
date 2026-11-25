// src/hooks/useViewport.js
// Responsive viewport breakpoint hook aligned with mobile_tablet_ux_spec.md
// Mobile: < 768px | Tablet: 768px - 1024px | Desktop: >= 1025px
import { useState, useEffect } from 'react';

export const BREAKPOINTS = {
  MOBILE_MAX: 767,
  TABLET_MAX: 1024,
  DESKTOP_MIN: 1025,
};

const getWindowWidth = () => {
  if (typeof window === 'undefined') return 1280;
  return window.innerWidth;
};

export const getViewportFlags = (width) => ({
  width,
  isMobile: width <= BREAKPOINTS.MOBILE_MAX,
  isTablet: width > BREAKPOINTS.MOBILE_MAX && width <= BREAKPOINTS.TABLET_MAX,
  isDesktop: width >= BREAKPOINTS.DESKTOP_MIN,
});

export const useViewport = () => {
  const [width, setWidth] = useState(getWindowWidth);

  useEffect(() => {
    const handleResize = () => {
      const next = getWindowWidth();
      setWidth((prev) => (prev === next ? prev : next));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return getViewportFlags(width);
};
