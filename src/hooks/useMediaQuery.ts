/**
 * useMediaQuery - Hook para detectar media queries
 */

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Breakpoint helpers
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery("(max-width: 480px)");
  const isTablet = useMediaQuery("(min-width: 481px) and (max-width: 1024px)");
  const isDesktop = useMediaQuery("(min-width: 1025px) and (max-width: 1440px)");
  const isTV = useMediaQuery("(min-width: 1441px)");
  const is4K = useMediaQuery("(min-width: 1921px)");

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTV,
    is4K,
    // Convenience helpers
    isMobileOrTablet: isMobile || isTablet,
    isDesktopOrTV: isDesktop || isTV || is4K,
  };
}

export default useMediaQuery;
