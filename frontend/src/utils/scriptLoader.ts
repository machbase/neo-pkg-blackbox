const LOADED_COMMON_SCRIPTS = new Set<string>();

export function prefixUrl(url: string, baseUrl?: string): string {
    const prefix = baseUrl ?? __API_PREFIX__;
    if (prefix && url.startsWith("/")) return `${prefix}${url}`;
    return url;
}

function loadScript(url: string, baseUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const src = prefixUrl(url, baseUrl);
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.onload = () => {
            script.remove();
            resolve();
        };
        script.onerror = () => {
            console.error("[scriptLoader] FAILED", src);
            script.remove();
            reject(new Error(`Failed to load: ${src}`));
        };
        document.head.appendChild(script);
    });
}

export function filterNewScripts(scripts: string[]): string[] {
    return scripts.filter((s) => !LOADED_COMMON_SCRIPTS.has(s));
}

export async function loadScriptsSequentially(jsAssets: string[], jsCodeAssets: string[], baseUrl?: string): Promise<void> {
    const newAssets = filterNewScripts(jsAssets);
    for (const url of [...newAssets, ...jsCodeAssets]) {
        await loadScript(url, baseUrl);
        if (newAssets.includes(url)) LOADED_COMMON_SCRIPTS.add(url);
    }
}
