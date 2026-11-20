# Golden GraphDocument examples

Deterministic layouts for the topo track.

**Preview:** serve `assets/` and open `host/index.html`, then use the **Example** dropdown (or `?example=flowchart-linear`). Requires HTTP (`fetch`); `file://` will not load these JSON files.

| File | Recipe |
|---|---|
| `flowchart-linear.json` | Top-down process |
| `flowchart-decision.json` | Decision + Yes/No + merge |
| `flowchart-feedback.json` | U-path + dashed return |
| `flowchart-swimlane.json` | Two lanes, hand-off |
| `flowchart-fan-in.json` | Fan-in → merge → sink |
| `data-flow-pipeline.json` | Role × stage pipeline |
| `state-machine.json` | States + labeled transitions |

Authoring rules: [`references/layout-recipes.md`](../../references/layout-recipes.md), verify: [`references/layout-verify.md`](../../references/layout-verify.md).

Host smoke sample (groups + SubNetwork) remains [`../host/sample.graph.json`](../host/sample.graph.json).
