# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Production dashboard data

The dashboard reads compact session data from:

```text
/static/raw-sessions-compact.json
```

In development, `npm.cmd run dev` regenerates this compact file from:

```text
src/lib/data/raw-sessions.json
```

In production, do not edit source files. Update the database, set the backend
`DASHBOARD_STATIC_DIR` to your deployed frontend `static` folder, then call:

```text
GET /api/export/raw-sessions-json
```

That refreshes the public dashboard file:

```text
raw-sessions-compact.json
```

The backend can also write the heavier raw export to a private location. Set
`RAW_JSON_OUTPUT_DIR` for that.

If your frontend should read data directly from the backend instead of a static
file, set this at build time:

```text
VITE_SESSION_DATA_URL=http://your-backend-host:5000/api/export/raw-sessions-compact
```
