# luan.sys

Portfólio pessoal — HTML/CSS/JS puro, sem build, sem dependências.

```
index.html        conteúdo (fonte única: o terminal lê projetos/links daqui)
css/style.css     tema (tokens em :root — troque --accent para mudar a cor)
js/init.js        decide o boot antes do primeiro paint
js/main.js        boot, decode ASCII, bitfield, digitação, scramble, pixel art, terminal
assets/           favicon.svg, og.png (1200x630)
vercel.json       headers de segurança (CSP, HSTS…) e cache
```

## Rodar local
Abra `index.html` direto no navegador, ou: `npx serve .`

## Deploy (Vercel)
`npx vercel` na pasta — ou importe o repositório no painel. Framework preset: **Other**, sem build command.
Depois do deploy, troque `og:image` em `index.html` pela URL absoluta (`https://SEU-DOMINIO/assets/og.png`).

## Para preencher
Procure por `[` em `index.html`: sobrenome, descrições dos projetos e links (remova `data-placeholder`
quando colocar a URL real), certificações, GitHub/LinkedIn/e-mail.
