// theme.js from the text of extension/src's files: core.js, each scene in its own block (so a scene's names stay its
// own), then engine.js, all in one function. No file access, so the plugin's tests can use it too.
const indent = (text, by) => text.replace(/\r\n/g, '\n').trimEnd().replace(/^(?=.)/gm, ' '.repeat(by))

export const assemble = (core, scenes, engine) => ['// Built by tools/build.mjs from extension/src: edit there, then build.',
  '(() => {', indent(core, 2), '', ...scenes.flatMap(s => ['  {', indent(s, 4), '  }', '']), indent(engine, 2), '})();', ''].join('\n')
