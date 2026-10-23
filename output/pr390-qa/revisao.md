# PR #390 — C1: identidade dos painéis por conversa

O teste agora pertence a describe e verifica três contratos: irmãos com keys
distintas; keys estáveis após recarga SSE da mesma conversa; keys diferentes
e atendimentoId atualizado ao selecionar outra conversa. Na fonte antiga,
conta quatro elementos (desktop e Drawer); a casca308 tem um painel e deve
adaptar essa quantidade a dois ao integrar, preservando os três contratos.

Prova negativa: keys constantes distintas por tipo, sem ID, causaram1falha/
40passes. A produção foi restaurada e comparada sem delta ao HEAD. Recorte
3arquivos/81testes, TypeScript19403 e lint alterados encerraram com saída0,
sem filtro/ignorados. Não houve novo browser, DB ou suíte global local desta
revisão. A implementação de produção permanece a original da PR.

Pais389/388/385/387/386/R6 incorporados por merge normal. Conflito somente no
quadro, ambos os registros preservados. Aguardar389 na main e CI do head final,
além do parecer independente, antes do merge. Nenhum pacote/lock/schema,
permissão, transporte ou comportamento de produção foi alterado nesta revisão.
