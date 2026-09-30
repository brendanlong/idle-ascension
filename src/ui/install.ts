/**
 * Asks the browser not to clear the save under storage pressure. Only when
 * installed, since some browsers show a permission prompt for this.
 */
export function protectInstalledSave(): void {
  if (!matchMedia('(display-mode: standalone)').matches) return;
  void navigator.storage?.persist?.();
}
