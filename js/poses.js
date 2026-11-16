// Paso a Paso - deteccion de la pose con MediaPipe en el navegador
// Usa la version de JavaScript de MediaPipe (carpeta lib/mediapipe) y el mismo modelo del notebook.

import { FilesetResolver, PoseLandmarker } from "../lib/mediapipe/vision_bundle.mjs";

export const FPS = 15;          // igual que en el notebook
const ANCHO_MAX = 640;

let detector = null;
let cargando = null;
let ultimoTiempo = 0;           // MediaPipe pide que el tiempo de cada cuadro siempre vaya aumentando

export function cargarDetector() {
  if (detector) return Promise.resolve(detector);
  if (cargando) return cargando;
  cargando = (async () => {
    const archivos = await FilesetResolver.forVisionTasks(new URL("lib/mediapipe/wasm", location.href).href);
    const opciones = (delegate) => ({
      baseOptions: { modelAssetPath: new URL("modelos/pose_landmarker_full.task", location.href).href, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    // se usa la CPU porque da el mismo resultado en cualquier computador (en algunos la GPU es mas lenta)
    try {
      detector = await PoseLandmarker.createFromOptions(archivos, opciones("CPU"));
    } catch (e) {
      console.warn("No se pudo usar la CPU, se intenta con la GPU", e);
      detector = await PoseLandmarker.createFromOptions(archivos, opciones("GPU"));
    }
    return detector;
  })();
  cargando.catch(() => { cargando = null; });
  return cargando;
}

// ---------------------------------------------------------------- preprocesamiento
// se reduce a 640 px de ancho y si la imagen esta oscura se le sube el brillo y el contraste
const lienzo = document.createElement("canvas");
const ctx = lienzo.getContext("2d", { willReadFrequently: true });
const mini = document.createElement("canvas");
mini.width = 64; mini.height = 36;
const ctxMini = mini.getContext("2d", { willReadFrequently: true });

function brillo(fuente) {
  ctxMini.drawImage(fuente, 0, 0, 64, 36);
  const d = ctxMini.getImageData(0, 0, 64, 36).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return s / (d.length / 4);
}

function preprocesar(video) {
  const w0 = video.videoWidth, h0 = video.videoHeight;
  const w = Math.min(w0, ANCHO_MAX), h = Math.round(h0 * w / w0);
  if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
  ctx.filter = brillo(video) < 110 ? "brightness(1.25) contrast(1.15)" : "none";
  ctx.drawImage(video, 0, 0, w, h);
  return { imagen: lienzo, w0, h0 };
}

// ---------------------------------------------------------------- un cuadro
function vacio() {
  return { p: Array.from({ length: 33 }, () => [NaN, NaN, NaN, NaN]), m: Array.from({ length: 33 }, () => [NaN, NaN, NaN]), ok: false };
}

export function detectarCuadro(video) {
  const { imagen, w0, h0 } = preprocesar(video);
  ultimoTiempo += 1000 / FPS;
  const res = detector.detectForVideo(imagen, ultimoTiempo);
  const c = vacio();
  if (res.landmarks && res.landmarks.length) {
    c.p = res.landmarks[0].map((l) => [l.x, l.y * h0 / w0, l.z, l.visibility ?? 1]);
    c.m = res.worldLandmarks[0].map((l) => [l.x, l.y, l.z]);
    c.ok = true;
  }
  return c;
}

function juntar(cuadros) {
  return {
    puntos: cuadros.map((c) => c.p),
    mundo: cuadros.map((c) => c.m),
    detectado: cuadros.map((c) => c.ok),
  };
}

// ---------------------------------------------------------------- video subido
const esperar = (el, evento) => new Promise((ok) => el.addEventListener(evento, ok, { once: true }));

export async function posesDeArchivo(url, { maxSegundos = 60, progreso = () => {} } = {}) {
  await cargarDetector();
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  await esperar(v, "loadeddata");
  if (!Number.isFinite(v.duration)) {      // algunos webm no traen la duracion
    v.currentTime = 1e6;
    await esperar(v, "seeked");
    v.currentTime = 0;
    await esperar(v, "seeked");
  }
  const duracion = Math.min(v.duration, maxSegundos);
  const total = Math.floor(duracion * FPS);
  const cuadros = [];
  for (let k = 0; k < total; k++) {
    v.currentTime = k / FPS;
    await esperar(v, "seeked");
    cuadros.push(detectarCuadro(v));
    if (k % 5 === 0) progreso(k / total);
  }
  v.removeAttribute("src"); v.load();
  return { ...juntar(cuadros), recortado: v.duration > maxSegundos };
}

export function recortar(poses, a, b) {
  return { puntos: poses.puntos.slice(a, b), mundo: poses.mundo.slice(a, b), detectado: poses.detectado.slice(a, b) };
}
