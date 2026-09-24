# Gate de investigación prospectiva y gobernanza — Insulog APS

Fecha de corte: 24 septiembre 2026.

## Estado

Este documento define el gate obligatorio antes de usar Insulog APS para una cohorte prospectiva o para recolectar datos con fines de investigación.

**El gate NO está cumplido todavía.** El código puede continuar en desarrollo, pruebas sintéticas y validación técnica. No se debe iniciar reclutamiento prospectivo hasta completar los ítems externos y documentales indicados abajo.

## 1. Aprobaciones previas

Antes del primer participante deben constar:

1. protocolo de investigación en versión fechada y controlada;
2. informe favorable de un Comité Ético Científico acreditado e independiente;
3. autorización expresa de la dirección del establecimiento donde se ejecutará el estudio;
4. consentimiento informado aprobado por el CEC y firmado antes de cualquier procedimiento de investigación, salvo que el propio CEC determine por escrito una excepción jurídicamente aplicable;
5. responsables nominales de investigación, custodia de datos, seguridad/incidentes y administración técnica;
6. clasificación/regulación aplicable del software documentada con consulta institucional/ISP cuando corresponda.

La Ley 20.120, artículos 10 y 11, y el DS 114/2010, artículos 10 y 11, son el piso normativo de este gate.

## 2. Paquete mínimo para CEC

El expediente debe mantener una sola versión coherente entre protocolo, consentimiento, CRF/dataset y software.

Contenido mínimo:

- problema y justificación local;
- marco teórico;
- pregunta de investigación, objetivos e hipótesis;
- diseño, población, criterios de inclusión/exclusión, reclutamiento y seguimiento;
- descripción exacta de qué hace Insulog y qué decisión conserva el médico;
- desenlaces y variables;
- plan estadístico;
- riesgos previsibles, manejo de hipoglicemia/hiperglicemia y criterios de suspensión;
- manejo de desviaciones del algoritmo y overrides del profesional;
- consentimiento informado;
- plan de privacidad y gobernanza;
- plan de incidentes y tecnovigilancia si el encuadre regulatorio lo requiere;
- versiones del motor clínico, interfaz y esquema de datos;
- declaración de financiamiento/conflictos de interés;
- cronograma, recursos y responsables.

## 3. Separación asistencial e investigación

Insulog es una herramienta de apoyo y no reemplaza el juicio clínico. Para la fase prospectiva:

- el médico debe poder aceptar o modificar la recomendación y dejar motivo;
- las rutas de urgencia deben prevalecer sobre la titulación automática;
- una negativa a participar o el retiro del estudio no puede condicionar la atención habitual;
- la atención clínica identificada y el dataset de investigación pseudonimizado deben mantenerse conceptualmente separados;
- cualquier cambio del motor que pueda modificar conducta clínica requiere nueva versión y evaluación de si constituye enmienda al protocolo/CEC.

## 4. Gobernanza del dato

### 4.1 Capas

**Capa operativa identificada:** `Pacientes`, `Controles` y `Eventos`. Solo para continuidad clínica/operativa y verificación autorizada.

**Capa de investigación:** `CasosRaw` y exportaciones analíticas derivadas. Usa identificadores de estudio HMAC y no debe contener nombre, fecha de nacimiento, RUT profesional ni texto libre potencialmente identificable.

### 4.2 Minimización

Recolectar solo variables preespecificadas en protocolo/diccionario. No incorporar texto libre a `CasosRaw`. Los motivos libres pueden permanecer en la capa operativa si son clínicamente necesarios, pero para investigación se transforman a indicadores/códigos estructurados.

### 4.3 Acceso

Antes de prospectiva debe existir una matriz nominal con:

| Rol | Acceso identificado | Acceso pseudonimizado | Puede exportar | Puede administrar |
| --- | --- | --- | --- | --- |
| Investigador principal | según protocolo | sí | sí, según protocolo | no necesariamente |
| Equipo clínico autorizado | mínimo necesario | según rol | no por defecto | no |
| Analista | no | sí | solo dataset aprobado | no |
| Administrador técnico | mínimo técnico | mínimo técnico | no por defecto | sí |

El Google Sheet de producción debe permanecer privado y sin enlaces `anyone`/dominio. Los profesionales participantes no requieren acceso directo a la planilla si el bridge es el único escritor autorizado.

### 4.4 Retención y eliminación

El protocolo/CEC debe definir explícitamente:

- plazo de conservación de datos identificados;
- plazo de conservación del dataset pseudonimizado;
- tratamiento de copias de seguridad;
- qué ocurre ante retiro del consentimiento;
- momento y responsable de destrucción o anonimización irreversible;
- conservación de documentación regulatoria/auditoría cuando exista obligación legal.

No fijar plazos arbitrarios en código.

### 4.5 Integridad y trazabilidad

- `recordId` idempotente por registro;
- `CasosRaw` append-only lógico;
- hash SHA-256 del payload pseudonimizado;
- cadena de hashes entre registros;
- versión del motor, sync y schema por caso;
- reintentos no deben duplicar eventos ni perder `CasosRaw`;
- las exportaciones de análisis deben registrar fecha, versión de protocolo y criterio de inclusión.

### 4.6 Incidentes

Definir un procedimiento escrito para:

- acceso no autorizado;
- pérdida/alteración de datos;
- error de algoritmo con potencial daño;
- discrepancia entre recomendación y payload persistido;
- indisponibilidad del bridge;
- exposición accidental de identificadores en exportaciones.

Cada incidente debe registrar fecha, alcance, contención, análisis de causa, corrección, necesidad de notificar al CEC/institución/autoridad y criterio para reabrir el estudio.

## 5. Protección de datos en transición normativa

A 24-09-2026 sigue vigente la Ley 19.628 en su versión actual. La Ley 21.719 entra en vigor el 01-12-2026.

Dado que una fase prospectiva puede atravesar esa fecha, Insulog debe diseñarse desde ahora al estándar más exigente: finalidad definida, minimización, control de acceso, trazabilidad, seguridad, derechos del titular y responsabilidades documentadas.

## 6. Bridge y profesionales autorizados

Durante desarrollo funcional puede mantenerse el bridge actual.

**Antes de recolección prospectiva multiusuario** se exige:

- autenticación real del escritor;
- lista explícita de profesionales autorizados;
- RUT solo como identificador, nunca como secreto/autenticador;
- respuesta verificable del servidor para confirmar persistencia;
- cola de reintento durable y segura o mecanismo equivalente;
- protección contra replay/duplicados;
- revocación de acceso por profesional;
- logs de acceso/errores sin datos clínicos innecesarios.

La lista de RUT se incorpora cuando el investigador defina quiénes participarán.

## 7. Gate GO / NO-GO

La fase prospectiva queda en **NO-GO** si falta cualquiera de los siguientes:

- CEC favorable;
- autorización de dirección;
- consentimiento final aprobado, cuando corresponda;
- protocolo/dataset/versiones congelados;
- 9B PASS en hardware físico;
- autenticación/autorización del bridge para los profesionales participantes;
- confirmación fuerte de escritura y reintento seguro;
- matriz de accesos y retención aprobada;
- clasificación/regulación del software documentada;
- plan de incidentes activo.

Solo al cerrar todos esos puntos puede cambiarse este gate a **GO**, registrando fecha, versión de Insulog y responsables.

## Fuentes oficiales

- Ley 20.120, BCN: https://www.bcn.cl/leychile/navegar?i=253478
- DS 114/2010 MINSAL, BCN: https://www.bcn.cl/leychile/navegar?i=1032919
- Ley 19.628, BCN: https://www.bcn.cl/leychile/Navegar?dt=open&idLey=19628
- Ley 21.719, BCN (vigencia 01-12-2026): https://www.bcn.cl/leychile/navegar?i=1209272
