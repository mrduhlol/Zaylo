# Zaylo 4.0 implementation plan

Approved scope from the product planning session. This track is separate from the
3.3.0 stability/security release. Submit focused PRs to loftytechlabs-dev/Zaylo
from mrduhlol/Zaylo. Do not change upstream default branches or publish releases.

## Delivery policy

For every project file create, modification, removal, rename or move: run an
appropriate check, commit only that file's task changes, and push immediately
before editing the next file. Preserve unrelated changes. No credentials, temporary
files or build output in Git. No force pushing. Report exact failures.
All agent work uses low reasoning effort when supported. OpenCode GLM/DeepSeek
Flash may assist; the lead completes remaining work if their quota is exhausted.
Never open UI windows or change focus/workspaces. Headless operation only.

## Interface and navigation

- Normal mode by default. Sidebar: New chat, chat search, Personas, Library,
  collapsible Pinned (only populated), Projects, Recent chats, Settings at bottom.
  Section names toggle expansion and show counts. Chat rows have visible gaps.
- Builder mode toggle in General reveals ALL original tool destinations ABOVE
  New chat: Playground, Models, Personas (available in both modes, no duplicate),
  LoftyDB, Forge, More Tools. More Tools includes Overview, Server & API,
  Connected Devices, Performance, Terminal Logs, Hardware Benchmark. Preserve
  actual existing functionality, engine state and advanced controls.
- Collapsing sidebar removes the entire rail/logo; only an expand toggle remains
  top left. No File/Edit/View/Window/Help row on Linux/Windows; preserve native
  window controls and macOS platform affordances.
- Pin and three-dot controls appear on chat hover/focus; pinned chat keeps a
  filled pin. Right-click and dots expose Rename, Pin/Unpin, Share, Archive,
  Delete, Move to project. No Lock chat. Undo archive/delete; confirm destructive
  permanent deletion. Settings includes searchable Archived chats and restore.
- Search sidebar chats/projects by title/content; Settings search finds options
  across categories, including enabled builder tools.
- Conversation prompt minimap: one tick per USER prompt, hover preview, click
  smoothly jumps to that prompt; keyboard access and reduced motion supported.

## Visual design

- Manrope for interface/chat, JetBrains Mono for code; bundle fonts offline.
- Theme families T3 Chat, Grove, Ocean, Ember, Iris, with independent Light,
  Dark and System appearances. No hardcoded dark surfaces in Light mode.
  License/attribute any reused themes; document inspired palettes honestly.
- Image thumbnails in theme cards match the artwork behind the Zaylo sidebar
  name. Header has NO enclosing rectangular button/border/dropdown chevron;
  supplied ASCII artwork fades into sidebar and changes with theme.
- Optional translucent glass surfaces, opacity control and platform-supported
  blur; honest fallback. Keep chat text readable. HTML wallpaper simulation is
  not native desktop transparency.
- Theme-colored inner glow on New chat hover and composer. Light appearance
  uses deeper, visible theme hues. Subtle hover lift on suggestion buttons,
  no layout shift. Atom SVG supplied by user replaces Settings gear.
- Searchable two-column Settings panel; refined custom accessible dropdowns,
  not browser default select menus. Proper spacing, checks, hover, keyboard
  navigation, focus and escape/outside dismissal.

## New chat and setup

- First-run guided LOCAL model setup: detect hardware, recommend model, explain
  storage/download size and progress/cancel, then chat. No remote model calls
  implied by local API. Existing installations keep their usable models.
- Default startup is fresh New chat. General > On startup also offers Continue
  where I left off. Persist preferences locally.
- Centered greeting/composer; attach, model/persona selection, mic, send, useful
  suggestions. Maintain drafts/attachments per conversation.
- One randomly selected background per new empty conversation; stable until
  next New chat, avoid immediate repeats. Fade OUT after first message; no
  animation behind ongoing conversations. No background-picker menu on main UI.
- Original references: live ASCII clouds at https://eooo.me/lab/ascii-clouds/;
  procedural live ASCII fish/abstract studies in HTML prototypes. User later
  explicitly requested supplied MP4 backgrounds too (eight distinct clips) and
  the blue arc image rotated to landscape. Support accepted supplied media,
  label/render accurately; do not present video as live ASCII recreation.
- Background quality is a priority: remove video matte/letterbox rectangles,
  feather all edges, deliberate landscape crop, no captured pointer/page chrome,
  check each source in each appearance. No stretching portrait video. Verify
  legibility, transitions, loop behavior, pause offscreen/hidden and CPU/GPU use.
- Appearance has animation enable/intensity and static reduced-motion fallback.
  Check permission/license of external source/code/assets before redistribution.

## Chat features

- Stop generation, edit/retry prompts, copy/regenerate/read aloud responses.
- Document answers cite actual source files/passages; no fabricated citations.
- Export chats to Markdown/PDF. Projects group chats/files/instructions.
  Library separates uploaded documents, generated images and saved outputs.
- Editable searchable keybindings with conflict detection and reset. Defaults:
  Ctrl+1..9 sidebar chat order (Cmd on Mac), New chat Ctrl+Shift+O,
  Search Ctrl+K, sidebar Ctrl+B, Settings Ctrl+comma, Enter sends,
  Shift+Enter newline. Account for IME/composition and editable-field behavior.
- Temporary chats excluded from saved history AND memory. Per-chat memory
  recall/save controls and inspection. Conversation branching preserves parent.
- Personas available in both modes: general, writing, tutor, coding, custom.
  Composer selection remembered per chat, configurable default, preview/test,
  duplicate/customize, offline import/export, clear descriptions/example prompts.
  Advanced system prompt/model/generation controls in Builder mode.

## Voice, status, storage, accessibility

- Local speech-model setup on first use; explicit microphone permission.
  Entire composer becomes a recording bar with speech-reactive waveform,
  theme-colored inner glow, stop/cancel and timer. It stays recording for the
  duration, not just a short effect. On stop transcribe locally; automatic send
  unless Review before sending enabled. Retry failed transcription without
  losing recording; clear errors and privacy semantics, no silent cloud API.
- Compact System Status popover: CPU/RAM/GPU/VRAM, AI model ready/loading/
  downloading/generating status, tokens/sec. Real values only; hide unsupported
  metrics. Right-click customization with checkboxes, Customize entry and reset;
  preferences persist. Advanced runtime/temperature/diagnostics in builder tools.
- Storage breakdown for models/documents/generated images with safe actions.
- Adjustable text size, reduced motion, full keyboard/screen-reader access,
  contrast, empty/loading/error/offline states. Preserve drafts on navigation.

## References and evidence

Standalone HTML prototypes are UX evidence, not production code. They contain
placeholder features and accumulated scripts; implement clean native components.
Latest local prototypes: /tmp/zaylo-chat-preview/seamless-light.html and
/tmp/zaylo-chat-preview/seamless-preview.html (not durable product assets).
Approved mockup changes: sidebar-section collapse, builder tools above New chat,
Personas in both modes, illustrated theme cards, custom dropdowns, atom Settings
icon, theme-colored glows and seamless background blending.
Original supplied assets are in /home/abhishek/.t3/userdata/attachments/ with
conversation prefix 983aac76-920d-499e-a4b7-1c79f0bb587c-. Preserve originals.

## Release and review

3.3.0 bug/security work happens in its independent thread; do not duplicate its
changes here. 4.0.0 covers the redesigned product and new functionality. Split
navigation, appearance, new-chat, chat functionality/personas/privacy, and
voice/status into reviewable changes rather than a giant PR. Increment package
versions consistently when appropriate. Test existing tools as well as new flows.
No exactness/perfection claims without visual/runtime evidence; call out remaining
limitations honestly. Link every PR immediately after creation or push to it.

## Delivery status — 2026-11-12

The combined implementation is committed and pushed on the fork's
`feat/v4-workspace` branch. Its manifests and native version metadata are prepared
for 4.0.0; no release or installer has been published.

Focused upstream drafts currently open:

- [#3 — Appearance foundation](https://github.com/loftytechlabs-dev/Zaylo/pull/3):
  palettes, offline fonts, shared artwork, presentation preferences and effects.
- [#4 — Local voice and PDF services](https://github.com/loftytechlabs-dev/Zaylo/pull/4):
  local speech setup/transcription, trusted IPC, cancellation and PDF export.
- [#5 — Chat request lifecycle](https://github.com/loftytechlabs-dev/Zaylo/pull/5):
  early/queued cancellation, stream correlation, memory consent and source provenance.
- [#6 — Workspace data](https://github.com/loftytechlabs-dev/Zaylo/pull/6):
  conversation lifecycle, projects, Library, saved outputs and memory inspection.
- [#7 — Personas](https://github.com/loftytechlabs-dev/Zaylo/pull/7):
  gallery/editor, defaults, per-chat selection, import/export and previews.

The independent 3.3.0 security/stability work is in upstream PRs #1 and #2.
Its validated fixes are carried forward in the combined 4.0 branch. Review the
prerequisites before merging dependent drafts; shared-store overlap must be
updated against the accepted upstream base. Do not force-push published history.

Three follow-up topics remain to be submitted from that accepted base:

1. Workspace shell/settings integration: App, Sidebar, Header, Settings,
   shortcuts, illustrated theme controls and collapse behavior.
2. Chat experience integration: composer, recording surface, centered greetings,
   drafts/attachments, source passages, temporary-image guard and background media.
3. 4.0 release metadata and final integration validation.

Those changes are already implemented and verified together on the integration
branch. Do not submit that entire branch as one rollup PR or duplicate all the
unmerged prerequisites into each UI PR.

Local verification of the combined branch:

- Full regression suite: 164 tests across 24 files passed.
- Workspace checks: 30 typecheck tasks and 16 build tasks passed; subsequent
  desktop TypeScript and renderer/Electron production builds passed after UI fixes.
- Headless renderer checks cover all five palettes in light/dark, inherited
  tokens, default greetings/startup, real MediaRecorder with a fixture transcription
  boundary, draft-plus-dictation auto-send, focused transcript review, temporary
  image blocking, memory inspection, popup hit testing and collapsed layout.
- macOS control spacing was simulated in the renderer; this is not native macOS
  window or installer verification. No desktop UI or workspace focus was changed.
- A separate Linux/Python 3.12 CPU smoke test transcribed a local audio sample
  with offline model flags.

Still unverified: packaged Electron microphone permissions and PDF output,
macOS/Windows installers, full native media loop/performance behavior, and every
source frame. The procedural clouds are original code; bundled clips remain
accurately described as video, not a live text recreation. Existing Vite browser
externalization, bundle-size and pnpm configuration warnings remain visible.
