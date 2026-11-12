import type { ReactNode } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

export const controlClass = 'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

export function SettingsRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 py-5 dark:border-zinc-800"><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{title}</h3>{description && <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>}</div>{children}</div>;
}

/** Radix supplies listbox focus, arrows, Home/End, typeahead, Escape and outside dismissal. */
export function SettingsSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <Select.Root value={value} onValueChange={onChange}><Select.Trigger aria-label={label} className={`${controlClass} flex min-w-40 items-center justify-between gap-4`}><Select.Value /><Select.Icon><ChevronDown size={14} /></Select.Icon></Select.Trigger><Select.Portal><Select.Content position="popper" sideOffset={5} className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-lg border border-zinc-300 bg-white p-1 text-sm text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"><Select.Viewport>{options.map(option => <Select.Item key={option.value} value={option.value} className="relative cursor-default rounded px-8 py-2 outline-none data-[highlighted]:bg-violet-100 dark:data-[highlighted]:bg-violet-950"><Select.ItemIndicator className="absolute left-2 top-2.5"><Check size={14} /></Select.ItemIndicator><Select.ItemText>{option.label}</Select.ItemText></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root>;
}

export function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${checked ? 'bg-violet-700 dark:bg-violet-400' : 'bg-zinc-300 dark:bg-zinc-600'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${checked ? 'left-6' : 'left-1'}`} /></button>;
}

/** Original geometric artwork, authored locally under the repository MIT license. No network assets. */
export function ThemeArtwork({ family }: { family: string }) {
  const colors: Record<string, [string, string]> = { 't3-chat': ['#f3dce8', '#9d356c'], grove: ['#dce8d7', '#386749'], ocean: ['#d4e6ee', '#246580'], ember: ['#f3dfcc', '#a44926'], iris: ['#e6def2', '#6e4b9a'] };
  const [base, ink] = colors[family] || colors.iris;
  return <svg viewBox="0 0 160 72" aria-hidden="true" className="h-16 w-full rounded-md" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="72" fill={base} /><g fill="none" stroke={ink} strokeWidth="1.5" opacity=".75">{Array.from({ length: 7 }, (_, i) => <path key={i} d={`M-10 ${24 + i * 7} Q40 ${-20 + i * 6} 85 ${28 + i * 5} T180 ${12 + i * 7}`} />)}</g><circle cx="125" cy="22" r="9" fill={ink} opacity=".65" /></svg>;
}
