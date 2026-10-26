# #372 — colisão de cadastro por telefone, C9

Uma corrida entre a leitura e a criação de ContatoWhatsApp podia reverter a operação corretamente, mas mostrar erro genérico. O catch local agora reconhece exclusivamente P2002 da classe Prisma, modelo ContatoWhatsApp e alvo exato telefoneE164 e devolve a mensagem de cadastro/acesso alterado. Outros erros preservam sua identidade. Não há retry automático, consulta após aborto ou adoção do cadastro concorrente.

Origem DEV a41792ca85e2e2a66e55889b87086bf59025d537, selecionada por quatro blobs sobre a fonte pública 8a29b27f0892c2ef94ac87435150b3407766756d, sem ancestrais privados. Preimages e hashes conferidos. C4, inbound, UI, mapas, schema e dependências permanecem iguais à base.

DEV: arquivo unitário EX completo50/50, lint3 e TypeScript original código0. Três cenários nativos autorizados pelo dono reproduziram duas falhas de mensagem e um controle; o mesmo arquivo passou3/3 após a correção, sem filtros, retries ou timeout novo. Terminais RED e2f2ed, GREEN24156f. O integrador restaurou o banco descartável ao snapshot506 depois das duas fases.

C10: duas amostras de colisão COMMIT medem apenas esses cenários instrumentados. Não representam carga, percentis, SLA ou garantia de conclusão em5s. O timeout permanece igual; a medição mais ampla continua pendente.

QA independente desta composição ainda pendente. Os gates globais1091arquivos/9869casos, TypeScript, lint e build pertencem à base8a29, antes deste catch; não foram reatribuídos ao novo commit. Esta PR continua em rascunho, com dependências e aceite visual próprios.
