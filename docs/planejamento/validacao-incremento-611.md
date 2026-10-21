# Incremento 611 — vídeo institucional e revisão fixa

## Implementação

A rota de vídeo institucional usa agora o stream autorizado. A identidade é capturada no contexto HTTP; cada leitura relê usuário ativo, papéis e escopo de consulta do diário. Troca de fonte impede continuar. A revalidação acontece antes da leitura e antes da entrega do trecho. Teste adicional também verifica revogação enquanto um trecho está sendo aguardado, descartando os bytes recebidos posteriormente.

Limite explícito: o modelo de sessão do funcionário não expõe identificador/versão/expiração do JWT no guard atual. A nova proteção cobre inativação, papéis e atribuição; não comprova revogação isolada de token independente desses controles. Bytes já enviados ou no buffer do cliente não são recuperados.

## Validação

Regressão unitária atual: 1240 testes aprovados, zero falhas e zero pendentes, relatório docs/validacao-unitaria-611-2026-09-16.json. TypeScript e lint focado passaram. Build finalizado com código 0: docs/validacao-build-611-2026-09-16.log. Regressão integral de banco reiniciada com dependências restauradas, sessão20856; não contabilizar aprovação antes de finalizar. Não executar outro teste DB em paralelo.

## Controle de revisão

Pesquisa oficial e requisitos de implementação em [gravacoes-revisao-fixa-611.md](gravacoes-revisao-fixa-611.md). A revisão fixa ainda não está implementada. Nenhuma migration146 foi criada/aplicada; não houve alteração externa no Drive. F07.7 permanece parcial e homologação real de capacidade continua pendente.
