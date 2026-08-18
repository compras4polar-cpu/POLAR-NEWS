# Backend — Painel de Compras Internacionais (Polar Indústria)

Backend Node.js (Vercel Functions + Vercel Cron) que atualiza automaticamente
os dados do painel e envia um relatório diário em PDF por e-mail.

## Aviso importante — leia antes de implantar

Esta pasta foi escrita e revisada com cuidado, mas **não pôde ser testada
localmente**: a máquina onde ela foi gerada não tem Node.js, npm nem git
instalados. Isso significa que:

- A lógica de cada arquivo foi escrita seguindo os padrões oficiais do
  Vercel/SendGrid/Puppeteer, mas o primeiro deploy real pode expor erros de
  ambiente (versão de pacote, timeout, variável faltando) que só aparecem
  rodando de verdade no Vercel. Isso é normal em qualquer backend novo — não
  significa que o projeto esteja errado, apenas que a primeira implantação
  costuma exigir 1-2 ajustes.
- Antes de rodar, confirme os endpoints reais das APIs abaixo (BCB, EIA,
  NOAA, USGS são conhecidos e estáveis, mas provedores mudam formatos de
  tempos em tempos).

## O que este backend automatiza de fato (dados 100% reais e gratuitos)

| Fonte | O que traz | Precisa de conta/chave? |
|---|---|---|
| Banco Central do Brasil (PTAX) | USD/BRL | Não — API pública |
| EIA (Energy Information Administration) | Petróleo Brent | Sim, **gratuita** — [registrar aqui](https://www.eia.gov/opendata/register.php) |
| NOAA National Hurricane Center | Furacões/tempestades ativas no Atlântico | Não — feed público |
| USGS | Terremotos significativos da semana | Não — feed público |

## O que continua manual/estático por enquanto (e por quê)

USD/CNY, Baltic Dry Index, todos os preços químicos (TDI, poliol, TCPP,
cloreto de metileno, amina, estanho, silicone) e todo o frete marítimo
**não têm API gratuita real** — as fontes de referência (ICIS, Drewry,
Xeneta, Baltic Exchange, LME oficial, Trading Economics) são serviços pagos.
Os conectores para ICIS, Drewry e LME já existem em
`lib/fetchers/paidSources.js`, prontos para receber a chamada HTTP real no
dia em que a Polar assinar algum desses serviços — hoje eles só verificam se
a variável de ambiente existe e retornam "não disponível" caso contrário,
para não inventar nenhum número.

## Passo a passo de implantação

### 1. Subir este código para o seu repositório GitHub

Como não há `git` nesta máquina, a forma mais simples é:
- Baixar a pasta `backend/` (e o `index.html` dentro dela) para uma máquina
  com Git instalado, **ou**
- Usar o GitHub Desktop, **ou**
- Fazer upload manual dos arquivos pela interface web do GitHub
  (`github.com/compras4polar-cpu/<seu-repo>` → "Add file" → "Upload files").

Estrutura esperada no repositório (a raiz do repo deve ser o conteúdo desta
pasta `backend/`, não a pasta `backend/` dentro de outra coisa):

```
/index.html
/package.json
/vercel.json
/api/cron-refresh.js
/api/dashboard-data.js
/api/send-daily-report.js
/lib/store.js
/lib/fetchers/*.js
/data/static-snapshot.json
```

### 2. Conectar o repositório ao projeto Vercel `compradores-polar`

No painel do Vercel → seu projeto → Settings → Git → conectar ao
repositório do GitHub. Cada push na branch principal gera um novo deploy
automaticamente.

### 3. Persistência dos dados (via GitHub, sem banco externo)

Em vez de Vercel KV (que agora exige instalar uma integração de marketplace
com aceite manual de termos), os dados atualizados são gravados como um
commit em `data/live-snapshot.json`, no próprio repositório. Vantagem
colateral: você ganha um histórico versionado de cada atualização, de
graça, direto no GitHub.

Para isso funcionar, é preciso um token do GitHub com permissão de escrita
no repositório — ver `GITHUB_TOKEN` no próximo passo.

### 4. Adicionar as demais variáveis de ambiente

Em Project Settings → Environment Variables, adicione (ver
`.env.example` para a lista completa e comentada):

- `EIA_API_KEY` — chave gratuita da EIA.
- `SENDGRID_API_KEY` — chave da conta gratuita do SendGrid.
- `REPORT_EMAIL_FROM` — endereço verificado no SendGrid.
- `REPORT_EMAIL_TO` — `compras4.polar@gmail.com` (já é o padrão no código).
- `DASHBOARD_PUBLIC_URL` — a URL pública do projeto (ex.:
  `https://polar-news.vercel.app`), preencha **depois** do primeiro
  deploy, quando essa URL existir.
- `GITHUB_TOKEN` — token com permissão de escrita no repositório
  `compras4polar-cpu/POLAR-NEWS` (usado para persistir os dados atualizados
  como commits — ver seção 3 acima).
- `GITHUB_REPO` — `compras4polar-cpu/POLAR-NEWS`.
- `CRON_SECRET` — opcional, qualquer string aleatória, para os endpoints de
  cron rejeitarem chamadas externas não autorizadas.

### 5. Confirmar o plano do Vercel e a frequência do cron

`vercel.json` está configurado para:
- `08:30 UTC` (05:30 BRT) — atualizar os dados (`/api/cron-refresh`)
- `09:00 UTC` (06:00 BRT) — gerar e enviar o PDF (`/api/send-daily-report`)

Isso já respeita o limite do **plano Hobby** (gratuito) do Vercel, que
permite no máximo 2 cron jobs, executados até 1x por dia cada. Se no futuro
quiser atualização a cada 30 minutos como no desenho original do projeto,
será necessário o **plano Pro** do Vercel (permite cron mais frequente e
funções com mais tempo de execução).

### 6. Testar manualmente antes de confiar no cron

Depois do deploy, acesse diretamente no navegador (ou via `curl`):
```
https://compradores-polar.vercel.app/api/cron-refresh
https://compradores-polar.vercel.app/api/dashboard-data
```
O primeiro deve retornar um JSON com `ok: true` e os dados buscados; o
segundo deve retornar o snapshot atual. Só depois de confirmar que isso
funciona, teste o `/api/send-daily-report` (ele envia um e-mail de verdade).

## Sobre o e-mail diário em PDF

É a parte mais delicada tecnicamente: renderizar uma página com Chromium
headless dentro de uma função serverless. Segue o padrão documentado do
Vercel com `@sparticuz/chromium` + `puppeteer-core`, mas se der erro de
timeout ou memória no primeiro teste, normalmente resolve-se aumentando
`maxDuration` em `vercel.json` (já está em 60s, o máximo do plano Hobby —
no plano Pro pode ir mais alto) ou fazendo upgrade de plano.

## Continuar esta implantação em uma sessão futura

Se quiser que eu ajude a depurar erros reais do Vercel (logs de build, logs
de função), cole aqui o texto do erro exibido no painel do Vercel — eu não
tenho acesso direto à sua conta Vercel/GitHub, então preciso que você traga
esses logs para eu conseguir diagnosticar.
