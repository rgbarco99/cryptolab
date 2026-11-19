/* Pruebas de la lógica criptográfica.  Ejecuta:  node tests/ciphers.test.js */
'use strict';
const assert = require('node:assert/strict');
const C = require('../js/ciphers.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const TEXTO = 'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo ' +
  'de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, ' +
  'salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos.';

test('César: ida y vuelta, ROT13 es su propio inverso', () => {
  assert.equal(C.caesar('Hola, Mundo', 3), 'Krod, Pxqgr');
  assert.equal(C.caesar(C.caesar('ROT', 13), 13), 'ROT');
});

test('Atbash es involutivo', () => {
  assert.equal(C.atbash('ABC xyz'), 'ZYX cba');
  assert.equal(C.atbash(C.atbash(TEXTO)), TEXTO);
});

test('Vigenère: vector clásico LEMON', () => {
  assert.equal(C.vigenere('ATTACKATDAWN', 'LEMON', 1), 'LXFOPVEFRNHR');
  assert.equal(C.vigenere('LXFOPVEFRNHR', 'LEMON', -1), 'ATTACKATDAWN');
});

test('Vigenère: el ataque recupera la clave de un texto largo', () => {
  const r = C.crackVigenere(C.vigenere(TEXTO, 'QUIJOTE', 1));
  assert.equal(r.key, 'QUIJOTE');
  assert.equal(r.plain, TEXTO);
});

test('Índice de coincidencia: español ≈ 0,07, aleatorio ≈ 0,04', () => {
  assert.ok(C.indexOfCoincidence(C.lettersOf(TEXTO)) > 0.065);
  assert.ok(C.indexOfCoincidence(C.randomLetters(2000)) < 0.045);
});

test('Enigma: vectores conocidos', () => {
  const cfg = { rotors: ['I', 'II', 'III'], pos: 'AAA', rings: 'AAA', plugs: '' };
  assert.equal(C.enigma('AAAAA', cfg), 'BDZGO');
  // Doble paso del rotor central: ADU → ADV → AEW → BFX
  const m = C.makeEnigma({ ...cfg, pos: 'ADU' });
  const seq = []; for (let i = 0; i < 3; i++) { m.press(0); seq.push(m.pos); }
  assert.deepEqual(seq, ['ADV', 'AEW', 'BFX']);
});

test('Enigma: recíproca y nunca cifra una letra como sí misma', () => {
  const cfg = { rotors: ['IV', 'II', 'V'], pos: 'QEV', rings: 'BUL', plugs: 'AV BS CG DL FU HZ IN KM OW RX' };
  const ct = C.enigma('ATAQUE AL AMANECER', cfg);
  assert.equal(C.enigma(ct, cfg), 'ATAQUE AL AMANECER');
  const plain = 'A'.repeat(500), out = C.enigma(plain, cfg);
  assert.ok(![...out].includes('A'));
});

test('Enigma: el tablero rechaza letras repetidas', () => {
  assert.throws(() => C.parsePlugboard('AB AC'));
});

test('Bombe: recupera rotores y posición de un texto largo sin tablero', () => {
  const ct = C.enigma(TEXTO, { rotors: ['II', 'V', 'I'], pos: 'MCK', rings: 'AAA' });
  const idx = [...C.lettersOf(C.deaccent(ct), C.ALPHA_26)].slice(0, 90).map(c => C.ALPHA_26.indexOf(c));
  const best = C.ROTOR_ORDERS.map(o => C.bombeScan(idx, o, 1)[0]).sort((a, b) => a.score - b.score)[0];
  assert.deepEqual([best.rotors.join('-'), best.pos], ['II-V-I', 'MCK']);
});

test('One-time pad: ida y vuelta, y clave corta = error', () => {
  const pad = C.randomLetters(40);
  const ct = C.otp('Huid ya, nos han descubierto', pad, 1);
  assert.equal(C.otp(ct, pad, -1), 'Huid ya, nos han descubierto');
  assert.throws(() => C.otp('mensaje largo', 'ABC', 1));
});

test('One-time pad: existe una clave para cualquier mensaje falso', () => {
  const ct = C.otp('ATACAD', 'XKQPMZ', 1);
  const fake = C.otpKeyFor(ct, 'HUIDYA');
  assert.equal(C.otp(ct, fake, -1), 'HUIDYA');
});

test('Codificaciones: Base64, hex y Morse', () => {
  assert.equal(C.b64enc('España'), 'RXNwYcOxYQ==');
  assert.equal(C.b64dec('RXNwYcOxYQ=='), 'España');
  assert.equal(C.hexenc('ñ'), 'c3 b1');
  assert.equal(C.hexdec('c3b1'), 'ñ');
  assert.equal(C.morseenc('SOS ñ'), '... --- ... / --.--');
  assert.equal(C.morsedec('... --- ...'), 'SOS');
});

test('SHA-256: vector "abc" y efecto avalancha', async () => {
  assert.equal(await C.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const d = C.bitDiff(await C.sha256('hola'), await C.sha256('hola!'));
  assert.ok(d > 90 && d < 166, `bits distintos: ${d}`);
});

test('AES-GCM: ida y vuelta; contraseña errónea falla; salida distinta cada vez', async () => {
  const a = await C.aesEncrypt('secreto ñ', 'pw', 1000), b = await C.aesEncrypt('secreto ñ', 'pw', 1000);
  assert.notEqual(a, b);
  assert.equal(await C.aesDecrypt(a, 'pw', 1000), 'secreto ñ');
  await assert.rejects(C.aesDecrypt(a, 'otra', 1000));
});

test('RSA: claves, cifrado por bloques y factorización', () => {
  const k = C.rsaKeys(61n, 53n);
  assert.equal(k.n, 3233n); assert.equal(k.d * k.e % k.phi, 1n);
  for (const bits of [8, 16, 24, 32]) {
    const key = C.rsaGenerate(bits);
    const msg = 'Mensaje con ñ y emoji 🔐 — bloques de ' + C.rsaBlockBytes(key.n) + ' bytes';
    assert.equal(C.rsaDecrypt(C.rsaEncrypt(msg, key), key), msg);
  }
  const key = C.rsaGenerate(24), it = C.pollardRho(key.n);
  let r; do r = it.next(); while (!r.done);
  assert.ok(r.value === key.p || r.value === key.q);
  assert.throws(() => C.rsaKeys(15n, 7n));
});

test('Primalidad', () => {
  assert.ok(C.isPrime(2147483647n));            // primo de Mersenne 2^31−1
  assert.ok(!C.isPrime(3215031751n));           // pseudoprimo fuerte en bases 2,3,5,7
});

(async () => {
  let fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ✔', t.name); }
    catch (e) { fail++; console.log('  ✘', t.name, '\n    ', e.message); }
  }
  console.log(`\n${tests.length - fail}/${tests.length} pruebas superadas`);
  process.exit(fail ? 1 : 0);
})();
