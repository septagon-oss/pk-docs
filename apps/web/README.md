# apps/web

Current implementation:

- zero-dependency static renderer
- PlatformKit public shell for the product page, module pages, and documentation
- hosted documentation content generated from architecture, ADR, and requirement sources
- page models beside rendered pages for future search, API, and runtime adapters

The important part is not the HTML renderer itself. The maintainable asset is the composed content model that already separates:

- module source loading
- documentation content loading
- API loading
- showcase loading
- public page composition

That lets the renderer change later without rewriting data plumbing.
