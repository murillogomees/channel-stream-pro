/**
 * ============================================================================
 * useFocusManager - Hook para Navegação TV
 * ============================================================================
 * 
 * Integração React do FocusManager para:
 * - Registro automático de elementos focáveis
 * - Cleanup automático no unmount
 * - Estado reativo do foco
 * 
 * @version 1.0.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { focusManager } from '../FocusManager';

// =============================================================================
// TYPES
// =============================================================================

interface UseFocusableOptions {
  /** ID do grupo de foco */
  groupId: string;
  /** ID único do elemento */
  id: string;
  /** Posição na linha (para navegação vertical) */
  row: number;
  /** Posição na coluna (para navegação horizontal) */
  col: number;
  /** Callback quando elemento recebe foco */
  onFocus?: () => void;
  /** Callback quando elemento perde foco */
  onBlur?: () => void;
  /** Callback quando elemento é selecionado (Enter/OK) */
  onSelect?: () => void;
  /** Desabilitar foco */
  disabled?: boolean;
}

interface UseFocusGroupOptions {
  /** ID do grupo */
  groupId: string;
  /** ID do elemento com foco inicial */
  defaultFocusId?: string;
  /** Ativar grupo automaticamente ao montar */
  autoActivate?: boolean;
}

// =============================================================================
// useFocusable - Registra um elemento focável
// =============================================================================

export function useFocusable(options: UseFocusableOptions) {
  const { groupId, id, row, col, onFocus, onBlur, onSelect, disabled } = options;
  const ref = useRef<HTMLElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Register element
  useEffect(() => {
    if (!ref.current || disabled) return;

    focusManager.register(groupId, id, ref.current, row, col, {
      onFocus: () => {
        setIsFocused(true);
        onFocus?.();
      },
      onBlur: () => {
        setIsFocused(false);
        onBlur?.();
      },
      onSelect,
    });

    return () => {
      focusManager.unregister(groupId, id);
    };
  }, [groupId, id, row, col, onFocus, onBlur, onSelect, disabled]);

  // Focus method
  const focus = useCallback(() => {
    focusManager.setFocus(id);
  }, [id]);

  return {
    ref,
    isFocused,
    focus,
    focusProps: {
      'data-focus-id': id,
      'data-focus-group': groupId,
    },
  };
}

// =============================================================================
// useFocusGroup - Gerencia um grupo de elementos focáveis
// =============================================================================

export function useFocusGroup(options: UseFocusGroupOptions) {
  const { groupId, defaultFocusId, autoActivate = false } = options;
  const [isActive, setIsActive] = useState(false);

  // Create and setup group
  useEffect(() => {
    focusManager.createGroup(groupId, defaultFocusId);

    if (autoActivate) {
      focusManager.setActiveGroup(groupId);
      setIsActive(true);
    }

    return () => {
      focusManager.removeGroup(groupId);
    };
  }, [groupId, defaultFocusId, autoActivate]);

  // Activate group
  const activate = useCallback(() => {
    focusManager.setActiveGroup(groupId);
    setIsActive(true);
  }, [groupId]);

  return {
    isActive,
    activate,
  };
}

// =============================================================================
// useFocusManagerInit - Inicializa o FocusManager
// =============================================================================

export function useFocusManagerInit() {
  useEffect(() => {
    focusManager.init();

    return () => {
      focusManager.destroy();
    };
  }, []);
}

// =============================================================================
// useBackHandler - Handler para botão Back/Return
// =============================================================================

export function useBackHandler(callback: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleBack = () => {
      callback();
    };

    window.addEventListener('focusmanager:back', handleBack);
    return () => window.removeEventListener('focusmanager:back', handleBack);
  }, [callback, enabled]);
}

// =============================================================================
// useCurrentFocus - Estado reativo do foco atual
// =============================================================================

export function useCurrentFocus() {
  const [currentFocusId, setCurrentFocusId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = focusManager.addListener(setCurrentFocusId);
    return unsubscribe;
  }, []);

  return currentFocusId;
}
