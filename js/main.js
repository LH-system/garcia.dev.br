/* ==========================================================================
   luan.sys — interações
   Sem dependências. Tudo respeita prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reducedMQ.matches;
  var BITS = '01';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function bit() { return BITS[rand(2)]; }

  function onVisible(el, cb, opts) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.disconnect(); cb(); }
      });
    }, opts || { threshold: 0.35 });
    io.observe(el);
  }

  /* ------------------------------------------------------------------------
     1. DECODE — ASCII do nome começa como 0/1 e "decodifica"
     ------------------------------------------------------------------------ */
  var decodeTargets = $$('[data-decode]').map(function (el) {
    var target = el.textContent;
    var chars = target.split('');
    var lineLen = 0, col = 0, cols = [];
    chars.forEach(function (c) {
      if (c === '\n') { col = 0; cols.push(-1); return; }
      cols.push(col++);
      lineLen = Math.max(lineLen, col);
    });
    return { el: el, chars: chars, cols: cols, width: lineLen || 1 };
  });

  function scrambledFrame(t) {
    return t.chars.map(function (c, i) {
      if (c === '\n' || c === ' ') return c;
      return t.resolveAt && t.resolveAt[i] <= t.elapsed ? c : bit();
    }).join('');
  }

  // Pré-embaralha logo de cara para o texto final não "piscar" antes da animação
  if (!reduced) decodeTargets.forEach(function (t) { t.el.textContent = scrambledFrame(t); });

  function runDecode() {
    if (reduced) return;
    decodeTargets.forEach(function (t) {
      t.resolveAt = t.cols.map(function (c) {
        return c < 0 ? 0 : (c / t.width) * 850 + Math.random() * 450;
      });
    });
    var start = performance.now(), last = 0, END = 1350, finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      decodeTargets.forEach(function (t) { t.el.textContent = t.chars.join(''); });
    }
    // garantia: mesmo com rAF pausado (aba em background), o nome sempre fica legível
    setTimeout(finish, END + 150);
    (function tick(now) {
      if (finished) return;
      var elapsed = now - start;
      if (now - last > 32) {
        last = now;
        decodeTargets.forEach(function (t) {
          t.elapsed = elapsed;
          t.el.textContent = scrambledFrame(t);
        });
      }
      if (elapsed < END) requestAnimationFrame(tick);
      else finish();
    })(start);
  }

  /* ------------------------------------------------------------------------
     2. BITFIELD — campo de 0/1 no fundo do hero, reage ao cursor
     ------------------------------------------------------------------------ */
  function bitfield(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var hero = canvas.parentElement;
    var CW = 16, CH = 20, R = 120;
    var cols = 0, rows = 0, bits, base, heat;
    var mouse = { x: -9999, y: -9999, on: false };
    var running = false, visible = true, last = 0;

    var BASE = ['rgba(122,122,128,0.06)', 'rgba(122,122,128,0.10)', 'rgba(122,122,128,0.15)', 'rgba(122,122,128,0.22)'];
    var HOT = [];
    for (var i = 0; i < 10; i++) HOT.push('rgba(0,255,156,' + (0.18 + i * 0.08).toFixed(2) + ')');

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '400 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'top';
      cols = Math.ceil(w / CW);
      rows = Math.ceil(h / CH);
      var n = cols * rows;
      bits = new Uint8Array(n);
      base = new Uint8Array(n);
      heat = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        bits[i] = Math.random() < 0.5 ? 1 : 0;
        base[i] = rand(4);
      }
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var mx = mouse.x, my = mouse.y, on = mouse.on && !reduced;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var i = r * cols + c;
          var x = c * CW, y = r * CH;
          if (on) {
            var dx = x + CW / 2 - mx, dy = y + CH / 2 - my;
            if (dx > -R && dx < R && dy > -R && dy < R) {
              var p = 1 - Math.sqrt(dx * dx + dy * dy) / R;
              if (p > heat[i]) heat[i] = p;
            }
          }
          var h = heat[i];
          if (h > 0.06) {
            ctx.fillStyle = HOT[Math.min(9, (h * 10) | 0)];
            ctx.fillText('1', x + 4, y + 4);
            heat[i] = h * 0.9;
          } else {
            heat[i] = 0;
            ctx.fillStyle = BASE[base[i]];
            ctx.fillText(bits[i] ? '1' : '0', x + 4, y + 4);
          }
        }
      }
    }

    function frame(now) {
      if (!running) return;
      if (now - last > 33) { // ~30fps é suficiente e economiza bateria
        last = now;
        var flips = Math.max(1, (cols * rows * 0.004) | 0);
        for (var k = 0; k < flips; k++) bits[rand(bits.length)] ^= 1;
        draw();
      }
      requestAnimationFrame(frame);
    }

    function start() {
      if (reduced || running || !visible || document.hidden) return;
      running = true;
      requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    hero.addEventListener('pointermove', function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.on = true;
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { mouse.on = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    // redesenha quando a fonte mono carregar (canvas não re-renderiza sozinho)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

    resize();
    start();
  }

  /* ------------------------------------------------------------------------
     3. BOOT — tela de inicialização curta (máx ~1.5s, pulável)
     ------------------------------------------------------------------------ */
  function boot(done) {
    if (!root.classList.contains('booting')) { done(); return; }
    var box = $('#boot'), log = $('#boot-log'), skip = $('#boot-skip');
    var lines = [
      '<span class="hl">&gt; initializing luan.sys</span> ............ <span class="ok">[OK]</span>',
      '&gt; mounting /dev/brain ............... <span class="ok">[OK]</span>',
      '&gt; loading modules: php ts react sql .. <span class="ok">[OK]</span>',
      '&gt; net stack: tcp/ip dns udp ......... <span class="ok">[OK]</span>',
      '&gt; security layer .................... <span class="ok">[ARMING]</span>',
      '<span class="hl">&gt; welcome, guest.</span>'
    ];
    var i = 0, finished = false, timer;

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      try { sessionStorage.setItem('luan.sys:booted', '1'); } catch (e) {}
      box.classList.add('done');
      setTimeout(function () {
        root.classList.remove('booting');
        box.classList.remove('done');
        done();
      }, 250);
    }
    function onKey() { finish(); }
    function next() {
      if (i < lines.length) {
        log.innerHTML += lines[i++] + '\n';
        timer = setTimeout(next, i === 1 ? 260 : 170);
      } else {
        timer = setTimeout(finish, 220);
      }
    }

    skip.addEventListener('click', finish);
    box.addEventListener('pointerdown', finish);
    document.addEventListener('keydown', onKey);
    next();
  }

  /* ------------------------------------------------------------------------
     4. TÍTULOS — efeito de digitação + cursor █
     ------------------------------------------------------------------------ */
  function setupTypeTitles() {
    $$('.type-title').forEach(function (el) {
      var text = el.textContent.trim();
      el.textContent = '';
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text;
      var typed = document.createElement('span');
      typed.setAttribute('aria-hidden', 'true');
      var cursor = document.createElement('span');
      cursor.className = 'cursor';
      cursor.setAttribute('aria-hidden', 'true');
      cursor.textContent = '█';
      el.append(sr, typed, cursor);

      // texto completo por padrão: se o observer nunca disparar, o título continua legível
      typed.textContent = text;
      if (reduced) return;
      onVisible(el, function () {
        var n = 0;
        typed.textContent = '';
        (function type() {
          typed.textContent = text.slice(0, ++n);
          if (n < text.length) setTimeout(type, 55 + Math.random() * 45);
        })();
      }, { threshold: 0 });
    });
  }

  /* ------------------------------------------------------------------------
     5. SCRAMBLE no hover dos cards
     ------------------------------------------------------------------------ */
  function scramble(el, duration) {
    if (reduced || el._scrambling) return;
    var original = el.dataset.text || (el.dataset.text = el.textContent);
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', original);
    el._scrambling = true;
    var start = performance.now(), dur = duration || 420;
    (function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      var revealed = Math.floor(original.length * p);
      var out = '';
      for (var i = 0; i < original.length; i++) {
        var c = original[i];
        out += (i < revealed || c === ' ') ? c : bit();
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
      else { el.textContent = original; el._scrambling = false; }
    })(start);
  }

  function setupScramble() {
    $$('.card').forEach(function (card) {
      var target = $('[data-scramble]', card);
      if (!target) return;
      var fire = function () { scramble(target); };
      card.addEventListener('pointerenter', fire);
      card.addEventListener('focusin', fire);
    });
  }

  /* ------------------------------------------------------------------------
     Barras de nível ASCII [██████░░░░]
     ------------------------------------------------------------------------ */
  function barText(n) {
    return '[' + '█'.repeat(n) + '░'.repeat(10 - n) + ']';
  }
  function setupBars() {
    $$('.bar[data-level]').forEach(function (bar) {
      var level = Math.max(0, Math.min(10, parseInt(bar.dataset.level, 10) || 0));
      if (reduced) { bar.textContent = barText(level); return; }
      bar.textContent = barText(0);
      onVisible(bar, function () {
        var n = 0;
        (function fill() {
          bar.textContent = barText(n);
          if (n++ < level) setTimeout(fill, 45);
        })();
      }, { threshold: 1 });
    });
  }

  /* ------------------------------------------------------------------------
     6. PIXEL ART 1-bit (# = pixel, + = dithering, . = vazio)
     ------------------------------------------------------------------------ */
  var SPRITES = {
    server: [
      '................',
      '.##############.',
      '.#............#.',
      '.#.##.....#.#.#.',
      '.#............#.',
      '.##############.',
      '.#++++++++++++#.',
      '.##############.',
      '.#............#.',
      '.#.##.....#.#.#.',
      '.#............#.',
      '.##############.',
      '.#++++++++++++#.',
      '.##############.',
      '...#........#...',
      '..###......###..'
    ],
    window: [
      '################',
      '#.#.#..........#',
      '################',
      '#..............#',
      '#.+++++.######.#',
      '#.+++++........#',
      '#.+++++.####...#',
      '#.+++++........#',
      '#.+++++.#####..#',
      '#..............#',
      '#.############.#',
      '#..............#',
      '#.######.......#',
      '#..............#',
      '################',
      '................'
    ],
    db: [
      '....########....',
      '..##........##..',
      '.#............#.',
      '.##..........##.',
      '.#.##########.#.',
      '.#............#.',
      '.#++++++++++++#.',
      '.##++++++++++##.',
      '.#.##########.#.',
      '.#............#.',
      '.#............#.',
      '.##..........##.',
      '.#.##########.#.',
      '..##++++++++##..',
      '....########....',
      '................'
    ],
    lock: [
      '.....######.....',
      '....##....##....',
      '...##......##...',
      '...#........#...',
      '...#........#...',
      '..############..',
      '..#..........#..',
      '..#.++++++++.#..',
      '..#.+++##+++.#..',
      '..#.++####++.#..',
      '..#.+++##+++.#..',
      '..#.+++##+++.#..',
      '..#.++++++++.#..',
      '..#..........#..',
      '..############..',
      '................'
    ]
  };

  // Cardputer desenhado proceduralmente (48x30)
  function cardputerSprite() {
    var W = 48, H = 30, g = [];
    for (var y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    function px(x, y, v) { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = v || '#'; }
    function fill(x, y, w, h, v) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) px(i, j, v); }
    function rect(x, y, w, h) {
      for (var i = x; i < x + w; i++) { px(i, y); px(i, y + h - 1); }
      for (var j = y; j < y + h; j++) { px(x, j); px(x + w - 1, j); }
    }
    // antena LoRa
    fill(39, 0, 4, 2); fill(40, 2, 2, 3);
    // corpo com cantos arredondados
    rect(0, 5, 48, 25);
    px(0, 5, '.'); px(47, 5, '.'); px(0, 29, '.'); px(47, 29, '.');
    px(1, 6); px(46, 6); px(1, 28); px(46, 28);
    // tela
    rect(3, 7, 28, 11);
    px(6, 9); px(7, 10); px(8, 11); px(7, 12); px(6, 13); // ">"
    fill(10, 13, 4, 1); // "_"
    fill(5, 15, 24, 1, '+');
    // botão G0 e grade do alto-falante
    rect(34, 8, 9, 8); fill(36, 10, 5, 4, '+');
    for (var s = 34; s <= 42; s += 2) px(s, 17);
    // teclado: 3 fileiras de teclas 3x2
    for (var row = 0; row < 3; row++) {
      var ky = 20 + row * 3;
      for (var k = 0; k < 11; k++) {
        var kx = 3 + k * 4;
        if (row === 2 && k >= 3 && k <= 7) continue;
        fill(kx, ky, 3, 2);
      }
    }
    fill(15, 26, 19, 2); // barra de espaço
    return g.map(function (r) { return r.join(''); });
  }
  SPRITES.cardputer = cardputerSprite();

  function spriteToSVG(rows) {
    var h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var rects = '';
    for (var y = 0; y < h; y++) {
      var runStart = -1;
      for (var x = 0; x <= w; x++) {
        var c = rows[y][x];
        var on = c === '#' || (c === '+' && (x + y) % 2 === 0);
        if (on && runStart < 0) runStart = x;
        if (!on && runStart >= 0) {
          rects += '<rect x="' + runStart + '" y="' + y + '" width="' + (x - runStart) + '" height="1"/>';
          runStart = -1;
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
      '" fill="currentColor" shape-rendering="crispEdges" focusable="false">' + rects + '</svg>';
  }

  function setupPixels() {
    $$('[data-pixel]').forEach(function (el) {
      var sprite = SPRITES[el.dataset.pixel];
      if (sprite) el.innerHTML = spriteToSVG(sprite);
    });
  }

  /* ------------------------------------------------------------------------
     7. TERMINAL interativo
     ------------------------------------------------------------------------ */
  function setupTerminal() {
    var form = $('#term-form'), input = $('#term-cmd'), out = $('#term-out'), body = $('#term');
    if (!form) return;
    var history = [], hIndex = 0;

    // Fonte única da verdade: links e projetos vêm do próprio HTML
    function contactLinks() {
      return $$('.contact-links li').map(function (li) {
        var a = $('a', li);
        return { label: $('.label', li).textContent, href: a.getAttribute('href'), text: a.textContent.replace(' ↗', '') };
      });
    }
    function projects() {
      return $$('.project').map(function (p) {
        return {
          name: $('h3', p).dataset.text || $('h3', p).textContent,
          tags: $$('.tags li', p).map(function (t) { return t.textContent; }).join(', ')
        };
      });
    }

    function print(parts, cls) {
      var p = document.createElement('p');
      p.className = cls || 'out';
      (Array.isArray(parts) ? parts : [parts]).forEach(function (part) {
        if (typeof part === 'string') { p.appendChild(document.createTextNode(part)); return; }
        var el;
        if (part.href) {
          el = document.createElement('a');
          el.href = part.href;
          if (/^https?:/.test(part.href)) { el.target = '_blank'; el.rel = 'noopener'; }
        } else {
          el = document.createElement('span');
        }
        if (part.cls) el.className = part.cls;
        el.textContent = part.text;
        p.appendChild(el);
      });
      out.appendChild(p);
    }

    var CMDS = {
      help: function () {
        print('comandos disponíveis:');
        [['about', 'quem sou eu'], ['skills', 'stack técnica'], ['projects', 'lista de projetos'],
         ['certs', 'certificações'], ['lab', 'hardware / estudos'], ['contact', 'como falar comigo'],
         ['clear', 'limpa o terminal']].forEach(function (c) {
          print(['  ', { text: c[0].padEnd(10), cls: 'accent' }, c[1]]);
        });
      },
      about: function () {
        print('Luan — dev full-stack há 2 anos (PHP, Laravel, TS, React, SQL).');
        print('Trainee de TI na Gazin Tech · Sistemas para Internet @ UniALFA.');
        print('Em transição para cibersegurança: redes + hardware hacking.');
      },
      whoami: function () { print('guest — mas o dono daqui é o luan. tente "about".'); },
      skills: function () {
        $$('.module').forEach(function (m) {
          var title = $('h3', m).dataset.text || $('h3', m).textContent;
          var items = $$('.skills li > span:first-child', m).map(function (s) { return s.textContent; });
          print([{ text: title.toLowerCase().padEnd(16), cls: 'accent' }, items.join(' · ')]);
        });
      },
      projects: function () {
        projects().forEach(function (p, i) {
          print([{ text: '[' + String(i + 1).padStart(2, '0') + '] ', cls: 'accent' }, p.name + '  — ' + p.tags]);
        });
        print(['→ detalhes em ', { text: '#projetos', href: '#projetos' }]);
      },
      certs: function () {
        $$('#certs .log li').forEach(function (li) { print(li.textContent.replace(/\s+/g, ' ').trim()); });
      },
      lab: function () {
        print('M5Stack Cardputer ADV + LoRa SX1262 · firmware Bruce');
        print('módulos: Wi-Fi · BLE · Sub-GHz · RFID');
        print({ text: '⚠ apenas em equipamentos próprios ou autorizados.', cls: 'accent' });
      },
      contact: function () {
        contactLinks().forEach(function (l) {
          print([l.label.toLowerCase().padEnd(10), { text: l.text, href: l.href }]);
        });
      },
      ls: function () { print('about.txt  projects/  certs.log  lab/  contact.txt'); },
      date: function () { print(new Date().toString()); },
      echo: function (args) { print(args.join(' ')); },
      history: function () { history.forEach(function (h, i) { print('  ' + (i + 1) + '  ' + h); }); },
      sudo: function () { print('guest não está no arquivo sudoers. Este incidente será reportado. ;)', 'out err'); },
      exit: function () { print('não há saída. brincadeira — é só fechar a aba.'); },
      clear: function () { out.textContent = ''; }
    };
    var ALIASES = { 'cat about.txt': 'about', 'cat contact.txt': 'contact', 'cat certs.log': 'certs', 'man': 'help', '?': 'help', 'cls': 'clear' };

    function run(raw) {
      var line = raw.trim();
      print([{ text: 'guest@luan.sys:~$ ', cls: 'prompt' }, line], 'cmd');
      if (!line) return;
      history.push(line);
      var key = ALIASES[line.toLowerCase()] || line.split(/\s+/)[0].toLowerCase();
      var args = line.split(/\s+/).slice(1);
      if (Object.prototype.hasOwnProperty.call(CMDS, key)) CMDS[key](args);
      else print('comando não encontrado: ' + line.split(/\s+/)[0] + ' — digite "help"', 'out err');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      run(input.value);
      input.value = '';
      hIndex = history.length;
      body.scrollTop = body.scrollHeight;
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && history.length) {
        hIndex = Math.max(0, hIndex - 1);
        input.value = history[hIndex];
        e.preventDefault();
      } else if (e.key === 'ArrowDown' && history.length) {
        hIndex = Math.min(history.length, hIndex + 1);
        input.value = history[hIndex] || '';
        e.preventDefault();
      } else if (e.key === 'Tab' && input.value) {
        var match = Object.keys(CMDS).filter(function (c) { return c.indexOf(input.value.toLowerCase()) === 0; });
        if (match.length === 1) { input.value = match[0]; e.preventDefault(); }
      } else if (e.key === 'l' && e.ctrlKey) {
        CMDS.clear();
        e.preventDefault();
      }
    });

    body.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      if (window.getSelection && String(window.getSelection())) return;
      input.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------------------
     Detalhes: relógio e links placeholder
     ------------------------------------------------------------------------ */
  function setupClock() {
    var el = $('#clock');
    if (!el) return;
    function tick() { el.textContent = new Date().toLocaleTimeString('pt-BR', { hour12: false }); }
    tick();
    setInterval(tick, 1000);
  }

  $$('[data-placeholder]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  reducedMQ.addEventListener && reducedMQ.addEventListener('change', function (e) { reduced = e.matches; });

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  setupPixels();
  setupBars();
  setupScramble();
  setupTerminal();
  setupClock();
  var canvas = $('#bitfield');
  if (canvas) bitfield(canvas);

  boot(function () {
    runDecode();
    setupTypeTitles();
  });
})();
