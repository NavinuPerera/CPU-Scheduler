# CoreQueue development guide

React + TypeScript + Vite + Tailwind project for local development.
Use `npm ci`, `npm run dev`, `npm test`, and `npm run build`.
No development server is assumed to already be running.

`src/App.tsx` owns the UI, `src/index.css` owns styling, and
`src/scheduler.ts` owns pure scheduling behavior. UI-only changes should
preserve scheduling semantics. Keep Guided Practice removed. Preserve the
Figma pixelated visual direction, keyboard access, and responsive behavior.

For engine changes, update meaningful regression cases under tests/ and run
`npm test`. Run `npm run build` before delivering changes.
