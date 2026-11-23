# Paso a Paso
Proyecto final de Procesamiento Digital de Imágenes, Universidad Autónoma de Occidente, 2026.
Autores: Juan José Mosquera Bermúdez y David Elías Castro Ochoa.

## Descripción
Paso a Paso es una página web para aprender tres pasos básicos de salsa desde la casa: 
básico lineal, cruzado y lateral. La persona escoge un paso y ve la explicación de una instructora.
Después se graba bailando al tiempo con un video de práctica de unos 15 segundos, o sube un video que ya tenga. 
Al final la página le dice qué tan parecido le salió, de 1 a 4 barras, con lo que hizo bien y lo que puede mejorar.

Para esto la página detecta los puntos del cuerpo con MediaPipe y gira el cuerpo en 3D para que el usuario y la instructora 
queden mirando hacia el mismo lado. Luego compara el movimiento con el de la instructora usando DTW y mide el ritmo con la transformada de Fourier. 
Todo se hace en el navegador de la persona y el video no se envía a ningún lado.

## Enlaces

- Página del prototipo: https://juanjomodez.github.io/PasoAPaso/
- Documento del proyecto: https://docs.google.com/document/d/1yR0-G6F64x3I439NeGZlby8E-eP-wG23/edit?usp=sharing&ouid=108141870538564797218&rtpof=true&sd=true
- Video demostrativo de 3 minutos: https://youtu.be/retMyHcTUpw?si=LvpoqYqvDJvm6lxd
- Videos de las pruebas de uso: https://drive.google.com/drive/folders/1yuG8oHrTeMI_k5Dp241DKX3u_rZKnUEM?usp=sharing
- Carpeta del Drive con el notebook y los datos: https://drive.google.com/drive/folders/1A7z0A_OIzO7Gn-6L8D_8E5ea7HdrTiS1?usp=sharing
- Notebook directo: https://drive.google.com/file/d/1-fQbAjc_AG6w9rrZAunJgxrhGWHZwmkP/view?usp=sharing

En este repositorio también hay dos carpetas: "video demostracion", donde está el video del proyecto, y "documento", 
donde está el documento escrito. Ahí se explica la problemática, la arquitectura, la metodología, la implementación, los datos, 
la interfaz, los resultados y las conclusiones.

## Cómo está construida la página
La página no necesita servidor ni base de datos, son archivos que abre el navegador.

El archivo index.html tiene todas las pantallas de la página, y css/estilos.css tiene los colores y la forma en que se acomoda en celular o computador. 
En la carpeta js hay tres archivos:
- app.js controla el flujo: cambia de pantalla, abre la cámara, hace la cuenta regresiva, graba y muestra el resultado.
- poses.js toma 15 cuadros por segundo del video, los prepara y les saca los 33 puntos del cuerpo con MediaPipe.
- analisis.js gira el cuerpo, compara con la instructora y arma el nivel y los consejos.

En la carpeta datos está referencias.json, que tiene los movimientos de la instructora, los límites de cada nivel y 
los textos de los consejos. Este archivo sale del notebook.

La carpeta videos tiene los videos de la instructora. La carpeta modelos tiene el modelo de MediaPipe y lib/mediapipe tiene la librería 
para que funcione sin internet. Las carpetas icons e img, junto con sw.js y manifest.webmanifest, sirven para el logo 
y para poder instalar la página como app en el celular. Los archivos Abrir-PasoAPaso.bat y Abrir-PasoAPaso.command 
abren la página en Windows o Mac sin instalar nada.

El funcionamiento es así. 
El usuario escoge el paso, ve la explicación y se graba o sube su video. 
Luego la página pasa por tres fases: detecta el cuerpo, lo compara con la instructora y prepara los consejos.
Al final muestra el resultado, con los dos videos lado a lado y el esqueleto dibujado encima del usuario.

El notebook PasoAPaso_Proyecto.ipynb es donde probamos el método con nuestros propios videos y sacamos las métricas. 
De ahí salió el archivo referencias.json que usa la página.

## Cómo ejecutarlo

La forma más fácil es abrir https://juanjomodez.github.io/PasoAPaso/ desde el computador o el celular.

Para correrla en el computador hay que descargar el repositorio y abrir la carpeta en Visual Studio Code. 
Después se instala la extensión Live Server, se da clic derecho sobre index.html y se escoge "Open with Live Server". 
Si no se tiene Visual Studio Code, se puede abrir Abrir-PasoAPaso.bat en Windows o Abrir-PasoAPaso.command en Mac, con Chrome o Edge instalado.

La página no funciona abriendo index.html con doble clic, porque el navegador bloquea la carga del modelo. Para grabarse hay que darle permiso a la cámara.

Para correr el notebook se sube la carpeta del Drive a "Mi unidad", se abre PasoAPaso_Proyecto.ipynb en Google Colab y se ejecutan todas las celdas.

## Resultados

MediaPipe detectó a la persona en casi todos los cuadros de nuestros videos, entre el 97,5 % y el 100 %. 
El sistema reconoce el paso correcto el 90 % de las veces, mientras que sin girar el cuerpo en 3D solo acertaba el 38,8 %. 
Además separa bien un paso bien hecho de uno equivocado, con un AUC de 0,945.

En las pruebas con la página, quedarse quieto y bailar otro paso dan el nivel más bajo, 
y subir el video de la instructora da el nivel máximo. También funciona aunque la instructora esté de espaldas y el usuario de frente.

## Limitaciones y mejoras

Una persona que baila bien pero a otro ritmo que la instructora saca una nota baja; 
en nuestras pruebas sacó 2 de 4. Esto pasa porque la página compara contra el tiempo exacto del video de referencia 
y no contra qué tan bien se baila. Como mejora, la idea es no depender de un solo video de la instructora: 
usar varias referencias o ajustar el ritmo antes de comparar. También queremos probar con más personas y que una profesora de baile revise los consejos.

## Créditos

Los videos de la instructora son de Lau Dance y se usan solo con fines académicos.
- Canal: https://youtube.com/@laudance?si=uZ4_GUY-_OYUL6Dh
- Video original: https://www.youtube.com/watch?v=2FsZl11VmIw
