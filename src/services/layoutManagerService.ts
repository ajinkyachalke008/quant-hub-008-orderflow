import { FloatingPaneState, WidgetId, WorkspacePreset } from '../types/terminal';

const STORAGE_KEYS = {
  PRESET: 'openterminal_active_preset_v3',
  FLOATING: 'openterminal_floating_panes_v3',
};

const DEFAULT_FLOATING_PANES: FloatingPaneState[] = [
  {
    id: 'float_depth',
    title: 'Level 2 Depth & Liquidity Wall',
    widgetId: 'level2-book',
    isOpen: false,
    x: 80,
    y: 80,
    width: 480,
    height: 420,
    isPoppedOut: false,
  },
  {
    id: 'float_tape',
    title: 'Time & Sales Aggressor Tape',
    widgetId: 'xau-orderbook',
    isOpen: false,
    x: 580,
    y: 80,
    width: 380,
    height: 420,
    isPoppedOut: false,
  },
  {
    id: 'float_fix',
    title: 'FIX 4.4 Protocol Inspector',
    widgetId: 'fix-inspector',
    isOpen: false,
    x: 120,
    y: 200,
    width: 600,
    height: 380,
    isPoppedOut: false,
  },
];

type LayoutSubscriber = (preset: WorkspacePreset, floatingPanes: FloatingPaneState[]) => void;

class LayoutManagerService {
  private activePreset: WorkspacePreset = 'default_scalper';
  private floatingPanes: FloatingPaneState[] = [];
  private subscribers: Set<LayoutSubscriber> = new Set();

  constructor() {
    this.activePreset = this.loadPreset();
    this.floatingPanes = this.loadFloatingPanes();
  }

  public subscribe(cb: LayoutSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.activePreset, [...this.floatingPanes]);
    return () => this.subscribers.delete(cb);
  }

  public getActivePreset(): WorkspacePreset {
    return this.activePreset;
  }

  public getFloatingPanes(): FloatingPaneState[] {
    return [...this.floatingPanes];
  }

  public setPreset(preset: WorkspacePreset) {
    this.activePreset = preset;
    try {
      localStorage.setItem(STORAGE_KEYS.PRESET, preset);
    } catch {}
    this.notify();
  }

  public openFloatingPane(widgetId: WidgetId, title: string) {
    let pane = this.floatingPanes.find((p) => p.widgetId === widgetId);
    if (pane) {
      pane.isOpen = true;
    } else {
      pane = {
        id: `float_${widgetId}`,
        title,
        widgetId,
        isOpen: true,
        x: 100 + this.floatingPanes.length * 30,
        y: 100 + this.floatingPanes.length * 30,
        width: 520,
        height: 420,
        isPoppedOut: false,
      };
      this.floatingPanes.push(pane);
    }
    this.saveFloatingPanes();
    this.notify();
  }

  public closeFloatingPane(id: string) {
    const pane = this.floatingPanes.find((p) => p.id === id);
    if (pane) {
      pane.isOpen = false;
      this.saveFloatingPanes();
      this.notify();
    }
  }

  public popoutWindow(id: string) {
    const pane = this.floatingPanes.find((p) => p.id === id);
    if (!pane) return;

    // Attempt browser window.open
    try {
      const url = `${window.location.origin}/?popout=${pane.widgetId}`;
      const newWin = window.open(
        url,
        `popout_${pane.id}`,
        `width=${pane.width},height=${pane.height},menubar=no,status=no,toolbar=no`
      );
      if (newWin) {
        pane.isPoppedOut = true;
        pane.isOpen = false;
        this.saveFloatingPanes();
        this.notify();
        return;
      }
    } catch (_) {}

    // Fallback if window.open is blocked by iframe or browser policy:
    // keep as active in-app floating window
    pane.isOpen = true;
    this.saveFloatingPanes();
    this.notify();
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb(this.activePreset, [...this.floatingPanes]);
      } catch (_) {}
    });
  }

  private loadPreset(): WorkspacePreset {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.PRESET);
      return (s as WorkspacePreset) || 'default_scalper';
    } catch {
      return 'default_scalper';
    }
  }

  private loadFloatingPanes(): FloatingPaneState[] {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.FLOATING);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FLOATING_PANES.map((p) => ({ ...p }));
  }

  private saveFloatingPanes() {
    try {
      localStorage.setItem(STORAGE_KEYS.FLOATING, JSON.stringify(this.floatingPanes));
    } catch {}
  }
}

export const layoutManagerService = new LayoutManagerService();
