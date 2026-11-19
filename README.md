# CryptoLab

Laboratorio visual de criptografía: cifra, descifra e **intenta romper** once cifrados y codificaciones, desde César hasta RSA, viendo qué pasa por dentro.

Cada cifrado tiene tres partes:

1. **¿Cómo funciona?** Una explicación breve con su historia.
2. **Visualización propia.** Por ejemplo, los rotores de Enigma y el recorrido de la señal, los bytes de sal, IV y etiqueta de AES o los 6 bits de cada símbolo de Base64.
3. **Consola de ataque.** Un ataque real, adaptado a cada cifrado, que se ejecuta en tu navegador.

| Cifrado | Ataque | Qué enseña |
|---|---|---|
| César | Fuerza bruta (25 claves) + χ² | Un espacio de claves pequeño no protege nada |
| Atbash | Ninguno (no tiene clave) | Seguridad por oscuridad |
| Vigenère | Índice de coincidencia + un César por columna | La estadística vence a la fuerza bruta: 130 intentos en vez de 11 millones |
| Enigma | «Bombe» simplificada: 60 órdenes × 17.576 posiciones | La longitud del mensaje importa (distancia de unicidad) y el tablero de clavijas era clave |
| AES-256-GCM | Diccionario contra la contraseña (PBKDF2 real) | El cifrado no se rompe; tu contraseña sí |
| One-time pad | Muestra que *cualquier* mensaje es posible | Secreto perfecto de Shannon |
| RSA (juguete) | Factorización con rho de Pollard | Por qué n debe tener 2048 bits |
| SHA-256 | Diccionario de huellas | Por qué las contraseñas se guardan con sal y bcrypt/Argon2 |
| Base64, Morse, Hex | Decodificación directa | Codificar no es cifrar |

## Estructura

```
index.html            maquetación
css/app.css           estilos (comparte paleta y tema con el portfolio)
js/ciphers.js         criptografía pura, sin DOM: se puede probar con Node
js/app.js             interfaz: claves, visualizaciones, traductor y ataques
tests/ciphers.test.js pruebas con vectores conocidos
```

AES, PBKDF2 y SHA-256 usan **WebCrypto**, la implementación nativa del navegador. RSA usa `BigInt` con primos pequeños para que se pueda romper. **No uses esto para proteger nada real.**

## Ejecutar

Es una página estática. WebCrypto solo funciona en un contexto seguro (`https://` o `localhost`), así que sírvela con un servidor local en vez de abrir el archivo directamente:

```bash
npx serve .        # o: python -m http.server
```

## Pruebas

```bash
node tests/ciphers.test.js
```

Incluyen vectores de referencia (`ATTACKATDAWN` + `LEMON` → `LXFOPVEFRNHR` en Vigenère; Enigma I-II-III en `AAA`: `AAAAA` → `BDZGO`; SHA-256 de `abc`), el doble paso del rotor central de Enigma y que cada ataque recupere la clave.

## Publicar una versión nueva

GitHub Pages deja que el navegador guarde los archivos 10 minutos (`Cache-Control: max-age=600`). Si cambias el JS o el CSS, **sube el número `?v=` de los `<link>` y `<script>` en `index.html`**: así nadie recibe una mezcla de archivos nuevos y viejos.
