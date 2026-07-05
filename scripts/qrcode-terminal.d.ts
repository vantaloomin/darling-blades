/** Minimal ambient types for the zero-dependency `qrcode-terminal` dev-dep. */
declare module 'qrcode-terminal' {
  export function generate(
    text: string,
    opts?: { small?: boolean },
    cb?: (qr: string) => void,
  ): void;
  export function setErrorLevel(level: 'L' | 'M' | 'Q' | 'H'): void;
}
