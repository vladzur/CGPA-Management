# Cumplimiento del sitio web — Google Workspace for Nonprofits

> **Propósito:** documentar cómo el sitio `https://cgpagrahambell.cl` cumple cada uno de los
> requisitos que Google revisa al evaluar la postulación a **Google Workspace for Nonprofits**,
> y qué queda pendiente antes de enviar la solicitud.

---

## 1. Datos de la organización declarados en el sitio

Estos son los datos que Google contrasta contra el registro de la organización sin fines de lucro.

| Dato | Valor | Dónde se publica |
|---|---|---|
| Nombre legal | Centro General de Padres y Apoderados Liceo Alexander Graham Bell | `/`, `/nosotros`, footer de todas las páginas |
| Sigla / marca | CGPA · CGPA Graham Bell | Encabezado y footer de todas las páginas |
| Naturaleza jurídica | Organización funcional sin fines de lucro | `/nosotros`, `/contacto`, footer |
| N° de personalidad jurídica | 242029 | `/`, `/nosotros`, `/contacto`, footer, datos estructurados |
| Fecha de concesión | 31-05-2016 | `/nosotros`, footer |
| Estado | Vigente | `/`, `/nosotros`, footer |
| Registro | Registro de Personas Jurídicas sin Fines de Lucro | `/nosotros` |
| Domicilio | San Ramón N° 2055, Villarrica, Región de La Araucanía | `/`, `/nosotros`, `/contacto`, footer, datos estructurados |
| Última elección de directiva | 29-04-2026 (período de 3 años) | `/nosotros#directiva` |
| Integrantes de la directiva | 10 cargos con nombre y cargo | `/nosotros#directiva` |

La fuente de verdad de este contenido es `apps/client/src/content/institutional.ts`.
Los **RUN de los integrantes de la directiva no se publican** (resguardo de datos personales,
Ley 19.628).

---

## 2. Revisión de los criterios de Google

### 2.1 Sitio web funcional

> *"El sitio web de tu organización debe ser completamente funcional. Asegúrate de que el
> dominio proporcionado se cargue correctamente y no contenga principalmente contenido
> provisional."*

| Requisito | Cómo se cumple |
|---|---|
| El dominio carga correctamente | `https://cgpagrahambell.cl` está conectado a Firebase Hosting como dominio personalizado, con certificado TLS y CDN global. |
| No hay contenido "Próximamente" ni "En construcción" | Todas las páginas institucionales tienen contenido real. Los estados vacíos son informativos y fechados (por ejemplo, `/proyectos` explica cuándo y cómo se publican los proyectos en lugar de mostrar un aviso provisional). |
| El contenido no depende de JavaScript | El build genera HTML estático para las 6 páginas públicas mediante `apps/client/scripts/prerender.mjs`. Un revisor con JavaScript deshabilitado ve el nombre legal, la misión, el N° de personalidad jurídica y el domicilio. |
| El sitio es navegable y está enlazado | Menú de navegación con 6 secciones, footer con mapa del sitio y enlaces cruzados entre páginas. |
| Formulario funcional | `/contacto` persiste el mensaje en Firestore y aparece en la bandeja de la directiva (`/admin/mensajes`). No es un simple enlace `mailto:`. |
| Transparencia financiera operativa | `/transparencia` publica el saldo del fondo general y cada movimiento con su respaldo y sello criptográfico. |
| Verificación de documentos | `/validar/:uuid` valida los documentos oficiales emitidos por la directiva. |
| El sitio es instalable | Manifiesto PWA con nombre, íconos propios y `start_url` configurados. |

### 2.2 Relación con la organización

> *"El sitio web de tu organización debe representar una relación clara entre tu organización
> sin fines de lucro registrada y el dominio enviado. Tu sitio web debe coincidir claramente
> con el nombre, el acrónimo reconocido o el desarrollo oficial de la marca."*

| Requisito | Cómo se cumple |
|---|---|
| El nombre legal completo aparece en el sitio | Se muestra en la portada, en `/nosotros`, en `/contacto` y en el pie de página de **todas** las páginas del sitio. |
| La sigla reconocida aparece en el sitio | "CGPA Graham Bell" en el encabezado y el título del documento. |
| El nombre del establecimiento es explícito | El nombre legal incluye "Liceo Alexander Graham Bell" y la misión lo menciona textualmente. |
| Relación dominio ↔ marca | El dominio `cgpagrahambell.cl` deriva de la sigla CGPA y del nombre del establecimiento. El footer declara "Sitio oficial: cgpagrahambell.cl" en todas las páginas. |
| Datos estructurados | El `<head>` de la portada incluye JSON-LD `@type: NGO` con `name`, `alternateName`, `identifier` (personalidad jurídica), `foundingDate`, `address` y `url`. |

### 2.3 Transparencia y contenido

> *"Tu sitio web oficial debe incluir los detalles de la organización que enviaste durante el
> registro. Asegúrate de que tu sitio muestre explícitamente detalles como tu ID de
> organización sin fines de lucro, una dirección física o una declaración de misión clara
> que describa tus programas o servicios."*

| Requisito | Dónde se satisface |
|---|---|
| ID de organización sin fines de lucro | N° de Personalidad Jurídica **242029**, publicado en `/nosotros` (ficha legal), `/contacto`, footer global y datos estructurados. |
| Dirección física | San Ramón N° 2055, Villarrica, Región de La Araucanía. Publicada en `/nosotros`, `/contacto`, footer global y datos estructurados `PostalAddress`. |
| Declaración de misión | `/` y `/nosotros` publican la misión, la visión y los objetivos permanentes. |
| Descripción de programas y servicios | `/nosotros` describe las 3 líneas de trabajo (infraestructura y equipamiento; material educativo y actividades; administración transparente de los recursos), y `/proyectos` publica los proyectos financiados con su ejecución presupuestaria. |
| Noticias y avisos institucionales | `/comunicados` publica los comunicados oficiales de la directiva. |
| Canal de contacto | `/contacto` con domicilio, horario de atención y formulario funcional. |

---

## 3. Verificación técnica (ejecutable)

```bash
# 1. El HTML servido contiene la identidad legal sin ejecutar JavaScript
curl -s https://cgpagrahambell.cl | grep -i "personalidad jurídica"
curl -s https://cgpagrahambell.cl/nosotros | grep -i "242029"
curl -s https://cgpagrahambell.cl/contacto | grep -i "San Ramón"

# 2. Archivos de rastreo
curl -s https://cgpagrahambell.cl/robots.txt
curl -s https://cgpagrahambell.cl/sitemap.xml

# 3. Certificado y redirección a HTTPS
curl -sI https://cgpagrahambell.cl | head -5
```

Comprobaciones adicionales:

1. Abrir `/`, `/nosotros` y `/contacto` con **JavaScript deshabilitado**: deben mostrar el nombre
   legal, la misión, el N° de personalidad jurídica, el estado y el domicilio.
2. Validar los datos estructurados con el *Rich Results Test* de Google sobre la portada.
3. Ejecutar Lighthouse (SEO y Best Practices) sobre `/` y `/nosotros`.
4. Verificar que el build genera las 6 páginas estáticas:
   `ls apps/client/dist/*.html` debe listar `index`, `nosotros`, `proyectos`, `transparencia`,
   `comunicados` y `contacto`.

---

## 4. Pendientes antes de enviar la solicitud

| Pendiente | Detalle | Dónde se cambia |
|---|---|---|
| Correo institucional | La directiva aún no define el correo público. Mientras tanto el sitio muestra "Pendiente de definir" y el formulario funciona como canal principal. | `ORGANIZATION.contact.email` en `apps/client/src/content/institutional.ts` |
| Teléfono institucional | Mismo caso que el correo. | `ORGANIZATION.contact.phone` en `apps/client/src/content/institutional.ts` |
| Revisión del texto institucional | La misión, la visión, los objetivos, los programas y la historia fueron redactados a partir de la descripción de la directiva y deben ser aprobados por ella antes de publicarse. | `apps/client/src/content/institutional.ts` |
| Dominio autorizado en Firebase Auth | Agregar `cgpagrahambell.cl` a Authentication → Settings → Dominios autorizados, para que el acceso de la directiva funcione desde el dominio nuevo. | Consola de Firebase |
| URL base de verificación | Actualizar el secreto `VERIFICATION_BASE_URL` a `https://cgpagrahambell.cl` para que los códigos QR de documentos apunten al dominio oficial. | GitHub Secrets + Cloud Run |
| Candidatura a Google for Nonprofits | La postulación se realiza con la cuenta institucional y el dominio `cgpagrahambell.cl`. Requiere acreditar la personalidad jurídica vigente ante el partner local de Google. | Google for Nonprofits |

---

## 5. Alcance no cubierto (por decisión de la directiva)

- Páginas de estatutos, preguntas frecuentes y documentos oficiales públicos.
- Publicación de los RUN de la directiva.
- Insignias de certificaciones de terceros (solo se declara el estado de organización funcional
  sin fines de lucro con su N° de personalidad jurídica).
