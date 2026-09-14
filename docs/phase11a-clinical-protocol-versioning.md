# Fase 11A — versionado explícito del protocolo clínico

## Objetivo

Separar la versión clínica de la versión técnica del app shell y evitar que una modificación del motor clínico entre como si fuera un refactor ordinario.

## Contrato

`clinical-protocol.json` es la fuente canónica de identidad del protocolo clínico. La versión inicial de esta capa de gobernanza es:

`APS-NPH-2026.09.14-r1`

El manifiesto identifica:

- el protocolo `insulog-aps-nph`;
- su alcance clínico;
- el archivo motor `clinical-engine.js`;
- la matriz de regresión que debe seguir verde;
- la política para futuros cambios clínicos.

## Guardrail

`scripts/check_clinical_protocol.py` valida siempre la estructura del manifiesto y la existencia de la matriz de regresión.

En un pull request hacia `main`, además compara el contenido del PR contra la rama base. Si `clinical-engine.js` cambió:

1. `clinical-protocol.json` también debe haber cambiado;
2. si la rama base ya tenía un manifiesto, la versión clínica debe ser distinta;
3. los tests clínicos existentes siguen ejecutándose en el workflow estático.

Por lo tanto, un cambio de dosis, umbral, criterio o conducta clínica no puede quedar oculto como cambio técnico sin al menos una nueva versión explícita del protocolo.

## Separación respecto del release técnico

Esta fase no modifica `clinical-engine.js`, HTML, CSS, service worker ni archivos de producción. Por eso no genera un nuevo fingerprint del app shell. El fingerprint técnico y la versión clínica son conceptos distintos y evolucionan por causas distintas.

## Alcance de esta fase

No se cambian reglas clínicas. No se resuelven ni reinterpretan propuestas clínicas abiertas. Solo se añade trazabilidad y gobernanza para que cualquier cambio clínico futuro sea visible, versionado y sometido a la matriz de regresión.
