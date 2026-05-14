# apps/web

Current implementation:

- zero-dependency static renderer
- central page-model driven preview
- intended to be replaced by a Fumadocs UI shell once package installation is available

The important part is not the HTML renderer itself. The maintainable asset is the composed page model that already separates:

- module source loading
- API loading
- showcase loading
- page composition

That lets the renderer change later without rewriting data plumbing.
