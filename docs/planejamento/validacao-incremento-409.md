# Incremento 409 — publicação e início da reprodução Drive

2026-09-14. A publicação do material pela operação da gestão ganhou teste de integração próprio. Sem prazo configurado, nada é publicado; com configuração, a janela usa exatamente a quantidade definida. Repetir a publicação conserva o material e o início/prazo originais. A ação agora identifica material já publicado sob o lock da reposição e informa o motivo, em vez de depender da falha de unicidade do banco.

## Evidência

- Sete testes operacionais passaram: `docs/validacao-publicacao-409-2026-09-14.json`.
- Após tornar explícita a recusa de publicação repetida, o teste específico passou novamente (um executado, seis não selecionados).
- Sem implantação ou uso de dados reais.

## Próxima frente em execução

Adaptador de vídeo Drive separado da autorização de acesso por matrícula. A API documenta `files.get`, `alt=media`, suporte a drives compartilhados e leitura parcial com Range: [referência files.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get), [download de arquivos](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

O adaptador ainda está em implementação; consulta de permissões no ERP está em revisão. Credenciais, acesso real ao drive institucional, desempenho e operação não estão validados. Liberação de entrega para matrícula pausada não deve ser interpretada como liberação automática de gravação.

Relatos pela equipe/professor e descarte explícito continuam em implementação. O escopo integral da SPEC permanece aberto.
