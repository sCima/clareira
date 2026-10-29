# Profundo.js

Sites que você atravessa. Profundo.js transforma a rolagem em uma viagem 3D: a câmera avança por um túnel, os títulos viram paredes vazadas, o vidro refrata a luz de verdade e cada clique manda uma onda pela cena.

Você descreve a cena em HTML e a biblioteca monta o resto em cima do [three.js](https://threejs.org).

- `index.html`: documentação, feita com a própria biblioteca
- `examples/mergulho.html`: o mergulho completo, sem nenhuma linha de JavaScript próprio
- `dist/`: a biblioteca (`profundo.js`, `profundo.css`)

Para ver localmente:

```bash
npx http-server@14.1.1 . -p 5173 -c-1
```

## O padrão

1. **Rolar é avançar.** O scroll move a câmera no eixo Z. Cada seção é um lugar no espaço.
2. **Palavra é porta.** Títulos grandes são vazados, e você atravessa as letras.
3. **Vidro refrata.** O vidro dobra o mundo atrás dele, em vez de só desfocar.
4. **Toque é onda.** Cada clique empurra a cena inteira.

## Instalação

Ainda não está no npm. Copie `dist/` para o seu projeto e carregue o three antes:

```html
<link rel="stylesheet" href="profundo.css">
<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>
<script src="profundo.js"></script>
```

A fonte padrão das palavras 3D é a Anybody (Google Fonts). Troque com `data-font` ou com a opção `font`.

Com three como módulo (r160 em diante), passe a referência: `Profundo.create({ three: THREE })`.

## Primeiro mergulho

```html
<div data-profundo data-length="600vh" data-depth="400" data-hud>
  <pf-gate word="OLÁ"></pf-gate>
  <pf-portals from="40" to="320"></pf-portals>
  <pf-dust></pf-dust>
  <pf-text at="80">Meu primeiro<br>mergulho.</pf-text>
  <pf-glass-field from="150" to="260"></pf-glass-field>
  <pf-wall at="340" word="FIM"></pf-wall>
  <pf-sun at="520"></pf-sun>
</div>

<section style="position:relative; z-index:2">
  <!-- o resto do site continua aqui, por cima da cena -->
</section>
```

As posições são em metros de profundidade: `at="200"` fica 200 metros à frente do início.

## Tags

| Tag | O que faz | Atributos |
| --- | --- | --- |
| `pf-gate` | Palavra vazada na tela que cresce até você passar por uma letra | `word` `through` `hint` |
| `pf-text` | Frase no espaço (`<br>` quebra linha) | `at` `x` `y` `width` `gradient` `stretch` `case="none"` |
| `pf-portal` | Um anel de neon | `at` `radius` `color` |
| `pf-portals` | Sequência de anéis (pula os trechos perto de paredes) | `from` `to` `every` `colors` |
| `pf-glass` | Peça de vidro iridescente | `at` `x` `y` `size` `shape` `tint` |
| `pf-glass-field` | Campo de vidro em volta do caminho | `from` `to` `count` `radius` `size` |
| `pf-wall` | Parede com a palavra vazada; a câmera passa pelo traço da letra | `at` `word` `through` `stroke` |
| `pf-sun` | Destino no fim do túnel | `at` `radius` `colors` |
| `pf-dust` | Poeira de luz | `count` `spread` |
| `pf-chapter` | Capítulo no HUD e evento `chapter` | `at` `name` `hint` |

Atributos do trilho: `data-theme`, `data-length`, `data-depth`, `data-hud`, `data-cursor`, `data-palette`, `data-fog`, `data-fog-density`, `data-waves`, `data-parallax`, `data-font`, `data-intro`.

## API em JavaScript

```js
// <script src="profundo.js" data-manual> desliga a montagem automática
const pf = Profundo.create({ track: '#trilho', length: '800vh', depth: 600, hud: 'MEU SITE' });

pf.add(
  Profundo.gate({ word: 'MERGULHE' }),
  Profundo.portals({ from: 40, to: 520 }),
  Profundo.text({ at: 90, text: 'Olá,\nprofundidade.', gradient: ['#ffb648', '#ff5d73'] }),
  Profundo.glassField({ from: 200, to: 360, count: 20 }),
  Profundo.wall({ at: 560, word: 'FIM' }),
  Profundo.chapter(0, 'Início'),
  Profundo.custom({
    at: 300,
    create: (THREE) => new THREE.Mesh(new THREE.TorusKnotGeometry(2, .5), new THREE.MeshNormalMaterial()),
    update: (obj, { dt }) => { obj.rotation.y += dt; }
  })
);

pf.on('progress', ({ progress, depth, speed }) => {});
pf.on('chapter', (cap, i) => {});
pf.on('wave', ({ x, y, depth }) => {});
pf.goTo(0, { duration: 3 });
pf.wave(innerWidth / 2, innerHeight / 2);
pf.destroy();
```

### Opções

| Opção | Padrão | Descrição |
| --- | --- | --- |
| `track` | `document.body` | Elemento ou seletor do trilho |
| `length` | `null` | Altura do trilho, ex. `"900vh"` |
| `depth` | `780` | Profundidade total, em metros |
| `intro` | `.08` | Fração da rolagem usada pelo portão |
| `palette` | 4 cores | Anéis, poeira e reflexos |
| `fog` / `sky` | roxo noturno | `{ color, density }` / `{ top, mid, glow, gold }` |
| `font` | Anybody | Família das palavras 3D |
| `smoothing` | `3.6` | Inércia da câmera |
| `parallax` / `sway` | `1` / `2.3` | Mouse e balanço lateral |
| `fov` / `speedFov` | `62` / `26` | Campo de visão e abertura com velocidade |
| `waves` / `aberration` / `grain` / `vignette` | ligados | Pós-processamento |
| `pixelRatio` / `msaa` | `1.75` / `4` | Qualidade (limitada no celular) |
| `theme` / `exposure` | `'dark'` / `1.15` | `'light'` para cenas claras: brilho vira tinta, névoa clara |
| `adaptive` / `cull` | ligados | Resolução que se ajusta ao fps; nada é desenhado além da névoa |
| `reducedMotion` | `'auto'` | Segue o sistema, ou `true`/`false` |
| `hud` / `cursor` | `false` | Painel de mergulho e cursor de anel |
| `three` / `canvas` | global / novo | Referência ao THREE e canvas próprio |

## Vidro na interface

`class="pf-glass"` dá vidro a qualquer elemento HTML. `data-pf-tilt` (ou `Profundo.tilt(alvo)`) inclina em 3D com um brilho que segue o mouse. Ajuste com `--pf-glass`, `--pf-glass-hi`, `--pf-glass-line`, `--pf-glass-tint` e `--pf-glass-blur`.

## Acessibilidade e desempenho

- O texto das tags fica no HTML, visível para leitores de tela e buscadores.
- Com movimento reduzido no sistema, somem a paralaxe, o balanço, a dobra de velocidade e as animações automáticas.
- Cliques em links, botões e campos não viram onda. `data-pf-nowave` protege outras áreas.
- A cena pausa com a aba escondida e quando a página já passou bem do trilho.
- Sem WebGL, a página ganha a classe `pf-no-gl` e um fundo em gradiente.
- Cada peça de vidro renderiza a cena de novo. Prefira até 30 no total.

## Licença

MIT
