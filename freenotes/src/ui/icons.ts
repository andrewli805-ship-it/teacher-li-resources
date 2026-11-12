export const icons = {
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M15.5 5 8 12l7.5 7"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>`,
  import: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0 4.5-4.5M12 15 7.5 10.5M5 18.5h14"/></svg>`,
  pen: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m15.5 4.8 3.7 3.7-11 11H4.5v-3.7zM14 6.3l3.7 3.7"/></svg>`,
  highlighter: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m15 5 4 4-3.2 3.2-4-4z"/><path fill="currentColor" opacity=".35" d="M5 18.5h9.5l.8-1.6-4.6-4.6-4.2 4.2z"/></svg>`,
  eraser: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m15.8 5.2 3 3c.7.7.7 1.8 0 2.5l-7.1 7.1H7.2L4.8 15c-.7-.7-.7-1.8 0-2.5l8.5-8.3c.7-.7 1.8-.7 2.5 0zM4 20h16"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M7 8H4v3m.4-2.4A7.5 7.5 0 1 1 4.8 16"/></svg>`,
  redo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M17 8h3v3m-.4-2.4A7.5 7.5 0 1 0 19.2 16"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m-7 0 1 12h6l1-12"/></svg>`,
  more: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></svg>`,
  chevronL: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m14.5 5-6 7 6 7"/></svg>`,
  chevronR: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m9.5 5 6 7-6 7"/></svg>`,
  export: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 14V4m0 0 4 4m-4-4-4 4M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/></svg>`,
  pages: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="11" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M6 7c-1 .4-1.5 1-1.5 2.2v9.3A1.5 1.5 0 0 0 6 20h8"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="m7 7 10 10M17 7 7 17"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m5.5 12 4.5 4.5 8.5-9"/></svg>`,
  homePlus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.8 12 4.5l7.5 6.3"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M6.2 10.2V19.5h11.6V10.2"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 12.2v5.2M9.4 14.8h5.2"/></svg>`,
};

export function icon(name: keyof typeof icons, className = "icon"): string {
  return `<span class="${className}">${icons[name]}</span>`;
}
