import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit2,
  Trash2,
  Star,
  ShieldCheck,
  Sparkles,
  MoreVertical,
  Zap,
  MessageSquare,
  Download,
} from 'lucide-react';
import type { Persona } from '@local-ai/shared';

interface PersonaCardProps {
  persona: Persona;
  isActive: boolean;
  isDefault: boolean;
  onActivate: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  onExport?: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  isActive,
  isDefault,
  onActivate,
  onSetDefault,
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
  onExport,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStyleBadgeColor = (style: string) => {
    switch (style.toLowerCase()) {
      case 'creative':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'concise':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-black/5 dark:bg-white/10 text-[color:var(--foreground)] border-[color:var(--border,rgba(128,128,128,0.2))]';
    }
  };

  const menuItemClass =
    'w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2';
  const menuItemColor = { color: 'var(--foreground)' } as const;
  const borderToken = 'var(--border, rgba(128,128,128,0.2))';

  return (
    <div
      className={`group relative rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between ${
        isActive ? 'shadow-xs' : 'hover:opacity-95'
      }`}
      style={{
        backgroundColor: isActive ? 'var(--card)' : 'var(--card)',
        borderColor: isActive ? 'var(--theme-accent)' : borderToken,
        color: 'var(--foreground)',
        boxShadow: isActive ? '0 0 0 1px var(--theme-accent)' : undefined,
      }}
    >
      <div>
        {/* Top Header: Avatar, Name, Status Badges & Context Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar / Icon Badge */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform duration-200 group-hover:scale-105 border"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: isActive ? 'var(--theme-accent)' : borderToken,
              }}
              aria-hidden="true"
            >
              <span>{persona.avatar || '🤖'}</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold truncate tracking-tight">{persona.name}</h3>

                {isDefault && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    title="Default system persona"
                  >
                    <Star className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                    <span>DEFAULT</span>
                  </span>
                )}

                {persona.isBuiltIn ? (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/5 dark:bg-white/10 border"
                    style={{ borderColor: borderToken, color: 'var(--muted-foreground)' }}
                    title="Protected built-in preset"
                  >
                    <ShieldCheck className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>PRESET</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                    <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>CUSTOM</span>
                  </span>
                )}
              </div>

              {/* Personality / Style Badge */}
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${getStyleBadgeColor(
                    persona.communicationStyle
                  )}`}
                >
                  {persona.communicationStyle}
                </span>
                {persona.personalityTraits.slice(0, 2).map((t, idx) => (
                  <span key={idx} className="text-[10px] hidden sm:inline" style={{ color: 'var(--muted-foreground)' }}>
                    • {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Context Action Menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-haspopup="menu"
              aria-expanded={showMenu}
              aria-label={`Options for ${persona.name}`}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <MoreVertical className="w-4 h-4" aria-hidden="true" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label={`${persona.name} actions`}
                  className="absolute right-0 mt-1 w-48 rounded-lg border shadow-xl py-1 z-30 text-xs"
                  style={{ backgroundColor: 'var(--card)', borderColor: borderToken }}
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onActivate();
                    }}
                    className={menuItemClass}
                    style={menuItemColor}
                  >
                    <Zap className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                    <span>{isActive ? 'Currently Active' : 'Set as Active'}</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onSetDefault();
                    }}
                    disabled={isDefault}
                    className={`${menuItemClass} disabled:opacity-40`}
                    style={menuItemColor}
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                    <span>{isDefault ? 'Default Persona' : 'Set as Default'}</span>
                  </button>

                  {onPreview && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        onPreview();
                      }}
                      className={menuItemClass}
                      style={menuItemColor}
                    >
                      <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                      <span>Preview Chat</span>
                    </button>
                  )}

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className={menuItemClass}
                    style={menuItemColor}
                  >
                    <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                    <span>{persona.isBuiltIn ? 'Inspect / Duplicate' : 'Edit Persona'}</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate();
                    }}
                    className={menuItemClass}
                    style={menuItemColor}
                  >
                    <Copy className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                    <span>Duplicate as Custom</span>
                  </button>

                  {onExport && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        onExport();
                      }}
                      className={menuItemClass}
                      style={menuItemColor}
                    >
                      <Download className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                      <span>Export JSON</span>
                    </button>
                  )}

                  {!persona.isBuiltIn && onDelete && (
                    <div className="mt-1 pt-1 border-t" style={{ borderColor: borderToken }}>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full text-left px-3 py-1.5 text-rose-500 hover:bg-rose-500/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Delete Persona</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs mt-3 line-clamp-2 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {persona.description || 'No description provided.'}
        </p>

        {/* Behavioral Rules Preview */}
        {persona.behavioralRules && persona.behavioralRules.length > 0 && (
          <div className="mt-3.5 pt-3 border-t space-y-1" style={{ borderColor: borderToken }}>
            <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: 'var(--muted-foreground)' }}>
              Core Directives
            </span>
            <ul className="text-[11px] space-y-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {persona.behavioralRules.slice(0, 2).map((rule, rIdx) => (
                <li key={rIdx} className="truncate flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-current opacity-50 shrink-0" aria-hidden="true" />
                  <span className="truncate">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Card Footer: Quick Actions */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: borderToken }}>
        <div className="flex items-center gap-1.5 text-[11px]">
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              <span>ACTIVE</span>
            </span>
          ) : (
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>STANDBY</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              onClick={onPreview}
              aria-label={`Preview ${persona.name} in a live local chat`}
              className="p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: borderToken, color: 'var(--muted-foreground)' }}
              title="Preview chat"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ borderColor: borderToken, color: 'var(--muted-foreground)' }}
          >
            {persona.isBuiltIn ? 'View' : 'Edit'}
          </button>

          <button
            onClick={onActivate}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              isActive ? 'cursor-default' : 'hover:opacity-90'
            }`}
            style={
              isActive
                ? {
                    backgroundColor: 'var(--background)',
                    color: 'var(--muted-foreground)',
                    border: `1px solid ${borderToken}`,
                  }
                : { backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }
            }
          >
            {isActive ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Active</span>
              </>
            ) : (
              <span>Activate</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
