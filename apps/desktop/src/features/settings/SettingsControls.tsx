import { useRef, useState, type ReactNode } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { themeArtwork } from '../../theme/artwork';
import type { ThemeFamily } from '../../stores/useWorkspacePreferences';

export const controlClass = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--theme-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)] disabled:opacity-50';

export function SettingsRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-5"><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{title}</h3>{description && <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p>}</div>{children}</div>;
}

/** Radix supplies listbox focus, arrows, Home/End, typeahead, Escape and outside dismissal. */
export function SettingsSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const tabDirection = useRef<number | null>(null);
  return <Select.Root open={open} onOpenChange={setOpen} value={value} onValueChange={onChange}><Select.Trigger ref={trigger} aria-label={label} className={`${controlClass} flex min-w-40 items-center justify-between gap-4`}><Select.Value /><Select.Icon><ChevronDown size={14} /></Select.Icon></Select.Trigger><Select.Portal><Select.Content position="popper" sideOffset={5} onKeyDown={event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      tabDirection.current = event.shiftKey ? -1 : 1;
      setOpen(false);
    }
  }} onCloseAutoFocus={event => {
    const direction = tabDirection.current;
    tabDirection.current = null;
    if (direction === null) return;
    event.preventDefault();
    const controls = Array.from(document.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]'))
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[role="listbox"], [inert]') && element.getClientRects().length > 0);
    const index = controls.indexOf(trigger.current!);
    (controls[index + direction] || trigger.current)?.focus();
  }} className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 text-sm text-[var(--popover-foreground)] shadow-lg"><Select.Viewport>{options.map(option => <Select.Item key={option.value} value={option.value} className="relative cursor-default rounded px-8 py-2 outline-none data-[highlighted]:bg-[var(--theme-accent-soft)] data-[state=checked]:text-[var(--theme-accent)]"><Select.ItemIndicator className="absolute left-2 top-2.5"><Check size={14} /></Select.ItemIndicator><Select.ItemText>{option.label}</Select.ItemText></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root>;
}

export function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${checked ? 'bg-[var(--theme-accent)]' : 'bg-[var(--border)]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${checked ? 'left-6' : 'left-1'}`} /></button>;
}

/** Theme cards and the sidebar header use the same bundled user artwork. */
export function ThemeArtwork({ family }: { family: string }) {
  const artwork = themeArtwork[family as ThemeFamily] || themeArtwork.iris;
  return <img src={artwork.src} alt="" aria-hidden="true" className="h-20 w-full rounded-md object-cover" style={{ filter: artwork.filter, objectPosition: '50% 40%' }} />;
}
