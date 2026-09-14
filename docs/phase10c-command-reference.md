# Comandos de mantenimiento

Referencia corta para ejecución local. La descripción completa vive en `README.md`.

```bash
npm run check:invariants
npm run check:release
npm run test:e2e
npm run test:devices
npm run verify
```

Cuando cambia un archivo del app shell:

```bash
npm run release:write
npm run check:release
npm run verify
```

No editar manualmente los `?v=` ni el nombre del cache del service worker.
