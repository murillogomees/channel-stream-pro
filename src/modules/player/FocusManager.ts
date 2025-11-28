/**
 * ============================================================================
 * FocusManager - Sistema de Navegação para Smart TVs
 * ============================================================================
 * 
 * Gerencia navegação por controle remoto em:
 * - Samsung Tizen
 * - LG webOS
 * - Android TV / Fire Stick
 * - Navegadores (teclado)
 * 
 * Features:
 * - Matriz 2D de navegação
 * - Registro dinâmico de elementos
 * - Suporte a grupos de foco
 * - Navegação por setas + OK + BACK
 * - Thresholds configuráveis
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FocusableElement {
  id: string;
  element: HTMLElement;
  row: number;
  col: number;
  group?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSelect?: () => void;
}

export interface FocusGroup {
  id: string;
  elements: Map<string, FocusableElement>;
  defaultFocusId?: string;
}

export interface FocusManagerConfig {
  /** Classe CSS aplicada ao elemento focado */
  focusClass: string;
  /** Scroll automático para elemento focado */
  autoScroll: boolean;
  /** Margem do scroll */
  scrollMargin: number;
  /** Tempo de debounce para navegação (ms) */
  navigationDebounce: number;
  /** Habilitar navegação circular (wrap) */
  wrapNavigation: boolean;
}

type Direction = 'up' | 'down' | 'left' | 'right';
type KeyAction = 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'none';

// =============================================================================
// KEY MAPPINGS - Samsung, LG, Android TV, Browser
// =============================================================================

const KEY_MAPPINGS: Record<string, KeyAction> = {
  // Standard
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'Enter': 'select',
  ' ': 'select',
  'Escape': 'back',
  'Backspace': 'back',
  
  // Samsung Tizen
  '38': 'up',
  '40': 'down',
  '37': 'left',
  '39': 'right',
  '13': 'select',
  '10009': 'back', // RETURN key on Samsung
  '10182': 'back', // EXIT key on Samsung
  
  // LG webOS
  '461': 'back', // BACK key on LG
  '403': 'select', // RED key (can be used as select)
  
  // Android TV
  '4': 'back', // KEYCODE_BACK
  '23': 'select', // KEYCODE_DPAD_CENTER
  '66': 'select', // KEYCODE_ENTER
};

// =============================================================================
// FOCUS MANAGER CLASS
// =============================================================================

class FocusManager {
  private groups: Map<string, FocusGroup> = new Map();
  private activeGroupId: string | null = null;
  private currentFocusId: string | null = null;
  private config: FocusManagerConfig;
  private isEnabled: boolean = true;
  private lastNavigationTime: number = 0;
  private listeners: Set<(focusedId: string | null) => void> = new Set();

  constructor(config?: Partial<FocusManagerConfig>) {
    this.config = {
      focusClass: 'tv-focused',
      autoScroll: true,
      scrollMargin: 100,
      navigationDebounce: 150,
      wrapNavigation: false,
      ...config,
    };

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Inicializa o FocusManager e adiciona listeners
   */
  init(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    console.log('[FocusManager] Initialized');
  }

  /**
   * Remove listeners e limpa estado
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.groups.clear();
    this.activeGroupId = null;
    this.currentFocusId = null;
    this.listeners.clear();
    console.log('[FocusManager] Destroyed');
  }

  // ===========================================================================
  // GROUP MANAGEMENT
  // ===========================================================================

  /**
   * Cria um novo grupo de foco
   */
  createGroup(groupId: string, defaultFocusId?: string): void {
    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, {
        id: groupId,
        elements: new Map(),
        defaultFocusId,
      });
    }
  }

  /**
   * Remove um grupo de foco
   */
  removeGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      // Remove focus classes from all elements
      group.elements.forEach(el => {
        el.element.classList.remove(this.config.focusClass);
      });
      this.groups.delete(groupId);
      
      if (this.activeGroupId === groupId) {
        this.activeGroupId = null;
        this.currentFocusId = null;
      }
    }
  }

  /**
   * Define o grupo ativo
   */
  setActiveGroup(groupId: string): void {
    if (this.groups.has(groupId)) {
      this.activeGroupId = groupId;
      const group = this.groups.get(groupId)!;
      
      // Focus default element or first element
      if (group.defaultFocusId && group.elements.has(group.defaultFocusId)) {
        this.setFocus(group.defaultFocusId);
      } else {
        const firstElement = group.elements.values().next().value;
        if (firstElement) {
          this.setFocus(firstElement.id);
        }
      }
    }
  }

  // ===========================================================================
  // ELEMENT REGISTRATION
  // ===========================================================================

  /**
   * Registra um elemento focável
   */
  register(
    groupId: string,
    id: string,
    element: HTMLElement,
    row: number,
    col: number,
    callbacks?: {
      onFocus?: () => void;
      onBlur?: () => void;
      onSelect?: () => void;
    }
  ): void {
    // Ensure group exists
    if (!this.groups.has(groupId)) {
      this.createGroup(groupId);
    }

    const group = this.groups.get(groupId)!;
    
    group.elements.set(id, {
      id,
      element,
      row,
      col,
      group: groupId,
      ...callbacks,
    });

    // Make element focusable
    element.setAttribute('tabindex', '-1');
    element.setAttribute('data-focus-id', id);
  }

  /**
   * Remove registro de um elemento
   */
  unregister(groupId: string, id: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      const element = group.elements.get(id);
      if (element) {
        element.element.classList.remove(this.config.focusClass);
        group.elements.delete(id);
        
        if (this.currentFocusId === id) {
          this.currentFocusId = null;
        }
      }
    }
  }

  // ===========================================================================
  // FOCUS CONTROL
  // ===========================================================================

  /**
   * Define foco em um elemento específico
   */
  setFocus(id: string): void {
    // Find element across all groups
    let targetElement: FocusableElement | null = null;
    let targetGroupId: string | null = null;

    for (const [groupId, group] of this.groups) {
      if (group.elements.has(id)) {
        targetElement = group.elements.get(id)!;
        targetGroupId = groupId;
        break;
      }
    }

    if (!targetElement || !targetGroupId) {
      console.warn(`[FocusManager] Element not found: ${id}`);
      return;
    }

    // Remove focus from current element
    if (this.currentFocusId) {
      const currentGroup = this.groups.get(this.activeGroupId || '');
      const currentElement = currentGroup?.elements.get(this.currentFocusId);
      if (currentElement) {
        currentElement.element.classList.remove(this.config.focusClass);
        currentElement.onBlur?.();
      }
    }

    // Set new focus
    this.activeGroupId = targetGroupId;
    this.currentFocusId = id;
    targetElement.element.classList.add(this.config.focusClass);
    targetElement.onFocus?.();

    // Auto scroll
    if (this.config.autoScroll) {
      this.scrollToElement(targetElement.element);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Obtém o ID do elemento focado
   */
  getCurrentFocusId(): string | null {
    return this.currentFocusId;
  }

  /**
   * Verifica se um elemento está focado
   */
  isFocused(id: string): boolean {
    return this.currentFocusId === id;
  }

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  /**
   * Move o foco em uma direção
   */
  navigate(direction: Direction): boolean {
    if (!this.isEnabled || !this.activeGroupId || !this.currentFocusId) {
      return false;
    }

    // Debounce
    const now = Date.now();
    if (now - this.lastNavigationTime < this.config.navigationDebounce) {
      return false;
    }
    this.lastNavigationTime = now;

    const group = this.groups.get(this.activeGroupId);
    if (!group) return false;

    const current = group.elements.get(this.currentFocusId);
    if (!current) return false;

    // Find next element
    const next = this.findNextElement(group, current, direction);
    
    if (next) {
      this.setFocus(next.id);
      return true;
    }

    return false;
  }

  /**
   * Encontra o próximo elemento na direção especificada
   */
  private findNextElement(
    group: FocusGroup,
    current: FocusableElement,
    direction: Direction
  ): FocusableElement | null {
    const elements = Array.from(group.elements.values());
    
    let candidates: FocusableElement[] = [];

    switch (direction) {
      case 'up':
        candidates = elements.filter(el => el.row < current.row);
        candidates.sort((a, b) => {
          const rowDiff = b.row - a.row; // Closest row first
          const colDiff = Math.abs(a.col - current.col) - Math.abs(b.col - current.col);
          return rowDiff !== 0 ? rowDiff : colDiff;
        });
        break;

      case 'down':
        candidates = elements.filter(el => el.row > current.row);
        candidates.sort((a, b) => {
          const rowDiff = a.row - b.row; // Closest row first
          const colDiff = Math.abs(a.col - current.col) - Math.abs(b.col - current.col);
          return rowDiff !== 0 ? rowDiff : colDiff;
        });
        break;

      case 'left':
        candidates = elements.filter(el => 
          el.row === current.row && el.col < current.col
        );
        candidates.sort((a, b) => b.col - a.col); // Closest col first
        break;

      case 'right':
        candidates = elements.filter(el => 
          el.row === current.row && el.col > current.col
        );
        candidates.sort((a, b) => a.col - b.col); // Closest col first
        break;
    }

    // Wrap navigation
    if (candidates.length === 0 && this.config.wrapNavigation) {
      switch (direction) {
        case 'up':
          candidates = elements.filter(el => el.row === Math.max(...elements.map(e => e.row)));
          break;
        case 'down':
          candidates = elements.filter(el => el.row === Math.min(...elements.map(e => e.row)));
          break;
        case 'left':
          candidates = elements.filter(el => 
            el.row === current.row && el.col === Math.max(...elements.filter(e => e.row === current.row).map(e => e.col))
          );
          break;
        case 'right':
          candidates = elements.filter(el => 
            el.row === current.row && el.col === Math.min(...elements.filter(e => e.row === current.row).map(e => e.col))
          );
          break;
      }
    }

    return candidates[0] || null;
  }

  /**
   * Executa ação no elemento focado
   */
  select(): boolean {
    if (!this.currentFocusId || !this.activeGroupId) return false;

    const group = this.groups.get(this.activeGroupId);
    const element = group?.elements.get(this.currentFocusId);

    if (element?.onSelect) {
      element.onSelect();
      return true;
    }

    // Fallback: click the element
    element?.element.click();
    return true;
  }

  // ===========================================================================
  // KEY HANDLING
  // ===========================================================================

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    const action = this.getKeyAction(event);
    if (action === 'none') return;

    event.preventDefault();
    event.stopPropagation();

    switch (action) {
      case 'up':
        this.navigate('up');
        break;
      case 'down':
        this.navigate('down');
        break;
      case 'left':
        this.navigate('left');
        break;
      case 'right':
        this.navigate('right');
        break;
      case 'select':
        this.select();
        break;
      case 'back':
        // Emit back event - handled by app
        window.dispatchEvent(new CustomEvent('focusmanager:back'));
        break;
    }
  }

  private getKeyAction(event: KeyboardEvent): KeyAction {
    // Try key first, then keyCode for TV compatibility
    return KEY_MAPPINGS[event.key] || 
           KEY_MAPPINGS[event.keyCode.toString()] || 
           'none';
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private scrollToElement(element: HTMLElement): void {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }

  /**
   * Habilita/desabilita o FocusManager
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Adiciona listener de mudança de foco
   */
  addListener(callback: (focusedId: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.currentFocusId));
  }

  /**
   * Debug: lista todos os elementos registrados
   */
  debug(): void {
    console.log('[FocusManager] State:', {
      activeGroup: this.activeGroupId,
      currentFocus: this.currentFocusId,
      groups: Array.from(this.groups.entries()).map(([id, group]) => ({
        id,
        elementCount: group.elements.size,
        elements: Array.from(group.elements.keys()),
      })),
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const focusManager = new FocusManager();
export default FocusManager;
