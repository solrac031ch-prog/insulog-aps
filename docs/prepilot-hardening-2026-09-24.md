# Endurecimiento pre-piloto — 24 septiembre 2026

## Alcance

Esta revisión ocurre después de completar 10/10 validaciones funcionales end-to-end con casos sintéticos. No constituye validación clínica de efectividad ni autorización para investigación prospectiva.

Versión clínica objetivo de esta fase: `APS-NPH-2026.09.24-r6`.

## Cambios incorporados

### Identidad profesional en equipos compartidos

- La pantalla de inicio muestra el profesional activo con RUT enmascarado.
- Existen acciones explícitas `CAMBIAR` y `CERRAR SESIÓN`.
- No se permite cambiar de profesional cuando existe un caso clínico activo; primero debe finalizarse el caso.
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
- no contiene nombre, fecha de nacimiento ni RUT;
- usa IDs de estudio HMAC estables generados en servidor;
- conserva versiones del motor/sincronización;
- registra SHA-256 del payload y una cadena de hashes entre filas para detectar alteraciones posteriores.

`Pacientes` y `Controles` continúan siendo las tablas operativas identificadas. `CasosRaw` no reemplaza la gobernanza de acceso ni un plan formal de investigación.

### Regla clínica de dosis inicial

La recomendación automática queda alineada con la matriz MINSAL:
- monodosis AM/PM: sugerencia automática 0,1 o 0,2 UI/kg;
- doble dosis: puede sugerir automáticamente 0,3 UI/kg ante hiperglicemia marcada;
- el profesional conserva la posibilidad de seleccionar manualmente 0,3 UI/kg como override documentado.

### Rango de glicemias de seguimiento

UI, motor y backend usan 20–600 mg/dL para las series de seguimiento. Un valor fuera de rango bloquea la titulación automática en vez de ser ignorado silenciosamente.

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

### Ética y gobernanza

No iniciar una cohorte prospectiva identificable hasta definir protocolo/CEC, consentimiento o dispensa que corresponda, roles de acceso, retención, exportación pseudonimizada y encuadre regulatorio institucional.

## Backups y acceso

La base operativa debe mantenerse privada en Drive. Antes de esta fase se realiza una copia de respaldo pre-piloto. Las copias no reemplazan el historial de versiones de Drive ni una política periódica de respaldo.

## Regla de interpretación

Los tests automatizados y casos sintéticos demuestran reproducibilidad funcional, trazabilidad y comportamiento de guardrails. No deben describirse como validación clínica del algoritmo.
