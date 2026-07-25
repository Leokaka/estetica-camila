# Roadmap — Camila Garcia Estética (sistema)

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
