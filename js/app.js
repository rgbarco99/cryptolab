/* ════════════════════════════════════════════════════════════════════
   CryptoLab — app.js  (interfaz: catálogo, claves, visualizaciones,
   traductor y consola de ataques). La criptografía vive en ciphers.js
════════════════════════════════════════════════════════════════════ */
'use strict';

const $ = id => document.getElementById(id);
const MAX = 5000;
const DEFAULT_TEXT = 'Nos vemos en el foro al amanecer';
const SAMPLE_TEXT = 'El mensaje debe llegar antes del amanecer. Los barcos saldrán del puerto norte cuando la marea esté alta ' +
  'y nadie debe conocer la ruta. Si algo sale mal, quemad las cartas y esperad noticias en la vieja estación del tren. ' +
  'Confiamos en vosotros: el destino de la operación depende de que este secreto no salga de aquí.';
const GPU_PBKDF2 = 1e5;   // contraseñas/s que prueba una GPU potente contra PBKDF2 de 100.000 vueltas (aprox.)
const GPU_SHA = 2e10;     // SHA-256 por segundo en una GPU de gama alta (aprox.)

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
    key: 'shift', crack: 'brute', enye: true,
    enc: t => caesar(t, state.shift), dec: t => caesar(t, -state.shift),
    how: `<p>Julio César desplazaba cada letra <b>tres posiciones</b>: la A se convertía en D, la B en E… Al llegar a la Z se vuelve a empezar por la A.</p>
          <p>La clave es solo un número entre 1 y 25. Con desplazamiento 13 se llama <b>ROT13</b> y tiene una curiosidad: cifrar dos veces devuelve el original.</p>
          <p class="fact">💡 Solo hay 25 claves posibles. Un ordenador las prueba todas en menos de un milisegundo; a mano, en unos minutos.</p>`,
  },
  atbash: {
    name: 'Atbash', era: 'Hebreo antiguo · ~500 a. C.', strength: 1, strengthText: 'Ninguna',
    tagline: 'El alfabeto se da la vuelta: la A es la Z, la B es la Y…',
    key: null, crack: 'trivial', enye: true,
    enc: t => atbash(t), dec: t => atbash(t),
    how: `<p>Se escribe el alfabeto al revés debajo del normal y se sustituye cada letra por la de abajo. Aparece en textos bíblicos en hebreo.</p>
          <p class="fact">💡 No tiene clave: quien conozca el método puede leerlo. Cifrar y descifrar son exactamente la misma operación.</p>`,
  },
  vigenere: {
    name: 'Vigenère', era: 'Europa · 1553', strength: 2, strengthText: 'Baja',
    tagline: 'Un César distinto para cada letra, marcado por una palabra clave.',
    key: 'word', crack: 'freq', enye: true,
    enc: t => vigenere(t, state.word, 1), dec: t => vigenere(t, state.word, -1),
    how: `<p>La palabra clave se repite debajo del mensaje y cada letra de la clave indica cuánto desplazar la letra de arriba (A = 0, B = 1, C = 2…).</p>
          <p>Así, una misma letra del mensaje se cifra de formas distintas según su posición, lo que despista el análisis de frecuencias simple.</p>
          <p><b>Cómo se rompe:</b> si la clave mide 5, las letras 1, 6, 11… se cifraron con el mismo César. El <b>índice de coincidencia</b> revela esa longitud, y cada columna se resuelve como un César con las frecuencias del español.</p>
          <p class="fact">💡 Lo llamaron <i>le chiffre indéchiffrable</i> durante casi 300 años, hasta que Kasiski publicó cómo romperlo en 1863. Pulsa «Romper» con el texto de ejemplo para verlo.</p>`,
  },
  enigma: {
    name: 'Enigma', era: 'Alemania · 1923-1945', strength: 3, strengthText: 'Media',
    tagline: 'Rotores que giran con cada tecla: la sustitución cambia letra a letra.',
    key: 'enigma', crack: 'bombe',
    enc: t => enigma(t, state.enigma), dec: t => enigma(t, state.enigma),
    how: `<p>Cada pulsación hace avanzar el rotor derecho; cuando llega a su muesca arrastra al central, como un cuentakilómetros. La corriente atraviesa el <b>tablero de clavijas</b>, los tres rotores, rebota en el <b>reflector</b> y vuelve por el mismo camino.</p>
          <p>Solo tenía 26 teclas: las tildes desaparecen y la Ñ, los números y los signos pasan sin cifrar.</p>
          <p>Gracias al reflector la máquina es <b>recíproca</b>: con la misma configuración, cifrar y descifrar es lo mismo. Pero también provoca su gran defecto: <b>una letra nunca se cifra como sí misma</b>.</p>
          <p class="fact">💡 Con 3 de 5 rotores, posiciones, anillos y 10 cables había unos 158 trillones de configuraciones. Turing y Welchman diseñaron la <i>Bombe</i>, que aprovechaba ese defecto y las frases previsibles («WETTERBERICHT»: parte meteorológico) para descartar millones de configuraciones.</p>`,
  },
  aes: {
    name: 'AES-256', era: 'Estándar · 2001', strength: 5, strengthText: 'Muy alta',
    tagline: 'El cifrado que protege tu banca, tu WiFi y tus mensajes.',
    key: 'password', crack: 'dictionary', async: true,
    enc: t => aesEncrypt(t, state.password), dec: t => aesDecrypt(t, state.password),
    err: () => 'Contraseña incorrecta o mensaje alterado',
    how: `<p>Mezcla los datos en bloques de 16 bytes a lo largo de 14 rondas de sustituciones, permutaciones y combinaciones con la clave.</p>
          <p>Tu contraseña no es la clave: se pasa por <b>PBKDF2</b> 100.000 veces junto con una <b>sal</b> aleatoria para obtener 256 bits. Esa lentitud a propósito es lo que frena a quien intenta adivinarla.</p>
          <p>Usamos el modo <b>GCM</b>: cada mensaje lleva un <b>IV</b> aleatorio (por eso el resultado cambia cada vez) y una <b>etiqueta</b> que detecta cualquier manipulación.</p>
          <p class="fact">💡 Probar las 2<sup>256</sup> claves llevaría muchísimo más que la edad del universo. El punto débil real es la contraseña que eliges: pulsa «Romper» con «sunshine» y luego con algo largo y aleatorio.</p>`,
  },
  otp: {
    name: 'One-time pad', era: 'Vernam · 1917', strength: 5, strengthText: 'Perfecta (bien usado)',
    tagline: 'Una clave aleatoria tan larga como el mensaje, usada una sola vez.',
    key: 'pad', crack: 'impossible', enye: true,
    enc: t => otp(t, state.pad, 1), dec: t => otp(t, state.pad, -1),
    err: e => e.message,
    how: `<p>Es un Vigenère cuya clave es <b>totalmente aleatoria</b>, <b>tan larga como el mensaje</b> y <b>no se reutiliza nunca</b>. Si se cumplen las tres condiciones, el cifrado es matemáticamente irrompible (Shannon lo demostró en 1949).</p>
          <p>El problema es práctico: hay que hacer llegar al destinatario una clave tan larga como todos los mensajes que vayas a enviar, sin que nadie la vea.</p>
          <p class="fact">💡 Para cualquier texto cifrado existe una clave que lo convierte en cualquier mensaje de la misma longitud: «ATACAD» y «HUID YA» son igual de probables. Los soviéticos reutilizaron páginas de sus cuadernos y el proyecto Venona descifró miles de mensajes.</p>`,
  },
  rsa: {
    name: 'RSA', era: 'Rivest, Shamir y Adleman · 1977', strength: 5, strengthText: 'Muy alta (2048 bits)',
    tagline: 'Una clave para cerrar y otra distinta para abrir.',
    key: 'rsa', crack: 'factor',
    enc: t => rsaEncrypt(t, state.rsa),
    dec: t => { if (!state.rsa.d) throw new Error('Sin clave privada (d)'); return rsaDecrypt(t, state.rsa); },
    err: e => e.message === 'Sin clave privada (d)' ? 'No tienes la clave privada: prueba a romperla' : 'No es un texto cifrado con esta clave',
    how: `<p>Se eligen dos primos <b>p</b> y <b>q</b> y se multiplican: <b>n = p·q</b>. La clave pública es (n, e) y cualquiera puede cifrar con ella: <b>c = mᵉ mod n</b>.</p>
          <p>Para descifrar hace falta <b>d</b>, el inverso de e módulo (p−1)(q−1): <b>m = cᵈ mod n</b>. Calcular d es trivial si conoces p y q… e imposible en la práctica si solo conoces n.</p>
          <p>Aquí usamos primos pequeños para que puedas <b>romperlo</b>: el ataque factoriza n con el algoritmo rho de Pollard. Sube el tamaño y mira cómo se dispara el tiempo.</p>
          <p class="fact">⚠️ Esto es RSA «de libro»: sin relleno (OAEP) el mismo bloque da siempre el mismo resultado. En la vida real RSA se usa para intercambiar una clave AES o para firmar, no para cifrar textos largos.</p>`,
  },
  sha256: {
    name: 'SHA-256', era: 'NSA · 2001', strength: 5, strengthText: 'No se descifra',
    tagline: 'Una huella digital: siempre el mismo tamaño y sin vuelta atrás.',
    key: null, crack: 'hash', oneWay: true, async: true,
    enc: t => sha256(t),
    how: `<p>Convierte cualquier texto en 64 caracteres hexadecimales (256 bits). Cambiar una sola letra cambia la huella por completo: es el <b>efecto avalancha</b>.</p>
          <p>Se usa para comprobar que un archivo no ha cambiado, en firmas digitales, en Git y en Bitcoin.</p>
          <p class="fact">💡 No se puede «descifrar». Pero si la huella es de una contraseña común, basta con calcular la huella de millones de palabras y comparar. Por eso las contraseñas se guardan con <b>sal</b> y algoritmos lentos (bcrypt, Argon2), no con SHA-256 a secas. Pega aquí una huella o escribe una contraseña y pulsa «Romper».</p>`,
  },
  base64: {
    name: 'Base64', era: 'Codificación · 1987', strength: 0, strengthText: 'Ninguna: no es un cifrado',
    tagline: 'Convierte cualquier dato en texto seguro de enviar. No oculta nada.',
    key: null, crack: 'decode',
    enc: t => b64enc(t), dec: t => b64dec(t),
    how: `<p>Agrupa los bytes de 3 en 3 (24 bits) y los reparte en 4 trozos de 6 bits. Cada trozo (0-63) es un símbolo de A-Z, a-z, 0-9, + y /. Si al final faltan bytes se rellena con «=».</p>
          <p class="fact">⚠️ Es muy común confundirlo con cifrado. No tiene clave: cualquiera puede revertirlo. Ocupa un 33 % más que el original.</p>`,
  },
  morse: {
    name: 'Morse', era: 'Telégrafo · 1838', strength: 0, strengthText: 'Ninguna: no es un cifrado',
    tagline: 'Letras convertidas en puntos y rayas.',
    key: null, crack: 'decode',
    enc: t => morseenc(t), dec: t => morsedec(t),
    how: `<p>Cada letra es una secuencia de pulsos cortos (·) y largos (—). Las letras más frecuentes en inglés tienen los códigos más cortos: la E es un solo punto.</p>
          <p>La raya dura 3 puntos; entre letras se deja un silencio de 3 puntos y entre palabras, de 7.</p>
          <p class="fact">💡 Se separan letras con espacios y palabras con «/». Los acentos se pierden. Pulsa ▶ para escucharlo.</p>`,
  },
  hex: {
    name: 'Hexadecimal', era: 'Codificación', strength: 0, strengthText: 'Ninguna: no es un cifrado',
    tagline: 'Los bytes reales de tu texto, escritos en base 16.',
    key: null, crack: 'decode',
    enc: t => hexenc(t), dec: t => hexdec(t),
    how: `<p>Cada byte (0-255) se escribe con dos símbolos de 0-9 y a-f. Es como ven el texto los programas.</p>
          <p class="fact">💡 Fíjate en la «ñ» o en las tildes: ocupan dos bytes en UTF-8. Un emoji, cuatro.</p>`,
  },
};

/* ── Estado ──────────────────────────────────────────────────────── */
const state = {
  group: 'clasicos', cipher: 'cesar', mode: 'enc', attack: null, busy: false,
  shift: 3, word: 'CLAVE',
  enigma: { rotors: ['I', 'II', 'III'], pos: 'AAA', rings: 'AAA', plugs: '' },
  pad: '', password: 'sunshine', rsaBits: 16, rsa: null, aesInfo: null,
};
const cur = () => CIPHERS[state.cipher];
try { state.rsa = rsaGenerate(state.rsaBits); } catch { /* sin BigInt: el resto sigue funcionando */ }

/* ── Utilidades de presentación ──────────────────────────────────── */
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const preview = (s, n = 48) => escH(s.replace(/\s+/g, ' ').slice(0, n)) + (s.length > n ? '…' : '');
const fmtNum = n => n.toLocaleString('es-ES');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const big = n => { const s = n.toString(); return s.length > 28 ? s.slice(0, 12) + '…' + s.slice(-12) + ` (${s.length} cifras)` : s; };

/** Segundos → texto humano, hasta «más que la edad del universo» */
function humanTime(s) {
  if (!isFinite(s) || s > 4.3e17 * 1000) return 'más de mil veces la edad del universo';
  if (s > 4.3e17) return 'más que la edad del universo';
  const units = [[31557600e6, 'millones de años'], [31557600e3, 'mil años'], [31557600, 'años'], [86400, 'días'], [3600, 'horas'], [60, 'minutos'], [1, 'segundos']];
  for (const [u, name] of units) if (s >= u) {
    const v = s / u;
    return `${v < 10 ? v.toFixed(1).replace('.', ',') : fmtNum(Math.round(v))} ${name}`;
  }
  return s >= 1e-3 ? `${Math.round(s * 1000)} ms` : 'menos de 1 ms';
}

/* ── Selector ────────────────────────────────────────────────────── */
function renderGroups() {
  $('groups').innerHTML = GROUPS.map(g => `
    <button class="group-tab" role="tab" data-group="${g.id}" style="--g:${g.color}"
      aria-selected="${g.id === state.group}"><span class="gi">${g.icon}</span>${g.name}</button>`).join('');
}
function renderCiphers() {
  const g = GROUPS.find(x => x.id === state.group);
  $('ciphers').innerHTML = g.ciphers.map(id => `
    <button class="cipher-chip${id === state.cipher ? ' active' : ''}" data-cipher="${id}">${CIPHERS[id].name}</button>`).join('');
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
  stopAttack(true); stopMorse();
  state.cipher = id;
  state.group = GROUPS.find(g => g.ciphers.includes(id)).id;
  state.aesInfo = null;
  if (cur().oneWay && state.mode === 'dec') { state.mode = 'enc'; $('swap').classList.remove('spin'); }
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
  document.title = `${c.name} · CryptoLab`;
}
$('how-toggle').addEventListener('click', () => {
  const open = $('how').hidden;
  $('how').hidden = !open;
  $('how-toggle').setAttribute('aria-expanded', String(open));
});

/* ── Clave ───────────────────────────────────────────────────────── */
const enyeBox = () => `<label class="check"><input type="checkbox" data-k="enye" ${alpha().length === 27 ? 'checked' : ''}> Alfabeto con Ñ</label>`;
const rotorSelect = i => `<select class="key-select" data-k="rotor" data-i="${i}" aria-label="Rotor ${['izquierdo', 'central', 'derecho'][i]}">
  ${Object.keys(ROTORS).map(r => `<option${r === state.enigma.rotors[i] ? ' selected' : ''}>${r}</option>`).join('')}</select>`;

const KEY_UI = {
  shift: () => {
    const n = alpha().length;
    state.shift = Math.min(state.shift, n - 1);
    return `<span class="key-label">🔑 Desplazamiento</span>
      <input type="range" class="key-range" data-k="shift" min="1" max="${n - 1}" value="${state.shift}" aria-label="Desplazamiento">
      <span class="key-value" id="key-val">${state.shift}</span>${enyeBox()}`;
  },
  word: () => `<span class="key-label">🔑 Palabra clave</span>
      <input type="text" class="key-text" data-k="word" value="${escH(state.word)}" maxlength="64" autocomplete="off" spellcheck="false" aria-label="Palabra clave">${enyeBox()}`,
  enigma: () => {
    const e = state.enigma;
    return `<span class="key-label">🔑 Rotores</span>${[0, 1, 2].map(rotorSelect).join('')}
      <label class="field">Posición <input class="key-text short" data-k="pos" value="${e.pos}" maxlength="3" autocomplete="off" spellcheck="false"></label>
      <label class="field">Anillos <input class="key-text short" data-k="rings" value="${e.rings}" maxlength="3" autocomplete="off" spellcheck="false"></label>
      <label class="field grow">Clavijas <input class="key-text" data-k="plugs" value="${escH(e.plugs)}" placeholder="AB CD EF…" maxlength="40" autocomplete="off" spellcheck="false"></label>
      <span class="key-msg" id="key-msg"></span>`;
  },
  password: () => `<span class="key-label">🔑 Contraseña</span>
      <input type="password" class="key-text" data-k="password" id="pw" value="${escH(state.password)}" maxlength="128" autocomplete="off" spellcheck="false" aria-label="Contraseña">
      <button class="mini-btn bordered" data-k="peek" type="button">👁 Ver</button>
      <div class="pw-meter" id="pw-meter"></div>`,
  pad: () => `<span class="key-label">🔑 Clave aleatoria</span>
      <input type="text" class="key-text mono-sm" data-k="pad" value="${escH(state.pad)}" maxlength="${MAX}" autocomplete="off" spellcheck="false" placeholder="Pulsa Generar" aria-label="Clave del one-time pad">
      <button class="mini-btn bordered" data-k="gen-pad" type="button">🎲 Generar</button>${enyeBox()}
      <span class="key-msg" id="key-msg"></span>`,
  rsa: () => {
    const r = state.rsa || {};
    return `<span class="key-label">🔑 Primos de</span>
      <input type="range" class="key-range" data-k="bits" min="8" max="40" value="${state.rsaBits}" aria-label="Bits de cada primo">
      <span class="key-value" id="key-val">${state.rsaBits}</span><span class="key-unit">bits</span>
      <button class="mini-btn bordered" data-k="gen-rsa" type="button">🎲 Generar par de claves</button>
      <label class="field">p <input class="key-text num" data-k="p" value="${r.p ?? ''}" inputmode="numeric" autocomplete="off" placeholder="desconocido"></label>
      <label class="field">q <input class="key-text num" data-k="q" value="${r.q ?? ''}" inputmode="numeric" autocomplete="off" placeholder="desconocido"></label>
      <span class="key-msg" id="key-msg"></span>`;
  },
};

function renderKey() {
  const c = cur(), row = $('key-row');
  if (c.key) row.innerHTML = KEY_UI[c.key]();
  else if (c.enye) row.innerHTML = `<span class="key-none">Sin clave</span>${enyeBox()}`;
  else row.innerHTML = c.oneWay ? '<span class="key-none">Sin clave · solo en un sentido</span>' : '<span class="key-none">Sin clave</span>';
  if (c.key === 'password') renderPwMeter();
  if (c.key === 'pad') updatePadMsg();
  if (c.key === 'enigma') validateEnigma();
}

const keyMsg = (txt, bad) => { const m = $('key-msg'); if (m) { m.textContent = txt; m.classList.toggle('bad', !!bad); } };

function validateEnigma() {
  try { parsePlugboard(state.enigma.plugs); } catch (e) { keyMsg(e.message, true); return false; }
  const n = (state.enigma.plugs.toUpperCase().match(/[A-Z]{2}/g) || []).length;
  keyMsg(n ? `${n} cable${n > 1 ? 's' : ''} conectado${n > 1 ? 's' : ''}` : 'Sin cables (los militares usaban 10)');
  return true;
}
function updatePadMsg() {
  const need = lettersOf($('input').value).length, have = vigKey(state.pad).length;
  if (!have) keyMsg('');
  else keyMsg(have >= need ? `✔ ${have} letras para ${need}` : `✘ Faltan ${need - have} letras`, have < need);
}

/** Estimación de la resistencia de una contraseña frente a un atacante con GPU */
function passwordStrength(pw) {
  if (!pw) return { bits: 0, label: 'Vacía', secs: 0, lvl: 0 };
  const base = pw.toLowerCase().replace(/[^a-zñ]+/g, '');
  const inDict = COMMON_PASSWORDS.some(w => [...mutations(w)].includes(pw)) || (base.length >= 3 && COMMON_PASSWORDS.includes(base) && pw.length <= base.length + 4);
  if (inDict) return { bits: 0, label: 'En el diccionario', secs: 1, lvl: 1, dict: true };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(pool), secs = 2 ** bits / 2 / GPU_PBKDF2;
  const lvl = secs < 3600 ? 1 : secs < 31557600 ? 2 : secs < 31557600e3 ? 3 : secs < 31557600e9 ? 4 : 5;
  return { bits, secs, lvl, label: ['', 'Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'][lvl] };
}
function renderPwMeter() {
  const s = passwordStrength(state.password), m = $('pw-meter');
  if (!m) return;
  const detail = s.dict ? 'aparece en las listas de contraseñas filtradas: se adivina en segundos'
    : s.bits ? `≈ ${Math.round(s.bits)} bits · una GPU tardaría ${humanTime(s.secs)} de media` : 'escribe una contraseña';
  m.innerHTML = `<div class="pw-bars lvl${s.lvl}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= s.lvl ? 'on' : ''}"></i>`).join('')}</div>
    <span><b>${s.label}</b> · ${detail}</span>`;
}

function setRsaFromPQ() {
  const pv = $('key-row').querySelector('[data-k="p"]').value.trim(), qv = $('key-row').querySelector('[data-k="q"]').value.trim();
  if (!/^\d+$/.test(pv) || !/^\d+$/.test(qv)) return keyMsg('p y q deben ser números enteros', true);
  try {
    state.rsa = rsaKeys(BigInt(pv), BigInt(qv));
    keyMsg(`✔ n de ${bitLen(state.rsa.n)} bits`);
  } catch (e) { keyMsg(e.message, true); }
}

$('key-row').addEventListener('input', e => {
  const k = e.target.dataset.k, v = e.target.value;
  if (k === 'shift') { state.shift = +v; $('key-val').textContent = v; }
  else if (k === 'word') state.word = v;
  else if (k === 'enye') { setEnye(e.target.checked); renderKey(); }
  else if (k === 'rotor') {
    const i = +e.target.dataset.i, r = state.enigma.rotors, j = r.indexOf(v);
    if (j >= 0 && j !== i) r[j] = r[i];        // cada rotor físico solo existe una vez: se intercambian
    r[i] = v; renderKey();
  } else if (k === 'pos' || k === 'rings') {
    const clean = v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (clean !== v) e.target.value = clean;
    state.enigma[k] = clean.padEnd(3, 'A');
  } else if (k === 'plugs') { state.enigma.plugs = v; validateEnigma(); }
  else if (k === 'password') { state.password = v; renderPwMeter(); }
  else if (k === 'pad') { state.pad = v; updatePadMsg(); }
  else if (k === 'bits') { state.rsaBits = +v; $('key-val').textContent = v; return; }
  else if (k === 'p' || k === 'q') setRsaFromPQ();
  renderVisual();
});
$('key-row').addEventListener('click', e => {
  const k = e.target.closest('[data-k]')?.dataset.k;
  if (k === 'peek') {
    const pw = $('pw'); pw.type = pw.type === 'password' ? 'text' : 'password';
    e.target.textContent = pw.type === 'password' ? '👁 Ver' : '🙈 Ocultar';
  } else if (k === 'gen-pad') {
    const need = Math.max(lettersOf($('input').value).length, 1);
    state.pad = randomLetters(need); renderKey(); renderVisual();
    toast(`Clave de ${need} letras generada · úsala una sola vez`);
  } else if (k === 'gen-rsa') {
    state.rsa = rsaGenerate(state.rsaBits); renderKey(); renderVisual();
    keyMsg(`✔ Par nuevo · n de ${bitLen(state.rsa.n)} bits`);
  }
});

/* ── Visualizaciones ─────────────────────────────────────────────── */
function lastLetterIdx() {
  const A = alpha(), t = $('input').value.toUpperCase();
  for (let i = t.length - 1; i >= 0; i--) { const x = A.indexOf(t[i]); if (x >= 0) return x; }
  return -1;
}
const cells = (arr, cls = '', hi = -1) =>
  `<div class="alpha ${cls}">${arr.map((c, i) => `<span class="${i === hi ? 'hl' : ''}">${escH(c)}</span>`).join('')}</div>`;

function strip(map, caption) {
  const A = alpha(), hi = lastLetterIdx(), enc = state.mode === 'enc';
  const mapped = A.split('').map((_, i) => A[map(i)]);
  const top = enc ? [...A] : mapped, bot = enc ? mapped : [...A];
  return `${cells(top, enc ? '' : 'cipher', hi)}<div class="alpha-arrows">${[...A].map(() => '<span>↓</span>').join('')}</div>${cells(bot, enc ? 'cipher' : '', hi)}
          <p class="visual-caption">${caption}</p>`;
}
/** Tres filas alineadas: texto · clave · resultado (Vigenère y one-time pad) */
function keyedRows(ks, repeat, caption) {
  const A = alpha(), n = A.length;
  const letters = lettersOf($('input').value).split('').slice(0, 24);
  const sample = letters.length ? letters : [...'ESCRIBEUNMENSAJE'];
  const dir = state.mode === 'enc' ? 1 : -1;
  const keyAt = i => (repeat ? ks[i % ks.length] : ks[i]);
  const keyRow = sample.map((_, i) => (keyAt(i) === undefined ? '?' : A[keyAt(i)]));
  const outRow = sample.map((ch, i) => (keyAt(i) === undefined ? '?' : A[(((A.indexOf(ch) + dir * keyAt(i)) % n) + n) % n]));
  return `<div class="row-labels"><span>${state.mode === 'enc' ? 'texto' : 'cifrado'}</span><span>clave</span><span>${state.mode === 'enc' ? 'cifrado' : 'texto'}</span></div>
    <div class="rows">${cells(sample)}${cells(keyRow, 'cipher')}${cells(outRow)}</div>
    <p class="visual-caption">${caption}</p>`;
}

let visualToken = 0;
const VISUALS = {
  cesar: () => strip(i => (i + state.shift) % alpha().length, `Desplazamiento ${state.shift}: ${alpha()[0]} → ${alpha()[state.shift]}`),
  atbash: () => strip(i => alpha().length - 1 - i, 'El alfabeto se refleja como en un espejo'),
  vigenere: () => {
    const A = alpha(), ks = vigKey(state.word);
    if (!ks.length) return '<div class="visual-placeholder">Escribe una palabra clave</div>';
    return keyedRows(ks, true, `La clave se repite: ${ks.map(k => `${A[k]}=${k}`).join(', ')}. Cada ${ks.length} letras vuelve a empezar… y esa repetición es su punto débil.`);
  },
  otp: () => {
    const ks = vigKey(state.pad);
    if (!ks.length) return '<div class="visual-placeholder"><div><b>🎲</b>Pulsa «Generar» para crear una clave aleatoria tan larga como tu mensaje</div></div>';
    return keyedRows(ks, false, 'Como Vigenère, pero la clave nunca se repite: no queda ningún patrón que analizar.');
  },
  enigma: () => {
    if (!validateEnigma()) return '<div class="visual-placeholder">Revisa el tablero de clavijas</div>';
    const cfg = state.enigma, m = makeEnigma(cfg);
    let last = null;
    for (const ch of deaccent($('input').value.toUpperCase())) {
      const i = ALPHA_26.indexOf(ch);
      if (i >= 0) last = m.press(i);
    }
    const rotors = cfg.rotors.map((r, i) => `<div class="rotor"><small>Rotor ${r}</small>
        <span class="rotor-win"><i>${ALPHA_26[(ALPHA_26.indexOf(m.pos[i]) + 25) % 26]}</i><b>${m.pos[i]}</b><i>${ALPHA_26[(ALPHA_26.indexOf(m.pos[i]) + 1) % 26]}</i></span>
        <small>empezó en ${cfg.pos[i]}</small></div>`).join('');
    const names = ['Tecla', 'Clavijas', `Rotor ${cfg.rotors[2]}`, `Rotor ${cfg.rotors[1]}`, `Rotor ${cfg.rotors[0]}`, 'Reflector',
      `Rotor ${cfg.rotors[0]}`, `Rotor ${cfg.rotors[1]}`, `Rotor ${cfg.rotors[2]}`, 'Lámpara'];
    const path = last ? `<div class="signal">${last.path.map((x, i) => `<span class="sig${i === 0 || i === 9 ? ' end' : ''}${i === 5 ? ' refl' : ''}"><small>${names[i]}</small><b>${ALPHA_26[x]}</b></span>`).join('<i>→</i>')}</div>
      <p class="visual-caption">La tecla <b>${ALPHA_26[last.path[0]]}</b> enciende la lámpara <b>${ALPHA_26[last.out]}</b>. La señal va y vuelve por los rotores, así que nunca puede salir la misma letra que entró: Bletchley Park explotó ese defecto.</p>`
      : '<p class="visual-caption">Escribe un mensaje para ver el recorrido de la corriente por la máquina.</p>';
    return `<div class="rotors">${rotors}<div class="rotor refl-box"><small>Reflector</small><span class="rotor-win"><b>B</b></span><small>fijo</small></div></div>${path}`;
  },
  aes: () => {
    const flow = `<div class="flow">
        <span class="flow-box">🔑 contraseña</span><i>→</i>
        <span class="flow-box">PBKDF2 · ${fmtNum(PBKDF2_ITER)} vueltas<br><small>+ sal aleatoria</small></span><i>→</i>
        <span class="flow-box">clave de 256 bits</span><i>→</i>
        <span class="flow-box hot">AES-256-GCM<br><small>14 rondas · IV aleatorio</small></span><i>→</i>
        <span class="flow-box">cifrado + etiqueta</span></div>`;
    const a = state.aesInfo;
    if (!a) return flow + '<p class="visual-caption">Pulsa «Cifrar» para ver los bytes que se generan. Cifra dos veces lo mismo: el resultado será distinto.</p>';
    const hex = (b, cls) => [...b].map(x => `<span class="byte ${cls}">${x.toString(16).padStart(2, '0')}</span>`).join('');
    const ct = a.ct.slice(0, -16), tag = a.ct.slice(-16);
    return flow + `<div class="bytes">${hex(a.salt, 'b-salt')}${hex(a.iv, 'b-iv')}${hex(ct.slice(0, 48), 'b-ct')}${ct.length > 48 ? '<span class="byte more">…</span>' : ''}${hex(tag, 'b-tag')}</div>
      <div class="legend"><span class="b-salt">sal · 16 B</span><span class="b-iv">IV · 12 B</span><span class="b-ct">cifrado · ${ct.length} B</span><span class="b-tag">etiqueta · 16 B</span></div>
      ${a.key ? `<p class="visual-caption">Clave derivada: <code>${a.key.slice(0, 32)}…</code> — nunca viaja con el mensaje. Todo lo de arriba es público: sin la contraseña no sirve de nada.</p>` : ''}`;
  },
  rsa: () => {
    const r = state.rsa;
    if (!r) return '<div class="visual-placeholder">Tu navegador no admite BigInt</div>';
    const known = r.p !== undefined;
    const sample = utf8.encode(($('input').value || 'Hola')).slice(0, rsaBlockBytes(r.n));
    let m = 0n; for (const b of sample) m = (m << 8n) | BigInt(b);
    const c = modPow(m, r.e, r.n);
    const row = (k, v, tag) => `<div class="math-row"><span class="math-k">${k}</span><code>${v}</code><span class="tag ${tag}">${tag}</span></div>`;
    return `<div class="math">
      ${row('p, q', known ? `${r.p} · ${r.q}` : '?', 'secreto')}
      ${row('n = p·q', `${big(r.n)}  (${bitLen(r.n)} bits)`, 'público')}
      ${row('φ = (p−1)(q−1)', known ? big(r.phi) : '?', 'secreto')}
      ${row('e', r.e, 'público')}
      ${row('d = e⁻¹ mod φ', known ? big(r.d) : '?', 'secreto')}
    </div>
    <p class="visual-caption">Primer bloque (${sample.length} byte${sample.length > 1 ? 's' : ''}): m = ${m} → c = m<sup>e</sup> mod n = <b>${c}</b>${known ? ` → c<sup>d</sup> mod n = ${modPow(c, r.d, r.n)} ✔` : ''}.
      Una clave real usa n de 2048 bits (617 cifras).</p>`;
  },
  sha256: () => {
    const t = $('input').value, tok = ++visualToken;
    if (!t) return '<div class="visual-placeholder"><div><b>🧬</b>Escribe algo para ver su huella</div></div>';
    const chars = [...t], last = chars.pop(), alt = chars.join('') + String.fromCodePoint(last.codePointAt(0) ^ 1);
    Promise.all([sha256(t), sha256(alt)]).then(([h1, h2]) => {
      if (tok !== visualToken || state.cipher !== 'sha256') return;
      const d = bitDiff(h1, h2), mark = (h, o) => [...h].map((c, i) => `<span class="${c !== o[i] ? 'diff' : ''}">${c}</span>`).join('');
      $('visual').innerHTML = `<div class="hash-cmp">
          <div><small>«${preview(t, 30)}»</small><code>${mark(h1, h2)}</code></div>
          <div><small>«${preview(alt, 30)}» (1 bit distinto en la última letra)</small><code>${mark(h2, h1)}</code></div></div>
        <div class="avalanche"><div class="avalanche-fill" style="width:${(d / 256 * 100).toFixed(1)}%"></div></div>
        <p class="visual-caption">Efecto avalancha: <b>${d} de 256 bits</b> cambian (${Math.round(d / 2.56)} %). Lo ideal es el 50 %: imposible deducir nada del cambio.</p>`;
    });
    return $('visual').querySelector('.hash-cmp') ? $('visual').innerHTML : '<div class="visual-placeholder">Calculando…</div>';
  },
  base64: () => {
    const src = state.mode === 'enc' ? $('input').value : $('output').value;
    const bytes = utf8.encode(src || 'Hola').slice(0, 9);
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lbl = b => (b >= 33 && b < 127 ? String.fromCharCode(b) : b === 32 ? '␣' : b.toString(16));
    let html = '';
    for (let g = 0; g < bytes.length; g += 3) {
      const grp = [...bytes.slice(g, g + 3)];
      const bits = grp.map(b => b.toString(2).padStart(8, '0')).join('').padEnd(24, '·');
      const top = [0, 1, 2].map(i => `<span class="b-char${grp[i] === undefined ? ' pad' : ''}">${grp[i] === undefined ? '' : escH(lbl(grp[i]))}</span>`).join('');
      const bitRow = [...bits].map((b, i) => `<span class="bit by${(i / 8) | 0}${b === '·' ? ' pad' : ''}">${b}</span>`).join('');
      const six = [0, 1, 2, 3].map(i => {
        const part = bits.slice(i * 6, i * 6 + 6).replace(/·/g, '0');
        const valid = i * 6 < grp.length * 8;
        return `<span class="six">${valid ? parseInt(part, 2) : '—'}</span>`;
      }).join('');
      const syms = [0, 1, 2, 3].map(i => {
        const valid = i * 6 < grp.length * 8, v = parseInt(bits.slice(i * 6, i * 6 + 6).replace(/·/g, '0'), 2);
        return `<span class="sym">${valid ? B64[v] : '='}</span>`;
      }).join('');
      html += `<div class="b64-group"><div class="b64-row r8">${top}</div><div class="b64-row r24">${bitRow}</div><div class="b64-row r6">${six}</div><div class="b64-row r6">${syms}</div></div>`;
    }
    return `<div class="b64">${html}</div><p class="visual-caption">3 bytes (24 bits) → 4 grupos de 6 bits → 4 símbolos. Los «=» rellenan el último grupo.</p>`;
  },
  hex: () => {
    const src = (state.mode === 'enc' ? $('input').value : $('output').value) || 'Año 🔐';
    const chars = [...src].slice(0, 24);
    return `<div class="hexchars">${chars.map(ch => {
      const b = [...utf8.encode(ch)];
      return `<div class="hexchar${b.length > 1 ? ' multi' : ''}"><b>${ch === ' ' ? '␣' : escH(ch)}</b><span>${b.map(x => x.toString(16).padStart(2, '0')).join(' ')}</span></div>`;
    }).join('')}</div>
      <p class="visual-caption">Las letras sin tilde ocupan 1 byte; «ñ» y las vocales con tilde, 2; un emoji, 4 (resaltados).</p>`;
  },
  morse: () => {
    const code = state.mode === 'enc' ? morseenc($('input').value) : $('input').value.trim();
    if (!code) return '<div class="visual-placeholder">Escribe un mensaje</div>';
    const glyphs = [...code].map(c => (c === '.' ? '<i class="dot"></i>' : c === '-' ? '<i class="dash"></i>' : c === '/' ? '<i class="wsep"></i>' : '<i class="lsep"></i>')).join('');
    return `<div class="morse-head"><div class="lamp" id="lamp" aria-hidden="true"></div>
        <button class="mini-btn bordered" id="morse-play" type="button">${morse.playing ? '⏹ Parar' : '▶ Escuchar'}</button>
        <span class="visual-caption">a 15 palabras por minuto, como un telegrafista entrenado</span></div>
      <div class="morse-line">${glyphs}</div>`;
  },
};

function renderVisual() { $('visual').innerHTML = VISUALS[state.cipher](); }

/* ── Morse sonoro (Web Audio) ────────────────────────────────────── */
const morse = { playing: false, ctx: null, timers: [] };
function stopMorse() {
  morse.timers.forEach(clearTimeout); morse.timers = [];
  if (morse.ctx) { morse.ctx.close(); morse.ctx = null; }
  morse.playing = false;
  $('lamp')?.classList.remove('on');
  const b = $('morse-play'); if (b) b.textContent = '▶ Escuchar';
}
function playMorse(code) {
  stopMorse();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return toast('Tu navegador no admite audio');
  const ctx = morse.ctx = new AC(), unit = 0.08;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.frequency.value = 620; gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination); osc.start();
  let t = 0.1;
  const on = (dur) => {
    const start = ctx.currentTime + t;
    gain.gain.setTargetAtTime(0.25, start, 0.004); gain.gain.setTargetAtTime(0, start + dur, 0.004);
    morse.timers.push(setTimeout(() => $('lamp')?.classList.add('on'), t * 1000));
    morse.timers.push(setTimeout(() => $('lamp')?.classList.remove('on'), (t + dur) * 1000));
    t += dur + unit;                 // 1 unidad de silencio entre símbolos
  };
  for (const c of code) {
    if (c === '.') on(unit);
    else if (c === '-') on(unit * 3);
    else if (c === ' ') t += unit * 2;   // +1 ya puesto = 3 entre letras
    else if (c === '/') t += unit * 4;   // con los espacios de alrededor = 7 entre palabras
  }
  morse.playing = true;
  morse.timers.push(setTimeout(stopMorse, (t + 0.2) * 1000));
  $('morse-play').textContent = '⏹ Parar';
}
$('visual').addEventListener('click', e => {
  if (e.target.id !== 'morse-play') return;
  if (morse.playing) return stopMorse();
  const code = state.mode === 'enc' ? morseenc($('input').value) : $('input').value.trim();
  if (code) playMorse(code);
});

/* ── Traductor ───────────────────────────────────────────────────── */
function updateLabels() {
  const enc = state.mode === 'enc', c = cur();
  $('in-label').textContent  = enc ? (c.oneWay ? 'Texto o huella' : 'Texto claro') : (c.strength ? 'Texto cifrado' : 'Codificado');
  $('out-label').textContent = enc ? (c.oneWay ? 'Huella' : c.strength ? 'Texto cifrado' : 'Codificado') : 'Texto claro';
  $('run-btn').textContent   = enc ? (c.oneWay ? '🧬 Calcular huella' : c.strength ? '🔒 Cifrar' : '🔣 Codificar') : (c.strength ? '🔓 Descifrar' : '🔣 Decodificar');
  $('crack-btn').textContent = c.crack === 'impossible' ? '⚡ Intentar romper' : '⚡ Romper';
  $('swap').disabled = !!c.oneWay;
}

async function run() {
  const c = cur(), t = $('input').value;
  if (state.busy) return;
  if (c.key === 'word' && !vigKey(state.word).length) return toast('Escribe una palabra clave');
  if (c.key === 'enigma' && !validateEnigma()) return toast('Revisa el tablero de clavijas');
  if (c.key === 'password' && !state.password) return toast('Escribe una contraseña');
  if (c.key === 'pad' && !vigKey(state.pad).length) return toast('Genera una clave primero');
  state.busy = true; $('run-btn').disabled = true;
  if (c.async) setOutState('calculando…');
  try {
    $('output').value = await (state.mode === 'enc' ? c.enc : c.dec)(t);
    setOutState('');
    if (state.cipher === 'aes') await captureAesInfo(state.mode === 'enc' ? $('output').value : t);
  } catch (e) {
    $('output').value = '';
    setOutState(c.err ? c.err(e) : 'No es un texto válido para decodificar', 'hot');
  } finally {
    state.busy = false; $('run-btn').disabled = false;
    renderVisual();
  }
}
/** Guarda las piezas del mensaje AES para dibujarlas (y re-deriva la clave para enseñarla) */
async function captureAesInfo(b64) {
  try {
    const parts = aesParse(b64);
    const key = await deriveKey(state.password, parts.salt);
    state.aesInfo = { ...parts, key: toHex(new Uint8Array(await crypto.subtle.exportKey('raw', key))) };
  } catch { state.aesInfo = null; }
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
$('input').addEventListener('input', () => {
  updateCounter();
  if (cur().key === 'pad') updatePadMsg();
  if (state.cipher !== 'aes') renderVisual();
});
$('clear-btn').addEventListener('click', () => {
  $('input').value = ''; $('output').value = ''; state.aesInfo = null;
  updateCounter(); renderVisual(); setOutState('');
});
$('sample-btn').addEventListener('click', () => {
  if (state.mode === 'dec') $('swap').click();
  $('input').value = SAMPLE_TEXT; $('output').value = '';
  updateCounter(); renderVisual(); setOutState('');
  if (cur().key === 'pad') updatePadMsg();
  toast('Texto largo cargado · los ataques estadísticos necesitan muchas letras');
});

function setOutState(text, cls) {
  $('out-status').textContent = text;
  $('out-status').className = 'out-status' + (cls ? ' ' + cls : '');
  $('pane-out').classList.toggle('cracking', cls === 'hot' && !!state.attack);
  $('pane-out').classList.toggle('found', cls === 'ok');
}

/* ── Copiar / compartir ──────────────────────────────────────────── */
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600);
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
  let url = `${location.origin}${location.pathname}#c=${state.cipher}&t=${b64url(secret)}`;
  // En RSA la clave pública puede viajar a la vista: es justo para lo que existe
  if (state.cipher === 'rsa') url += `&n=${state.rsa.n}&e=${state.rsa.e}`;
  copy(url, state.cipher === 'rsa' ? 'Enlace copiado · incluye solo la clave pública' : 'Enlace copiado · la clave no va incluida');
});
function loadFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const id = p.get('c'), t = p.get('t');
  if (!id || !CIPHERS[id] || !t) return false;
  let text; try { text = unb64url(t).slice(0, MAX); } catch { return false; }
  if (id === 'rsa' && /^\d+$/.test(p.get('n') || '') && /^\d+$/.test(p.get('e') || '')) {
    state.rsa = { n: BigInt(p.get('n')), e: BigInt(p.get('e')) };   // sin p, q ni d
  }
  state.mode = CIPHERS[id].oneWay ? 'enc' : 'dec';
  selectCipher(id);
  $('input').value = text;
  updateCounter(); renderVisual();
  history.replaceState(null, '', location.pathname);
  toast(id === 'rsa' ? 'Mensaje recibido · solo tienes la clave pública: ¿podrás romperla?'
    : cur().key ? 'Mensaje recibido · introduce la clave y pulsa Descifrar' : 'Mensaje recibido');
  return true;
}

/* ── Consola de ataque ───────────────────────────────────────────── */
const log = (html) => { const el = $('console-log'); el.insertAdjacentHTML('beforeend', html + '\n'); el.scrollTop = el.scrollHeight; };

function stopAttack(silent) {
  if (!state.attack) return;
  state.attack.stopped = true;
  if (!silent) log('<span class="warn">⏹ Ataque detenido por el usuario.</span>');
}
$('stop-btn').addEventListener('click', () => stopAttack(false));
$('close-console').addEventListener('click', () => { stopAttack(true); $('console').hidden = true; setOutState(''); });

const ATTACKS = {
  brute: crackCaesar, trivial: crackTrivial, decode: crackDecode, freq: crackVigenere,
  bombe: crackEnigma, dictionary: crackAes, impossible: crackOtp, factor: crackRsa, hash: crackHash,
};

async function crack() {
  const c = cur();
  if (state.attack || state.busy) return;
  // El ataque trabaja sobre el texto cifrado: si estamos cifrando, ciframos el texto ACTUAL
  // (la salida podría ser de una versión anterior) y lo pasamos a la izquierda
  if (state.mode === 'enc' && !c.oneWay) {
    if (!$('input').value.trim()) return toast('Escribe un mensaje primero');
    await run();
    if (!$('output').value) return toast('Escribe un mensaje primero');
    $('swap').click();
  }
  const target = $('input').value;
  if (!target.trim()) return toast(c.oneWay ? 'Escribe una contraseña o pega una huella' : 'Pega un texto cifrado');

  const atk = state.attack = { stopped: false, t0: performance.now() };
  $('console').hidden = false;
  $('console-log').innerHTML = '';
  $('stop-btn').disabled = false;
  stats(0, '—', '—', 0);
  $('console').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const tick = setInterval(() => { $('st-time').textContent = ((performance.now() - atk.t0) / 1000).toFixed(1).replace('.', ',') + ' s'; }, 100);
  setOutState('probando…', 'hot');

  try {
    await ATTACKS[c.crack](target, atk, c);
  } catch (e) {
    log(`<span class="warn">✘ Error inesperado: ${escH(e.message)}</span>`);
    setOutState('');
  } finally {
    clearInterval(tick);
    $('st-time').textContent = ((performance.now() - atk.t0) / 1000).toFixed(1).replace('.', ',') + ' s';
    $('stop-btn').disabled = true;
    state.attack = null;
    if (atk.stopped) setOutState('detenido', '');
  }
}
$('crack-btn').addEventListener('click', crack);

function stats(tries, space, eta, pct) {
  $('st-tries').textContent = typeof tries === 'number' ? fmtNum(tries) : tries;
  $('st-space').textContent = space;
  $('st-eta').textContent = eta;
  $('progress').style.width = pct + '%';
}
const header = (title, cmd) => { $('console-title').textContent = title; log(`<span class="dim">$ cryptolab crack ${cmd}</span>`); };
const bar = (v, max, w = 24) => '█'.repeat(Math.round((v / max) * w)).padEnd(w, '░');

/* César: 25 claves, se prueban todas */
async function crackCaesar(target, atk) {
  const n = alpha().length, keys = n - 1;
  header('fuerza bruta · césar', '--cipher=cesar --mode=bruteforce');
  log(`<span class="dim">› ${keys} claves posibles. Puntuación: parecido con las frecuencias del español (χ², menor = mejor).</span>`);
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
  header('ataque · atbash', '--cipher=atbash');
  log(`<span class="dim">› Atbash no tiene clave: basta con conocer el método.</span>`);
  await sleep(500);
  if (atk.stopped) return;
  $('output').value = c.dec(target);
  stats(1, '1', 'instantáneo', 100);
  log(`<span class="hit">✔ Roto en 1 intento → «${preview($('output').value)}»</span>`);
  setOutState('roto en 1 intento', 'ok');
}

async function crackDecode(target, atk, c) {
  header(`ataque · ${c.name.toLowerCase()}`, `--cipher=${state.cipher}`);
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

/* Vigenère: 1) longitud de la clave con el índice de coincidencia, 2) un César por columna */
async function crackVigenere(target, atk) {
  const A = alpha(), letters = lettersOf(target);
  header('análisis de frecuencias · vigenère', '--cipher=vigenere --mode=kasiski');
  log(`<span class="dim">› ${letters.length} letras cifradas. Índice de coincidencia (IC) del texto completo: ${indexOfCoincidence(letters).toFixed(4)}</span>`);
  log(`<span class="dim">  (español ≈ 0,0750 · letras al azar ≈ ${(1 / A.length).toFixed(4)}: está «aplanado», hay varios alfabetos mezclados)</span>`);
  if (letters.length < 60) log(`<span class="warn">⚠ Texto corto: con menos de ~60 letras la estadística falla a menudo. Prueba con «📄 Ejemplo».</span>`);

  const dists = kasiski(letters).slice(0, 6);
  if (dists.length) log(`\n<span class="dim">Paso 0 · Kasiski: trigramas repetidos a distancias ${dists.join(', ')} → la clave suele dividir esas distancias.</span>`);

  log(`\n<b>Paso 1 · ¿Cuánto mide la clave?</b> Separamos el texto en L columnas y medimos su IC:`);
  const { L, scores } = guessKeyLength(letters);
  const maxIc = Math.max(...scores.map(s => s.ic));
  for (const s of scores) {
    if (atk.stopped) return;
    log(`  L=${String(s.L).padStart(2)}  ${bar(s.ic, maxIc)}  ${s.ic.toFixed(4)}${s.L === L ? '  <span class="best">← parece español</span>' : ''}`);
    stats(s.L, `${A.length}ⁿ`, 'unos ms', (s.L / scores.length) * 40);
    await sleep(90);
  }
  log(`<span class="hit">→ Longitud más probable: ${L}</span>`);

  log(`\n<b>Paso 2 · Cada columna es un César.</b> Probamos los ${A.length} desplazamientos de cada una:`);
  const ks = [];
  for (let c = 0; c < L && !atk.stopped; c++) {
    let col = '';
    for (let i = c; i < letters.length; i += L) col += letters[i];
    const sol = solveColumn(col);
    ks.push(sol.shift);
    const partial = ks.map(k => A[k]).join('') + '·'.repeat(L - ks.length);
    log(`  columna ${c + 1}: ${preview(col, 18).padEnd(19)} → desplazamiento ${String(sol.shift).padStart(2)} = <span class="best">${A[sol.shift]}</span>   clave: ${partial}`);
    // El texto va apareciendo: las columnas aún sin resolver se quedan cifradas
    $('output').value = mapLetters(target, (x, i) => (i % L < ks.length ? x - ks[i % L] : x));
    stats(A.length * (c + 1), `${A.length}^${L}`, 'unos ms', 40 + (60 * (c + 1)) / L);
    await sleep(350);
  }
  if (atk.stopped) return;
  const key = ks.map(k => A[k]).join('');
  $('output').value = vigenere(target, key, -1);
  log(`\n<span class="hit">✔ Clave encontrada: ${key}  →  «${preview($('output').value)}»</span>`);
  log(`<span class="dim">› Fuerza bruta habría necesitado ${fmtNum(A.length ** Math.min(L, 12))}${L > 12 ? '…' : ''} intentos; la estadística solo ${fmtNum(L * A.length)}.</span>`);
  stats(L * A.length, `${A.length}^${L} = ${fmtNum(A.length ** Math.min(L, 15))}`, 'milisegundos', 100);
  setOutState(`clave ${key}`, 'ok');
}

/* Enigma: Bombe simplificada (60 órdenes de rotores × 17.576 posiciones, puntuando con χ²) */
async function crackEnigma(target, atk) {
  const letters = lettersOf(deaccent(target), ALPHA_26).replace(/Ñ/g, '');
  const idx = [...letters.slice(0, 90)].map(c => ALPHA_26.indexOf(c));
  const total = ROTOR_ORDERS.length * 17576;
  header('bombe · enigma', '--cipher=enigma --mode=bombe');
  log(`<span class="dim">› Supuestos de esta Bombe simplificada: anillos en AAA y sin tablero de clavijas.</span>`);
  log(`<span class="dim">› Probaremos ${ROTOR_ORDERS.length} órdenes de rotores × 17.576 posiciones = ${fmtNum(total)} configuraciones con ${idx.length} letras.</span>`);
  if (state.enigma.plugs.trim() || state.enigma.rings !== 'AAA')
    log(`<span class="warn">⚠ Tu configuración usa ${state.enigma.plugs.trim() ? 'tablero' : ''}${state.enigma.plugs.trim() && state.enigma.rings !== 'AAA' ? ' y ' : ''}${state.enigma.rings !== 'AAA' ? 'anillos' : ''}: es probable que este ataque falle. Así de importantes eran.</span>`);
  if (idx.length < 50) log(`<span class="warn">⚠ Solo ${idx.length} letras: con tan poco texto muchas configuraciones falsas «parecen» español. Prueba con «📄 Ejemplo».</span>`);
  log('');
  let best = [], done = 0;
  const t0 = performance.now();
  for (const order of ROTOR_ORDERS) {
    if (atk.stopped) return;
    const res = bombeScan(idx, order, 1)[0];
    best.push(res); best.sort((a, b) => a.score - b.score);
    done += 17576;
    const isTop = best[0] === res, rate = done / ((performance.now() - t0) / 1000);
    log(`${order.join('-').padEnd(9)} mejor ${res.pos}  χ²=${res.score.toFixed(0).padStart(5)}  ${isTop ? '<span class="best">' : ''}${preview(enigma(target, { rotors: order, pos: res.pos, rings: 'AAA' }), 34)}${isTop ? '</span>' : ''}`);
    stats(done, '158·10¹⁸', `${fmtNum(Math.round(rate))} config/s`, (done / total) * 100);
    await sleep(0);
  }
  const b = best[0], cfg = { rotors: b.rotors, pos: b.pos, rings: 'AAA', plugs: '' };
  $('output').value = enigma(target, cfg);
  const secs = (performance.now() - t0) / 1000;
  log(`\n<span class="hit">✔ Configuración más probable: rotores ${b.rotors.join('-')}, posición ${b.pos}  →  «${preview($('output').value)}»</span>`);
  log(`<span class="dim">› ${fmtNum(total)} configuraciones en ${secs.toFixed(1).replace('.', ',')} s. Con las 150 billones de combinaciones del tablero serían ${humanTime(secs * 150e12)}.</span>`);
  log(`<span class="dim">› La Bombe real no probaba el tablero a ciegas: partía de una palabra adivinada (crib) y descartaba configuraciones por contradicción lógica.</span>`);
  setOutState(`${b.rotors.join('-')} · ${b.pos}`, 'ok');
}

/* AES: el cifrado es inexpugnable; se ataca la contraseña con un diccionario */
async function crackAes(target, atk) {
  header('ataque de diccionario · aes-256', '--cipher=aes --mode=dictionary');
  let parts;
  try { parts = aesParse(target); } catch { log('<span class="warn">✘ Esto no parece un mensaje de AES-GCM en Base64.</span>'); return setOutState('texto no válido', 'hot'); }
  log(`<span class="dim">› Probar las 2²⁵⁶ claves es imposible. Pero la clave sale de una contraseña… y la gente elige mal.</span>`);
  log(`<span class="dim">› Cada intento obliga a repetir PBKDF2 ${fmtNum(PBKDF2_ITER)} veces: esa lentitud es la defensa.</span>\n`);
  const words = [...new Set(COMMON_PASSWORDS)];
  const pass2 = [...new Set(words.flatMap(w => [...mutations(w)]))].filter(w => !words.includes(w));
  const all = words.concat(pass2), total = all.length;
  let tries = 0;
  const t0 = performance.now();
  for (const pw of all) {
    if (atk.stopped) return;
    tries++;
    if (tries === words.length + 1) log(`\n<span class="dim">› Nada en la lista básica. Ahora las variaciones típicas: Mayúscula, 123, !, 2025, l33t…</span>`);
    let ok = false;
    try {
      const key = await deriveKey(pw, parts.salt);
      $('output').value = utf8d.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: parts.iv }, key, parts.ct));
      ok = true;
    } catch { /* etiqueta GCM incorrecta = contraseña incorrecta */ }
    const rate = tries / ((performance.now() - t0) / 1000);
    if (ok) {
      log(`<span class="hit">✔ ¡Contraseña encontrada en el intento ${fmtNum(tries)}: «${escH(pw)}»</span>`);
      log(`<span class="dim">› Texto: «${preview($('output').value)}»</span>`);
      log(`<span class="dim">› Tu navegador prueba ~${fmtNum(Math.round(rate))}/s. Una GPU potente, ~${fmtNum(GPU_PBKDF2)}/s. Las listas reales tienen miles de millones.</span>`);
      stats(tries, fmtNum(total), humanTime(tries / GPU_PBKDF2) + ' (GPU)', 100);
      return setOutState(`contraseña: ${pw}`, 'ok');
    }
    if (tries <= words.length || tries % 25 === 0) log(`<span class="dim">✘ ${escH(pw)}</span>`);
    stats(tries, fmtNum(total), `${humanTime((total - tries) / rate)} restantes`, (tries / total) * 100);
  }
  $('output').value = '';
  log(`\n<span class="warn">✘ La contraseña no está en el diccionario (${fmtNum(total)} candidatas).</span>`);
  log(`<span class="dim">› Ahí está la lección: AES no se rompe. Con una contraseña larga y aleatoria, ni las GPU llegan.</span>`);
  setOutState('resistió', '');
}

/* One-time pad: no se puede romper porque CUALQUIER mensaje es posible */
async function crackOtp(target, atk) {
  const A = alpha(), letters = lettersOf(target), n = letters.length;
  header('intento de ataque · one-time pad', '--cipher=otp --mode=bruteforce');
  log(`<span class="dim">› ${n} letras cifradas → ${A.length}^${n} claves posibles. Pero el problema no es el número…</span>`);
  log(`<span class="dim">› Para cada mensaje imaginable existe una clave que lo produce. Mira:</span>\n`);
  const FAKES = ['ATACAD AL AMANECER POR EL FLANCO NORTE', 'HUID YA NOS HAN DESCUBIERTO TODOS', 'EL PAQUETE LLEGA EL MARTES A LAS NUEVE',
    'NO HAY NADA QUE DECIR TODO VA BIEN POR AQUI', 'COMPRA PAN LECHE HUEVOS Y DOS MANZANAS', 'TE QUIERO NOS VEMOS EN LA PLAZA MAYOR'];
  const toLen = s => { const l = lettersOf(s, A); return l.repeat(Math.ceil(n / l.length)).slice(0, n); };
  for (const [i, f] of FAKES.entries()) {
    if (atk.stopped) return;
    const fake = toLen(f), key = otpKeyFor(target, fake);
    const shown = mapLetters(target, (x, j) => x - A.indexOf(key[j]));
    $('output').value = shown;
    log(`clave ${preview(key, 22).padEnd(23)} → «${preview(shown, 44)}»`);
    stats(i + 1, `${A.length}^${n}`, 'infinito', ((i + 1) / FAKES.length) * 100);
    await sleep(700);
  }
  log(`\n<span class="hit">✔ Todos son descifrados «válidos». Sin la clave, no hay forma de saber cuál era el mensaje.</span>`);
  log(`<span class="dim">› Esto es el secreto perfecto de Shannon. Su único punto débil: reutilizar la clave o que no sea aleatoria.</span>`);
  log(`<span class="dim">› ¿Ves los espacios raros? El cifrado los conserva y delata la longitud de cada palabra: por eso los espías escribían en bloques de 5 letras.</span>`);
  setOutState('irrompible', '');
}

/* RSA: factorizar n con rho de Pollard; con p y q se calcula d y se descifra */
async function crackRsa(target, atk) {
  const r = state.rsa, n = r.n, bits = bitLen(n);
  header('factorización · rsa', '--cipher=rsa --mode=pollard-rho');
  log(`<span class="dim">› Clave pública: n = ${big(n)} (${bits} bits), e = ${r.e}</span>`);
  log(`<span class="dim">› Si encontramos p y q tales que p·q = n, podremos calcular d igual que su dueño.</span>`);
  log(`<span class="dim">› Algoritmo rho de Pollard: ~n^¼ ≈ ${fmtNum(Math.round(2 ** (bits / 4)))} pasos esperados.</span>\n`);
  const gen = pollardRho(n), t0 = performance.now(), expected = 2 ** (bits / 4);
  let res, lastLog = 0;
  for (;;) {
    const slice = performance.now();
    do res = gen.next(); while (!res.done && performance.now() - slice < 30);
    if (res.done) break;
    if (atk.stopped) return;
    const it = res.value;
    stats(it, `n de ${bits} bits`, `~${fmtNum(Math.round(expected))} pasos`, Math.min(95, (it / expected) * 60));
    if (performance.now() - lastLog > 700) { log(`<span class="dim">  … ${fmtNum(it)} pasos</span>`); lastLog = performance.now(); }
    await sleep(0);
  }
  const p = res.value, q = n / p, secs = (performance.now() - t0) / 1000;
  log(`<span class="hit">✔ n = ${p} × ${q}   (${humanTime(secs)})</span>`);
  const k = rsaKeys(p < q ? p : q, p < q ? q : p);
  log(`  φ = (p−1)(q−1) = ${big(k.phi)}`);
  log(`  d = e⁻¹ mod φ = <span class="best">${big(k.d)}</span>  ← la clave privada`);
  try {
    $('output').value = rsaDecrypt(target, { ...k, e: r.e, d: modInv(r.e, k.phi) });
    log(`<span class="hit">✔ Mensaje: «${preview($('output').value)}»</span>`);
    setOutState('clave privada recuperada', 'ok');
  } catch { log('<span class="warn">✘ Hemos factorizado n, pero el texto no estaba cifrado con esta clave.</span>'); setOutState('factorizado', 'ok'); }
  // Extrapolación: rho crece como 2^(bits/4); para 2048 bits se usa la criba de cuerpos de números (GNFS), también inviable
  const per = secs / Math.max(1, expected);
  log(`\n<span class="dim">› Con este método, n de 128 bits tardaría ~${humanTime(per * 2 ** 32)}; de 256 bits, ~${humanTime(per * 2 ** 64)}.</span>`);
  log(`<span class="dim">› Récord público: RSA-250 (829 bits) en 2020, ~2.700 años de CPU con el mejor algoritmo conocido. Las claves reales tienen 2048 bits.</span>`);
  stats('✔', `n de ${bits} bits`, `2048 bits: ${humanTime(1e30)}`, 100);
  state.rsa = { ...k, e: r.e, d: modInv(r.e, k.phi) };
  renderKey(); renderVisual();
}

/* SHA-256: no se invierte; se adivina la entrada comparando huellas */
async function crackHash(target, atk) {
  header('ataque de diccionario · sha-256', '--cipher=sha256 --mode=dictionary');
  let hash = target.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    hash = await sha256(target);
    $('output').value = hash;
    log(`<span class="dim">› Calculamos la huella de tu texto y fingimos que es lo único que ha robado el atacante:</span>`);
    log(`<span class="dim">  ${hash}</span>`);
  } else log(`<span class="dim">› Huella objetivo: ${hash}</span>`);
  log(`<span class="dim">› Estrategia: calcular la huella de muchas contraseñas típicas y comparar.</span>\n`);
  const all = [...new Set(COMMON_PASSWORDS.flatMap(w => [...mutations(w)]))], total = all.length;
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (atk.stopped) return;
    const h = await sha256(all[i]);
    if (h === hash) {
      const rate = (i + 1) / ((performance.now() - t0) / 1000);
      $('output').value = all[i];
      log(`<span class="hit">✔ ¡Coincide! sha256(«${escH(all[i])}») = ${hash.slice(0, 16)}…  (intento ${fmtNum(i + 1)})</span>`);
      log(`<span class="dim">› Tu navegador: ~${fmtNum(Math.round(rate))} huellas/s. Una GPU: ~${fmtNum(GPU_SHA)}/s.</span>`);
      log(`<span class="dim">› Por eso las webs serias guardan contraseñas con sal + bcrypt/Argon2: lentos a propósito.</span>`);
      stats(i + 1, fmtNum(total), 'instantáneo', 100);
      return setOutState(`entrada: ${all[i]}`, 'ok');
    }
    if (i % 60 === 0) {
      log(`<span class="dim">✘ ${escH(all[i]).padEnd(16)} ${h.slice(0, 24)}…</span>`);
      stats(i + 1, fmtNum(total), '—', ((i + 1) / total) * 100);
      await sleep(16);
    }
  }
  const len = target.trim().length;
  log(`\n<span class="warn">✘ No está entre las ${fmtNum(total)} contraseñas del diccionario.</span>`);
  log(`<span class="dim">› Por fuerza bruta (95 símbolos, ${len} caracteres) una GPU tardaría ${humanTime(95 ** len / 2 / GPU_SHA)} de media.</span>`);
  setOutState('resistió', '');
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
  $('input').value = DEFAULT_TEXT;
  updateCounter(); renderVisual();
}
