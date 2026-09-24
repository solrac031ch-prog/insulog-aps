# Insulog APS

Insulog APS es una aplicación web estática de apoyo clínico para insulinización y seguimiento con NPH en atención primaria chilena. El proyecto prioriza seguridad clínica, uso móvil, funcionamiento offline coherente por release y generación de un documento imprimible para el paciente.

> **Alcance:** herramienta de apoyo para equipos clínicos. No reemplaza juicio médico, protocolos locales ni evaluación presencial. Los cambios de dosis, umbrales o conducta clínica se tratan como cambios clínicos explícitos y no como refactors de interfaz.

## Qué protege el proyecto

- inicio con NPH según criterios y riesgo definidos en el motor clínico;
- bloqueo del flujo ambulatorio ante sospecha de cetosis/cetoacidosis/crisis hiperglicémica;
- sensibilidad a insulina orientada por edad, IMC, VFG y riesgo de hipoglicemia;
- seguimiento con al menos 3 HGT y titulación mediante el menor valor de la serie correspondiente;
- metas individualizadas de HbA1c <7%, <8% o <8,5%;
- ajustes porcentuales de NPH (±10/20%) protegidos por regresión;
- clasificación de hipoglicemia nivel 1/2/3 y bloqueo del ajuste automático en nivel 3;
- derivación inmediata a urgencia ante hipoglicemia nivel 3 referida;
- guardrail de insulina basal a 0,5 UI/kg/día y revisión de posible sobreinsulinización;
- valores altos discordantes señalados sin excluirlos automáticamente;
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
| `clinical-protocol.json` | Identidad, fuentes y versión canónica del protocolo clínico |
| `clinical-copy.js` | Generación pura de notas clínicas, sin DOM |
| `app-runtime.js` | Estado efímero, navegación y registro de acciones |
| `app.js` | Adaptación de inputs al motor, delegación del texto y presentación del resultado |
| `aps-safety-2026.js` | Formularios/seguridad APS y flujos complementarios |
| `patient-document.js` | Estructura semántica del documento del paciente |
| `pdf-enhancements.js` | Transformaciones del documento |
| `document-flow.js` | Preparación, vista previa e impresión P6/P7 |
| `app-shell.js` | Inicialización, controles clínicos r2 y registro del service worker |
| `sw.js` | App shell offline inmutable |
| `scripts/check_clinical_protocol.py` | Gobernanza: exige nueva versión si cambia el motor clínico |
| `scripts/check_invariants.py` | Contratos arquitectónicos y clínicos estáticos |
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

Los workflows de GitHub Actions siguen siendo la autoridad antes de integrar un cambio.

## Cómo publicar un cambio del app shell

Si se modifica cualquier archivo incluido en `SHELL_FILES`:

```bash
npm run release:write
npm run check:release
npm run verify
```

`release:write` calcula el fingerprint desde el contenido y sincroniza `index.html`, `pdf-preview.html` y `sw.js`. **No editar manualmente los `?v=` ni el nombre del cache.**

El service worker no usa `skipWaiting()` ni `clients.claim()`: una atención ya abierta conserva un release coherente hasta que el worker anterior deja de controlar clientes.

Release técnico vigente: **`cef21df9f6534c07`**.

## Cambios visuales

`tests/e2e/visual-contract.spec.js` usa dHash perceptual y genera PNG de diagnóstico. `VISUAL_RECORD=1` solo se usa deliberadamente para grabar un baseline nuevo después de inspeccionar las capturas; nunca debe quedar habilitado como mecanismo automático de aceptación.

## Cambios clínicos

La versión clínica vigente es **`APS-NPH-2026.09.24-r6`** y vive en `clinical-protocol.json`.

El baseline r6 alinea el motor con la Vía Clínica DM2 MINSAL 2026, el protocolo MINSAL de insulinización NPH y la capa de seguridad/hipoglicemia ADA 2026. Las adaptaciones locales deliberadas están declaradas en `clinical-protocol.json`.

No modificar de forma incidental `clinical-engine.js`, umbrales o resultados esperados. Un cambio clínico debe:

1. documentar la conducta propuesta y su fuente;
2. definir primero los casos esperados/regresiones;
3. actualizar `clinical-protocol.json` con una nueva versión;
4. actualizar motor y UI por separado cuando corresponda;
5. regenerar el release técnico si cambia el app shell;
6. pasar toda la red de seguridad;
7. quedar explícitamente identificado como cambio clínico.

CI compara cada PR contra `main`. Si cambia `clinical-engine.js` sin cambiar el manifiesto o sin una nueva versión clínica, el check falla.

## Validación en hardware real

La emulación cross-browser no reemplaza dispositivos físicos. El protocolo de aceptación iPhone/Android está en [`docs/mobile-device-validation.md`](docs/mobile-device-validation.md). Fase 9B permanece abierta hasta completar esa evidencia.

## Estado de ingeniería

- Fase 8: PDF + release/PWA atómico cerrados.
- Fase 9A: compatibilidad móvil automatizada cerrada.
- Fase 9B: validación física pendiente.
- Fase 10A: estados visuales clínicos dinámicos protegidos.
- Fase 10B: accesibilidad/visibilidad de alertas críticas protegida.
- Fase 10C: reproducibilidad de mantenimiento y documentación operativa.
- Fase 11A: versionado explícito y gobernanza del protocolo clínico.
- Fase 11B: generación de notas clínicas separada del DOM con regresión exacta.
- Clinical r6: alineación MINSAL 2026/ADA 2026, titulación porcentual, metas individualizadas, guardrails de urgencia/dosis basal, HGT de seguimiento válidos 20–600 mg/dL y sugerencia automática de 0,3 UI/kg limitada a doble dosis.
- Auditoría pre-piloto: identidad profesional visible/cambiable, dataset de investigación estructurado y registro pseudonimizado append-only `CasosRaw`.
- Autenticación del bridge y lista de profesionales autorizados: pendiente de la nómina de participantes; el bridge actual continúa operativo para pruebas y funcionamiento interno.

Para el detalle y la deuda técnica vigente, revisar [`docs/engineering-baseline.md`](docs/engineering-baseline.md), [`docs/phase11a-clinical-protocol-versioning.md`](docs/phase11a-clinical-protocol-versioning.md) y [`docs/phase11b-clinical-copy.md`](docs/phase11b-clinical-copy.md).
