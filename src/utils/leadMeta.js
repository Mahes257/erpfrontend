/**
 * leadMeta.js — frontend-only persistence bridge.
 *
 * The target backend exposes a unified CRM model: every CRM record is a
 * Lead (clients = stage WON, follow-ups = open leads with a schedule).
 * Fields the backend model does not know about (lead number, priority,
 * follow-up schedule, client tax/banking details, etc.) are serialized
 * into a reserved JSON object appended to the lead's `internalNotes` text.
 *
 * This module reads/writes that object so no data is lost across reloads,
 * while keeping the plain internal-notes text clean for display.
 */

const META_KEY = '__crmMeta';

/**
 * Split an internalNotes string into { meta, notes }.
 * The meta blob lives on the final line, e.g.:
 *   "Some notes...\n{\"__crmMeta\":{\"priority\":\"high\"}}"
 */
export function parseMeta(internalNotes = '') {
  const text = String(internalNotes ?? '');
  const lines = text.split('\n');
  const tail = (lines[lines.length - 1] || '').trim();
  if (tail.startsWith('{') && tail.endsWith('}')) {
    try {
      const parsed = JSON.parse(tail);
      if (parsed && typeof parsed === 'object' && parsed[META_KEY] && typeof parsed[META_KEY] === 'object') {
        lines.pop();
        return { meta: parsed[META_KEY], notes: lines.join('\n').trim() };
      }
    } catch {
      // Not our blob — treat the whole text as plain notes.
    }
  }
  return { meta: {}, notes: text.trim() };
}

/** Read only the meta object from an internalNotes string. */
export function readMeta(internalNotes = '') {
  return parseMeta(internalNotes).meta;
}

/** Return the plain notes text with any meta blob removed. */
export function stripMeta(internalNotes = '') {
  return parseMeta(internalNotes).notes;
}

/**
 * Merge `patch` into the meta object and re-serialize internalNotes,
 * preserving the existing plain notes text.
 */
export function writeMeta(internalNotes = '', patch = {}) {
  const { meta, notes } = parseMeta(internalNotes);
  const next = { ...meta, ...patch };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined || next[key] === null || next[key] === '') delete next[key];
  });
  const suffix = Object.keys(next).length ? `\n${JSON.stringify({ [META_KEY]: next })}` : '';
  return `${notes}${suffix}`.trim();
}

/** Remove specific keys from the meta object and re-serialize. */
export function removeMetaKeys(internalNotes = '', keys = []) {
  const { meta, notes } = parseMeta(internalNotes);
  keys.forEach((key) => delete meta[key]);
  return writeMeta(notes, meta);
}
