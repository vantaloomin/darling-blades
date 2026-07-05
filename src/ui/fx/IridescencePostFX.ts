import Phaser from 'phaser';

const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uMode;      // 0 border ring, 1 radial hologram, 2 pointer foil, 3 pearlescent oil-slick
uniform vec2 uPointer;    // -1..1 relative to card center
varying vec2 outTexCoord;

vec3 hue2rgb(float h) {
  h = fract(h) * 6.0;
  return clamp(vec3(abs(h - 3.0) - 1.0, 2.0 - abs(h - 2.0), 2.0 - abs(h - 4.0)), 0.0, 1.0);
}
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec4 base = texture2D(uMainSampler, outTexCoord);
  vec2 uv = outTexCoord;
  vec3 rgb = base.rgb;

  if (uMode < 0.5) {
    // Rainbow flows along whatever pixels exist (the baked white ring).
    float band = (uv.x + uv.y) * 1.5 + uTime * 0.25;
    float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(base.rgb, hue2rgb(band) * (0.55 + 0.45 * luma), 0.9) * base.a;
    gl_FragColor = vec4(rgb, base.a);
    return;
  }

  if (uMode < 1.5) {
    // Concentric rainbow rings breathing outward.
    float d = distance(uv, vec2(0.5));
    float band = d * 3.0 - uTime * 0.15;
    rgb = base.rgb + hue2rgb(band) * 0.22 * base.a;
    gl_FragColor = vec4(rgb, base.a);
    return;
  }

  if (uMode < 2.5) {
    // Foil: pointer-reactive rainbow bands over procedural noise patches.
    float n = vnoise(uv * 6.0);
    float band = uv.x * 3.0 + uv.y * 1.5 + uPointer.x * 1.2 + uPointer.y * 0.6 + n * 0.8 + uTime * 0.05;
    float mask = smoothstep(0.35, 0.75, n) * base.a;
    rgb = base.rgb + hue2rgb(band) * mask * 0.42;
    gl_FragColor = vec4(rgb, base.a);
    return;
  }

  // Pearlescent: pointer-reactive pink/green oil-slick interference bands.
  float pn = vnoise(uv * 4.0 + uTime * 0.04);
  float pband = sin((uv.x + uv.y * 0.7 + pn * 1.4 + uPointer.x * 0.6 + uPointer.y * 0.3) * 7.0 + uTime * 0.35);
  vec3 pink = vec3(1.0, 0.45, 0.75);
  vec3 green = vec3(0.45, 1.0, 0.7);
  vec3 slick = mix(pink, green, 0.5 + 0.5 * pband);
  float pmask = smoothstep(0.25, 0.8, pn) * base.a;
  rgb = base.rgb + slick * pmask * 0.34;
  gl_FragColor = vec4(rgb, base.a);
}
`;

/**
 * One custom PostFXPipeline, four modes (border / radial / foil /
 * pearlescent), selected per-instance via the `mode` field. Register once in
 * BootScene; applied via gameObject.setPostPipeline(IridescencePostFX).
 */
export class IridescencePostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  mode = 0;
  pointerX = 0;
  pointerY = 0;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: FRAG });
  }

  onPreRender(): void {
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set1f('uMode', this.mode);
    this.set2f('uPointer', this.pointerX, this.pointerY);
  }
}

export const IRIDESCENCE_KEY = 'IridescencePostFX';
