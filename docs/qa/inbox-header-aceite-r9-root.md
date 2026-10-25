# Cabeçalho do Inbox: validação da quebra intrínseca

O cabeçalho preserva nome, status e estado da Aria quando as ações não cabem na mesma linha. Identidade e botões usam quebra intrínseca; o Menu fica fora do container e alinhado à última linha de ações. Permissões, handlers e configuração do projeto não mudam.

Fonte executada: `7e798e6b515784ae53d5c8209701772781534f07`. Build: `QcX9UI909PYyS4KqCFIyQ`.

Verificações concluídas:

- Build original, incluindo TypeScript: sessão 92688, terminal 31b85b, EXIT0. Configurações preservadas.
- Quatro arquivos focais completos, 37 testes, UTC, sem filtros ou skips: 30f207, EXIT0. ESLint do arquivo alterado: 86913/8177ae, EXIT0.
- Medição real em 31 combinações de largura e painel: 46178/04aa2e, EXIT0, sem falhas de legibilidade, sobreposição ou alinhamento. Inclui 320/360/699/700 px, o caso negativo de 1.320 px e larguras úteis de 639/640/641 px.
- Capturas nominais: 52196/823673, EXIT0, 30 imagens dos cinco estados, três larguras e dois temas. TESTER inspecionou as 30 individualmente; parecer favorável restrito ao cabeçalho, SHA256 `eea893d2c21208aae74b00e0a1617a0046e8ff27f662d78ceb22d800e71fd28d`.
- Menu real: 38575/32aed9, EXIT0, 20 cenários nos dois temas. Conferidos limites na tela, foco no item, Escape e devolução de foco ao gatilho. O teste fecha o painel modal pelo controle real antes de interagir com o fundo; não usa force click nem escolhe ações de negócio.
- Auditoria posterior: 6bfb2c, EXIT0. Os 1.379 registros originais e 424 hashes foram preservados; nas 47 linhas fictícias, somente as sete datas técnicas explicitamente permitidas mudaram. A flag do número fictício recompôs seu hash original em a96160, EXIT0.

Os negativos anteriores permanecem registrados: nome reduzido a 22,97 px em largura útil de 660 px, desalinhamento em 699 px, seletores de status excessivamente amplos e tentativas do teste de clicar atrás de um painel modal. No produto corrigido, o nome mediu 130,13 px nesses casos. A instrumentação passou a selecionar o título no primeiro filho estrutural da faixa; o feedback continua montado. O ensaio com CSS temporário foi apenas diagnóstico e não foi apresentado como captura do produto compilado.

A comparação usa 24 referências estruturais do protótipo. Seis cenas do vendedor ficam sem par fiel porque a decisão D1 aprovada difere da demonstração original. A altura natural e a segunda linha preservam ações autorizadas; não se exige repetir o truncamento do protótipo. A proteção existente do ancestral para telas curtas foi mantida.

Este aceite cobre a apresentação do cabeçalho e as interações do Menu descritas acima. Não homologa os demais fluxos, cartões, compositor, tarefas ou autorização do servidor. Os gates globais de 1.009 arquivos/8.753 testes pertencem à composição anterior `57822fc2`, e não são reatribuídos a esta mudança de classes.

As imagens e os recibos privados permanecem fora do Git. A publicação dos binários depende da autorização específica do dono. CI após integrar as bases, demais gates de cada issue e merges continuam separados; nenhuma issue foi fechada por esta validação.
