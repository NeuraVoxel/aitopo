# Element angle + angleAnchor Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkboxes track progress.

**Goal:** Persist and render `angle` / `angleAnchor` on Node, Group, Path, ShapeNode; Edit-mode rotate handle.

**Architecture:** Degrees about a relative `{u,v}` pivot on originalBounds; paint/hit via rotate/inverse-rotate; dirty uses rotated AABB; Path/ShapeNode keep authored points.

**Tech Stack:** TypeScript, Zod parse, Canvas2D, vitest.

---

### Task 1: Geom helpers
- [x] Geom helpers in `src/geom.ts`
- [x] Tests in `tests/geom-angle.spec.ts`

### Task 2: Protocol
- [x] Types + Zod on Node/Group/Path/ShapeNode
- [x] Patch merge / invert preserve fields

### Task 3: Views + paint + hit
- [x] Views cache angle + anchor; original body vs rotated cull bounds
- [x] Canvas2D rotate about pivot; selection/hover overlays
- [x] Hit inverse-rotates pointer

### Task 4: Dirty / Network
- [x] Dirty / paint use rotated bounds
- [x] Rotate handle overlay chrome

### Task 5: Resize + Rotate interactions
- [x] Resize handles follow rotated corners
- [x] `RotateElementInteraction` + Edit pack + preview/commit

### Task 6: Demo + note
- [x] Elements samples with angle / angleAnchor
- [x] Agent Note implemented; tests green
