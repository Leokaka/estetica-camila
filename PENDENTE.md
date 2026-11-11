# Pendências — sistema da Camila

Mapeado em 11/11/2026. Nada aqui é urgente; o sistema está em uso normal.

## 1. Repositório privado
O repositório no GitHub (`Leokaka/estetica-camila`) está **público**. Não há chave
nem senha no código (conferido em 11/11), mas os dados de negócio e a estrutura
ficam visíveis. Trocar para privado em GitHub → Settings → Change visibility.
Conferir depois se a Vercel continua publicando a cada push.

## 2. Pedido de avaliação: marcar quem já recebeu
Desde 07/11 o cartão da cliente tem o botão "Pedir avaliação no Google". Falta o
sistema lembrar quem já recebeu o pedido, pra Camila não mandar duas vezes.
Ideia: gravar a data do pedido na cliente (coluna nova em `clientes`, só adiciona)
e trocar o botão por "Pedido enviado em dd/mm". Mexe no banco — perguntar antes.

## 3. Textos da Camila
Nunca tratar a Camila como iniciante nas mensagens ("pra quem está começando").
Ela é profissional. Pedidos de avaliação falam do valor pra outras clientes.
