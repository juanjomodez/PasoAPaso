// Paso a Paso - analisis del baile
// Es el mismo procedimiento del notebook pero en JavaScript: senales con el cuerpo girado,
// comparacion con DTW contra la instructora y reglas para los consejos.
// Los datos de la instructora y los umbrales vienen de datos/referencias.json (los genera el notebook).

const CADERA_I = 23, CADERA_D = 24, RODILLA_I = 25, RODILLA_D = 26, TOBILLO_I = 27, TOBILLO_D = 28;
const HOMBRO_I = 11, HOMBRO_D = 12, CODO_I = 13, CODO_D = 14, MUNECA_I = 15, MUNECA_D = 16;

// limites de los consejos (los mismos del notebook)
const LIMITES = {
  basico_adelante: [0.55, 1.8],
  lateral_lado: [0.4, 1.8],
  cruzado_giro: [0.35, 2.0],
  cruzado_lado_min: 0.35,
  rodillas: [0.5, 0.8],
  brazos_min: 0.4,
  ritmo: [0.75, 1.35],
  desfase: 0.08,
  otro_paso: 0.9, // se avisa si otra referencia queda a menos del 90 % de la distancia
};

// ---------------------------------------------------------------- utilidades
const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const desv = (a) => { const m = media(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const mediana = (a) => {
  const b = [...a].sort((x, y) => x - y), n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
};
const columna = (F, j) => F.map((f) => f[j]);

// X es una lista de filas (una por cuadro), cada fila es una lista de numeros
function rellenarHuecos(X) {
  const T = X.length, D = X[0].length;
  const Y = X.map((f) => [...f]);
  for (let j = 0; j < D; j++) {
    const ok = [];
    for (let t = 0; t < T; t++) if (!Number.isNaN(Y[t][j])) ok.push(t);
    if (ok.length === 0) { for (let t = 0; t < T; t++) Y[t][j] = 0; continue; }
    if (ok.length === T) continue;
    for (let t = 0; t < T; t++) {
      if (!Number.isNaN(Y[t][j])) continue;
      if (t < ok[0]) Y[t][j] = Y[ok[0]][j];
      else if (t > ok[ok.length - 1]) Y[t][j] = Y[ok[ok.length - 1]][j];
      else {
        let k = 0;
        while (ok[k + 1] < t) k++;
        const a = ok[k], b = ok[k + 1];
        Y[t][j] = Y[a][j] + (Y[b][j] - Y[a][j]) * (t - a) / (b - a);
      }
    }
  }
  return Y;
}

// promedio movil en el tiempo (filtro pasa bajas)
function suavizar(X, ventana = 5) {
  const T = X.length;
  if (T < ventana) return X;
  const D = X[0].length, pad = Math.floor(ventana / 2);
  const Y = Array.from({ length: T }, () => new Array(D).fill(0));
  for (let t = 0; t < T; t++) {
    for (let k = -pad; k <= pad; k++) {
      const i = Math.min(T - 1, Math.max(0, t + k));
      for (let j = 0; j < D; j++) Y[t][j] += X[i][j] / ventana;
    }
  }
  return Y;
}

function desenrollar(p) {
  const out = [p[0]];
  let corr = 0;
  for (let i = 1; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    let dm = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    if (dm === -Math.PI && d > 0) dm = Math.PI;
    if (Math.abs(d) >= Math.PI) corr += dm - d;
    out.push(p[i] + corr);
  }
  return out;
}

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norma = (v) => Math.hypot(v[0], v[1], v[2]);
function angulo(a, b, c) {
  const v1 = resta(a, b), v2 = resta(c, b);
  const cos = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (norma(v1) * norma(v2) + 1e-8);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

// ---------------------------------------------------------------- senales
// mundo: lista de cuadros, cada cuadro con 33 puntos [x, y, z] en metros (NaN si no se detecto)
export function calcularSenales(mundo) {
  const T = mundo.length;
  let plano = mundo.map((c) => c.flat());
  plano = suavizar(rellenarHuecos(plano), 5);
  // centrar en la cadera
  const W = plano.map((f) => {
    const p = [];
    for (let k = 0; k < 33; k++) p.push([f[3 * k], f[3 * k + 1], f[3 * k + 2]]);
    const c = [(p[CADERA_I][0] + p[CADERA_D][0]) / 2, (p[CADERA_I][1] + p[CADERA_D][1]) / 2, (p[CADERA_I][2] + p[CADERA_D][2]) / 2];
    return p.map((q) => resta(q, c));
  });
  const orient = (a, b) => desenrollar(W.map((p) => Math.atan2(p[a][2] - p[b][2], p[a][0] - p[b][0])));
  const angC = orient(CADERA_I, CADERA_D);
  let angH = orient(HOMBRO_I, HOMBRO_D);
  const vueltas = Math.round(media(angH.map((h, i) => h - angC[i])) / (2 * Math.PI));
  angH = angH.map((h) => h - 2 * Math.PI * vueltas);
  // giro con la orientacion promedio de unos 3 s
  const v = T > 2 ? Math.min(45, Math.floor(T / 2) * 2 - 1) : 1;
  const base = suavizar(angC.map((a) => [a]), v).map((f) => f[0]);
  for (let t = 0; t < T; t++) {
    const c = Math.cos(-base[t]), s = Math.sin(-base[t]);
    for (const q of W[t]) {
      const x = q[0], z = q[2];
      q[0] = c * x - s * z;
      q[2] = s * x + c * z;
    }
  }
  const pierna = W.map((p) => (norma(resta(p[CADERA_I], p[RODILLA_I])) + norma(resta(p[RODILLA_I], p[TOBILLO_I])) +
    norma(resta(p[CADERA_D], p[RODILLA_D])) + norma(resta(p[RODILLA_D], p[TOBILLO_D]))) / 2);
  const esc = mediana(pierna) + 1e-6;
  return W.map((p0, t) => {
    const p = p0.map((q) => q.map((x) => x / esc));
    const pi = p[TOBILLO_I], pd = p[TOBILLO_D];
    const medio = [(pi[0] + pd[0]) / 2, (pi[1] + pd[1]) / 2, (pi[2] + pd[2]) / 2];
    return [
      pi[0], pi[2], pi[1], pd[0], pd[2], pd[1],
      angulo(p[CADERA_I], p[RODILLA_I], p[TOBILLO_I]), angulo(p[CADERA_D], p[RODILLA_D], p[TOBILLO_D]),
      angulo(p[HOMBRO_I], p[CODO_I], p[MUNECA_I]), angulo(p[HOMBRO_D], p[CODO_D], p[MUNECA_D]),
      p[MUNECA_I][1], p[MUNECA_D][1], -medio[0], -medio[2], angC[t] - base[t], angH[t] - base[t],
    ];
  });
}

// ---------------------------------------------------------------- simetrias
function hacerSimetrias(ref) {
  const { pares, eje_x, eje_z, giro } = ref.simetrias;
  const cambiar = (F) => F.map((f) => { const g = [...f]; for (const [a, b] of pares) { g[a] = f[b]; g[b] = f[a]; } return g; });
  const negar = (F, idx) => F.map((f) => { const g = [...f]; for (const i of idx) g[i] = -g[i]; return g; });
  return [
    ["igual", (F) => F],
    ["espejo", (F) => negar(cambiar(F), [...eje_x, ...giro])],
    ["lados_cambiados", (F) => negar(cambiar(F), [...eje_x, ...eje_z])],
    ["espejo_y_cambiados", (F) => negar(F, [...eje_z, ...giro])],
  ];
}

// ---------------------------------------------------------------- dtw
function estandarizar(F, ref) {
  const D = F[0].length;
  const m = [], s = [];
  for (let j = 0; j < D; j++) {
    const col = columna(F, j);
    m.push(media(col));
    s.push(Math.max(desv(col), ref.piso * ref.escala[j]));
  }
  return F.map((f) => f.map((x, j) => (x - m[j]) / s[j]));
}

function dtw(A, B, banda) {
  const n = A.length, m = B.length;
  const dist = (i, j) => { let s = 0; for (let k = 0; k < A[i].length; k++) s += (A[i][k] - B[j][k]) ** 2; return Math.sqrt(s); };
  const w = Math.max(Math.floor(banda * Math.max(n, m)), Math.abs(n - m) + 1);
  const C = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  C[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    const c = Math.round(i * m / n);
    for (let j = Math.max(1, c - w); j <= Math.min(m, c + w); j++) {
      C[i][j] = dist(i - 1, j - 1) + Math.min(C[i - 1][j], C[i][j - 1], C[i - 1][j - 1]);
    }
  }
  // camino de atras hacia adelante
  let i = n, j = m;
  const camino = [[i - 1, j - 1]];
  while (i > 1 || j > 1) {
    const op = [];
    if (i > 1 && j > 1) op.push([C[i - 1][j - 1], i - 1, j - 1]);
    if (i > 1) op.push([C[i - 1][j], i - 1, j]);
    if (j > 1) op.push([C[i][j - 1], i, j - 1]);
    op.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    [, i, j] = op[0];
    camino.push([i - 1, j - 1]);
  }
  camino.reverse();
  return [C[n][m] / camino.length, camino];
}

function distancia(Fu, Fr, ref, cada) {
  cada = cada || ref.cada;
  const sub = (F) => F.filter((_, i) => i % cada === 0);
  const U = sub(estandarizar(Fu, ref)), R = sub(estandarizar(Fr, ref));
  const forma = (F) => F.map((f) => ref.forma.map((k) => f[k]));
  let mejor = [Infinity, null, null];
  for (const [nombre, fn] of hacerSimetrias(ref)) {
    const [d, cam] = dtw(forma(fn(U)), forma(R), ref.banda_dtw);
    if (d < mejor[0]) mejor = [d, nombre, cam];
  }
  return mejor;
}

// ---------------------------------------------------------------- ritmo con la fft
export function ritmo(F, fps) {
  const n = F.length;
  if (n < 16) return 0;
  const cols = [0, 1, 3, 4];
  const m = cols.map((j) => media(columna(F, j)));
  const X = F.map((f) => cols.map((j, k) => f[j] - m[k]));
  // direccion en la que mas se mueven los pies (vector propio principal de X'X)
  const C = [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((b) => X.reduce((s, x) => s + x[a] * x[b], 0)));
  let v = [1, 1, 1, 1];
  for (let it = 0; it < 200; it++) {
    const w = C.map((fila) => fila.reduce((s, c, k) => s + c * v[k], 0));
    const nw = Math.hypot(...w) || 1;
    v = w.map((x) => x / nw);
  }
  const senal = X.map((x, t) => x.reduce((s, c, k) => s + c * v[k], 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / (n - 1))));
  let mejorF = 0, mejorE = -1;
  for (let k = 0; k <= Math.floor(n / 2); k++) {
    const f = k * fps / n;
    if (f <= 0.2 || f >= 3.0) continue;
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) { re += senal[t] * Math.cos(2 * Math.PI * k * t / n); im -= senal[t] * Math.sin(2 * Math.PI * k * t / n); }
    const e = Math.hypot(re, im);
    if (e > mejorE) { mejorE = e; mejorF = f; }
  }
  return mejorF;
}

function amplitudes(F) {
  const s = F[0].map((_, j) => desv(columna(F, j)));
  return { pies_lado: Math.max(s[0], s[3]), pies_adelante: Math.max(s[1], s[4]), rodillas: Math.max(s[6], s[7]),
           brazos: Math.max(s[8], s[9], s[10], s[11]), giro: s[14] };
}

function nivelDe(d, ref) {
  for (const k of ["muy_parecido", "parecido", "algo_parecido"]) if (d <= ref.umbrales[k]) return k;
  return "lejos";
}

// ---------------------------------------------------------------- escoger el pedazo de 15 s
// si el video es mas largo que la practica se busca el pedazo que mas se parece a la instructora
export function mejorPedazo(poses, paso, ref) {
  const nRef = ref.pasos[paso].senales.length;
  const T = poses.mundo.length;
  if (T <= nRef + 3 * ref.fps) return 0;
  const F = calcularSenales(poses.mundo);
  let mejor = 0, dMin = Infinity;
  for (let i = 0; i + nRef <= T; i += ref.fps) {
    const d = distancia(F.slice(i, i + nRef), ref.pasos[paso].senales, ref, 3)[0];
    if (d < dMin) { dMin = d; mejor = i; }
  }
  return mejor;
}

// ---------------------------------------------------------------- retroalimentacion
// poses: { puntos: [T][33][4] (x, y, z, visibilidad), mundo: [T][33][3], detectado: [T] }
export function analizar(poses, paso, ref) {
  const T = poses.mundo.length;
  const det = T ? poses.detectado.filter(Boolean).length / T : 0;
  if (T < 30 || det < 0.3) {
    return { nivel: null, titulo: "No te pudimos ver bien", bien: [], mejorar: [], avisos: [],
             resumen: "Intenta grabarte con más luz, un poco más lejos de la cámara y que se te vea de la cabeza a los pies." };
  }
  const avisos = [];
  if (det < 0.7) avisos.push("En algunas partes del video no se te detectó, puede que te hayas salido del cuadro.");
  const visPies = [];
  poses.puntos.forEach((p) => { for (let k = 27; k < 33; k++) if (!Number.isNaN(p[k][3])) visPies.push(p[k][3]); });
  if (visPies.length && media(visPies) < 0.5) avisos.push("Los pies casi no se ven en el video. Aléjate un poco de la cámara para que se vean completos.");

  const nombre = (k) => ref.pasos[k].nombre;
  const F = calcularSenales(poses.mundo);
  const R = ref.pasos[paso].senales;
  const [d, sim, cam] = distancia(F, R, ref);
  let nivel = nivelDe(d, ref);
  const au = amplitudes(F), ar = ref.pasos[paso].amplitudes;
  const prop = {};
  for (const k in au) prop[k] = ar[k] > 1e-6 ? au[k] / ar[k] : 1;
  const bien = [], mejorar = [];

  // otro paso: si otra referencia se parece bastante mas que la que escogio
  let otro = null, dOtro = Infinity;
  for (const k of Object.keys(ref.pasos)) {
    if (k === paso) continue;
    const dk = distancia(F, ref.pasos[k].senales, ref)[0];
    if (dk < dOtro) { dOtro = dk; otro = k; }
  }
  const otroPaso = dOtro < d * LIMITES.otro_paso;
  if (otroPaso) {
    mejorar.push("Por momentos el movimiento se parece más al paso " + nombre(otro) + " que al " + nombre(paso) +
                 ". Revisa otra vez la explicación, sobre todo hacia dónde va cada pie.");
    if (nivel === "muy_parecido" || nivel === "parecido") nivel = "algo_parecido";
  } else if (nivel === "muy_parecido" || nivel === "parecido") {
    bien.push("El patrón de los pies corresponde al paso " + nombre(paso) + ".");
  }

  // movimiento principal de cada paso
  if (paso === "basico") {
    const [a, b] = LIMITES.basico_adelante;
    if (prop.pies_adelante < a) mejorar.push("Los pasos hacia adelante y hacia atrás te quedaron cortos, marca más el paso.");
    else if (prop.pies_adelante > b) mejorar.push("Los pasos hacia adelante y hacia atrás son muy largos, en salsa el paso es corto.");
    else if (!otroPaso) bien.push("Buen tamaño en los pasos hacia adelante y hacia atrás.");
  } else if (paso === "lateral") {
    const [a, b] = LIMITES.lateral_lado;
    if (prop.pies_lado < a) mejorar.push("Abre un poco más los pies hacia los lados, el paso lateral casi no se nota.");
    else if (prop.pies_lado > b) mejorar.push("Los pasos hacia los lados son muy abiertos, intenta que sean más cortos.");
    else if (!otroPaso) bien.push("Los pasos hacia los lados tienen un buen tamaño.");
  } else {
    const [a, b] = LIMITES.cruzado_giro;
    if (prop.giro < a) mejorar.push("Gira un poco más la cadera cuando cruzas el pie.");
    else if (prop.giro > b) mejorar.push("Estás girando mucho el cuerpo, en el cruzado el giro es corto.");
    else if (!otroPaso) bien.push("La cadera acompaña bien el cruce del pie.");
    if (prop.pies_lado < LIMITES.cruzado_lado_min) mejorar.push("Cruza más el pie por delante del otro, ahora mismo el cruce casi no se ve.");
  }

  // rodillas y brazos
  if (prop.rodillas < LIMITES.rodillas[0]) mejorar.push("Suelta un poco más las rodillas, si se quedan rígidas el paso se ve tieso.");
  else if (prop.rodillas >= LIMITES.rodillas[1]) bien.push("Las rodillas se ven sueltas, eso ayuda a que el paso fluya.");
  if (prop.brazos < LIMITES.brazos_min) mejorar.push("Deja que los brazos acompañen el movimiento.");

  // tiempo: ritmo con la fft y desfase con el camino del dtw
  const ru = ritmo(F, ref.fps), rr = ref.pasos[paso].ritmo;
  const n = cam[cam.length - 1][0] + 1, m = cam[cam.length - 1][1] + 1;
  const desfase = media(cam.map(([i, j]) => i / Math.max(n - 1, 1) - j / Math.max(m - 1, 1)));
  let msg = null;
  if (ru > 0 && rr > 0) {
    const rel = ru / rr;
    const armonico = (rel >= 1.75 && rel <= 2.3) || (rel >= 0.43 && rel <= 0.57); // la fft a veces da el doble o la mitad
    if (!armonico && rel > LIMITES.ritmo[1]) msg = "Vas más rápido que la instructora, cuenta 1, 2, 3... 5, 6, 7 y respeta la pausa.";
    else if (!armonico && rel < LIMITES.ritmo[0]) msg = "Vas más lento que la instructora, intenta que cada paso caiga en el tiempo de la música.";
  }
  if (msg === null && desfase > LIMITES.desfase) msg = "Vas un poco atrasado respecto al video.";
  else if (msg === null && desfase < -LIMITES.desfase) msg = "Te estás adelantando al video.";
  if (msg) mejorar.push(msg); else bien.push("Llevas bien el tiempo con la instructora.");

  if (!bien.length) bien.push("Hiciste el ejercicio completo, eso ya es un buen comienzo.");
  if (!mejorar.length) mejorar.push("Para seguir mejorando intenta hacerlo sin mirar el video, solo con la música.");
  return { nivel, titulo: ref.titulos[nivel], resumen: ref.resumen[nivel], bien, mejorar, avisos,
           detalle: { distancia: d, simetria: sim, desfase, ritmo: [ru, rr], proporcion: prop, otro, dOtro } };
}
