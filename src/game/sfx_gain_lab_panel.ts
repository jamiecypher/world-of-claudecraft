// Dev-only /dev mix gain-lab panel. Throwaway local tool for finding good
// sfx_gain_map.json/sfx_speed_map.json values by ear in real gameplay, before
// the initial bulk mob-audio import PR ships. Explicitly agreed NOT to submit
// this upstream (unlike the /dev sound panel it sits alongside); see
// project_woc_gain_lab_panel memory for the design rationale.
//
// Deliberately does NOT write live to the real gain/speed maps or to Zyzz's
// Studio server. A "write scope" button accumulates {scope, keys, gainDb,
// rateDelta} rows in-panel; "export json" dumps them to a textarea to copy
// out and hand to a future session, which applies them for real via
// writeSfxGainMap/writeSfxSpeedMap in scripts/sfx/playback_profile.mjs.

import { sfx } from './sfx';
import {
  actionsForFamily,
  ceilingForScope,
  familiesIn,
  keysInScope,
  tightestKeyInScope,
} from './sfx_gain_lab_hierarchy';

const OVERSHOOT_RANGE_DB = 24; // how far past the real ceiling the panel lets you preview

const STORAGE_KEY = 'woc_sfx_gain_lab';
const MELEE_RANGE = 5; // yards; src/sim/types.ts MELEE_RANGE, duplicated deliberately, see sfx_dev_panel.ts

export interface PlayerPose {
  x: number;
  y: number;
  z: number;
  facing: number;
}

interface WriteScopeRow {
  family: string;
  action: string | null;
  keys: string[];
  gainDb: number;
  rateDelta: number;
}

export class SfxGainLabPanel {
  private visible = false;
  private root: HTMLDivElement | null = null;
  private collapsed = true;
  private families: string[] = [];
  private selectedFamily = '';
  private selectedAction: string | null = null;
  private gainDb = 0;
  private rateDelta = 0;
  private allowOvershoot = false;
  private poseProvider: (() => PlayerPose | null) | null = null;
  private rows: WriteScopeRow[] = [];

  private strip: HTMLDivElement | null = null;
  private body: HTMLDivElement | null = null;
  private familyLabel: HTMLDivElement | null = null;
  private familySelect: HTMLSelectElement | null = null;
  private actionLabel: HTMLDivElement | null = null;
  private actionSelect: HTMLSelectElement | null = null;
  private ceilingLabel: HTMLDivElement | null = null;
  private overshootCheckbox: HTMLInputElement | null = null;
  private gainRange: HTMLInputElement | null = null;
  private gainNumber: HTMLInputElement | null = null;
  private rateRange: HTMLInputElement | null = null;
  private rateNumber: HTMLInputElement | null = null;
  private rowsEl: HTMLDivElement | null = null;
  private exportArea: HTMLTextAreaElement | null = null;

  constructor() {
    const params = new URLSearchParams(location.search);
    const startVisible = params.has('audiomix') || localStorage.getItem(STORAGE_KEY) === '1';
    if (startVisible) this.show();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  private show(): void {
    this.visible = true;
    localStorage.setItem(STORAGE_KEY, '1');
    if (!this.root) this.mount();
    if (this.root) this.root.style.display = 'block';
    this.refreshFamilies();
  }

  private hide(): void {
    this.visible = false;
    localStorage.removeItem(STORAGE_KEY);
    if (this.root) this.root.style.display = 'none';
  }

  refreshFamilies(): void {
    if (!this.visible) return;
    this.families = familiesIn(sfx.listKeys());
    if (!this.families.includes(this.selectedFamily)) this.selectedFamily = this.families[0] ?? '';
    this.renderFamilyOptions();
    this.refreshActions();
    this.refreshGainRangeForScope();
  }

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

  private currentScopeKeys(): string[] {
    return keysInScope(sfx.listKeys(), this.selectedFamily, this.selectedAction);
  }

  /** The real production ceiling for the current scope, or undefined if the
   *  scope is empty. */
  private currentCeilingDb(): number | undefined {
    return ceilingForScope(this.currentScopeKeys());
  }

  private renderCeilingLabel(): void {
    if (!this.ceilingLabel) return;
    const ceiling = this.currentCeilingDb();
    if (ceiling === undefined) {
      this.ceilingLabel.textContent = 'ceiling: (no keys in scope)';
      return;
    }
    const over = this.gainDb > ceiling;
    this.ceilingLabel.textContent = `ceiling: ${ceiling.toFixed(1)}dB${over ? '  (past ceiling, preview only)' : ''}`;
    this.ceilingLabel.style.color = over ? '#f5a623' : '#9db4d4';
  }

  /** Extends the slider's usable max past the real ceiling when "test past
   *  ceiling" is checked, so overshoot can be auditioned live without ever
   *  affecting what write scope/export can actually produce. */
  private refreshGainRangeForScope(): void {
    const ceiling = this.currentCeilingDb() ?? 0;
    const max = this.allowOvershoot ? ceiling + OVERSHOOT_RANGE_DB : Math.max(ceiling, 0);
    if (this.gainRange) this.gainRange.max = String(max);
    if (this.gainDb > max) {
      this.gainDb = max;
      if (this.gainRange) this.gainRange.value = String(max);
      if (this.gainNumber) this.gainNumber.value = String(max);
    }
    this.renderCeilingLabel();
  }

  private preview(): void {
    const keys = this.currentScopeKeys();
    // Play the key that actually SETS the scope's ceiling, not an arbitrary
    // one: every key is already individually pinned to its own ceiling in
    // the live gain map, so previewing a looser key than the scope's true
    // (tightest) constraint would make the headroom look bigger than it is.
    const key = tightestKeyInScope(keys);
    if (!key) return;
    const pos = this.meleeRangePosition();
    if (!pos) return;
    sfx.playAt(key, pos.x, pos.y, pos.z, {
      jitter: false,
      cooldown: 0,
      gain: 10 ** (this.gainDb / 20),
      rate: 1 + this.rateDelta,
    });
  }

  private addScopeRow(): void {
    const keys = this.currentScopeKeys();
    if (keys.length === 0) return;
    this.rows.push({
      family: this.selectedFamily,
      action: this.selectedAction,
      keys,
      gainDb: this.gainDb,
      rateDelta: this.rateDelta,
    });
    this.renderRows();
  }

  private removeRow(index: number): void {
    this.rows.splice(index, 1);
    this.renderRows();
  }

  private exportJson(): void {
    if (!this.exportArea) return;
    const payload = this.rows.map((row) => ({
      scope: row.action ? `${row.family}+${row.action}` : row.family,
      keys: row.keys,
      gainDb: row.gainDb,
      rateDelta: row.rateDelta,
    }));
    this.exportArea.value = JSON.stringify(payload, null, 2);
    this.exportArea.style.display = 'block';
    this.exportArea.select();
  }

  // --- DOM -------------------------------------------------------------

  private mount(): void {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'right:8px',
      'bottom:120px',
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
    strip.textContent = 'sfx mix ▾';
    strip.style.cssText = 'padding:4px 8px;cursor:pointer;white-space:nowrap;';
    strip.addEventListener('click', () => this.toggleCollapsed());
    root.appendChild(strip);
    this.strip = strip;

    const body = document.createElement('div');
    body.style.cssText = 'display:none;padding:8px;min-width:300px;max-width:360px;';
    root.appendChild(body);
    this.body = body;

    const familyLabel = document.createElement('div');
    familyLabel.style.cssText = 'color:#9db4d4;margin-bottom:2px;';
    body.appendChild(familyLabel);
    this.familyLabel = familyLabel;

    const familySelect = document.createElement('select');
    familySelect.style.cssText = 'width:100%;background:#0b1320;color:#e6f0ff;border:1px solid #334;margin-bottom:6px;';
    familySelect.addEventListener('change', () => {
      this.selectedFamily = familySelect.value;
      this.selectedAction = null;
      this.refreshActions();
      this.refreshGainRangeForScope();
    });
    body.appendChild(familySelect);
    this.familySelect = familySelect;

    const actionLabel = document.createElement('div');
    actionLabel.style.cssText = 'color:#9db4d4;margin-bottom:2px;';
    body.appendChild(actionLabel);
    this.actionLabel = actionLabel;

    const actionSelect = document.createElement('select');
    actionSelect.style.cssText = 'width:100%;background:#0b1320;color:#e6f0ff;border:1px solid #334;margin-bottom:6px;';
    actionSelect.addEventListener('change', () => {
      this.selectedAction = actionSelect.value || null;
      this.refreshGainRangeForScope();
    });
    body.appendChild(actionSelect);
    this.actionSelect = actionSelect;

    const ceilingLabel = document.createElement('div');
    ceilingLabel.style.cssText = 'margin-bottom:4px;color:#9db4d4;';
    body.appendChild(ceilingLabel);
    this.ceilingLabel = ceilingLabel;

    const overshootRow = document.createElement('label');
    overshootRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;cursor:pointer;';
    const overshootCheckbox = document.createElement('input');
    overshootCheckbox.type = 'checkbox';
    overshootCheckbox.addEventListener('change', () => {
      this.allowOvershoot = overshootCheckbox.checked;
      this.refreshGainRangeForScope();
    });
    const overshootText = document.createElement('span');
    overshootText.textContent = 'test past ceiling (preview only, write scope still clamps)';
    overshootRow.appendChild(overshootCheckbox);
    overshootRow.appendChild(overshootText);
    body.appendChild(overshootRow);
    this.overshootCheckbox = overshootCheckbox;

    const gainRow = this.buildSliderRow('gain dB', -24, 24, 0.5, (value) => {
      this.gainDb = value;
      this.preview();
      this.renderCeilingLabel();
    });
    body.appendChild(gainRow.row);
    this.gainRange = gainRow.range;
    this.gainNumber = gainRow.number;

    const rateRow = this.buildSliderRow('rate ±', -0.3, 0.3, 0.01, (value) => {
      this.rateDelta = value;
      this.preview();
    });
    body.appendChild(rateRow.row);
    this.rateRange = rateRow.range;
    this.rateNumber = rateRow.number;

    const controlRow = document.createElement('div');
    controlRow.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';
    const previewButton = document.createElement('button');
    previewButton.textContent = 'preview';
    previewButton.addEventListener('click', () => this.preview());
    const addButton = document.createElement('button');
    addButton.textContent = 'write scope';
    addButton.addEventListener('click', () => this.addScopeRow());
    const exportButton = document.createElement('button');
    exportButton.textContent = 'export json';
    exportButton.addEventListener('click', () => this.exportJson());
    controlRow.appendChild(previewButton);
    controlRow.appendChild(addButton);
    controlRow.appendChild(exportButton);
    body.appendChild(controlRow);

    const rowsEl = document.createElement('div');
    rowsEl.style.cssText = 'max-height:160px;overflow-y:auto;border-top:1px solid #223;padding-top:6px;white-space:pre;';
    body.appendChild(rowsEl);
    this.rowsEl = rowsEl;

    const exportArea = document.createElement('textarea');
    exportArea.readOnly = true;
    exportArea.style.cssText = 'display:none;width:100%;height:120px;margin-top:6px;background:#0b1320;color:#e6f0ff;border:1px solid #334;';
    body.appendChild(exportArea);
    this.exportArea = exportArea;

    document.body.appendChild(root);
    this.root = root;
  }

  private buildSliderRow(
    label: string,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
  ): { row: HTMLDivElement; range: HTMLInputElement; number: HTMLInputElement } {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = 'width:60px;';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = '0';
    range.style.cssText = 'flex:1;';
    const number = document.createElement('input');
    number.type = 'number';
    number.step = String(step);
    number.value = '0';
    number.style.cssText = 'width:64px;background:#0b1320;color:#e6f0ff;border:1px solid #334;';
    const apply = (value: number) => {
      const clamped = Math.min(max, Math.max(min, value));
      range.value = String(clamped);
      number.value = String(clamped);
      onChange(clamped);
    };
    // Live feedback on the `input` event (fires on every drag tick), not
    // `change` (fires only on release) — a mid-loop slider tweak must take
    // effect on the very next preview trigger.
    range.addEventListener('input', () => apply(Number(range.value)));
    number.addEventListener('input', () => apply(Number(number.value) || 0));
    row.appendChild(labelEl);
    row.appendChild(range);
    row.appendChild(number);
    return { row, range, number };
  }

  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    if (this.body) this.body.style.display = this.collapsed ? 'none' : 'block';
    if (this.strip) this.strip.textContent = this.collapsed ? 'sfx mix ▾' : 'sfx mix ▴';
  }

  private renderFamilyOptions(): void {
    if (!this.familySelect) return;
    this.familySelect.innerHTML = '';
    for (const family of this.families) {
      const option = document.createElement('option');
      option.value = family;
      option.textContent = family;
      if (family === this.selectedFamily) option.selected = true;
      this.familySelect.appendChild(option);
    }
  }

  private refreshActions(): void {
    if (!this.actionSelect || !this.familyLabel || !this.actionLabel) return;
    const actions = actionsForFamily(sfx.listKeys(), this.selectedFamily);
    const hasActions = actions.length > 0;
    // A key with no action children (foot_grass, ui_click, ...) is not
    // meaningfully a "family": label and treat it as a single flat key, and
    // hide the action tier entirely rather than showing an empty/pointless
    // "(whole family)"-only dropdown.
    this.familyLabel.textContent = hasActions ? 'family' : 'key';
    this.actionLabel.style.display = hasActions ? 'block' : 'none';
    this.actionLabel.textContent = 'action (or whole family)';
    this.actionSelect.innerHTML = '';
    const anyOption = document.createElement('option');
    anyOption.value = '';
    anyOption.textContent = '(whole family)';
    this.actionSelect.appendChild(anyOption);
    for (const action of actions) {
      const option = document.createElement('option');
      option.value = action;
      option.textContent = action;
      this.actionSelect.appendChild(option);
    }
    this.actionSelect.style.display = hasActions ? 'block' : 'none';
    this.selectedAction = null;
  }

  private renderRows(): void {
    if (!this.rowsEl) return;
    this.rowsEl.innerHTML = '';
    if (this.rows.length === 0) {
      this.rowsEl.textContent = '(no scoped writes yet)';
      return;
    }
    for (const [index, row] of this.rows.entries()) {
      const scope = row.action ? `${row.family}+${row.action}` : row.family;
      const ceiling = ceilingForScope(row.keys) ?? 0;
      const over = row.gainDb > ceiling;
      const line = document.createElement('div');
      line.style.cssText = 'display:flex;gap:6px;align-items:center;';
      const text = document.createElement('span');
      text.style.cssText = `flex:1;${over ? 'color:#f5a623;' : ''}`;
      const clampNote = over ? `  [clamps to ${ceiling.toFixed(1)}dB in production]` : '';
      text.textContent = `${scope}  g${row.gainDb.toFixed(1)}dB  r${row.rateDelta >= 0 ? '+' : ''}${row.rateDelta.toFixed(2)}  (${row.keys.length} keys)${clampNote}`;
      const removeButton = document.createElement('button');
      removeButton.textContent = 'x';
      removeButton.addEventListener('click', () => this.removeRow(index));
      line.appendChild(text);
      line.appendChild(removeButton);
      this.rowsEl.appendChild(line);
    }
  }
}

/** `/dev mix` toggles the panel. Pure match, client-only, mirrors
 *  isSfxDevPanelCommand in sfx_dev_panel.ts. */
export function isSfxGainLabPanelCommand(raw: string): boolean {
  return /^\/dev\s+mix(?:\s|$)/i.test(raw.trim());
}

export function createSfxGainLabPanel(): SfxGainLabPanel {
  return new SfxGainLabPanel();
}
