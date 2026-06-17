# Recomendações para o clibridge — Práticas da Comunidade MCP/CLI-Agents (2024-2025)

Baseado na pesquisa de práticas da comunidade (Aider, Cline, Continue.dev, spec MCP) e na inspeção direta do código em `/home/ubuntu/repos/clibridge`. Cada item abaixo está ancorado em algo observado no repositório, não em recomendação genérica.

---

## 1. Nome dos tools MCP usa ponto (`.`) — viola convenção e já causa drift observável

**O que mudar:** Renomear `clibridge.run_agent`, `clibridge.run_workflow`, `clibridge.providers` (em `src/mcp/create-server.ts:34,60,81`) para nomes apenas alfanuméricos com underscore, ex.: `run_agent`, `run_workflow`, `providers`. Atualizar `docs/workflow-executor-contract.md`, que hoje documenta `clibridge.run_workflow` como "tool canônico" (linha ~20-24).

**Por que é prática real da comunidade:** A pesquisa cita "Naming Conventions: ensure all exported tools follow MCP alphanumeric naming conventions." Não é teórico: nesta própria sessão, o host MCP que carregou o servidor `clibridge` expôs os tools como `mcp__clibridge__clibridge_run_agent`, `mcp__clibridge__clibridge_run_workflow`, `mcp__clibridge__clibridge_providers` — o ponto foi silenciosamente convertido em underscore pelo client. Ou seja, o nome "canônico" documentado no contrato já não é o nome real que um LLM vê em produção.

**Benefício/ROI:** Elimina uma fonte de drift entre docs e comportamento real. Hoje, qualquer prompt de agente ou documentação que referencie `clibridge.run_workflow` literalmente (copiado do `workflow-executor-contract.md`) vai falhar a correspondência de nome em clients que não fazem essa sanitização automática, ou confundir o LLM ao ver dois nomes diferentes para a mesma ferramenta. Custo de correção é trivial; custo de não corrigir cresce a cada novo client/host integrado.

**Esforço:** S (3 strings + 1 doc).

---

## 2. `RATE_LIMITED` está "reservado" mas nunca é lançado — o fallback documentado como gotcha nunca dispara para o caso mais importante

**O que mudar:** Em `src/broker/errors.ts:36`, o próprio comentário no código diz `RATE_LIMITED: 'RATE_LIMITED', // Reserved: not yet thrown by any adapter.`. Em `src/broker/run-agent.ts:118-125`, a lógica de fallback (`eligibleCodes`) já inclui `RATE_LIMITED` como gatilho legítimo de failover entre providers — mas como nenhum adapter (`claude.ts`, `codex.ts`, `gemini.ts`, `opencode.ts`, `agy.ts`) detecta padrões de rate-limit/quota no stderr e lança esse código, todo rate-limit real cai em `PROCESS_EXIT_NONZERO` ou `UNKNOWN_PROVIDER_ERROR` genérico.

**Por que é prática real da comunidade:** A pesquisa enfatiza "Error Envelopes" para permitir auto-correção do LLM e routing "Traffic Cop" que decide com base em sinais reais (rate limit, custo, latência) — não em erros genéricos indistinguíveis. O `CLAUDE.md` deste próprio projeto já registra isso como gotcha conhecido ("Fallback Masquerading: Broker-level fallbacks can mask API/credential failures"), confirmando que a distinção de causa de erro é uma preocupação real do mantenedor, não hipotética.

**Benefício/ROI:** Hoje, sem detecção de rate limit por padrão de texto, o sistema de fallback funciona "por acidente" (qualquer exit não-zero aciona fallback) em vez de por design. Adicionar detecção explícita (regex/heurística de mensagens conhecidas de cada CLI: "rate limit", "quota exceeded", "429", "credit") melhora a precisão do diagnóstico nos logs/envelope de erro e permite, no futuro, tratar rate limit com backoff diferente de falha de auth — sem isso, é impossível medir quantos fallbacks são por rate limit vs. bug real.

**Esforço:** M (heurística por adapter + testes; tocar 5 arquivos de adapter).

---

## 3. Testes de adapter cobrem só parsing — nenhum exercita `run()` ponta-a-ponta via processo real

**O que mudar:** `test/adapters.test.mjs` testa apenas funções puras de parsing (`parseOpenCodeOutput`, etc. — ver linhas 1-40), nunca chama `adapter.run()` com um processo real via injeção de `runProcessFn`. Em contraste, `test/process-runner.test.mjs:12-26` já usa o padrão "re-exec" da pesquisa (spawna `process.execPath -e "..."` para emular um binário de CLI sem precisar do binário real instalado) — mas só para testar `runProcess` isoladamente, não os adapters que o consomem.

**Por que é prática real da comunidade:** A pesquisa descreve exatamente esse padrão ("Re-exec Pattern... testing the true I/O boundaries without needing external binaries") como a forma madura de testar dispatchers que spawnam processos, evitando tanto mocks frágeis quanto dependência de binários externos instalados na máquina de CI.

**Benefício/ROI:** Hoje, um bug em como `claude.ts`/`codex.ts`/`gemini.ts` monta argv, aplica `envAllowlist`, ou interpreta timeout só seria pego em `npm run live:validate` (que exige os CLIs reais instalados) ou em produção. Estender o padrão já existente em `process-runner.test.mjs` para os 5 adapters fecha esse gap em CI puro (`npm test`, sem binários externos), que é exatamente o que o pipeline `ci.yml` já roda hoje sem `live:validate`.

**Esforço:** M (1 helper de fixture reutilizável + casos por adapter).

---

## 4. Matriz de capacidades no README é texto livre, sem fonte única de verdade

**O que mudar:** A tabela em `README.md:97` (Structured Output / Image Analysis / Sandboxed Mode / Skip Permissions por CLI) é mantida manualmente, enquanto a fonte real dessas mesmas capacidades já existe como dado estruturado em cada adapter (`capabilities: ProviderCapabilities` definido via `src/adapters/contract.ts:13-21` e usado em `claude.ts`, `codex.ts`, etc.). Nada garante que a tabela do README continue sincronizada quando um adapter mudar suas capacidades.

**Por que é prática real da comunidade:** A pesquisa cita "Capability Matrices" como padrão de descoberta e "Docs-as-Code" exigindo que documentação acompanhe o código no mesmo PR/CI. Aqui esse acoplamento simplesmente não existe — é dois lugares duplicando a mesma informação sem checagem.

**Benefício/ROI:** Baixo risco hoje (poucos adapters, baixa frequência de mudança), mas o custo de detectar drift manualmente sobe a cada novo provider adicionado. Um teste simples que lê `defaultAdapters` e compara contra uma versão parseada do bloco da tabela no README (ou que gera a tabela e falha o CI se diferir do README) garante que a documentação mais visível do projeto nunca minta sobre o que o broker realmente valida em `assertProviderSupports` (`run-agent.ts:32-40`).

**Esforço:** S/M (script de geração + assert em teste, sem mudar comportamento de runtime).

---

## 5. `CONTRIBUTING.md` não explica que mensagens de commit controlam o versionamento via release-please

**O que mudar:** `.github/workflows/release-please.yml` usa `release-type: node`, que depende inteiramente de Conventional Commits (`feat:`, `fix:`, etc.) no histórico para decidir bump de versão e gerar o CHANGELOG. `CONTRIBUTING.md` (na seção "Submitting Changes") só diz "Commit messages should be clear and descriptive" — não menciona o formato exigido nem o motivo.

**Por que é prática real da comunidade:** A pesquisa descreve "Changesets-First Workflows" e CI gating como o padrão para projetos que automatizam release — o ponto central é que o `CONTRIBUTING.md` deve instruir explicitamente o contribuidor externo sobre o mecanismo de versionamento, já que ele não é óbvio sem ler `.github/workflows/`. (`clibridge` usa `release-please` em vez de `changesets`, o que é uma variante válida do mesmo padrão — não exige adoção de uma ferramenta nova, só documentar a que já existe.)

**Benefício/ROI:** Sem essa seção, um contribuidor externo (alguém sem acesso aos `CLAUDE.md`/regras privadas do mantenedor, que já impõem Conventional Commits só para o próprio usuário) pode abrir PRs com mensagens fora do padrão, gerando releases sem bump de versão correto ou changelog vazio — falha silenciosa que só aparece depois do merge. Custo de adicionar a seção é mínimo; o ganho é eliminar uma classe de erro de release que hoje depende só do mantenedor lembrar de corrigir manualmente.

**Esforço:** S (3-5 linhas de doc).

---

## Resumo de esforço

| # | Item | Esforço |
|---|------|---------|
| 1 | Corrigir nomes de tools MCP (ponto → underscore) | S |
| 2 | Implementar detecção real de `RATE_LIMITED` nos adapters | M |
| 3 | Estender padrão re-exec para testes de `adapter.run()` | M |
| 4 | Sincronizar matriz de capacidades do README com `contract.ts` | S/M |
| 5 | Documentar Conventional Commits no `CONTRIBUTING.md` | S |

Prioridade sugerida: **1 e 5** primeiro (risco zero, esforço mínimo, corrigem inconsistência já observada), depois **2** (fecha gap funcional documentado como gotcha conhecido), depois **3 e 4** (qualidade/manutenibilidade de médio prazo).
