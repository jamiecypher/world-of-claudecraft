// Dev-only in-game audio testing panel (/dev sound). Off by default, zero
// cost for real players, mirrors the ?perf overlay's opt-in pattern (query
// flag or localStorage, see perf.ts). Lets an audio contributor pick a
// catalog key, play through its takes either strictly in order or via the
// real production no-repeat-random picker (#1901), watch a stack-grouped
// log of everything that has actually fired recently, and flag a moment for
// later without breaking out of active gameplay.
//
// Non-modal by design: unlike bag/character-sheet windows, this never sets
// the modal gate main.ts checks via hud.isModalOpen(), so movement, camera,
// and attack input keep working while it is open, the whole point is being
// able to "hit shit and see how it feels", not just lab-test standing still.

import { sfx } from './sfx';
import { groupRecentPlays, recentPlayLabel } from './sfx_recent_plays';

const STORAGE_KEY = 'woc_sfx_dev_panel';
const MELEE_RANGE = 5; // yards; src/sim/types.ts MELEE_RANGE, duplicated here
// deliberately rather than importing sim (game/ never imports sim/ concrete
// state, only pure display helpers per src/CLAUDE.md; a constant is not
// worth a cross-boundary import).
const DEFAULT_GAP_MS = 750;
const MIN_GAP_MS = 100;
const MAX_GAP_MS = 3000;
const LOG_REFRESH_MS = 250;

export interface PlayerPose {
  x: number;
  y: number;
  z: number;
  facing: number; // radians, matches Entity.facing convention (see click_move.ts)
}

type PlaybackMode = 'sequential' | 'random';

interface FlaggedPlay {
  label: string;
  note: string;
  at: number; // Date.now()
}

export class SfxDevPanel {
  private visible = false;
  private root: HTMLDivElement | null = null;
  private collapsed = true;
  private keys: string[] = [];
  private selectedKey = '';
  private mode: PlaybackMode = 'sequential';
  private gapMs = DEFAULT_GAP_MS;
  private playing = false;
  private sequentialIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private renderTimer: ReturnType<typeof setInterval> | null = null;
  private poseProvider: (() => PlayerPose | null) | null = null;
  private flagged: FlaggedPlay[] = [];
  private lastLoggedLabel = '';

  // DOM refs, populated by mount().
  private strip: HTMLDivElement | null = null;
  private body: HTMLDivElement | null = null;
  private keySelect: HTMLSelectElement | null = null;
  private modeToggle: HTMLButtonElement | null = null;
  private gapRange: HTMLInputElement | null = null;
  private gapNumber: HTMLInputElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private logEl: HTMLDivElement | null = null;
  private flagNote: HTMLInputElement | null = null;

  constructor() {
    const params = new URLSearchParams(location.search);
    const startVisible = params.has('audiodev') || localStorage.getItem(STORAGE_KEY) === '1';
    if (startVisible) this.show();
  }

  /** Whether the panel is currently mounted/visible. Read by main.ts to
   *  decide whether to keep feeding it a pose provider. */
  get isVisible(): boolean {
    return this.visible;
  }

  /** Toggled by the client-only `/dev sound` chat command (intercepted
   *  before it ever reaches world.chat(), this is a pure UI concern, sim/
   *  stays host-agnostic and never sees it) as well as the initial
   *  ?audiodev query flag / localStorage state. */
  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  private show(): void {
    this.visible = true;
    localStorage.setItem(STORAGE_KEY, '1');
    sfx.setDevLogEnabled(true);
    if (!this.root) this.mount();
    if (this.root) this.root.style.display = 'block';
    if (!this.renderTimer) this.renderTimer = setInterval(() => this.renderLog(), LOG_REFRESH_MS);
    this.refreshKeys();
  }

  private hide(): void {
    this.visible = false;
    localStorage.removeItem(STORAGE_KEY);
    sfx.setDevLogEnabled(false);
    this.stopLoop();
    if (this.root) this.root.style.display = 'none';
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
  }

  /** main.ts calls this once on show, and again whenever the manifest's
   *  resolved key set could have changed (it does not currently change
   *  post-load, but cheap to keep this pull-based rather than assuming). */
  refreshKeys(): void {
    if (!this.visible) return;
    this.keys = sfx.listKeys().sort();
    if (!this.keys.includes(this.selectedKey)) this.selectedKey = this.keys[0] ?? '';
    this.renderKeyOptions();
  }

  /** main.ts feeds the current player position/facing once per frame; only
   *  read at the moment a manual/loop play actually fires, never polled. */
  setPoseProvider(provider: () => PlayerPose | null): void {
    this.poseProvider = provider;
  }

  private meleeRangePosition(): { x: number; y: number; z: number } | null {
    const pose = this.poseProvider?.();
    if (!pose) return null;
    return {
      x: pose.x + Math.sin(pose.facing) * MELEE_RANGE,
      y: pose.y,
      z: pose.z + Math.cos(pose.facing) * MELEE_RANGE,
    };
  }

  private fireOnce(): void {
    const key = this.selectedKey;
    if (!key) return;
    const pos = this.meleeRangePosition();
    if (!pos) return;
    if (this.mode === 'sequential') {
      const count = sfx.variantCount(key);
      sfx.playAt(key, pos.x, pos.y, pos.z, {
        jitter: false,
        cooldown: 0,
        forceVariantIndex: this.sequentialIndex % count,
      });
      this.sequentialIndex = (this.sequentialIndex + 1) % count;
    } else {
      // Random: no forceVariantIndex, this is the exact real production
      // no-repeat-random picker (#1901), the point of this mode is hearing
      // what a player actually experiences, not a reimplementation of it.
      sfx.playAt(key, pos.x, pos.y, pos.z, { jitter: false, cooldown: 0 });
    }
  }

  private startLoop(): void {
    if (this.playing) return;
    this.playing = true;
    this.sequentialIndex = 0;
    const step = () => {
      if (!this.playing) return;
      this.fireOnce();
      this.timer = setTimeout(step, this.gapMs);
    };
    step();
    this.updatePlayButton();
  }

  private stopLoop(): void {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.updatePlayButton();
  }

  private flagLast(): void {
    if (!this.lastLoggedLabel) return;
    this.flagged.push({
      label: this.lastLoggedLabel,
      note: this.flagNote?.value ?? '',
      at: Date.now(),
    });
    if (this.flagNote) this.flagNote.value = '';
    // TODO(v2): persist to Zyzz's Studio server instead of holding this only
    // in memory, see project_woc_sfx_todo item 7 for the full write-through
    // design. v1 just keeps the flagged list around for a manual copy-out.
    console.info('[sfx-dev-panel] flagged', this.flagged.at(-1));
  }

  // --- DOM -------------------------------------------------------------

  private mount(): void {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'right:8px',
      'bottom:8px',
      'z-index:2147483647',
      'font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'color:#e6f0ff',
      'background:rgba(6,10,18,0.88)',
      'border:1px solid rgba(147,197,253,0.4)',
      'border-radius:6px',
      'box-shadow:0 8px 28px rgba(0,0,0,0.35)',
      'pointer-events:auto',
      'user-select:none',
    ].join(';');

    const strip = document.createElement('div');
    strip.textContent = 'sfx dev ▾';
    strip.style.cssText = 'padding:4px 8px;cursor:pointer;white-space:nowrap;';
    strip.addEventListener('click', () => this.toggleCollapsed());
    root.appendChild(strip);
    this.strip = strip;

    const body = document.createElement('div');
    body.style.cssText = 'display:none;padding:8px;min-width:280px;max-width:340px;';
    root.appendChild(body);
    this.body = body;

    const keyRow = document.createElement('div');
    keyRow.style.cssText = 'margin-bottom:6px;';
    const keySelect = document.createElement('select');
    keySelect.style.cssText = 'width:100%;background:#0b1320;color:#e6f0ff;border:1px solid #334;';
    keySelect.addEventListener('change', () => {
      this.selectedKey = keySelect.value;
      this.sequentialIndex = 0;
    });
    keyRow.appendChild(keySelect);
    body.appendChild(keyRow);
    this.keySelect = keySelect;

    const controlRow = document.createElement('div');
    controlRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';

    const modeToggle = document.createElement('button');
    modeToggle.addEventListener('click', () => {
      this.mode = this.mode === 'sequential' ? 'random' : 'sequential';
      this.sequentialIndex = 0;
      this.updateModeToggle();
    });
    controlRow.appendChild(modeToggle);
    this.modeToggle = modeToggle;

    const playButton = document.createElement('button');
    playButton.addEventListener('click', () => {
      if (this.playing) this.stopLoop();
      else this.startLoop();
    });
    controlRow.appendChild(playButton);
    this.playButton = playButton;

    body.appendChild(controlRow);

    const gapRow = document.createElement('div');
    gapRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
    const gapLabel = document.createElement('span');
    gapLabel.textContent = 'gap ms';
    gapRow.appendChild(gapLabel);
    const gapRange = document.createElement('input');
    gapRange.type = 'range';
    gapRange.min = String(MIN_GAP_MS);
    gapRange.max = String(MAX_GAP_MS);
    gapRange.step = '50';
    gapRange.value = String(this.gapMs);
    gapRange.style.cssText = 'flex:1;';
    const gapNumber = document.createElement('input');
    gapNumber.type = 'number';
    gapNumber.min = String(MIN_GAP_MS);
    gapNumber.value = String(this.gapMs);
    gapNumber.style.cssText = 'width:64px;background:#0b1320;color:#e6f0ff;border:1px solid #334;';
    const setGap = (value: number) => {
      this.gapMs = Math.max(1, value);
      gapRange.value = String(Math.min(MAX_GAP_MS, this.gapMs));
      gapNumber.value = String(this.gapMs);
    };
    gapRange.addEventListener('input', () => setGap(Number(gapRange.value)));
    gapNumber.addEventListener('change', () => setGap(Number(gapNumber.value) || DEFAULT_GAP_MS));
    gapRow.appendChild(gapRange);
    gapRow.appendChild(gapNumber);
    body.appendChild(gapRow);
    this.gapRange = gapRange;
    this.gapNumber = gapNumber;

    const flagRow = document.createElement('div');
    flagRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
    const flagButton = document.createElement('button');
    flagButton.textContent = 'flag last';
    flagButton.addEventListener('click', () => this.flagLast());
    const flagNote = document.createElement('input');
    flagNote.type = 'text';
    flagNote.placeholder = 'note (optional)';
    flagNote.style.cssText = 'flex:1;background:#0b1320;color:#e6f0ff;border:1px solid #334;';
    flagRow.appendChild(flagButton);
    flagRow.appendChild(flagNote);
    body.appendChild(flagRow);
    this.flagNote = flagNote;

    const logEl = document.createElement('div');
    logEl.style.cssText =
      'max-height:200px;overflow-y:auto;border-top:1px solid #223;padding-top:6px;white-space:pre;';
    body.appendChild(logEl);
    this.logEl = logEl;

    document.body.appendChild(root);
    this.root = root;
    this.updateModeToggle();
    this.updatePlayButton();
  }

  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    if (this.body) this.body.style.display = this.collapsed ? 'none' : 'block';
    if (this.strip) this.strip.textContent = this.collapsed ? 'sfx dev ▾' : 'sfx dev ▴';
  }

  private renderKeyOptions(): void {
    if (!this.keySelect) return;
    this.keySelect.innerHTML = '';
    for (const key of this.keys) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      if (key === this.selectedKey) option.selected = true;
      this.keySelect.appendChild(option);
    }
  }

  private updateModeToggle(): void {
    if (this.modeToggle) this.modeToggle.textContent = this.mode === 'sequential' ? 'seq' : 'rand';
  }

  private updatePlayButton(): void {
    if (this.playButton) this.playButton.textContent = this.playing ? 'stop' : 'play';
  }

  private renderLog(): void {
    if (!this.logEl) return;
    const log = sfx.getRecentPlays();
    this.lastLoggedLabel = log[0] ? recentPlayLabel(log[0]) : '';
    const lines: string[] = [];
    for (const group of groupRecentPlays(log)) {
      for (const [index, entry] of group.entries()) {
        const prefix = index === 0 ? '' : '  └ ';
        lines.push(`${prefix}${recentPlayLabel(entry)}  g${entry.gain.toFixed(2)}`);
      }
    }
    this.logEl.textContent = lines.join('\n') || '(nothing played yet)';
  }
}

/** `/dev sound` toggles the panel. Pure match, client-only: this never
 *  reaches the sim (sim/ stays host-agnostic and has no concept of a DOM
 *  overlay), the caller intercepts it before world.chat(), same pattern as
 *  hud.ts's maybeHandleQuestShareCommand for "/share". */
export function isSfxDevPanelCommand(raw: string): boolean {
  return /^\/dev\s+sound(?:\s|$)/i.test(raw.trim());
}

export function createSfxDevPanel(): SfxDevPanel {
  return new SfxDevPanel();
}
