# Insulog APS — seguimiento en Google Drive

## Objetivo

Registrar automáticamente cada documento clínico emitido por Insulog en la base de Google Sheets `Insulog APS - Base de seguimiento clínico`, usando nombre completo + fecha de nacimiento como identidad clínica longitudinal. El profesional no escribe códigos ni identificadores técnicos adicionales.

## Base de destino definitiva

- Propietario: `mdcarlosherrera@gmail.com`
- Spreadsheet ID: `1WTDqnaHgwX_7OdgxW0C7WIC6Up3dcxOcmKhObHw9La4`
- Hojas utilizadas: `Pacientes`, `Controles`, `Eventos`, `Diccionario`
- Carpeta del proyecto: `Insulog APS - Seguimiento y Validación`
- Los identificadores `patient_id`, `control_id` y `event_id` son generados automáticamente.

## Clasificación longitudinal

El primer registro de cada paciente queda diferenciado automáticamente:

- `Inicio`: el paciente no utilizaba insulina y el inicio de NPH se realiza mediante Insulog.
- `Ingreso con insulina previa`: el paciente ya utilizaba insulina antes de aparecer por primera vez en Insulog.

Después del primer registro:

- `Ajuste`: cambia la dosis indicada respecto de la pauta previa.
- `Seguimiento`: se registra un control sin cambio de dosis.

En `Pacientes` también se conserva la fecha de nacimiento y la situación basal: tipo de ingreso a cohorte, si usaba insulina previamente, NPH AM/PM basal, NPH total basal y dosis final tras el primer registro.

La vinculación longitudinal usa **nombre normalizado + fecha de nacimiento**. Dos personas con el mismo nombre pero distinta fecha de nacimiento se mantienen como pacientes diferentes.

## Despliegue del puente de Google Apps Script

1. Abrir la hoja `Insulog APS - Base de seguimiento clínico` en el Drive de `mdcarlosherrera@gmail.com`.
2. Ir a **Extensiones → Apps Script**.
3. Reemplazar el contenido de `Code.gs` por el archivo `google-apps-script/Code.gs` de este repositorio.
4. Guardar el proyecto con el nombre `Insulog APS Drive Bridge`.
5. Ir a **Implementar → Nueva implementación → Aplicación web**.
6. Ejecutar como: **Yo** (`mdcarlosherrera@gmail.com`).
7. Acceso: usar la opción más restringida que siga funcionando en los equipos clínicos. Si los equipos no comparten un dominio Google Workspace autenticado, la alternativa funcional puede requerir acceso más amplio; el endpoint no expone registros por `doGet`.
8. Implementar y copiar la URL que termina en `/exec`.

## Configuración de Insulog

La aplicación incorpora el endpoint de producción del puente de Drive. Por lo tanto, **no es necesario configurar cada computador**: al abrir la versión publicada de Insulog, los controles pueden enviarse a la base central automáticamente.

El parámetro `?driveEndpoint=` y la clave local del endpoint se conservan únicamente como mecanismos de override técnico para pruebas o recuperación.

### Identificación diaria del profesional

Al abrir Insulog, el sistema solicita el **RUT profesional**. Se valida el dígito verificador y se guarda en el navegador asociado a la fecha local del día. Mientras siga siendo el mismo día, no vuelve a solicitarse en ese computador.

Al cambiar de día, la identificación diaria expira y el RUT se solicita nuevamente. Cada control y evento de hipoglicemia queda asociado al RUT profesional que emitió la decisión clínica.

El médico no necesita acceso al Google Sheet ni iniciar sesión en la cuenta propietaria del Drive. El Apps Script escribe en la base utilizando la cuenta propietaria del puente.

## Datos enviados por control

- Nombre completo del paciente y fecha de nacimiento.
- Fecha/hora.
- RUT profesional validado.
- Tipo de control: inicio, ingreso con insulina previa, ajuste o seguimiento.
- Peso.
- HbA1c basal o HbA1c actual si está disponible.
- VFG en el inicio si fue registrada.
- Dosis NPH previa AM/PM y total.
- Promedios de glicemia en ayunas y pre-almuerzo.
- Detección de valores <70 y <54 mg/dL.
- Recomendación original de Insulog.
- Decisión final del profesional.
- Motivo de modificación, cuando corresponde.
- Tratamiento concomitante del día con medicamento y dosis.
- Claves estructuradas de medicamentos y marcadores por clase: metformina, iSGLT2 y DPP-4/vildagliptina.
- Versiones del motor clínico/documento/runtime.

## Comportamiento ante fallas

El endpoint de producción de Drive viene configurado en la aplicación. Si se invalida o se reemplaza manualmente por un endpoint incorrecto, Insulog no guarda nombres en almacenamiento persistente local. Si falla la red durante una pestaña abierta, conserva temporalmente el registro solo en memoria y vuelve a intentar al recuperar conexión. Al cerrar la pestaña, ese buffer se pierde; por eso la implementación de Apps Script debe verificarse con un paciente ficticio antes del uso prospectivo.

## Duplicados

Cada emisión clínica tiene un `recordId` técnico. El backend rechaza reintentos con el mismo `recordId`. Dentro de una misma sesión, volver a abrir el mismo documento sin cambiar la decisión reutiliza el identificador para evitar duplicar el control.

## Identidad y análisis longitudinal

La identificación clínica utiliza nombre normalizado + fecha de nacimiento y el backend asigna un `patient_id` interno. Los medicamentos concomitantes se guardan en `Controles`, no como atributo fijo de `Pacientes`, porque pueden cambiar entre visitas. Esto permite reconstruir la exposición terapéutica de cada control sin perder la situación basal.
