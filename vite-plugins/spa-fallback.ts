import type { Plugin } from 'vite';

/**
 * GitHub Pages serves `404.html` for unknown paths. This plugin emits a tiny
 * 404 page that redirects `/rooms/abc?x=1#y` to `/?/rooms/abc&x=1#y`; the
 * matching snippet in `index.html` restores the original URL with
 * `history.replaceState` before the app boots (technique from
 * https://github.com/rafgraph/spa-github-pages).
 *
 * `pathSegmentsToKeep` is derived from Vite's `base`, so the same build works
 * for a user site (`/`) and for a project site (`/<repo>/`).
 */
export function spaFallback404(): Plugin {
  let base = '/';
  return {
    name: 'applyhub:spa-fallback-404',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      const segments = base.split('/').filter(Boolean).length;
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: render404(segments),
      });
    },
  };
}

export function render404(pathSegmentsToKeep: number): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>ApplyHub</title>
    <meta name="robots" content="noindex" />
    <script>
      (function () {
        var pathSegmentsToKeep = ${pathSegmentsToKeep};
        var l = window.location;
        l.replace(
          l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
            l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
            l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
            (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
            l.hash,
        );
      })();
    </script>
  </head>
  <body></body>
</html>
`;
}
