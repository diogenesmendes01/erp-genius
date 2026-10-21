# Incremento 612 — adaptadores de revisão fixa do Drive

## Código implementado

- `drive-revisao.ts`: captura a revisão de cabeça, solicita retenção keepForever e confirma a mesma identidade antes de retornar; consulta posterior aceita cabeça nova mas exige revisão persistida e permanente, Drive, checksum, tamanho e MIME coerentes.
- `drive-revisao-stream.ts`: lê somente revisions/{revisionId}?alt=media; mantém Range e confere total da revisão. Não usa fallback para a cabeça. Erros e timeouts são genéricos; token e adaptadores que ignoram AbortSignal têm prazo efetivo.
- `drive.ts`: correção de Range sufixo, distinguindo quantidade de bytes da posição final; valida o início/fim do sufixo contra o total.

## Verificações

37 testes focados passaram, zero falhas, em docs/validacao-unitaria-estavel-612-2026-09-16.json. TypeScript e lint focado passaram. Primeiro relatório unitário612 preserva duas falhas que revelaram o erro de sufixo; corrigidas antes da execução estável. Testes de provedor usam fetch simulado, sem chamadas reais.

## Integração ainda necessária

Estes adaptadores ainda não foram ligados à publicação nem às rotas do ERP. Não declarar controle de revisão entregue ao usuário. Migration146, persistência, propagação em correções/material derivado, recusa de legado sem revisão e fixtures estão mapeados em [mapa-integracao-revisao-612.md](mapa-integracao-revisao-612.md). Não houve schema/migration nova nem mutação do Drive.

A regressão integral611 segue na sessão20856, sem segunda execução DB em paralelo. Homologação real de desempenho/permissões/custos permanece pendente.

Referências oficiais e requisitos: [gravacoes-revisao-fixa-611.md](gravacoes-revisao-fixa-611.md).
