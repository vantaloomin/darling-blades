/**
 * Device quality tier for the FX / texture budget (mobile-lan-plan §1.6).
 * Phaser-free and browser-guarded: headless (node/vitest) environments detect
 * `full`, so nothing below the UI layer ever changes behavior because of it.
 *
 * `lite` is chosen for touch/mobile devices and low-capability GPUs; it gates
 * the expensive WebGL card FX (see src/ui/fx/FXSupport.ts) and switches the
 * art loader to the half-res 320×400 set (see src/art/ArtResolver.ts).
 *
 * Debug override: append `?quality=lite` or `?quality=full` to the URL — it
 * wins over detection. Tests use detectQualityTier() (pure) or
 * setQualityTier().
 */

export type QualityTier = 'full' | 'lite';

/** Everything detection reads, injected so the decision function stays pure. */
export interface QualityEnv {
  /** value of the `?quality=` URL param, if any */
  queryQuality: string | null;
  userAgent: string;
  /** `(pointer: coarse)` media query result */
  coarsePointer: boolean;
  maxTouchPoints: number;
  /** navigator.deviceMemory (GB) — undefined where unsupported (Safari/Firefox) */
  deviceMemoryGb?: number;
  /** MAX_TEXTURE_SIZE of a throwaway WebGL context — undefined if none */
  webglMaxTextureSize?: number;
}

export function detectQualityTier(env: QualityEnv): QualityTier {
  if (env.queryQuality === 'lite' || env.queryQuality === 'full') return env.queryQuality;
  // Touch / mobile UA → lite. iPadOS 13+ masquerades as Macintosh but exposes
  // multi-touch, hence the second clause.
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(env.userAgent);
  const touchMac = /Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1;
  const touchDevice = env.coarsePointer && env.maxTouchPoints > 0;
  if (mobileUa || touchMac || touchDevice) return 'lite';
  // Low-capability hardware even with a mouse.
  if (env.deviceMemoryGb !== undefined && env.deviceMemoryGb <= 2) return 'lite';
  if (env.webglMaxTextureSize !== undefined && env.webglMaxTextureSize < 4096) return 'lite';
  return 'full';
}

let cached: QualityTier | null = null;

/** The active tier — detected once per page load, then cached. */
export function qualityTier(): QualityTier {
  if (cached === null) cached = detectQualityTier(browserEnv());
  return cached;
}

/** Debug/test hook: force a tier, or pass null to re-detect on next read. */
export function setQualityTier(tier: QualityTier | null): void {
  cached = tier;
}

function browserEnv(): QualityEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    // headless — engine/tests: full, i.e. no behavior change anywhere below UI
    return { queryQuality: null, userAgent: '', coarsePointer: false, maxTouchPoints: 0 };
  }
  let query: string | null = null;
  try {
    query = new URLSearchParams(window.location.search).get('quality');
  } catch {
    /* ignore — no override */
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    queryQuality: query,
    userAgent: navigator.userAgent ?? '',
    coarsePointer:
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    deviceMemoryGb: nav.deviceMemory,
    webglMaxTextureSize: probeWebglMaxTextureSize(),
  };
}

/** One throwaway context at first qualityTier() call; released immediately. */
function probeWebglMaxTextureSize(): number | undefined {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return undefined;
    const size = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return size;
  } catch {
    return undefined;
  }
}
