# Insulog APS — estado prepiloto 2026-09-24

## Estado funcional

La ronda sintética end-to-end cerró 10/10 escenarios: inicio, override profesional, seguimiento, hipoglicemia bioquímica, hipoglicemia nivel 3 en ambas ramas, bloqueo de escalamiento por dosis basal alta y crisis hiperglicémica/cetosis con derivación sin pauta ambulatoria.

Esto constituye validación funcional y de trazabilidad; no equivale a validación clínica prospectiva.

## Cambios de endurecimiento prepiloto

### Identidad profesional en equipos compartidos

La portada muestra el profesional activo con RUT enmascarado y permite `CAMBIAR PROFESIONAL`. Al cambiar se elimina la identidad diaria local anterior y se invalida el fingerprint local del registro para evitar que dos profesionales distintos reutilicen el mismo recordId.

### Dataset de investigación

Schema v10 agrega campos estructurados de contexto de inicio y seguridad de dosis, además de `CasosRaw`.

`CasosRaw` es append-only desde la aplicación y guarda:
- control_id;
- research_patient_id pseudonimizado;
- research_professional_id pseudonimizado;
- fecha/hora;
- tipo de documento;
- versión clínica y schema;
- SHA-256 del payload;
- JSON pseudonimizado con todos los inputs/outputs enviados por el frontend.

Los identificadores directos (nombre, fecha de nacimiento y RUT profesional) se excluyen del JSON raw.

### Regla 0,3 UI/kg

Clinical r6 reserva la **sugerencia automática** de 0,3 UI/kg para `doble_dosis`. Si el motor elige monodosis, la sugerencia automática queda en 0,1 o 0,2 UI/kg. El médico conserva la posibilidad de seleccionar manualmente 0,3 UI/kg como override profesional trazado.

### Rango de HGT de seguimiento

UI, motor y backend quedan alineados en **20–600 mg/dL** para valores numéricos de HGT usados en titulación. Valores fuera de ese rango bloquean el cálculo/registro como dato numérico válido.

## Drive y backups

Revisión del 24-09-2026:
- la base clínica principal figura como **no compartida**;
- el único permiso retornado por Google Drive es el propietario;
- se creó una copia de respaldo prepiloto antes de aplicar schema v10.

## Pendientes antes de recolección prospectiva

1. Autenticación/autorización real del profesional cuando exista la nómina de RUT participantes.
2. Reemplazar el POST `no-cors` por un mecanismo que permita confirmar desde el navegador que el servidor aceptó el registro.
3. Completar Fase 9B en un iPhone físico y un Android físico, incluyendo PWA instalada, offline e impresión/compartir PDF.
4. Confirmar branch protection/ruleset de `main` desde GitHub Settings; la integración instalada no tiene permiso administrativo para leer esa configuración.
5. Cerrar CEC/consentimiento/gobernanza de datos antes de usar la base con fines prospectivos de investigación.

## Criterio de uso actual

Apto para pruebas sintéticas y uso técnico controlado. No declarar validación clínica ni iniciar recolección prospectiva de investigación hasta cerrar los pendientes anteriores.
