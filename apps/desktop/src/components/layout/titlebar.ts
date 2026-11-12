/** Leave native macOS traffic lights clear when the sidebar is collapsed. */
export function collapsedTitlebarInsets(platform = typeof navigator === 'undefined' ? '' : navigator.platform) {
  return /Mac/.test(platform) ? { toggleLeft: 80, contentLeft: 128 } : { toggleLeft: 8, contentLeft: 48 };
}
