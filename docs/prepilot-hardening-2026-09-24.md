# Endurecimiento pre-piloto — 24 septiembre 2026

## Alcance

Esta revisión ocurre después de completar 10/10 validaciones funcionales end-to-end con casos sintéticos. No constituye validación clínica de efectividad ni autorización para investigación prospectiva.

Versión clínica objetivo de esta fase: `APS-NPH-2026.09.24-r6`.

## Cambios incorporados

### Identidad profesional en equipos compartidos

- La pantalla de inicio muestra el profesional activo con RUT enmascarado.
- Existen acciones explícitas `CAMBIAR` y `CERRAR SESIÓN`.
- No se permite cambiar de profesional cuando existe un caso clínico activo, incluso si solo hay campos o selecciones parcialmente completados; primero debe finalizarse o descartarse el caso.
- Al cambiar/cerrar profesional se invalida también el identificador de registro en memoria, evitando reutilizar un `recordId` entre identidades.
- El RUT diario sigue siendo identificación operativa, no autenticación criptográfica.

### Dataset de investigación y auditoría

`Controles` incorpora variables estructuradas para:
- mínimos HGT realmente usados por el algoritmo;
- dosis actual, recomendada y final en UI/kg/día;
- nivel de seguridad de dosis basal y bloqueo de escalamiento;
- glicemias, edad, IMC, criterios, síntomas y riesgo de hipoglicemia del inicio;
- ruta de crisis/urgencia y su motivo;
- identificadores de estudio pseudonimizados de paciente y profesional.

Se añade `CasosRaw`, destinado a una traza append-only del payload clínico pseudonimizado:
- se construye desde una allowlist de variables estructuradas, no desde una copia del payload identificable;
- no contiene nombre, fecha de nacimiento, RUT ni texto libre clínico/profesional;
- conserva indicadores estructurados de si existió motivo libre y códigos de razones de bloqueo;
- usa IDs de estudio HMAC estables generados en servidor;
- conserva versiones del motor/sincronización;
- registra SHA-256 del payload y una cadena de hashes entre filas para detectar alteraciones posteriores;
- un reintento de un `recordId` existente puede reparar `CasosRaw` o eventos automáticos faltantes sin duplicarlos.

`Pacientes` y `Controles` continúan siendo las tablas operativas identificadas. `CasosRaw` no reemplaza la gobernanza de acceso ni un plan formal de investigación.

Desde la preparación para inicio de atenciones, todo caso nuevo se etiqueta como `PREPILOTO_OPERATIVO` y `Elegible para investigación = No`. Los registros históricos previos a esta separación se etiquetan `PREPILOTO_LEGACY`. Esto permite conservar los casos asistenciales/prepiloto sin incorporarlos automáticamente a una cohorte prospectiva futura. La transición a `PROSPECTIVO_CEC` requiere un cambio de versión explícito después de completar los gates éticos e institucionales.

### Regla clínica de dosis inicial

La recomendación automática queda alineada con la matriz MINSAL:
- monodosis AM/PM: sugerencia automática 0,1 o 0,2 UI/kg;
- doble dosis: puede sugerir automáticamente 0,3 UI/kg ante hiperglicemia marcada;
- el profesional conserva la posibilidad de seleccionar manualmente 0,3 UI/kg como override documentado.

### Rango de glicemias de seguimiento

UI, motor y backend usan 20–600 mg/dL para las series de seguimiento. La interfaz conserva el valor digitado fuera de rango (por ejemplo 601) para que el motor lo rechace explícitamente; no lo recorta silenciosamente a 600.

## Pendientes deliberados

### Autenticación del bridge

El bridge continúa operativo durante desarrollo/validación funcional. Antes de incorporar múltiples profesionales a recolección prospectiva se debe implementar autenticación/autorización con la lista de profesionales participantes. Un RUT con DV válido no es autenticación.

La confirmación fuerte de persistencia servidor-cliente se resolverá junto con esa evolución del bridge; el modo `no-cors` actual no permite al navegador demostrar que Apps Script aceptó el payload.

### Fase 9B

La compatibilidad automatizada WebKit/Chromium sigue siendo un guardrail, no una prueba física. 9B requiere PASS manual en:
- iPhone físico: Safari + PWA;
- Android físico: Chrome + PWA;
- teclado/orientación/foco;
- PDF/impresión o compartir;
- offline tras cierre/reapertura;
- al menos una transición real entre releases.

### Ética, consentimiento, gobernanza y regulación

El gate prospectivo se formaliza en:
- `docs/prospective-research-gate-2026-09-24.md`;
- `docs/consentimiento-investigacion-template.md`;
- `docs/regulatory-position-chile-2026-09-24.md`.

No iniciar una cohorte prospectiva hasta contar con CEC favorable y autorización institucional, consentimiento final aprobado cuando corresponda, gobernanza de acceso/retención, 9B físico PASS, bridge autenticado para los participantes y criterio regulatorio documentado.

## Backups y acceso

Revisión 24-09-2026: la base operativa de Drive está privada, sin permisos `anyone`, dominio ni editores adicionales; el único permiso visible es el propietario. Existen tres copias prepiloto fechadas 24-09-2026 y la base activa conserva historial de revisiones. No se elimina ninguna copia automáticamente.

GitHub: el repositorio no expone rulesets configurados. La consulta de branch protection clásica devuelve 403 para la integración actual, por lo que no puede verificarse ni modificarse desde este flujo. Issue #73 permanece como gate de plataforma hasta configurarlo y probar que un check rojo bloquea el merge.

## Regla de interpretación

Los tests automatizados y casos sintéticos demuestran reproducibilidad funcional, trazabilidad y comportamiento de guardrails. No deben describirse como validación clínica del algoritmo.
