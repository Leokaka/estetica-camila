# Roadmap — Camila Garcia Estética (sistema)

## 🎯 BRIEFING DO REBUILD (ler primeiro, sessão dedicada)

**Autorização**: Léo confirmou (jul/2026) que todo o dado hoje no app (clientes Naara, Veronica,
Giovana, Rafa e os agendamentos ligados a eles) é só teste — Camila ainda não usou o sistema pra
valer. Agora que ela tem espaço físico próprio, vai usar de verdade. **Isso libera refazer telas
e estrutura sem medo de perder dado real.** Script pronto pra zerar clientes/agendamentos/lançamentos
de teste (mantém `servicos`, que é catálogo real): `limpar-testes.ps1` — ficou bloqueado pelo
classificador de segurança do Claude Code por ser delete em massa via service role; Léo pode rodar
ele mesmo quando quiser (está no scratchpad da sessão, ou peça pra eu regerar).

**Ângulo estratégico novo**: Camila estuda estética e pode trazer colegas de turma como futuras
clientes/usuárias. Ou seja, o sistema não é só "serve pra Camila" — é uma vitrine que pode virar
negócio pro Léo (outras esteticistas vendo o sistema da colega e querendo o mesmo). Isso eleva a
régua de qualidade: não basta funcionar, tem que impressionar quem já usa sistema profissional
(Trinks etc.) no dia a dia.

**O que NÃO pode quebrar** (lógica testada e funcionando, preservar):
- `proxy.ts` + páginas de auth (`login`, `esqueci-senha`, `redefinir-senha`) — fluxo de recuperação
  de senha via hash fragment do Supabase, já debugado a fundo
- `lib/agenda.ts` (motor de disponibilidade: Seg-Sáb 9h-18h, almoço 13h-14h, grade 15min) e sua
  integração em `agendamentos/page.tsx` — verificado ao vivo, respeita conflito de horário
- Schema do Supabase (`clientes`, `servicos`, `agendamentos`, `lancamentos`) e RLS — o catálogo de
  `servicos` já foi corrigido/reativado, não mexer sem necessidade

**O que É pra questionar e redesenhar livremente**:
- Se o padrão "admin dashboard genérico" (sidebar + tabelas) é mesmo o certo pra uma esteticista
  solo checando o celular entre uma cliente e outra — talvez o fluxo do dia (próximos atendimentos,
  ação rápida de confirmar/WhatsApp) devesse ser o centro, não uma tabela
- Estrutura visual de cada página (`dashboard`, `clientes`, `agendamentos`, `servicos`, `financeiro`)
  além do que já foi feito (cores de marca, Playfair nos títulos, Button/Input/Select elevados)
- Referência de qualidade: projeto "Ateliê da Tatinha" do Léo — foi de MVP genérico pra algo com
  cara de identidade própria do negócio

**Pendente de confirmar com a Camila**: horário exato do almoço (assumi 13h-14h a partir de "a
partir da 1:00", nunca confirmado explicitamente).

**Adiado, não é pra essa sessão**: agendamento self-service público pra cliente (motor já existe
em `lib/agenda.ts`, só falta expor sem autenticação) — Léo pediu explicitamente pra deixar pra depois.

---

> Pesquisa de mercado (jul/2026) confirmou o que falta pra ficar no nível dos sistemas de
> clínica de estética profissionais (tipo Trinks). Ordem de prioridade abaixo.

## 1. Prontuário / Anamnese digital (prioridade alta — questão legal, não só UX)
- Ficha de anamnese por cliente: alergias, contraindicações, procedimentos anteriores
- Termo de consentimento assinado digitalmente (essencial pra injetáveis — botox, preenchimento)
- Fotos antes/depois anexadas por sessão
- Campo de evolução (o que foi feito, reação, observação da Camila)
- Onde entra: nova aba "Prontuário" dentro do perfil de cada cliente (`/clientes/[id]`)

## 2. Controle de estoque de insumos
- Cartucho do jato de plasma, agulha do dermapen, ácidos — cada um tem custo já registrado
  em `servicos.custo`, mas não existe baixa automática de estoque nem alerta de validade/lote
- Sugestão de tabela nova: `estoque` (item, lote, validade, quantidade, custo unitário) +
  `estoque_movimentos` (entrada/saída, vinculado a agendamento quando aplicável)

## 3. Pacotes com controle de sessões usadas
- Já existem serviços tipo "Pacote Massagem Modeladora 5x" no banco, mas o sistema não
  sabe quantas sessões a cliente já usou daquele pacote comprado
- Precisa de tabela `pacotes_vendidos` (cliente, serviço-pacote, sessões totais, sessões usadas, validade)

## 4. Segurança do financeiro (parcialmente feito)
- ✅ Feito: confirmação antes de marcar "realizado" (mostra o valor que vai ser lançado)
- ✅ Feito: exclusão de agendamento/lançamento já pedia confirmação nativa
- Pendente: considerar um "modo simples" pra Camila (só visualização de resumo) vs "modo completo"
  pra quem edita/lança manualmente — hoje as duas coisas estão misturadas na mesma tela

## 5. Identidade visual — feito nessa sessão, mas pode ir mais fundo
- ✅ Feito: Playfair Display nos títulos, paleta de marca em ícones/cores semânticas, marca
  d'água do monograma, cards com sombra quente em vez de ring cinza padrão shadcn
- Se quiser ir além: revisar Button/Input/Select/Badge (ainda usam o visual padrão shadcn,
  só herdam cor via CSS vars — funcional, mas dá pra refinar bordas/radius/hover individualmente)
- Referência de qualidade almejada: projeto "Ateliê da Tatinha" (outro sistema do Léo que já
  passou por essa evolução de MVP → acabado)

## Fontes da pesquisa de mercado
- https://blog.aestheticpro.com.br/qual-o-melhor-sistema-para-clinica-de-estetica-analise-2026/
- https://quarkclinic.com.br/blog/sistema-de-gestao-para-clinicas-de-estetica/
- https://www.belasis.com.br/melhor-gestao-controle-clinica-estetica-software-sistema-agenda-prontuario-estoque-financeiro-brasil/
- https://agendiva.com.br/blog/software-de-gestao-para-clinica-de-estetica

## 6. Horários de funcionamento (feito nessa sessão)
- ✅ Motor de disponibilidade real (`lib/agenda.ts`): Seg-Sáb 9h-18h, almoço 13h-14h,
  respeita a duração de cada serviço e não deixa marcar em cima de agendamento existente
- Base pronta pro agendamento self-service da cliente (item futuro) — é a mesma lógica,
  só falta expor via rota pública sem autenticação

## 7. Bug conhecido (pendente)
- Select de Cliente/Serviço no formulário de "Novo Agendamento" mostra o ID (uuid) no botão
  fechado em vez do nome — funciona certo depois de escolher, só o texto do trigger está errado
