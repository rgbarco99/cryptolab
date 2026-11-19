/* ════════════════════════════════════════════════════════════════════
   CryptoLab — ciphers.js
   Lógica criptográfica pura: sin DOM, para poder probarla con Node
   (`node tests/ciphers.test.js`). app.js solo se ocupa de la interfaz.
════════════════════════════════════════════════════════════════════ */
'use strict';

/* ── Alfabetos ───────────────────────────────────────────────────── */
const ALPHA_26 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHA_27 = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
let useEnye = false;
const alpha = () => (useEnye ? ALPHA_27 : ALPHA_26);
const setEnye = v => { useEnye = !!v; };

/** Aplica fn(índice, nºletra) a cada letra del alfabeto; el resto queda igual y se respeta mayúscula/minúscula */
function mapLetters(text, fn, A = alpha()) {
  const n = A.length;
  let i = 0, out = '';
  for (const ch of text) {
    const up = ch.toUpperCase(), idx = A.indexOf(up);
    if (idx < 0) { out += ch; continue; }
    const c = A[((fn(idx, i++) % n) + n) % n];
    out += ch === up ? c : c.toLowerCase();
  }
  return out;
}
const lettersOf = (text, A = alpha()) => [...text.toUpperCase()].filter(c => A.includes(c)).join('');

/* ── César, Atbash, Vigenère ─────────────────────────────────────── */
const caesar   = (t, k) => mapLetters(t, x => x + k);
const atbash   = t => mapLetters(t, x => alpha().length - 1 - x);
const vigKey   = k => [...k.toUpperCase()].map(c => alpha().indexOf(c)).filter(x => x >= 0);
const vigenere = (t, key, dir) => {
  const ks = vigKey(key);
  if (!ks.length) return t;
  return mapLetters(t, (x, i) => x + dir * ks[i % ks.length]);
};

/* ── Estadística del español ─────────────────────────────────────── */
const ES_FREQ = { A: 12.53, B: 1.42, C: 4.68, D: 5.86, E: 13.68, F: 0.69, G: 1.01, H: 0.7, I: 6.25, J: 0.44, K: 0.02, L: 4.97, M: 3.15,
  N: 6.71, 'Ñ': 0.31, O: 8.68, P: 2.51, Q: 0.88, R: 6.87, S: 7.98, T: 4.63, U: 3.93, V: 0.9, W: 0.01, X: 0.22, Y: 0.9, Z: 0.52 };

/** Chi-cuadrado frente al español: cuanto menor, más «suena» a español */
function spanishScore(text, A = alpha()) {
  const counts = Object.fromEntries([...A].map(c => [c, 0]));
  let total = 0;
  for (const ch of text.toUpperCase()) if (ch in counts) { counts[ch]++; total++; }
  if (!total) return Infinity;
  const sumF = [...A].reduce((s, c) => s + ES_FREQ[c], 0);
  return [...A].reduce((s, c) => { const e = total * ES_FREQ[c] / sumF; return s + (counts[c] - e) ** 2 / e; }, 0);
}

/**
 * Índice de coincidencia: probabilidad de que dos letras al azar del texto sean iguales.
 * Español ≈ 0,075 · texto aleatorio ≈ 1/26 ≈ 0,038. Es la herramienta clave contra Vigenère y Enigma.
 */
function indexOfCoincidence(letters) {
  const n = letters.length;
  if (n < 2) return 0;
  const f = {};
  for (const c of letters) f[c] = (f[c] || 0) + 1;
  let s = 0;
  for (const k in f) s += f[k] * (f[k] - 1);
  return s / (n * (n - 1));
}

/* ── Ataque a Vigenère: Kasiski / IC + un César por columna ──────── */
/** Distancias entre trigramas repetidos (método de Kasiski, 1863) */
function kasiski(letters) {
  const seen = {}, dists = [];
  for (let i = 0; i + 3 <= letters.length; i++) {
    const tri = letters.slice(i, i + 3);
    if (seen[tri] !== undefined) dists.push(i - seen[tri]);
    seen[tri] = i;
  }
  return dists;
}

/** Para cada longitud candidata, IC medio de sus columnas. La longitud correcta tiene IC ≈ español */
function keyLengthScores(letters, maxLen = 16) {
  const out = [];
  for (let L = 1; L <= Math.min(maxLen, Math.floor(letters.length / 2)); L++) {
    let sum = 0;
    for (let c = 0; c < L; c++) {
      let col = '';
      for (let i = c; i < letters.length; i += L) col += letters[i];
      sum += indexOfCoincidence(col);
    }
    out.push({ L, ic: sum / L });
  }
  return out;
}

/** Elige la longitud: la MÁS CORTA cuyo IC se acerca al máximo (los múltiplos también puntúan alto) */
function guessKeyLength(letters, maxLen = 16) {
  const sc = keyLengthScores(letters, maxLen);
  if (!sc.length) return { L: 1, scores: sc };
  const best = Math.max(...sc.map(s => s.ic));
  const pick = sc.find(s => s.ic >= best * 0.9) || sc[0];
  return { L: pick.L, scores: sc };
}

/** Resuelve una columna como si fuera un César: prueba todos los desplazamientos */
function solveColumn(col, A = alpha()) {
  let best = { shift: 0, score: Infinity };
  for (let s = 0; s < A.length; s++) {
    const dec = [...col].map(c => A[(A.indexOf(c) - s + A.length) % A.length]).join('');
    const score = spanishScore(dec, A);
    if (score < best.score) best = { shift: s, score };
  }
  return best;
}

function crackVigenere(text, maxLen = 16) {
  const A = alpha(), letters = lettersOf(text, A);
  const { L, scores } = guessKeyLength(letters, maxLen);
  const cols = [];
  for (let c = 0; c < L; c++) {
    let col = '';
    for (let i = c; i < letters.length; i += L) col += letters[i];
    cols.push({ col, ...solveColumn(col, A) });
  }
  const key = cols.map(c => A[c.shift]).join('');
  return { L, scores, cols, key, plain: vigenere(text, key, -1) };
}

/* ── Enigma I (Wehrmacht): rotores I-V, reflector B, tablero ─────── */
const ROTORS = {
  I:   { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II:  { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMSUQO', notch: 'V' },
  IV:  { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V:   { wiring: 'VZBRGITYUPSDNHLMWFCQOKJEXA', notch: 'Z' },
};
const REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';
const AZ = ALPHA_26, A2I = c => AZ.indexOf(c);

/** Convierte "AB CD EF" en un mapa de intercambios (cada letra como mucho una vez) */
function parsePlugboard(str) {
  const map = [...Array(26).keys()];
  const pairs = (str || '').toUpperCase().match(/[A-Z]{2}/g) || [];
  const used = new Set();
  for (const [a, b] of pairs) {
    if (a === b || used.has(a) || used.has(b)) throw new Error(`Par de clavijas no válido: ${a}${b}`);
    used.add(a); used.add(b);
    map[A2I(a)] = A2I(b); map[A2I(b)] = A2I(a);
  }
  return map;
}

/**
 * Máquina Enigma. cfg = { rotors:['I','II','III'] (izq→der), pos:'AAA', rings:'AAA', plugs:'AB CD' }
 * step() mueve los rotores ANTES de cifrar cada letra, incluido el famoso «doble paso» del rotor central.
 */
function makeEnigma(cfg) {
  const rot = cfg.rotors.map(r => ROTORS[r]);
  const pos = [...(cfg.pos || 'AAA').toUpperCase()].map(A2I);
  const ring = [...(cfg.rings || 'AAA').toUpperCase()].map(A2I);
  const plug = parsePlugboard(cfg.plugs);
  const fwd = rot.map(r => [...r.wiring].map(A2I));
  const back = fwd.map(w => { const b = []; w.forEach((o, i) => (b[o] = i)); return b; });
  const notch = rot.map(r => A2I(r.notch));
  const mod = x => ((x % 26) + 26) % 26;

  function step() {
    const midAtNotch = pos[1] === notch[1], rightAtNotch = pos[2] === notch[2];
    if (midAtNotch) { pos[0] = mod(pos[0] + 1); pos[1] = mod(pos[1] + 1); }  // doble paso
    else if (rightAtNotch) pos[1] = mod(pos[1] + 1);
    pos[2] = mod(pos[2] + 1);
  }
  const through = (i, x, table) => mod(table[i][mod(x + pos[i] - ring[i])] - pos[i] + ring[i]);

  /** Cifra una letra (0-25) y devuelve también el recorrido de la señal para la visualización */
  function press(x) {
    step();
    const path = [x];
    let c = plug[x];              path.push(c);
    c = through(2, c, fwd);       path.push(c);
    c = through(1, c, fwd);       path.push(c);
    c = through(0, c, fwd);       path.push(c);
    c = A2I(REFLECTOR_B[c]);      path.push(c);
    c = through(0, c, back);      path.push(c);
    c = through(1, c, back);      path.push(c);
    c = through(2, c, back);      path.push(c);
    c = plug[c];                  path.push(c);
    return { out: c, path };
  }

  return {
    press,
    get pos() { return pos.map(p => AZ[p]).join(''); },
    /** Enigma solo tenía 26 teclas: se ignora todo lo demás (también Ñ y tildes, tras quitarlas) */
    run(text) {
      let out = '';
      for (const ch of deaccent(text)) {
        const up = ch.toUpperCase(), i = A2I(up);
        if (i < 0 || up === 'Ñ') { out += ch; continue; }
        const c = AZ[press(i).out];
        out += ch === up ? c : c.toLowerCase();
      }
      return out;
    },
  };
}
const enigma = (text, cfg) => makeEnigma(cfg).run(text);

/** Las 60 formas de colocar 3 de los 5 rotores (el orden importa) */
const ROTOR_ORDERS = (() => {
  const r = Object.keys(ROTORS), out = [];
  for (const a of r) for (const b of r) for (const c of r) if (a !== b && b !== c && a !== c) out.push([a, b, c]);
  return out;
})();

/**
 * «Bombe» simplificada: para un orden de rotores prueba las 17.576 posiciones iniciales y puntúa
 * cada descifrado con chi² frente al español. Asume anillos en AAA y sin tablero de conexiones.
 * Es una versión muy rápida de makeEnigma() (sin objetos ni cadenas) porque se ejecuta millones de veces.
 */
function bombeScan(cipherIdx, order, top = 3) {
  const W = order.map(r => [...ROTORS[r].wiring].map(A2I));
  const B = W.map(w => { const b = []; w.forEach((o, i) => (b[o] = i)); return b; });
  const N = order.map(r => A2I(ROTORS[r].notch)), R = [...REFLECTOR_B].map(A2I);
  const sumF = [...AZ].reduce((s, c) => s + ES_FREQ[c], 0), L = cipherIdx.length;
  const E = [...AZ].map(c => L * ES_FREQ[c] / sumF);
  const counts = new Int32Array(26), m = x => (x + 26) % 26;
  let best = [];
  for (let p = 0; p < 17576; p++) {
    let a = (p / 676) | 0, b = ((p / 26) | 0) % 26, c = p % 26;
    counts.fill(0);
    for (let k = 0; k < L; k++) {
      if (b === N[1]) { a = (a + 1) % 26; b = (b + 1) % 26; } else if (c === N[2]) b = (b + 1) % 26;
      c = (c + 1) % 26;
      let y = m(W[2][(cipherIdx[k] + c) % 26] - c);
      y = m(W[1][(y + b) % 26] - b); y = m(W[0][(y + a) % 26] - a);
      y = R[y];
      y = m(B[0][(y + a) % 26] - a); y = m(B[1][(y + b) % 26] - b); y = m(B[2][(y + c) % 26] - c);
      counts[y]++;
    }
    let chi = 0;
    for (let i = 0; i < 26; i++) chi += (counts[i] - E[i]) ** 2 / E[i];
    if (best.length < top || chi < best[best.length - 1].score) {
      best.push({ pos: AZ[(p / 676) | 0] + AZ[((p / 26) | 0) % 26] + AZ[p % 26], score: chi, rotors: order });
      best.sort((x, y) => x.score - y.score);
      if (best.length > top) best.pop();
    }
  }
  return best;
}

/* ── One-time pad (sobre letras, como lo usaban los espías) ──────── */
function randomLetters(n, A = alpha()) {
  const out = [], buf = new Uint32Array(1);
  // Rechazo para evitar sesgo de módulo: solo aceptamos valores < múltiplo exacto del alfabeto
  const lim = Math.floor(0x100000000 / A.length) * A.length;
  while (out.length < n) {
    crypto.getRandomValues(buf);
    if (buf[0] < lim) out.push(A[buf[0] % A.length]);
  }
  return out.join('');
}
/** Cifra con la clave sin repetirla. Si la clave se acaba, lanza error: reutilizarla rompe la seguridad */
function otp(text, pad, dir) {
  const ks = vigKey(pad), need = lettersOf(text).length;
  if (ks.length < need) throw new Error(`La clave tiene ${ks.length} letras y el mensaje ${need}`);
  return mapLetters(text, (x, i) => x + dir * ks[i]);
}
/** La clave que haría que `cipher` se descifrara como `fake`: la prueba de que el OTP es irrompible */
function otpKeyFor(cipher, fake) {
  const A = alpha(), c = lettersOf(cipher, A), f = lettersOf(fake, A);
  return [...c].slice(0, f.length).map((ch, i) => A[(A.indexOf(ch) - A.indexOf(f[i]) + A.length) % A.length]).join('');
}

/* ── Codificaciones ──────────────────────────────────────────────── */
const utf8 = new TextEncoder(), utf8d = new TextDecoder('utf-8', { fatal: true });
const bytesToB64 = bytes => { let b = ''; bytes.forEach(c => (b += String.fromCharCode(c))); return btoa(b); };
const b64ToBytes = s => Uint8Array.from(atob(s.replace(/\s+/g, '')), c => c.charCodeAt(0));
const b64enc = s => bytesToB64(utf8.encode(s));
const b64dec = s => utf8d.decode(b64ToBytes(s));
const toHex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const hexenc = s => [...utf8.encode(s)].map(b => b.toString(16).padStart(2, '0')).join(' ');
const hexdec = s => {
  const clean = s.replace(/[^0-9a-f]/gi, '');
  if (clean.length % 2) throw new Error('hex impar');
  return utf8d.decode(Uint8Array.from(clean.match(/../g) || [], h => parseInt(h, 16)));
};
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-',
  L: '.-..', M: '--', N: '-.', 'Ñ': '--.--', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
/** Quita tildes pero conserva la Ñ (la virgulilla U+0303) */
const deaccent = s => s.normalize('NFD').replace(/(?![̃])[̀-ͯ]/g, '').normalize('NFC');
const morseenc = s => deaccent(s.toUpperCase()).split(/\s+/).filter(Boolean)
  .map(w => [...w].map(c => MORSE[c] || '').filter(Boolean).join(' ')).join(' / ');
const morsedec = s => s.trim().split(/\s*\/\s*/).map(w => w.split(/\s+/).map(c => MORSE_REV[c] || '').join('')).join(' ');

/* ── AES-256-GCM con clave derivada de contraseña (WebCrypto) ────── */
/*
 * Formato del resultado (Base64):  sal(16) ‖ IV(12) ‖ texto cifrado + etiqueta GCM(16)
 * La sal y el IV no son secretos: viajan con el mensaje. Lo único secreto es la contraseña.
 */
const PBKDF2_ITER = 100000;
async function deriveKey(password, salt, iterations = PBKDF2_ITER) {
  const base = await crypto.subtle.importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function aesEncrypt(text, password, iterations = PBKDF2_ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(text)));
  const out = new Uint8Array(28 + ct.length);
  out.set(salt); out.set(iv, 16); out.set(ct, 28);
  return bytesToB64(out);
}
function aesParse(b64) {
  const all = b64ToBytes(b64);
  if (all.length < 28 + 16) throw new Error('Demasiado corto para ser AES-GCM');
  return { salt: all.slice(0, 16), iv: all.slice(16, 28), ct: all.slice(28) };
}
/** Lanza error si la contraseña es incorrecta: GCM detecta cualquier manipulación con su etiqueta */
async function aesDecrypt(b64, password, iterations = PBKDF2_ITER) {
  const { salt, iv, ct } = aesParse(b64);
  const key = await deriveKey(password, salt, iterations);
  return utf8d.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

/* ── SHA-256 ─────────────────────────────────────────────────────── */
async function sha256(text) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(text))));
}
/** Bits distintos entre dos huellas hex: el efecto avalancha ronda siempre el 50 % (≈128 de 256) */
function bitDiff(h1, h2) {
  let d = 0;
  for (let i = 0; i < h1.length; i++) {
    let x = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/* ── RSA de juguete con BigInt ───────────────────────────────────── */
function modPow(b, e, m) {
  let r = 1n; b %= m;
  while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
  return r;
}
function egcd(a, b) {
  let [r0, r1, s0, s1] = [a, b, 1n, 0n];
  while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  return { g: r0, x: s0 };
}
function modInv(a, m) {
  const { g, x } = egcd(((a % m) + m) % m, m);
  if (g !== 1n) throw new Error('No tiene inverso');
  return ((x % m) + m) % m;
}
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
const bitLen = n => n.toString(2).length;

function randBig(bits) {
  const bytes = Math.ceil(bits / 8), buf = crypto.getRandomValues(new Uint8Array(bytes));
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return n & ((1n << BigInt(bits)) - 1n);
}
/** Miller-Rabin con bases fijas: determinista para n < 3,3·10²⁴ (sobra para este laboratorio) */
function isPrime(n) {
  if (n < 2n) return false;
  const small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
  for (const p of small) { if (n === p) return true; if (n % p === 0n) return false; }
  let d = n - 1n, s = 0;
  while (!(d & 1n)) { d >>= 1n; s++; }
  outer: for (const a of small) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) { x = x * x % n; if (x === n - 1n) continue outer; }
    return false;
  }
  return true;
}
function randomPrime(bits) {
  for (;;) {
    const c = randBig(bits) | (1n << BigInt(bits - 1)) | 1n;  // fuerza el tamaño exacto y que sea impar
    if (isPrime(c)) return c;
  }
}

/** A partir de p y q calcula todo el par de claves. e = 65537 si se puede (es lo habitual) */
function rsaKeys(p, q) {
  if (!isPrime(p) || !isPrime(q)) throw new Error('p y q deben ser primos');
  if (p === q) throw new Error('p y q deben ser distintos');
  const n = p * q, phi = (p - 1n) * (q - 1n);
  let e = 65537n;
  if (e >= phi || gcd(e, phi) !== 1n) { e = 3n; while (gcd(e, phi) !== 1n) e += 2n; }
  return { p, q, n, phi, e, d: modInv(e, phi) };
}
function rsaGenerate(bits) {
  for (;;) {
    const p = randomPrime(bits), q = randomPrime(bits);
    if (p === q) continue;
    try { return rsaKeys(p, q); } catch { /* e sin inverso: se repite */ }
  }
}

/** Bytes que caben en un bloque: el número de cada bloque debe ser menor que n */
const rsaBlockBytes = n => Math.max(1, Math.floor((bitLen(n) - 1) / 8));
/**
 * RSA «de libro»: los bytes se agrupan en bloques y cada bloque m se cifra como c = m^e mod n.
 * Sin relleno (OAEP) es determinista y vulnerable; aquí interesa ver las matemáticas.
 */
function rsaEncrypt(text, { n, e }) {
  const bytes = utf8.encode(text), k = rsaBlockBytes(n), out = [];
  for (let i = 0; i < bytes.length; i += k) {
    let m = 0n;
    for (const b of bytes.slice(i, i + k)) m = (m << 8n) | BigInt(b);
    // Si el último bloque va incompleto, anotamos cuántos bytes lleva tras un punto (p. ej. "1x9k.2")
    out.push(modPow(m, e, n).toString(36) + (bytes.length - i < k ? '.' + (bytes.length - i) : ''));
  }
  return out.join(' ');
}
function rsaDecrypt(cipher, { n, d }) {
  const k = rsaBlockBytes(n), bytes = [];
  for (const tok of cipher.trim().split(/\s+/).filter(Boolean)) {
    const [num, len] = tok.split('.');
    if (!/^[0-9a-z]+$/.test(num)) throw new Error('Bloque no válido');
    const c = [...num].reduce((acc, ch) => acc * 36n + BigInt(parseInt(ch, 36)), 0n);
    if (c >= n) throw new Error('Bloque mayor que n');
    let m = modPow(c, d, n);
    const size = len ? +len : k, blk = [];
    for (let j = 0; j < size; j++) { blk.unshift(Number(m & 255n)); m >>= 8n; }
    bytes.push(...blk);
  }
  return utf8d.decode(new Uint8Array(bytes));
}

/**
 * Factoriza n con el algoritmo rho de Pollard (variante de Brent).
 * Es generador: cede el control cada `chunk` iteraciones para que la interfaz no se congele.
 */
function* pollardRho(n, chunk = 2000) {
  if (n % 2n === 0n) return 2n;
  let iters = 0;
  for (let c = 1n; ; c++) {
    const f = x => (x * x + c) % n;
    let x = 2n, y = 2n, d = 1n;
    while (d === 1n) {
      x = f(x); y = f(f(y)); d = gcd(x > y ? x - y : y - x, n);
      if (++iters % chunk === 0) yield iters;
    }
    if (d !== n) return d;
  }
}

/* ── Diccionario para los ataques a contraseñas ──────────────────── */
/* Las contraseñas más filtradas (listas públicas tipo RockYou) y palabras comunes en español */
const COMMON_PASSWORDS = (
  '123456 123456789 12345678 password qwerty 12345 1234567 111111 123123 1234567890 000000 abc123 password1 ' +
  'iloveyou 1234 qwerty123 dragon monkey letmein football master welcome shadow sunshine princess 654321 ' +
  'superman batman trustno1 admin admin123 root contraseña contrasena clave secreto hola hola123 teamo ' +
  'tequiero amor amorcito corazon familia madrid barcelona realmadrid barca futbol españa espana mexico ' +
  'argentina colombia chile peru estrella mariposa princesa gatito perrito pokemon minecraft fortnite ' +
  'naruto goku pikachu cristiano messi junio julio enero verano invierno lunes viernes sol luna cielo ' +
  'tesoro casa playa azul rojo verde negro blanco libertad dios jesus maria jose juan carlos lucia sofia ' +
  'daniel pablo alejandro javier manuel antonio david miguel laura marta ana elena carmen ruben ' +
  'cryptolab enigma cesar vigenere alan turing bletchley abcdef abcd1234 qwertyuiop asdfgh zxcvbn ' +
  'passw0rd p@ssw0rd 1q2w3e4r 1qaz2wsx q1w2e3r4 aaaaaa 112233 121212 159753 147258 987654321 666666 ' +
  'chocolate galleta pizza cerveza hello hello123 secret access starwars matrix'
).split(/\s+/);

/** Variaciones típicas que la gente cree que «hacen segura» una contraseña */
function* mutations(word) {
  const cap = word[0].toUpperCase() + word.slice(1);
  yield word; yield cap; yield word.toUpperCase();
  for (const suf of ['1', '12', '123', '1234', '!', '.', '2024', '2025', '2026', '01', '69', '99'])
    { yield word + suf; yield cap + suf; }
  const leet = word.replace(/a/g, '4').replace(/e/g, '3').replace(/i/g, '1').replace(/o/g, '0').replace(/s/g, '5');
  if (leet !== word) { yield leet; yield leet + '1'; }
  yield [...word].reverse().join('');
}

/* ── Exportación para Node (en el navegador son globales) ────────── */
if (typeof module !== 'undefined') {
  module.exports = {
    ALPHA_26, ALPHA_27, alpha, setEnye, mapLetters, lettersOf, caesar, atbash, vigKey, vigenere,
    spanishScore, indexOfCoincidence, kasiski, keyLengthScores, guessKeyLength, solveColumn, crackVigenere,
    ROTORS, REFLECTOR_B, ROTOR_ORDERS, bombeScan, parsePlugboard, makeEnigma, enigma, randomLetters, otp, otpKeyFor,
    b64enc, b64dec, hexenc, hexdec, morseenc, morsedec, deaccent, toHex,
    PBKDF2_ITER, aesEncrypt, aesDecrypt, aesParse, sha256, bitDiff,
    modPow, modInv, gcd, bitLen, isPrime, randomPrime, rsaKeys, rsaGenerate, rsaBlockBytes, rsaEncrypt, rsaDecrypt,
    pollardRho, COMMON_PASSWORDS, mutations,
  };
}
