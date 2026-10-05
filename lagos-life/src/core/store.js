// Character state store + persistence. One canonical state; everything subscribes to it.
import { createCharacter, sanitize, serialize, deserialize, fingerprint } from './schema.js';

const KEY = 'lagoslife.character.v2', SLOTS = 'lagoslife.slots.v2', WALLET = 'lagoslife.wallet.v1';
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } } };

export class Store {
  constructor() {
    this.subs = new Set(); this.state = null; this.committedWorn = null;
    const saved = ls.get(KEY); let st = null;
    if (saved) { try { st = deserialize(saved); } catch (e) { console.warn('saved character unreadable, starting fresh', e); } }
    this.state = st || createCharacter({ seed: 20251005, name: 'Ada' });
    this.wallet = Number(ls.get(WALLET)) || 300000; this.owned = new Set(JSON.parse(ls.get(WALLET + '.owned') || '[]'));
  }
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  // mutate(fn): fn receives a draft (deep copy), returns nothing. live=true while a slider is being dragged.
  mutate(fn, { live = false, silent = false } = {}) {
    const d = JSON.parse(JSON.stringify(this.state)); fn(d); this.state = sanitize(d);
    if (!silent) for (const s of this.subs) s(this.state, { live });
  }
  replace(st, opts = {}) { this.state = sanitize(st); for (const s of this.subs) s(this.state, { live: false, ...opts }); }
  fingerprint() { return fingerprint(this.state); }
  save(slot = 'main') { const json = serialize(this.state); ls.set(KEY, json); const all = JSON.parse(ls.get(SLOTS) || '{}'); all[slot] = { json, at: Date.now(), name: this.state.name, fp: this.fingerprint() }; ls.set(SLOTS, JSON.stringify(all)); return this.fingerprint(); }
  slots() { return JSON.parse(ls.get(SLOTS) || '{}'); }
  loadSlot(slot) { const e = this.slots()[slot]; if (!e) return false; this.replace(deserialize(e.json)); return true; }
  loadSaved() { const s = ls.get(KEY); if (!s) return false; this.replace(deserialize(s)); return true; }
  exportJSON() { return JSON.stringify(sanitize(this.state), null, 2); }
  importJSON(text) { this.replace(deserialize(text)); }
  buy(item, price) { if (this.owned.has(item)) return true; if (this.wallet < price) return false; this.wallet -= price; this.owned.add(item); ls.set(WALLET, String(this.wallet)); ls.set(WALLET + '.owned', JSON.stringify([...this.owned])); return true; }
}
