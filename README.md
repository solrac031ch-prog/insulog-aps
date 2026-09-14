# Insulog APS

Insulog APS es una aplicación web estática de apoyo clínico para insulinización y seguimiento con NPH en atención primaria chilena. El proyecto prioriza seguridad clínica, uso móvil, funcionamiento offline coherente por release y generación de un documento imprimible para el paciente.

> **Alcance:** herramienta de apoyo para equipos clínicos. No reemplaza juicio médico, protocolos locales ni evaluación presencial. Los cambios de dosis, umbrales o conducta clínica se tratan como cambios clínicos explícitos y no como refactors de interfaz.

## Qué protege el proyecto

- inicio con NPH según criterios y riesgo definidos en el motor clínico;
- seguimiento con 15 registros HGT y ajustes protegidos por regresión;
- clasificación de hipoglicemia y bloqueo del ajuste automático en nivel 3;
- advertencia de dosis alta/sobreinsulinización;
- valores altos discordantes señalados sin excluirlos del promedio;
- PDF Letter aislado de la interfaz principal;
- PWA con app shell inmutable por release;
- privacidad: sin persistencia local de datos clínicos identificables;
- compatibilidad móvil automatizada con WebKit iPhone-like y Chromium Android-like;
- regresión visual de estados clínicos críticos y foco accesible;
- versionado clínico explícito y guardrail que bloquea cambios del motor sin nueva versión;
- regresión exacta de los textos de nota clínica generados por la app.

El contrato técnico y clínico completo vive en [`docs/engineering-baseline.md`](docs/engineering-baseline.md).

## Arquitectura

| Archivo | Responsabilidad |
| --- | --- |
| `clinical-engine.js` | Cálculos y decisiones clínicas puras, sin DOM |
| `clinical-protocol.json` | Identidad y versión canónica del protocolo clínico |
| `clinical-copy.js` | Generación pura de notas clínicas, sin DOM |
| `app-runtime.js` | Estado efímero, navegación y registro de acciones |
| `app.js` | Adaptación de inputs al motor, delegación del texto y presentación del resultado |
| `aps-safety-2026.js` | Formularios/seguridad APS y flujos complementarios |
| `patient-document.js` | Estructura semántica del documento del paciente |
| `pdf-enhancements.js` | Transformaciones del documento |
| `document-flow.js` | Preparación, vista previa e impresión P6/P7 |
| `app-shell.js` | Inicialización y registro del service worker |
| `sw.js` | App shell offline inmutable |
| `scripts/check_clinical_protocol.py` | Gobernanza: exige nueva versión si cambia el motor clínico |
| `scripts/app_shell_release.py` | Fingerprint canónico del release técnico |

## Requisitos para desarrollo

- Node.js 22 o compatible con la versión fijada de Playwright;
- Python 3;
- navegadores de Playwright para ejecutar E2E.

Instalación:

```bash
npm install
npx playwright install
```

Para servir la app localmente de forma simple:

```bash
python -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Validación local

Comandos principales:

```bash
npm run check:clinical-protocol # manifiesto y gobernanza de versión clínica
npm run test:clinical-copy      # regresión exacta de las notas clínicas
npm run check:invariants        # arquitectura/privacidad/contratos estáticos
npm run check:release           # fingerprint y app shell atómico
npm run test:e2e                # Chromium: flujos, PDF, PWA, visual y accesibilidad
npm run test:devices            # WebKit iPhone-like + Chromium Android-like
npm run verify                  # ejecuta toda la red anterior en secuencia
```

Los workflows de GitHub Actions siguen siendo la autoridad antes de integrar un PR.

## Cómo publicar un cambio del app shell

Si se modifica cualquier archivo incluido en `SHELL_FILES`:

```bash
npm run release:write
npm run check:release
npm run verify
```

`release:write` calcula el fingerprint desde el contenido y sincroniza `index.html`, `pdf-preview.html` y `sw.js`. **No editar manualmente los `?v=` ni el nombre del cache.**

El service worker no usa `skipWaiting()` ni `clients.claim()`: una atención ya abierta conserva un release coherente hasta que el worker anterior deja de controlar clientes.

Release técnico vigente al cierre de Fase 11B: **`239bc6b77d3afe3d`**.

## Cambios visuales

`tests/e2e/visual-contract.spec.js` usa dHash perceptual y genera PNG de diagnóstico. `VISUAL_RECORD=1` solo se usa deliberadamente para grabar un baseline nuevo después de inspeccionar las capturas; nunca debe quedar habilitado como mecanismo automático de aceptación.

## Cambios clínicos

La versión clínica vigente es **`APS-NPH-2026.09.14-r2`** y vive en `clinical-protocol.json`.

No modificar de forma incidental `clinical-engine.js`, umbrales o resultados esperados. Un cambio clínico debe:

1. documentar la conducta propuesta;
2. definir primero los casos esperados/regresiones;
3. actualizar `clinical-protocol.json` con una nueva versión;
4. actualizar motor y UI por separado cuando corresponda;
5. pasar toda la red de seguridad;
6. quedar explícitamente identificado como cambio clínico en el PR.

CI compara cada PR contra `main`. Si cambia `clinical-engine.js` sin cambiar el manifiesto o sin una nueva versión clínica, el check falla.

Los issues clínicos abiertos se mantienen separados de las fases de arquitectura y mantenimiento.

## Validación en hardware real

La emulación cross-browser no reemplaza dispositivos físicos. El protocolo de aceptación iPhone/Android está en [`docs/mobile-device-validation.md`](docs/mobile-device-validation.md). Fase 9B permanece abierta hasta completar esa evidencia.

## Clinical Alignment r2

- Motor clínico alineado con Vía Clínica MINSAL DM2 APS 2026 y detalle técnico del Protocolo de Insulinización MINSAL 2022.
- Urgencias metabólicas e hipoglicemia nivel 3 bloquean titulación y derivan de inmediato.
- Titulación NPH basada en el menor de 3 glicemias, metas individualizadas y ajustes porcentuales.
- Techo automático de insulina basal: 0,5 UI/kg/día; sin intensificación automática de monodosis a BID en r2.

## Estado de ingeniería

- Fase 8: PDF + release/PWA atómico cerrados.
- Fase 9A: compatibilidad móvil automatizada cerrada.
- Fase 9B: validación física pendiente.
- Fase 10A: estados visuales clínicos dinámicos protegidos.
- Fase 10B: accesibilidad/visibilidad de alertas críticas protegida.
- Fase 10C: reproducibilidad de mantenimiento y documentación operativa.
- Fase 11A: versionado explícito y gobernanza del protocolo clínico.
- Fase 11B: generación de notas clínicas separada del DOM con regresión exacta.

Para el detalle y la deuda técnica vigente, revisar [`docs/engineering-baseline.md`](docs/engineering-baseline.md), [`docs/phase11a-clinical-protocol-versioning.md`](docs/phase11a-clinical-protocol-versioning.md) y [`docs/phase11b-clinical-copy.md`](docs/phase11b-clinical-copy.md).
