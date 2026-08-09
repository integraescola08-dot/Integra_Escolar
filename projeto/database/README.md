# Banco de dados — o que rodar em cada situação

## Já tenho um banco rodando e só quero atualizar
Rode **só** este:

```
mysql -u seu_usuario -p integra_escolar < atualizar_banco.sql
```

É seguro rodar quantas vezes quiser — ele só adiciona o que estiver
faltando (colunas, tabelas, índices), nunca apaga nada. Não importa
se você já tinha rodado `ajustes_v3_1.sql` ou `migracao_administrador.sql`
antes ou não: o resultado final é o mesmo.

## Vou montar um banco novo, do zero
1. `banco_completo.sql`
2. `dados_teste.sql` (opcional — cria usuários de teste)
3. `atualizar_banco.sql` (adiciona tudo que veio depois: categoria/arquivo
   da ocorrência, nível de Administrador, tabelas de Coordenador/Porteiro)

## Arquivos antigos (não usar mais diretamente)
`ajustes_v3_1.sql` e `migracao_administrador.sql` foram os scripts que,
com o tempo, foram criando as mudanças acima aos poucos. Todo o
conteúdo deles já está dentro de `atualizar_banco.sql`, então não
precisam mais ser rodados separadamente — ficam aqui só de histórico.

`integra_escolar_banco_completo.sql` é uma versão intermediária
(`banco_completo.sql` + `ajustes_v3_1.sql` já misturados, mas **sem**
Administrador/Coordenador/Porteiro) — também não usar mais. Prefira o
fluxo "banco novo" acima.
