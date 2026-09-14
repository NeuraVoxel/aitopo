# Installation guide

Ways to install `@neuravoxel/ai-eng` into a consumer repository, online or offline. Requires Node `^22.19.0 || >=24`. All examples use pnpm; npm works the same way — swap `pnpm add -D` for `npm install -D` and `pnpm exec` for `npx`.

After installing, scaffold the kit files with `pnpm exec ai-eng init` (see the [README](../README.md)). Verify any install with `pnpm exec ai-eng --version`.

## Online install

From the npm registry (recommended):

```bash
pnpm add -D @neuravoxel/ai-eng@0.1.11
# or track the minor line:
pnpm add -D @neuravoxel/ai-eng@^0.1.0
```

If a release cut exists only as a git tag, pin the tag instead:

```bash
pnpm add -D github:NeuraVoxel/ai-eng-kit#v0.1.11
```

## Offline install

Air-gapped machines install from the tarball: produce or download it on any connected machine, transfer it, then install from the file.

1. On a connected machine, get the tarball. Either download the published package without installing:

   ```bash
   npm pack @neuravoxel/ai-eng@0.1.11
   ```

   or build it from a clone of this repository:

   ```bash
   pnpm run pack   # writes dist/neuravoxel-ai-eng-<version>.tgz
   ```

2. Transfer the `.tgz` to the offline machine and put it in a stable location inside the consumer repo, for example `vendor/`.
3. Install from the file:

   ```bash
   pnpm add -D ./vendor/neuravoxel-ai-eng-0.1.11.tgz
   ```

   The dependency entry points at the file path. Keep the tarball at that path — commit it to the repo or serve it from an internal mirror — so later `pnpm install` runs keep resolving.

4. Scaffold and verify:

   ```bash
   pnpm exec ai-eng init .
   pnpm exec ai-eng --version
   ```

### Offline CI

The workflow shipped by `init` (`.github/workflows/ai-eng.yml`) runs `npx --yes @neuravoxel/ai-eng verify-notes .agents/notes`. `npx` resolves the locally installed package first, so with the devDependency from step 3 the gate runs without registry access as long as dependencies are installed. On runners without network, prime the package-manager cache (pnpm store / npm cache) before the workflow runs, or keep the committed tarball path and install as part of the job.

Upgrades follow the same channel: put the newer tarball at the same path (or bump the registry version), run `pnpm install`, then `pnpm exec ai-eng init --upgrade .` — see the README's [consumer upgrade sequence](../README.md#consumer-upgrade-sequence).
