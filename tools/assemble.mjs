// theme.js from the text of extension/src's files: core.js, each scene in its own block (so a scene's names stay its
// own), then engine.js, all in one function. No file access, so the plugin's tests can use it too.
const indent = (text, by) => text.replace(/\r\n/g, '\n').trimEnd().replace(/^(?=.)/gm, ' '.repeat(by))

// The scene kit a person's own scene gets: theme.js puts it on globalThis, and the module the mod writes for the
// scene takes it back as names (sceneModule), so it reads as a scene in extension/src/scenes does
export const KIT = ['root', 'GLYPHS', 'LOOSE', 'rgb', 'hex', 'mix', 'hsl', 'hash', 'glyph', 'ell', 'drift', 'near', 'twinkle',
  'rising', 'sketch', 'shape', 'flip', 'frame', 'shade', 'tint', 'haloOf', 'SCENES']
export const sceneModule = scene => `const { ${KIT.join(', ')} } = globalThis.themesForClaude;\n${scene}`

export const assemble = (core, scenes, engine) => ['// Built by tools/build.mjs from extension/src: edit there, then build.',
  '(() => {', indent(core, 2), `  globalThis.themesForClaude = { ${KIT.join(', ')} };`, '',
  ...scenes.flatMap(s => ['  {', indent(s, 4), '  }', '']), indent(engine, 2), '})();', ''].join('\n')
