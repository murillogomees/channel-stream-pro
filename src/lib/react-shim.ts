/**
 * React Shim - Forces consistent React instance across the app
 * This file re-exports React to ensure a single instance is used
 */
export {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useReducer,
  useLayoutEffect,
  useId,
  memo,
  forwardRef,
  lazy,
  Suspense,
  Fragment,
  StrictMode,
  type ReactNode,
  type FC,
  type ComponentProps,
  type ComponentType,
  type RefObject,
  type MutableRefObject,
} from 'react';

export { default } from 'react';
