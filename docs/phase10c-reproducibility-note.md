# Fase 10C — reproducibilidad de mantenimiento

Fase 10C no modifica la aplicación clínica ni el app shell. Su objetivo es que el mantenimiento del repositorio no dependa de conocimiento implícito.

## Cambios

- `README.md` se convierte en guía operativa con arquitectura, límites clínicos, validación, release y hardware real.
- `package.json` expone comandos reproducibles:
  - `npm run check:invariants`
  - `npm run check:release`
  - `npm run release:write`
  - `npm run test:e2e`
  - `npm run test:devices`
  - `npm run verify`
- `docs/engineering-baseline.md` registra Fases 10A/10B, 38 E2E Chromium, 12 estados visuales y la deuda técnica vigente.

## Límites

- no cambia `clinical-engine.js`;
- no cambia ningún umbral, dosis o conducta clínica;
- no cambia CSS, PDF, PWA ni service worker;
- no toca `SHELL_FILES`, por lo que el fingerprint vigente no cambia.
