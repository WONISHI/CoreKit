export function resolveContainer(el?: string | HTMLElement): HTMLElement {
  const target = typeof el === 'string' ? document.querySelector(el) : el;
  return (target || document.body || document.documentElement) as HTMLElement;
}

export function isFullScreen(el: HTMLElement): boolean {
  return el === document.body || el === document.documentElement;
}
