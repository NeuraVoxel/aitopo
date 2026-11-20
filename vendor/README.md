# vendor/

Read-only **design references** checked in as git submodules. They are not workspace packages and must not be imported by `src/` or `demo/`.

| Path | Upstream | Role |
|---|---|---|
| `vendor/archify` | [tt-a1i/archify](https://github.com/tt-a1i/archify) | Product-level architecture / authoring UX reference |
| `vendor/diagram-design` | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | Product-level diagram design / presentation reference |

## Reference split

| Concern | Authority |
|---|---|
| Render engine behavior (dirty paint, interactions, chrome, link geometry) | `twaver.vector` at `/home/jeff/Documents/DT/SDK2D/twaver` (Mac: `/Users/macff/Documents/DT/SDK2D/twaver`) — clean-room ideas only |
| Product-facing UX, information design, authoring flows | `vendor/archify`, `vendor/diagram-design` — ideas only |

AITopo remains a clean-room TypeScript engine: no imports from these trees, no copying of their public API names into `src/`.

## Clone / update

```sh
git submodule update --init --depth 1 vendor/archify vendor/diagram-design
git submodule update --remote --depth 1 vendor/archify   # optional tip bump
git submodule update --remote --depth 1 vendor/diagram-design
```

`archify` is large; prefer shallow clones (`--depth 1`). Do not vendor-copy or npm-link these repos into the engine package.
