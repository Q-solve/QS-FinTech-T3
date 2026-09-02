---
name: Managed Vite workflow environment
description: The environment contract for artifact-routed React/Vite previews and builds.
---

The managed artifact workflow is the reliable verification path for React/Vite artifacts because it supplies the required `PORT` and `BASE_PATH` values.

**Why:** The scaffolded Vite config intentionally fails fast when either variable is absent, so a bare package build can report an environment error even when the app itself is healthy.

**How to apply:** After code changes, restart the managed artifact workflow and use its logs and preview for runtime verification; treat an unconfigured standalone build failure as an environment check first.