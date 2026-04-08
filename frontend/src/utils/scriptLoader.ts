const LOADED_COMMON_SCRIPTS = new Set<string>();

export function prefixUrl(url: string): string {
  if (__API_PREFIX__ && url.startsWith('/')) return `${__API_PREFIX__}${url}`;
  return url;
}

function loadScript(url: string): Promise<void> {
  document.getElementById('tmp-script')?.remove();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = prefixUrl(url);
    script.id = 'tmp-script';
    script.type = 'text/javascript';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load: ${url}`));
    document.head.appendChild(script);
  });
}

export function filterNewScripts(scripts: string[]): string[] {
  return scripts.filter((s) => !LOADED_COMMON_SCRIPTS.has(s));
}

export async function loadScriptsSequentially(jsAssets: string[], jsCodeAssets: string[]): Promise<void> {
  const newAssets = filterNewScripts(jsAssets);
  for (const url of [...newAssets, ...jsCodeAssets]) {
    await loadScript(url);
    if (newAssets.includes(url)) LOADED_COMMON_SCRIPTS.add(url);
  }
}
