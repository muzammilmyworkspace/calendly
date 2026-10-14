/** Small inline icons — no icon library needed. */
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Clock = () => <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const Video = () => <svg {...base}><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10 5-3v10l-5-3" /></svg>;
export const Globe = () => <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg>;
export const Cal = () => <svg {...base}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const Check = () => <svg {...base} width={28} height={28} strokeWidth={2}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const Left = () => <svg {...base}><path d="m15 6-6 6 6 6" /></svg>;
export const Right = () => <svg {...base}><path d="m9 6 6 6-6 6" /></svg>;
export const Arrow = () => <svg {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
