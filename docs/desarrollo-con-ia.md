# Fallos silenciosos

**Dieciséis reglas para desarrollar software con agentes de IA.**

El principio que las une: en un proyecto con lógica de dominio, el modo de fallo
dominante no es la excepción — es el resultado equivocado que parece correcto.

Cada regla se justifica por el mecanismo que la hace cierta, no por la anécdota
que la originó. Destilado de un proyecto completo desarrollado con asistencia de
IA: seis ciclos de trabajo, un plan de saneamiento y una auditoría de seguridad
con pruebas de explotación.

---

## Por qué los fallos no avisan

Un agente escribe código sintácticamente correcto casi siempre. Los tests pasan,
el build compila, el lint queda limpio. Lo que falla es más sutil, y comparte una
forma reconocible:

- **Dos vistas del mismo dato divergen** — una recalcula en vivo, la otra lee lo
  persistido. Ambas cifras son plausibles.
- **Un dato se guarda mal y nadie lo lee** — la interfaz lo recalcula, así que se
  ve bien durante meses.
- **La documentación caduca** — era correcta el día que se escribió, y nada falla
  cuando deja de serlo.
- **Una garantía tiene un hueco** — se aplica en nueve sitios de diez, y el décimo
  no da error: obedece.

Ninguno lanza una excepción. Todos requieren que alguien compare a propósito
contra la realidad. Ese es el trabajo que las reglas siguientes convierten en
procedimiento.

> **Regla raíz.** Lo que no se comprueba contra la realidad, no está comprobado.
> Ni la documentación, ni los comentarios, ni la especificación, ni una deuda
> técnica escrita por ti mismo hace tres meses.

---

## Al arrancar el proyecto

### 1. Escribe reglas verificables, no buenas intenciones

Una instrucción sirve si quien la lee —persona o agente— puede saber si la está
cumpliendo. La diferencia no es de tono, es de comprobabilidad.

| Verificable | Decorativa |
| --- | --- |
| «Los importes se redondean a 2 decimales solo al presentar» | «Cuidar la precisión numérica» |
| «`lib/core/` no importa el framework ni el cliente de BD» | «Mantener la lógica desacoplada» |
| «Un registro cerrado es inmutable: nunca un UPDATE» | «Respetar la integridad de los datos» |

Marca como crítico solo lo que de verdad rompe algo. Si todo es importante, nada
lo es — y un archivo de instrucciones donde todo grita se lee como si nada
gritara.

### 2. Declara las trampas del stack, no solo sus versiones

Un modelo tiene fecha de corte y escribirá con total seguridad el código de la
versión que conoce. Si tu framework cambió de API, de convención de archivos o de
comandos, eso **no** lo va a deducir: lo va a contradecir con confianza.

Basta un archivo corto que diga «esta no es la versión que conoces» y **apunte a
la documentación instalada localmente** (`node_modules/<pkg>/docs`, el
`site-packages` correspondiente, etc.). Es la única fuente que corresponde con
certeza a la versión que hay en el proyecto — no la web, que mezcla versiones.

### 3. Define la unidad de trabajo, y que tenga cierre

Fase, épica, hito, *milestone*: el nombre da igual. Lo que importa es que tenga
**principio, criterios de aceptación y un cierre explícito**.

Sin cierre el trabajo se arrastra, y la documentación se desincroniza sin que nada
falle. El cierre es el único momento del ciclo en que alguien tiene motivo para
comparar lo escrito con lo construido.

> Y planifica **justo antes** de implementar, no todo por adelantado: lo que se
> aprende construyendo la primera unidad cambia las decisiones correctas de la
> segunda.

### 4. Aísla la lógica de dominio desde el primer día

Las reglas de negocio y los cálculos, en funciones puras: sin framework, sin
acceso a datos, sin estado global. Es lo que permite cubrirlas con tests rápidos y
fixtures verificados a mano, que son los que atrapan errores de convención que
ninguna documentación resuelve.

**El corolario que se descubre tarde:** el redondeo no pertenece al núcleo. Si
redondeas antes de comparar o clasificar, cambias el resultado — un valor de 1.996
se convierte en 2.00 y cruza un umbral que en realidad no cruzaba. El redondeo
pertenece a la persistencia y a la presentación, nunca al cálculo.

---

## Durante la implementación

### 5. Reproduce el fallo, arréglalo, reprodúcelo otra vez

El hábito de mayor rendimiento de todos, y el más fácil de saltarse cuando el
arreglo «se ve obviamente correcto». El ciclo completo son cuatro pasos:

1. Ejecuta el caso roto contra el código **sin arreglar** → debe fallar.
2. Aplica el arreglo.
3. Ejecuta **exactamente el mismo** caso → debe pasar.
4. Comprueba que el camino legítimo sigue funcionando.

Sin el paso 1 no sabes si el fallo existía, ni si tu reproducción lo toca
siquiera. Sin el paso 4 no sabes si el arreglo rompió el caso normal — y ese es el
que usan todos los días.

> **Un arreglo sin esa doble prueba es una hipótesis.** En un dominio de fallo
> silencioso, las hipótesis se ven exactamente igual que los arreglos.

**Variante útil — aislar la causa:** cuando aparezca un error nuevo justo después
de tu cambio, no supongas que es tuyo ni que no lo es. **Desactiva tu cambio y
vuelve a medir.** Si el error persiste, era preexistente y acabas de ahorrarte
horas persiguiendo un fantasma.

### 6. Verifica contra el almacenamiento, no contra la interfaz

La interfaz suele recalcular al vuelo. Puede mostrar el número correcto mientras lo
guardado es basura — y esa divergencia sobrevive meses, porque todo el mundo
verifica mirando la pantalla.

Cuando algo se persiste, la comprobación es una consulta a la base, no una captura
de pantalla.

> Corolario: **todo lo que se persiste debería tener al menos un consumidor que lo
> lea sin recalcular.** Si nadie lo lee tal cual, nadie se entera de que está mal.

### 7. Prueba el arranque en frío, no solo con datos de prueba

Los datos sembrados ya tienen todo lo que el flujo necesita: el contenedor creado,
las relaciones pobladas, los valores por defecto puestos. Un usuario que empieza de
cero no tiene nada de eso. Si *toda* la verificación corre sobre el seed, los
fallos del primer uso son invisibles hasta que los encuentra un usuario real.

Prueba siempre los dos caminos: con datos cargados, y desde cero.

### 8. Al corregir un generador de datos, busca a sus gemelos

Los generadores se copian entre sí: el seed de desarrollo, el de tests, el que crea
la cuenta de ejemplo en producción. Comparten forma, y por eso comparten defectos.

Cuando arregles uno, busca de inmediato a los demás. El que corre en producción
para cada usuario nuevo es el que más importa y el que menos se mira.

> **Un comentario que describe una garantía no es prueba de que la garantía
> exista.** Trátalos como afirmaciones de otro momento — exactamente igual que la
> documentación.

### 9. Si una regla aplica a N sitios, revísala en los N a la vez

Cuando cada sitio se implementa en un momento distinto, cada revisión ve solo su
parte. La excepción sobrevive porque nadie miró los N juntos — y suele ser justo el
caso de mayor alcance el que se quedó fuera.

Revisión **por eje** (una regla, todos sus sitios), no solo por tarea.

### 10. Importa lo que el sistema ya modela; no lo copies a mano

Los valores permitidos ya viven en algún sitio: una restricción de la base, un tipo
enumerado, un esquema de validación. Volver a escribirlos a mano en una
exportación, un informe o una etiqueta introduce divergencias que nada detecta.

Impórtalos desde la fuente. Si no se puede importar, es señal de que la fuente está
en el lugar equivocado.

### 11. Que el servidor recalcule; no confíes en lo que llega del cliente

El servidor reconstruye la entrada y vuelve a ejecutar la lógica antes de guardar:
una sola fuente de verdad para lo persistido.

Lo mismo con la autorización: revalida contra el almacén qué está cerrado,
publicado o aprobado. No contra los identificadores que llegan en la petición, que
son justamente lo que un atacante controla.

### 12. Pon la garantía en la capa que no se puede saltar

Si la regla vive solo en el código de aplicación, existe mientras todos pasen por
ahí. Cualquier acceso directo —una API pública, un cliente con clave legítima, un
script de mantenimiento— la ignora sin dar error.

**El patrón:** dos capas. La aplicación comprueba *y además* el almacén impone la
regla (restricción, trigger, política de acceso). La segunda es la que cuenta,
porque es la que no se puede rodear.

> Y cuando escribas una regla así, **enumera dónde debe aplicarse y compruébalo uno
> por uno.** Una garantía con un hueco es una garantía falsa — y el hueco siempre
> está donde nadie miró.

---

## Al cerrar cada unidad de trabajo

### 13. Un aprendizaje que no se vuelve procedimiento se olvida

Esta es la regla que hace que las demás sobrevivan, y la que más cuesta aplicar
porque parece administrativa.

Una lección guardada en un documento de «aprendizajes» se lee al *empezar* algo.
Pero muchas lecciones describen algo que hay que hacer al *terminar*. Guardada en
el sitio equivocado, se relee sin aplicarse — y el mismo fallo se repite con la
lección ya escrita, a veces más de una vez.

> **Si un aprendizaje describe algo que hay que hacer en un momento concreto del
> ciclo, su sitio es el checklist de ese momento**, no la sección de aprendizajes.

### 14. Revisa la documentación contra el código, entrada por entrada

No basta con recordar qué se tocó: hay que comprobarlo. **Nada falla cuando una
afirmación caduca** — no hay test que lo detecte, el lint no lo ve, el build pasa.
Solo lo encuentra alguien que compare a propósito.

Un checklist de cierre mínimo:

- [ ] Criterios de aceptación cumplidos y **verificados**, no solo implementados
- [ ] Comprobaciones automáticas en verde (tipos, lint, tests)
- [ ] Deuda técnica revisada entrada por entrada **contra el código**
- [ ] Cifras y estados barridos (conteos, versiones, listas de pendientes)
- [ ] Qué reglas quedaron **sin ejercer** todavía
- [ ] Aprendizajes anotados — y los accionables, movidos al checklist que toque

### 15. Anota qué reglas quedaron sin ejercer

Una regla escrita y nunca ejecutada no está verificada, por evidente que parezca.
Es habitual que una restricción se escriba mucho antes de que exista el flujo que
la ejercita.

Llevar la lista de lo que aún no se ha ejercido evita confundir *escrito* con
*funciona*.

### 16. Una deuda bien escrita puede estar mal diagnosticada

Las entradas de deuda técnica suelen registrar el **síntoma** correctamente y la
**causa** por hipótesis, en un momento en que nadie tenía tiempo de confirmarla.
Meses después se lee la hipótesis como hecho.

Verifica el código antes de actuar sobre lo que la deuda propone: puede que el
arreglo descrito no arregle nada.

---

## Cómo encargar el trabajo

La mitad del resultado se decide en el enunciado.

| Práctica | Por qué cambia el resultado |
| --- | --- |
| **Da la fuente de verdad y pide que se lea entera** | Apuntar al documento —«está en X, léelo antes de tocar nada»— produce mucho mejor trabajo que resumirlo de memoria en el propio encargo. |
| **Ordena el trabajo y marca qué decisiones son tuyas** | «Esto primero; si aquello no es trivial, propón y déjame elegir» evita que se aplique por cuenta propia justo lo que tiene riesgo de romper cosas. |
| **Define las reglas de compromiso** | Entorno local primero; producción solo lectura; no tocar datos sin pedirlo. Convierte una intervención destructiva en una reversible. |
| **Da números de referencia** | Conteos y valores esperados antes de empezar. Sin ellos, «lo dejé como estaba» es una afirmación sin prueba posible. |
| **Pide la evidencia, no la conclusión** | «El diff, la prueba de que antes fallaba y ahora no, y si el camino legítimo sigue intacto» hace imposible entregar una hipótesis disfrazada de arreglo. |
| **Autoriza explícitamente lo irreversible** | Migraciones, despliegues, borrados y envíos externos merecen una confirmación propia, aunque el resto del trabajo ya esté aprobado. |

---

## Tres huecos que conviene cerrar el primer día

**Tests de integración de la capa de persistencia.** Los tests de lógica pura son
fáciles y cubren bien el núcleo. Los fallos que más lejos llegan viven en la capa
intermedia —la que orquesta validación, escritura y permisos—, y ahí no hay
cobertura si no se montó al principio. Después no se monta: siempre hay algo más
urgente.

**Contenido duplicado a mano.** Cuando el mismo texto o la misma tabla vive en dos
sitios, la regla «al editar uno, editar el otro» funciona hasta que alguien la
olvida — y nada falla cuando eso pasa. Si algo debe existir en dos lugares, que uno
se genere del otro.

**Migraciones fuera del despliegue automático.** Si el código se despliega solo y
el esquema se migra a mano, existe una ventana en la que producción corre código
nuevo contra un esquema viejo. O se automatiza, o se documenta como paso
obligatorio del despliegue con su orden explícito.

---

## Resumen en una pantalla

| Momento | Regla |
| --- | --- |
| Arranque | Reglas verificables; trampas del stack declaradas |
| Arranque | Lógica de dominio aislada; el redondeo no vive en el núcleo |
| Arranque | Unidad de trabajo con cierre explícito; planificar justo antes |
| Durante | Reproducir → arreglar → reproducir → comprobar el camino legítimo |
| Durante | Verificar contra el almacenamiento, no contra la interfaz |
| Durante | Probar el arranque en frío, no solo con datos sembrados |
| Durante | La garantía va en la capa que no se puede saltar |
| Durante | Al corregir un generador, buscar sus gemelos |
| Cierre | Documentación contra código, entrada por entrada |
| Cierre | Los aprendizajes accionables van al checklist del momento |
| Cierre | Anotar qué reglas quedaron sin ejercer |

> Si solo cabe una regla: **reproduce el fallo antes de arreglarlo y después de
> arreglarlo.** Cuando los fallos son silenciosos y plausibles, es la única forma
> de distinguir un arreglo de una hipótesis.
