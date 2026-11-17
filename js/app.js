/* ════════════════════════════════════════════════════════════════════
   CryptoLab — app.js  (maqueta: César, Atbash, Vigenère y codificaciones
   funcionan; el resto muestra la estructura final)
════════════════════════════════════════════════════════════════════ */
'use strict';

const $ = id => document.getElementById(id);
const MAX = 5000;

/* ── Alfabetos ───────────────────────────────────────────────────── */
const ALPHA_26 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHA_27 = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
let useEnye = false;
const alpha = () => (useEnye ? ALPHA_27 : ALPHA_26);

/** Aplica fn(índice) a cada letra del alfabeto; el resto queda igual y se respeta mayúscula/minúscula */
function mapLetters(text, fn) {
  const A = alpha(), n = A.length;
  let i = 0, out = '';
  for (const ch of text) {
    const up = ch.toUpperCase(), idx = A.indexOf(up);
    if (idx < 0) { out += ch; continue; }
    const c = A[((fn(idx, i++) % n) + n) % n];
    out += ch === up ? c : c.toLowerCase();
  }
  return out;
}

/* ── Cifrados implementados en la maqueta ────────────────────────── */
const caesar   = (t, k) => mapLetters(t, x => x + k);
const atbash   = t => mapLetters(t, x => alpha().length - 1 - x);
const vigKey   = k => [...k.toUpperCase()].map(c => alpha().indexOf(c)).filter(x => x >= 0);
const vigenere = (t, key, dir) => {
  const ks = vigKey(key);
  if (!ks.length) return t;
  return mapLetters(t, (x, i) => x + dir * ks[i % ks.length]);
};

const utf8 = new TextEncoder(), utf8d = new TextDecoder('utf-8', { fatal: true });
const b64enc = s => { let b = ''; utf8.encode(s).forEach(c => (b += String.fromCharCode(c))); return btoa(b); };
const b64dec = s => utf8d.decode(Uint8Array.from(atob(s.replace(/\s+/g, '')), c => c.charCodeAt(0)));
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
const deaccent = s => s.normalize('NFD').replace(/(?![̃])[̀-ͯ]/g, '').normalize('NFC');
const morseenc = s => deaccent(s.toUpperCase()).split(/\s+/).filter(Boolean)
  .map(w => [...w].map(c => MORSE[c] || '').filter(Boolean).join(' ')).join(' / ');
const morsedec = s => s.trim().split(/\s*\/\s*/).map(w => w.split(/\s+/).map(c => MORSE_REV[c] || '').join('')).join(' ');

/* ── Catálogo ────────────────────────────────────────────────────── */
const GROUPS = [
  { id: 'clasicos',  name: 'Clásicos',       icon: '📜', color: '#e8a33a', ciphers: ['cesar', 'atbash', 'vigenere', 'enigma'] },
  { id: 'modernos',  name: 'Modernos',       icon: '🛡️', color: '#7c6fff', ciphers: ['aes', 'otp'] },
  { id: 'asim',      name: 'Asimétricos',    icon: '🗝️', color: '#0aa5c0', ciphers: ['rsa'] },
  { id: 'huellas',   name: 'Huellas',        icon: '🧬', color: '#e5588a', ciphers: ['sha256'] },
  { id: 'codif',     name: 'Codificaciones', icon: '🔣', color: '#22a876', ciphers: ['base64', 'morse', 'hex'] },
];

const CIPHERS = {
  cesar: {
    name: 'César', era: 'Roma · siglo I a. C.', strength: 1, strengthText: 'Ninguna hoy en día',
    tagline: 'Cada letra se desplaza un número fijo de posiciones en el alfabeto.',
    key: 'shift', ready: true, crack: 'brute',
    enc: (t, k) => caesar(t, k), dec: (t, k) => caesar(t, -k),
    how: `<p>Julio César desplazaba cada letra <b>tres posiciones</b>: la A se convertía en D, la B en E… Al llegar a la Z se vuelve a empezar por la A.</p>
          <p>La clave es solo un número entre 1 y ${ALPHA_26.length - 1}. Con desplazamiento 13 se llama <b>ROT13</b> y tiene una curiosidad: cifrar dos veces devuelve el original.</p>
          <p class="fact">💡 Solo hay 25 claves posibles. Un ordenador las prueba todas en menos de un milisegundo; a mano, en unos minutos.</p>`,
  },
  atbash: {
    name: 'Atbash', era: 'Hebreo antiguo · ~500 a. C.', strength: 1, strengthText: 'Ninguna',
    tagline: 'El alfabeto se da la vuelta: la A es la Z, la B es la Y…',
    key: null, ready: true, crack: 'trivial',
    enc: t => atbash(t), dec: t => atbash(t),
    how: `<p>Se escribe el alfabeto al revés debajo del normal y se sustituye cada letra por la de abajo. Aparece en textos bíblicos en hebreo.</p>
          <p class="fact">💡 No tiene clave: quien conozca el método puede leerlo. Cifrar y descifrar son exactamente la misma operación.</p>`,
  },
  vigenere: {
    name: 'Vigenère', era: 'Europa · 1553', strength: 2, strengthText: 'Baja',
    tagline: 'Un César distinto para cada letra, marcado por una palabra clave.',
    key: 'word', ready: true, crack: 'freq',
    enc: (t, k) => vigenere(t, k, 1), dec: (t, k) => vigenere(t, k, -1),
    how: `<p>La palabra clave se repite debajo del mensaje y cada letra de la clave indica cuánto desplazar la letra de arriba (A = 0, B = 1, C = 2…).</p>
          <p>Así, una misma letra del mensaje se cifra de formas distintas según su posición, lo que despista el análisis de frecuencias simple.</p>
          <p class="fact">💡 Lo llamaron <i>le chiffre indéchiffrable</i> durante casi 300 años, hasta que Kasiski publicó cómo romperlo en 1863.</p>`,
  },
  enigma: {
    name: 'Enigma', era: 'Alemania · 1923-1945', strength: 3, strengthText: 'Media',
    tagline: 'Rotores que giran con cada tecla: la sustitución cambia letra a letra.',
    key: 'enigma', ready: false, crack: 'bombe',
    how: `<p>Cada pulsación hacía avanzar unos rotores con cableado interno, así que la misma tecla daba una letra diferente cada vez. Un tablero de conexiones añadía otra capa.</p>
          <p class="fact">💡 Con la configuración militar había unos 158 trillones de combinaciones. Turing y el equipo de Bletchley Park la rompieron aprovechando errores de los operadores.</p>`,
  },
  aes: {
    name: 'AES-256', era: 'Estándar · 2001', strength: 5, strengthText: 'Muy alta',
    tagline: 'El cifrado que protege tu banca, tu WiFi y tus mensajes.',
    key: 'password', ready: false, crack: 'dictionary',
    how: `<p>Mezcla los datos en bloques de 16 bytes a lo largo de 14 rondas de sustituciones, permutaciones y combinaciones con la clave. Aquí la clave se deriva de tu contraseña con PBKDF2.</p>
          <p>Cada vez que cifras el resultado es distinto aunque el texto y la clave sean los mismos, porque se mezcla con un valor aleatorio (IV).</p>
          <p class="fact">💡 Probar las 2<sup>256</sup> claves llevaría muchísimo más que la edad del universo. El punto débil real es la contraseña que eliges.</p>`,
  },
  otp: {
    name: 'One-time pad', era: 'Vernam · 1917', strength: 5, strengthText: 'Perfecta (bien usado)',
    tagline: 'Una clave aleatoria tan larga como el mensaje, usada una sola vez.',
    key: 'pad', ready: false, crack: 'impossible',
    how: `<p>Cada letra se combina con una letra aleatoria de la clave. Si la clave es realmente aleatoria, tan larga como el mensaje y no se reutiliza, el cifrado es <b>matemáticamente irrompible</b>.</p>
          <p class="fact">💡 Para cualquier texto cifrado existe una clave que lo convierte en cualquier mensaje de la misma longitud: «ATACAD» y «HUID YA» son igual de probables.</p>`,
  },
  rsa: {
    name: 'RSA', era: 'Rivest, Shamir y Adleman · 1977', strength: 5, strengthText: 'Muy alta (2048 bits)',
    tagline: 'Una clave para cerrar y otra distinta para abrir.',
    key: 'rsa', ready: false, crack: 'factor',
    how: `<p>Se eligen dos números primos enormes y se multiplican. Multiplicar es fácil; volver a encontrar los dos primos a partir del producto es extraordinariamente difícil.</p>
          <p class="fact">💡 Con números pequeños se rompe al instante. Con 2048 bits (unas 617 cifras) nadie ha conseguido factorizarlo.</p>`,
  },
  sha256: {
    name: 'SHA-256', era: 'NSA · 2001', strength: 5, strengthText: 'No se descifra',
    tagline: 'Una huella digital: siempre el mismo tamaño y sin vuelta atrás.',
    key: null, ready: false, crack: 'dictionary', oneWay: true,
    how: `<p>Convierte cualquier texto en 64 caracteres hexadecimales. Cambiar una sola letra cambia la huella por completo (efecto avalancha).</p>
          <p class="fact">💡 No se puede «descifrar». Las contraseñas filtradas se recuperan probando millones de palabras y comparando huellas.</p>`,
  },
  base64: {
    name: 'Base64', era: 'Codificación · 1987', strength: 0, strengthText: 'Ninguna: no es un cifrado',
    tagline: 'Convierte cualquier dato en texto seguro de enviar. No oculta nada.',
    key: null, ready: true, crack: 'decode',
    enc: t => b64enc(t), dec: t => b64dec(t),
    how: `<p>Agrupa los bytes de 3 en 3 y los reparte en 4 caracteres de un alfabeto de 64 símbolos (A-Z, a-z, 0-9, + y /).</p>
          <p class="fact">⚠️ Es muy común confundirlo con cifrado. No tiene clave: cualquiera puede revertirlo.</p>`,
  },
  morse: {
    name: 'Morse', era: 'Telégrafo · 1838', strength: 0, strengthText: 'Ninguna: no es un cifrado',
    tagline: 'Letras convertidas en puntos y rayas.',
    key: null, ready: true, crack: 'decode',
    enc: t => morseenc(t), dec: t => morsedec(t),
    how: `<p>Cada letra es una secuencia de pulsos cortos (·) y largos (—). Las letras más frecuentes en inglés tienen los códigos más cortos: la E es un solo punto.</p>
          <p class="fact">💡 Se separan letras con espacios y palabras con «/». Los acentos se pierden.</p>`,
  },
  hex: {
    name: 'Hexadecimal', era: 'Codificación', strength: 0, strengthText: 'Ninguna: no es un cifrado',
    tagline: 'Los bytes reales de tu texto, escritos en base 16.',
    key: null, ready: true, crack: 'decode',
    enc: t => hexenc(t), dec: t => hexdec(t),
    how: `<p>Cada byte (0-255) se escribe con dos símbolos de 0-9 y a-f. Es como ven el texto los programas.</p>
          <p class="fact">💡 Fíjate en la «ñ» o en las tildes: ocupan dos bytes en UTF-8.</p>`,
  },
};

/* ── Estado ──────────────────────────────────────────────────────── */
const state = { group: 'clasicos', cipher: 'cesar', mode: 'enc', shift: 3, word: 'CLAVE', attack: null };
const cur = () => CIPHERS[state.cipher];

/* ── Selector ────────────────────────────────────────────────────── */
function renderGroups() {
  $('groups').innerHTML = GROUPS.map(g => `
    <button class="group-tab" role="tab" data-group="${g.id}" style="--g:${g.color}"
      aria-selected="${g.id === state.group}"><span class="gi">${g.icon}</span>${g.name}</button>`).join('');
}
function renderCiphers() {
  const g = GROUPS.find(x => x.id === state.group);
  $('ciphers').innerHTML = g.ciphers.map(id => `
    <button class="cipher-chip${id === state.cipher ? ' active' : ''}" data-cipher="${id}">
      ${CIPHERS[id].name}${CIPHERS[id].ready ? '' : '<span class="soon">pronto</span>'}</button>`).join('');
}
$('groups').addEventListener('click', e => {
  const b = e.target.closest('[data-group]'); if (!b) return;
  state.group = b.dataset.group;
  selectCipher(GROUPS.find(x => x.id === state.group).ciphers[0]);
});
$('ciphers').addEventListener('click', e => {
  const b = e.target.closest('[data-cipher]'); if (b) selectCipher(b.dataset.cipher);
});

function selectCipher(id) {
  stopAttack(true);
  state.cipher = id;
  state.group = GROUPS.find(g => g.ciphers.includes(id)).id;
  document.documentElement.style.setProperty('--accent', GROUPS.find(g => g.id === state.group).color);
  renderGroups(); renderCiphers(); renderHead(); renderKey(); renderVisual();
  $('output').value = ''; setOutState('');
  $('console').hidden = true;
  updateLabels();
}

/* ── Cabecera ────────────────────────────────────────────────────── */
function renderHead() {
  const c = cur();
  $('cipher-era').textContent = c.era;
  $('cipher-name').textContent = c.name;
  $('cipher-tagline').textContent = c.tagline;
  $('strength-bars').innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="${i <= c.strength ? 'on' : ''}"></i>`).join('');
  $('strength-text').textContent = c.strengthText;
  $('how').innerHTML = c.how;
}
$('how-toggle').addEventListener('click', () => {
  const open = $('how').hidden;
  $('how').hidden = !open;
  $('how-toggle').setAttribute('aria-expanded', String(open));
});

/* ── Clave ───────────────────────────────────────────────────────── */
function renderKey() {
  const c = cur(), row = $('key-row');
  const enye = `<label class="check"><input type="checkbox" id="enye" ${useEnye ? 'checked' : ''}> Alfabeto con Ñ</label>`;
  if (c.key === 'shift') {
    const n = alpha().length;
    state.shift = Math.min(state.shift, n - 1);
    row.innerHTML = `<span class="key-label">🔑 Desplazamiento</span>
      <input type="range" class="key-range" id="key" min="1" max="${n - 1}" value="${state.shift}">
      <span class="key-value" id="key-val">${state.shift}</span>${enye}`;
  } else if (c.key === 'word') {
    row.innerHTML = `<span class="key-label">🔑 Palabra clave</span>
      <input type="text" class="key-text" id="key" value="${state.word}" maxlength="64" autocomplete="off" spellcheck="false">${enye}`;
  } else if (c.key) {
    const label = { password: 'Contraseña', pad: 'Clave aleatoria', rsa: 'Par de claves', enigma: 'Rotores y posición' }[c.key];
    row.innerHTML = `<span class="key-label">🔑 ${label}</span><span class="key-none">Disponible en la versión final</span>`;
  } else if (state.cipher === 'atbash') {
    row.innerHTML = `<span class="key-none">Sin clave</span>${enye}`;
  } else {
    row.innerHTML = c.oneWay ? '<span class="key-none">Sin clave · solo en un sentido</span>' : '<span class="key-none">Sin clave</span>';
  }
}
$('key-row').addEventListener('input', e => {
  if (e.target.id === 'key' && cur().key === 'shift') {
    state.shift = +e.target.value; $('key-val').textContent = state.shift;
  } else if (e.target.id === 'key') {
    state.word = e.target.value;
  } else if (e.target.id === 'enye') {
    useEnye = e.target.checked; renderKey();
  }
  renderVisual();
});

/* ── Visualización ───────────────────────────────────────────────── */
function lastLetterIdx() {
  const A = alpha(), t = $('input').value.toUpperCase();
  for (let i = t.length - 1; i >= 0; i--) { const x = A.indexOf(t[i]); if (x >= 0) return x; }
  return -1;
}
function strip(map, caption) {
  const A = alpha(), hi = lastLetterIdx();
  const enc = state.mode === 'enc';
  const top = enc ? [...A] : A.split('').map((_, i) => A[map(i)]);
  const bot = enc ? A.split('').map((_, i) => A[map(i)]) : [...A];
  const row = (arr, cls) => `<div class="alpha ${cls}">${arr.map((c, i) => `<span class="${i === hi ? 'hl' : ''}">${c}</span>`).join('')}</div>`;
  return `${row(top, enc ? '' : 'cipher')}<div class="alpha-arrows">${[...A].map(() => '<span>↓</span>').join('')}</div>${row(bot, enc ? 'cipher' : '')}
          <p class="visual-caption">${caption}</p>`;
}
function renderVisual() {
  const v = $('visual'), c = cur(), n = alpha().length;
  if (state.cipher === 'cesar') {
    v.innerHTML = strip(i => (i + state.shift) % n, `Desplazamiento ${state.shift}: ${alpha()[0]} → ${alpha()[state.shift]}`);
  } else if (state.cipher === 'atbash') {
    v.innerHTML = strip(i => n - 1 - i, 'El alfabeto se refleja como en un espejo');
  } else if (state.cipher === 'vigenere') {
    const A = alpha(), ks = vigKey(state.word);
    const letters = [...$('input').value.toUpperCase()].filter(ch => A.includes(ch)).slice(0, 24);
    if (!ks.length) { v.innerHTML = '<div class="visual-placeholder">Escribe una palabra clave</div>'; return; }
    const sample = letters.length ? letters : [...'ESCRIBEUNMENSAJE'];
    const dir = state.mode === 'enc' ? 1 : -1;
    const keyRow = sample.map((_, i) => A[ks[i % ks.length]]);
    const outRow = sample.map((ch, i) => A[(((A.indexOf(ch) + dir * ks[i % ks.length]) % n) + n) % n]);
    const row = (arr, cls) => `<div class="alpha ${cls}">${arr.map(c => `<span>${c}</span>`).join('')}</div>`;
    v.innerHTML = `${row(sample, '')}${row(keyRow, 'cipher')}${row(outRow, '')}
      <p class="visual-caption">Texto · clave repetida (${ks.map(k => `${A[k]}=${k}`).join(', ')}) · resultado</p>`;
  } else {
    const icons = { enigma: '⚙️', aes: '🧊', otp: '🎲', rsa: '🔐', sha256: '🧬', base64: '🔤', morse: '📡', hex: '🔢' };
    const what = { enigma: 'los rotores girando', aes: 'las rondas sobre una matriz de 4×4 bytes', otp: 'mensaje ⊕ clave, bit a bit',
                   rsa: 'los primos p y q y el módulo n', sha256: 'el efecto avalancha', base64: 'bytes → grupos de 6 bits → símbolos',
                   morse: 'el mensaje como pulsos de luz y sonido', hex: 'cada carácter con sus bytes' }[state.cipher];
    v.innerHTML = `<div class="visual-placeholder"><div><b>${icons[state.cipher]}</b>Aquí se verá ${what}</div></div>`;
  }
}

/* ── Traductor ───────────────────────────────────────────────────── */
function updateLabels() {
  const enc = state.mode === 'enc', c = cur();
  $('in-label').textContent  = enc ? 'Texto claro' : (c.oneWay ? 'Huella' : 'Texto cifrado');
  $('out-label').textContent = enc ? (c.oneWay ? 'Huella' : c.strength ? 'Texto cifrado' : 'Codificado') : 'Texto claro';
  $('run-btn').textContent   = enc ? (c.strength ? '🔒 Cifrar' : '🔣 Codificar') : (c.strength ? '🔓 Descifrar' : '🔣 Decodificar');
  $('run-btn').disabled = !c.ready;
  $('crack-btn').disabled = !c.ready;
  $('swap').disabled = !!c.oneWay;
}
const keyArg = () => (cur().key === 'shift' ? state.shift : state.word);

function run() {
  const c = cur(), t = $('input').value;
  if (!c.ready) return;
  if (c.key === 'word' && !vigKey(state.word).length) return toast('Escribe una palabra clave');
  try {
    $('output').value = (state.mode === 'enc' ? c.enc : c.dec)(t, keyArg());
    setOutState('');
  } catch {
    $('output').value = '';
    setOutState('No es un texto válido para decodificar', 'hot');
  }
}
$('run-btn').addEventListener('click', run);

$('swap').addEventListener('click', () => {
  stopAttack(true);
  const a = $('input').value;
  $('input').value = $('output').value;
  $('output').value = a;
  state.mode = state.mode === 'enc' ? 'dec' : 'enc';
  $('swap').classList.toggle('spin');
  updateCounter(); updateLabels(); renderVisual(); setOutState('');
});

function updateCounter() { $('counter').textContent = `${$('input').value.length} / ${MAX}`; }
$('input').addEventListener('input', () => { updateCounter(); renderVisual(); });
$('clear-btn').addEventListener('click', () => { $('input').value = ''; $('output').value = ''; updateCounter(); renderVisual(); setOutState(''); });

function setOutState(text, cls) {
  $('out-status').textContent = text;
  $('out-status').className = 'out-status' + (cls ? ' ' + cls : '');
  $('pane-out').classList.toggle('cracking', cls === 'hot' && !!state.attack);
  $('pane-out').classList.toggle('found', cls === 'ok');
}

/* ── Copiar / compartir ──────────────────────────────────────────── */
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); } catch { toast('No se pudo copiar'); }
}
$('copy-btn').addEventListener('click', () => $('output').value ? copy($('output').value, 'Copiado') : toast('No hay nada que copiar'));

const b64url = s => b64enc(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => b64dec(s.replace(/-/g, '+').replace(/_/g, '/'));
$('share-btn').addEventListener('click', () => {
  const secret = state.mode === 'enc' ? $('output').value : $('input').value;
  if (!secret) return toast('Cifra algo primero');
  const url = `${location.origin}${location.pathname}#c=${state.cipher}&t=${b64url(secret)}`;
  copy(url, 'Enlace copiado · la clave no va incluida');
});
function loadFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const id = p.get('c'), t = p.get('t');
  if (!id || !CIPHERS[id] || !t) return false;
  let text; try { text = unb64url(t).slice(0, MAX); } catch { return false; }
  state.mode = 'dec';
  selectCipher(id);
  $('input').value = text;
  updateCounter(); renderVisual();
  history.replaceState(null, '', location.pathname);
  toast(cur().key ? 'Mensaje recibido · introduce la clave y pulsa Descifrar' : 'Mensaje recibido');
  return true;
}

/* ── Consola de ataque ───────────────────────────────────────────── */
const ES_FREQ = { A: 12.53, B: 1.42, C: 4.68, D: 5.86, E: 13.68, F: 0.69, G: 1.01, H: 0.7, I: 6.25, J: 0.44, K: 0.02, L: 4.97, M: 3.15,
  N: 6.71, 'Ñ': 0.31, O: 8.68, P: 2.51, Q: 0.88, R: 6.87, S: 7.98, T: 4.63, U: 3.93, V: 0.9, W: 0.01, X: 0.22, Y: 0.9, Z: 0.52 };
/** Chi-cuadrado frente al español: cuanto menor, más «suena» a español */
function spanishScore(text) {
  const A = alpha(), counts = Object.fromEntries([...A].map(c => [c, 0]));
  let total = 0;
  for (const ch of text.toUpperCase()) if (ch in counts) { counts[ch]++; total++; }
  if (!total) return Infinity;
  const sumF = [...A].reduce((s, c) => s + ES_FREQ[c], 0);
  return [...A].reduce((s, c) => { const e = total * ES_FREQ[c] / sumF; return s + (counts[c] - e) ** 2 / e; }, 0);
}

const log = (html) => { const el = $('console-log'); el.insertAdjacentHTML('beforeend', html + '\n'); el.scrollTop = el.scrollHeight; };
const escH = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const preview = s => escH(s.replace(/\s+/g, ' ').slice(0, 48)) + (s.length > 48 ? '…' : '');
const fmtNum = n => n.toLocaleString('es-ES');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function stopAttack(silent) {
  if (!state.attack) return;
  state.attack.stopped = true;
  if (!silent) log('<span class="warn">⏹ Ataque detenido por el usuario.</span>');
}
$('stop-btn').addEventListener('click', () => stopAttack(false));
$('close-console').addEventListener('click', () => { stopAttack(true); $('console').hidden = true; setOutState(''); });

async function crack() {
  const c = cur();
  if (!c.ready || state.attack) return;
  // El ataque trabaja sobre el texto cifrado: si estamos cifrando, lo pasamos a la izquierda
  if (state.mode === 'enc') {
    if (!$('output').value) run();
    if (!$('output').value) return toast('Escribe un mensaje primero');
    $('swap').click();
  }
  const target = $('input').value;
  if (!target.trim()) return toast('Pega un texto cifrado');

  const atk = state.attack = { stopped: false, t0: performance.now() };
  $('console').hidden = false;
  $('console-log').innerHTML = '';
  $('stop-btn').disabled = false;
  $('console').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const tick = setInterval(() => { $('st-time').textContent = ((performance.now() - atk.t0) / 1000).toFixed(1).replace('.', ',') + ' s'; }, 100);
  setOutState('probando…', 'hot');

  try {
    if (c.crack === 'brute') await crackCaesar(target, atk);
    else if (c.crack === 'trivial') await crackTrivial(target, atk, c);
    else if (c.crack === 'decode') await crackDecode(target, atk, c);
    else if (c.crack === 'freq') await crackVigenereTeaser(target, atk);
  } finally {
    clearInterval(tick);
    $('stop-btn').disabled = true;
    state.attack = null;
    if (atk.stopped) setOutState('detenido', '');
  }
}
$('crack-btn').addEventListener('click', crack);

function stats(tries, space, eta, pct) {
  $('st-tries').textContent = fmtNum(tries);
  $('st-space').textContent = space;
  $('st-eta').textContent = eta;
  $('progress').style.width = pct + '%';
}

async function crackCaesar(target, atk) {
  const n = alpha().length, keys = n - 1;
  $('console-title').textContent = 'fuerza bruta · césar';
  log(`<span class="dim">$ cryptolab crack --cipher=cesar --mode=bruteforce</span>`);
  log(`<span class="dim">› ${keys} claves posibles. Puntuación: parecido con las frecuencias del español (menor = mejor).</span>`);
  let best = { k: 0, score: Infinity, text: '' };
  for (let k = 1; k <= keys && !atk.stopped; k++) {
    const cand = caesar(target, -k), score = spanishScore(cand);
    const isBest = score < best.score;
    if (isBest) best = { k, score, text: cand };
    log(`clave ${String(k).padStart(2, '0')}  χ²=${score === Infinity ? '—' : score.toFixed(0).padStart(5)}  ${isBest ? '<span class="best">' : ''}${preview(cand)}${isBest ? '</span>' : ''}`);
    $('output').value = cand;                       // el textarea sigue a la consola
    stats(k, fmtNum(keys), '< 1 ms en un PC', (k / keys) * 100);
    await sleep(140);
  }
  if (atk.stopped) return;
  $('output').value = best.text;
  log(`\n<span class="hit">✔ Clave más probable: ${best.k}  →  «${preview(best.text)}»</span>`);
  log(`<span class="dim">› Aquí hemos ido despacio para que se vea; un ordenador real lo hace en menos de 1 ms.</span>`);
  setOutState(`clave ${best.k}`, 'ok');
}

async function crackTrivial(target, atk, c) {
  $('console-title').textContent = 'ataque · atbash';
  log(`<span class="dim">$ cryptolab crack --cipher=atbash</span>`);
  log(`<span class="dim">› Atbash no tiene clave: basta con conocer el método.</span>`);
  await sleep(500);
  if (atk.stopped) return;
  $('output').value = c.dec(target);
  stats(1, '1', 'instantáneo', 100);
  log(`<span class="hit">✔ Roto en 1 intento → «${preview($('output').value)}»</span>`);
  setOutState('roto en 1 intento', 'ok');
}

async function crackDecode(target, atk, c) {
  $('console-title').textContent = `ataque · ${c.name.toLowerCase()}`;
  log(`<span class="dim">$ cryptolab crack --cipher=${state.cipher}</span>`);
  log(`<span class="warn">› ${c.name} es una codificación, no un cifrado. No hay clave que buscar.</span>`);
  await sleep(500);
  if (atk.stopped) return;
  try {
    $('output').value = c.dec(target);
    stats(1, 'sin clave', 'instantáneo', 100);
    log(`<span class="hit">✔ Decodificado directamente → «${preview($('output').value)}»</span>`);
    setOutState('decodificado', 'ok');
  } catch {
    log(`<span class="warn">✘ El texto no es ${c.name} válido.</span>`);
    setOutState('texto no válido', 'hot');
  }
}

async function crackVigenereTeaser(target, atk) {
  $('console-title').textContent = 'análisis de frecuencias · vigenère';
  log(`<span class="dim">$ cryptolab crack --cipher=vigenere --mode=kasiski</span>`);
  log(`<span class="warn">› Maqueta: el ataque real (Kasiski + frecuencias) llegará en la versión final.</span>`);
  log(`<span class="dim">› Mostrará: 1) longitud probable de la clave, 2) cada letra como un César, 3) el texto saliendo poco a poco.</span>`);
  stats(0, '26ⁿ', 'segundos', 0);
  setOutState('');
}

/* ── Tema (misma preferencia que el portfolio) ───────────────────── */
$('theme-toggle').addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('portfolio-theme', t); } catch {}
});

/* ── Inicio ──────────────────────────────────────────────────────── */
if (!loadFromHash()) {
  selectCipher('cesar');
  $('input').value = 'Nos vemos en el foro al amanecer';
  updateCounter(); renderVisual();
}
