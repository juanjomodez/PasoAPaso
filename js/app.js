// Paso a Paso - logica de la pagina
// Maneja las pantallas, la camara, la grabacion y muestra la retroalimentacion.

import { analizar, mejorPedazo } from "./analisis.js";
import { cargarDetector, posesDeArchivo, recortar, FPS } from "./poses.js";

const NIVEL_NUM = { muy_parecido: 4, parecido: 3, algo_parecido: 2, lejos: 1 };
const CONEXIONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
                    [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32]];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let REF = null;              // datos/referencias.json
let pasoActual = null;
let flujo = null;            // "grabar" o "subir"
let streamCamara = null;
let grabador = null;
let trozos = [];
let urlUsuario = null;       // video del usuario para verlo en el resultado
let ultimoResultado = null;

// ---------------------------------------------------------------- arranque
fetch("datos/referencias.json")
  .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
  .then((d) => { REF = d; })
  .catch(() => aviso("No se encontró datos/referencias.json. Abre la página con Live Server desde la carpeta del proyecto.", 9000));

// ---------------------------------------------------------------- pantallas
function ir(id) {
  $$(".pantalla").forEach((p) => p.classList.remove("activa"));
  $("#" + id).classList.add("activa");
  $$("video").forEach((v) => { if (!v.closest("#" + id) && v.id !== "video-camara") v.pause(); });
  if (id !== "p-grabar") apagarCamara();
}

function aviso(texto, ms = 4500) {
  const t = $("#toast");
  t.textContent = texto;
  t.classList.add("on");
  clearTimeout(aviso.temp);
  aviso.temp = setTimeout(() => t.classList.remove("on"), ms);
}

$$("[data-ir]").forEach((b) => b.addEventListener("click", () => ir(b.dataset.ir)));

// ---------------------------------------------------------------- inicio
const abrirComo = () => $("#modal-como").classList.add("activa");
$("#btn-como").addEventListener("click", abrirComo);
$("#btn-entendido").addEventListener("click", () => {
  $("#modal-como").classList.remove("activa");
  try { localStorage.setItem("pasoapaso_visto", "1"); } catch (e) { /* sin localStorage */ }
});
try { if (!localStorage.getItem("pasoapaso_visto")) abrirComo(); } catch (e) { abrirComo(); }

$$(".tarjeta").forEach((t) => t.addEventListener("click", () => escogerPaso(t.dataset.paso)));

function escogerPaso(paso) {
  if (!REF) { aviso("Todavía no se cargan los datos de la instructora, revisa que estés usando Live Server."); return; }
  pasoActual = paso;
  const info = REF.pasos[paso];
  $$(".nombre-paso").forEach((s) => (s.textContent = info.nombre));
  const charla = $("#video-charla");
  charla.src = "videos/" + info.video_charla;
  $("#video-practica-grabar").src = "videos/" + info.video_practica;
  $("#video-practica-subir").src = "videos/" + info.video_practica;
  $("#video-instr").src = "videos/" + info.video_practica;
  $("#btn-descargar").href = "videos/" + info.video_practica;
  $("#btn-descargar").setAttribute("download", info.video_practica);
  ir("p-tutorial");
  charla.play().catch(() => {});
  // mientras ve la explicacion se va cargando MediaPipe
  cargarDetector().catch((e) => console.error(e));
}

// ---------------------------------------------------------------- explicacion
$("#btn-repetir-charla").addEventListener("click", () => {
  const v = $("#video-charla");
  v.currentTime = 0;
  v.play().catch(() => {});
});
$("#btn-listo").addEventListener("click", () => ir("p-modo"));

// ---------------------------------------------------------------- escoger modo
$("#btn-modo-subir").addEventListener("click", () => { flujo = "subir"; ir("p-subir"); });
$("#btn-modo-grabar").addEventListener("click", () => { flujo = "grabar"; abrirGrabar(); });

// ---------------------------------------------------------------- grabar
async function abrirGrabar() {
  ir("p-grabar");
  const practica = $("#video-practica-grabar");
  practica.currentTime = 0;
  const btn = $("#btn-empezar");
  btn.style.display = "";
  btn.disabled = true;
  $("#ayuda-grabar").textContent = "Abriendo la cámara...";
  try {
    streamCamara = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    $("#video-camara").srcObject = streamCamara;
  } catch (e) {
    aviso("No se pudo abrir la cámara. Revisa los permisos del navegador o usa la opción de subir video.");
    $("#ayuda-grabar").textContent = "Sin cámara no se puede grabar.";
    return;
  }
  $("#ayuda-grabar").textContent = "Preparando el detector...";
  try {
    await cargarDetector();
  } catch (e) {
    aviso("No se pudo cargar MediaPipe. Revisa que la carpeta lib esté completa.");
    return;
  }
  if (!streamCamara) return;
  btn.disabled = false;
  $("#ayuda-grabar").textContent = "Acomódate para que la cámara te vea completo y dale a empezar.";
}

function apagarCamara() {
  if (grabador && grabador.state !== "inactive") { grabador.onstop = null; grabador.stop(); }
  if (streamCamara) { streamCamara.getTracks().forEach((t) => t.stop()); streamCamara = null; }
  $("#punto-rec").classList.remove("on");
  $("#cuenta").classList.remove("on");
  $("#video-practica-grabar").onended = null;
}

$("#btn-salir-grabar").addEventListener("click", () => ir("p-modo"));

$("#btn-empezar").addEventListener("click", async () => {
  if (!streamCamara) return;
  $("#btn-empezar").style.display = "none";
  $("#ayuda-grabar").textContent = "¡Prepárate!";
  await cuentaRegresiva(5);
  if (!streamCamara) return; // se salio durante la cuenta
  empezarGrabacion();
});

function cuentaRegresiva(segundos) {
  return new Promise((listo) => {
    const c = $("#cuenta");
    c.classList.add("on");
    let n = segundos;
    const tic = () => {
      if (!streamCamara) { c.classList.remove("on"); listo(); return; }
      if (n === 0) { c.classList.remove("on"); listo(); return; }
      c.innerHTML = "<span>" + n + "</span>";
      n -= 1;
      setTimeout(tic, 1000);
    };
    tic();
  });
}

function tipoGrabacion() {
  const opciones = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return opciones.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

function empezarGrabacion() {
  const practica = $("#video-practica-grabar");
  trozos = [];
  const tipo = tipoGrabacion();
  grabador = new MediaRecorder(streamCamara, tipo ? { mimeType: tipo } : undefined);
  grabador.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
  grabador.onstop = () => {
    const blob = new Blob(trozos, { type: grabador.mimeType || "video/webm" });
    procesar(blob);
  };
  // el video de la instructora y la grabacion arrancan al mismo tiempo
  practica.currentTime = 0;
  grabador.start(250);
  practica.play().catch(() => {});
  $("#punto-rec").classList.add("on");
  $("#ayuda-grabar").textContent = "Grabando... sigue a la instructora";
  practica.onended = () => {
    practica.onended = null;
    $("#punto-rec").classList.remove("on");
    if (grabador && grabador.state !== "inactive") grabador.stop();
  };
}

// ---------------------------------------------------------------- subir
const zona = $("#soltar");
$("#archivo").addEventListener("change", (e) => { if (e.target.files[0]) subir(e.target.files[0]); });
["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("encima"); }));
["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("encima"); }));
zona.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) subir(e.dataTransfer.files[0]); });

function subir(archivo) {
  $("#archivo").value = "";
  if (!archivo.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(archivo.name)) {
    aviso("Ese archivo no parece un video.");
    return;
  }
  procesar(archivo);
}

// ---------------------------------------------------------------- analizar
function fase(i) {
  [...$$("#fases li")].forEach((li, k) => { li.className = k < i ? "hecho" : k === i ? "actual" : ""; });
}
const pausa = () => new Promise((r) => setTimeout(r, 60));

async function procesar(blob) {
  apagarCamara();
  ir("p-analizando");
  fase(0);
  $("#barra-progreso").style.width = "0%";
  if (urlUsuario) URL.revokeObjectURL(urlUsuario);
  urlUsuario = URL.createObjectURL(blob);
  try {
    let poses = await posesDeArchivo(urlUsuario, { progreso: (p) => { $("#barra-progreso").style.width = Math.round(p * 100) + "%"; } });
    if (poses.recortado) aviso("El video es largo, solo se revisó el primer minuto.");
    $("#barra-progreso").style.width = "100%";
    fase(1);
    await pausa();
    // si el video es mas largo que la practica se toma el pedazo que mas se parece
    const nRef = REF.pasos[pasoActual].senales.length;
    const desde = mejorPedazo(poses, pasoActual, REF);
    if (poses.mundo.length > nRef) poses = recortar(poses, desde, desde + nRef);
    const inicio = desde / FPS;
    fase(2);
    await pausa();
    const res = analizar(poses, pasoActual, REF);
    fase(3);
    ultimoResultado = { res, poses, inicio };
    mostrarResultado(res);
  } catch (e) {
    console.error(e);
    aviso("Algo salió mal analizando el video: " + e.message);
    ir(flujo === "subir" ? "p-subir" : "p-modo");
  }
}

// ---------------------------------------------------------------- resultado
function llenarLista(sel, items) {
  const ul = $(sel);
  ul.innerHTML = "";
  items.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
}

function mostrarResultado(res) {
  $("#res-titulo").textContent = res.titulo;
  $("#res-resumen").textContent = res.resumen;
  $("#nivel").dataset.n = NIVEL_NUM[res.nivel] || 0;
  llenarLista("#res-bien", res.bien);
  llenarLista("#res-mejorar", res.mejorar);
  const av = $("#res-avisos");
  av.innerHTML = "";
  res.avisos.forEach((t) => {
    const p = document.createElement("p");
    p.textContent = t;
    av.appendChild(p);
  });
  const vu = $("#video-usuario");
  vu.src = urlUsuario;
  vu.addEventListener("loadeddata", () => { vu.currentTime = ultimoResultado.inicio; }, { once: true });
  $("#video-instr").currentTime = 0;
  limpiarEsqueleto();
  ir("p-resultado");
}

// los dos videos al tiempo, con el esqueleto que detecto MediaPipe encima del usuario
let animacion = null;
$("#btn-comparar").addEventListener("click", () => {
  const vu = $("#video-usuario"), vi = $("#video-instr");
  vu.currentTime = ultimoResultado.inicio;
  vi.currentTime = 0;
  vu.play().catch(() => {});
  vi.play().catch(() => {});
  cancelAnimationFrame(animacion);
  const dibujar = () => {
    dibujarEsqueleto(vu);
    if (!vu.paused && !vu.ended && vu.currentTime < ultimoResultado.inicio + 16) animacion = requestAnimationFrame(dibujar);
    else { vu.pause(); vi.pause(); }
  };
  animacion = requestAnimationFrame(dibujar);
});

function limpiarEsqueleto() {
  const c = $("#esqueleto");
  c.getContext("2d").clearRect(0, 0, c.width, c.height);
}

function dibujarEsqueleto(video) {
  const c = $("#esqueleto");
  // el canvas ocupa lo mismo que se ve del video
  const caja = video.getBoundingClientRect();
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return;
  const esc = Math.min(caja.width / vw, caja.height / vh);
  const w = vw * esc, h = vh * esc;
  c.width = caja.width; c.height = caja.height;
  const ox = (caja.width - w) / 2, oy = (caja.height - h) / 2;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  const k = Math.round((video.currentTime - ultimoResultado.inicio) * FPS);
  const p = ultimoResultado.poses.puntos[k];
  if (!p || Number.isNaN(p[0][0])) return;
  const P = p.map(([x, y]) => [ox + x * w, oy + y * w]);
  ctx.lineWidth = 4; ctx.lineCap = "round";
  CONEXIONES.forEach(([a, b], i) => {
    ctx.strokeStyle = i < 5 ? "#ffc72c" : "#ff4d5a";
    ctx.beginPath(); ctx.moveTo(...P[a]); ctx.lineTo(...P[b]); ctx.stroke();
  });
  ctx.fillStyle = "#fff5e6";
  new Set(CONEXIONES.flat()).forEach((i) => { ctx.beginPath(); ctx.arc(P[i][0], P[i][1], 3.5, 0, 7); ctx.fill(); });
}

$("#btn-repetir").addEventListener("click", () => {
  if (flujo === "grabar") abrirGrabar();
  else ir("p-subir");
});
$("#btn-terminar").addEventListener("click", () => ir("p-inicio"));
