# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of JupyterLab 4.x extensions providing different types of AI/LLM support to students in Jupyter notebooks, built for an academic study. Each extension represents a distinct support condition. Extensions communicate with a JupyterHub service (`/services/askLLM/`) for LLM responses and logging.

## Build Commands

All extensions use `jlpm` (JupyterLab's bundled Yarn) and `hatchling` for building.

```bash
# Per-extension build (run from within an extension directory)
pip install -e "."                          # Install Python package in dev mode
jupyter labextension develop . --overwrite  # Register with JupyterLab
jlpm build                                 # Build TypeScript + labextension

# Watch mode for development
jlpm watch          # Auto-rebuild on source changes

# Production build
jlpm build:prod     # Clean build without sourcemaps

# Linting
jlpm lint           # Runs stylelint + prettier + eslint

# Docker build (from repo root)
docker build -t aipromptextensions .
```

There is no test suite in this project.

## Architecture

### Extension Manager (always loaded)
`extensionManager/src/index.ts` is the core routing extension. On startup it:
1. Sets `PageConfig` option `JupyterHubBaseUrl` (hardcoded to `http://localhost:8533/jupyterhub` — change `setJupyterHubBaseUrl` variable for deployment)
2. Fetches the user's assigned support group from `/services/askLLM/userSupportGroup`
3. Stores the result in `sessionStorage['UseExtension']`

### Support Extensions (6 variants)
Each extension follows the same pattern in a single `src/index.ts`:
- Registers as a `JupyterFrontEndPlugin` with `autoStart: true`
- Listens to `NotebookActions.executed` signal
- Checks cell metadata `supportType` to decide whether to activate
- On error: POSTs to `/services/askLLM/errorLog`, renders the LLM markdown response in a `LLMResponseWidget` side panel
- On success: POSTs to `/services/askLLM/successLog`

| Extension | `supportType` metadata | Behavior |
|---|---|---|
| `workedExampleExtension` | `workedExample` | Max 3 hints per cell via `hintCounter` metadata; reads companion TaskDescription cell |
| `instructionalTextExtension` | `instructionalText` | Max 3 hints; similar to workedExample but gives explanatory text |
| `genericSupportExtension` | `genericSupport` | Auto-calls LLM on error, shows response immediately |
| `personalizedSupportExtension` | `personalizedSupport` | Like generic but with personalized prompt type |
| `customPromptExtension` | `customPrompt` | Shows textarea for user to write their own prompt |
| `noSupportExtension` | `noSupport` | Logging only, no widget shown |

### Cell Metadata Convention
Notebooks must have cells pre-configured with metadata:
- `supportType`: determines which extension handles the cell
- `identifier` / `cellIdentifier`: unique cell ID (e.g. `"IP101Week8Challenge1"`)
- `hintCounter`: tracks hints given (0–3), used by workedExample and instructionalText

### API Authentication
All API calls use `PageConfig.getToken()` as Bearer token in request headers.

## Key Tech Stack
- TypeScript ~5.8–5.9, targeting ES2018
- JupyterLab 4.x (`@jupyterlab/application`, `@jupyterlab/notebook`, `@jupyterlab/rendermime`)
- Python >=3.9, hatchling build backend
- Node.js 20.x
