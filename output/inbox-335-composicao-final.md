# Inbox #335 — composição final sobre main

O painel do atendimento passa a oferecer links para a matrícula autorizada, usando o código como texto e o ID como destino. O Funil abre a Pessoa correta em Contatos, e o encoder compartilhado monta links internos de conversa sem aceitar origem/query arbitrária. As páginas de destino continuam revalidando seus próprios escopos; a leitura contextual D13 não concede CRM global.

Base direta main `6fe0e49ad5cd6c6dc5e929494d62b33a7770cc26`, squash da #413; issue324 CLOSED/completed confirmada. Selecionados apenas produto4c76, harness86f1/6e498 e documentos88b: commits finais f3ae13ff, d3d8a9b7,8f8ec7e2,e0b35f2c. Nenhuma migração, dependência ou história agregada foi incorporada.

Fonte final `e0b35f2c54d90ad79cfc70ef69d20b688290de29`. A preparação `bf3443f4a922d2290ec18d372a4d2edf3ae69fb1` foi rebaseada depois de conferir que o squash413 tem árvore integralmente igual ao seu head. Árvores antes/depois: `24187200c15d98ba45c420143effeb0cd256710a`, prova ac15e7/saída0. O rebase mudou somente ancestralidade. O único conflito documental anterior preservou os1.092.666bytes do quadro e acrescentou exclusivamente1.504bytes do bloco335.

## Verificação

- Global ROOT na preparação de árvore igual à final: sessão1276/d02cc7,saída0,916arquivos/7.205testes,201,27s,Node22,maxWorkers2,sem filtro/skips; configuração unitária exclui integração.
- TypeScript global1218/621415,saída0,heap8192. Lint global final38745/80d965,saída0,zeroerros/40avisosherdados,com o teto40doCI. A primeira execução saiu0 com43avisos: três vinham de dois helpers privados temporários não publicados; esses usos não necessários foram removidos e o lint completo repetido. Nenhuma guarda ou limite mudou.
- TESTER no SHAexatoE0:19arquivos/139unitários,f1dbe4,saída0,3,22s. A prova estática aba719 confirmou nove paths de produto iguais a4c76,nove de harness iguais a6e498,três do fixTags iguais a7ff e os três paths C5 iguais a0e4. Schema e dependências permanecem iguais à base.
- Integração independente da preparaçãoa4f6: sessão56263/6a6c55,saída0,3arquivos completos/32testes,121,66s,perfilintegracao/cliente487,maxWorkers1,semfiltro/skips. Arquivos:paineis.int,paineis-envio.int,painel-detalhes.int. A mudança posterior emSRC/SCRIPTS consiste somente nos três paths C5járevisados/testados na413,sem alterar o código335; não se inventa nova execução desses32emE0. O integrador restaurou o banco ao concluir as suítes coordenadas,424hashes/snapshotmantido.

A revisão original4c76 também permanece nominal:5arquivos/38unitários em duas chamadas e3/32INT,sem somar como casos distintos à nova rodada. Os seis pareceres completos, hashes físicos/LF, fontes e execuções estão no [índiceQA](inbox-335-qa/indice.json). Uma tentativa administrativa do TESTER usou um SHA de41caracteres e terminou antes das comparações; o parecer final preserva19cd01negativo e a prova correta posterior.

## Evidência visual

64PNGpositivas originais:24formais+40complementares,4.273.828bytes,fontes produto4c76/harness6e498. Inspeção independente conferiu64hashes e pranchas de navegação/alcance, além dos originais críticos. A matrícula e Contatos foram abertos por navegação real; o convidado sem papel de matrícula recebeu o resultado de acesso negado. O protótipo funcional éN/Aexplicitamente. Não houve nova captura na composição atual.

O link móvel aparece inteiro em y482,5–499,5deuma janela500: depende de rolagem local/Tab e tem0,5px de folga, sem promessa de margem maior. DuasEventSourcessequenciais significam máximo uma simultânea; não uma construção total. As rodadas negativas e as fotos com Preferences doNext estão fora da lista positiva.

[Pacote privado curado](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-335-aceite-4c76-6e498-20261023.zip):4.321.966bytes,SHA256 `ed71e143255c6f540ce6e5223c1ccc7b4f416db48a66c572f9b2b7d6eea38a6c`,asset670649541. Upload9435c8 e roundtripautenticadof689c7 terminaram0,hashidêntico. Release421321214mantida em rascunho. Só64PNG+manifesto/READMEcurados; sem credenciais, brutos ou PNG/ZIPnoGit.

## Limites

Sem schema/dependências, novas consultas por item, alteração de permissão, polling/SSE adicional, envio real, ativação de integração ou deploy. As 11linhas fictícias do aceite visual foram retiradas pelo restauroA c538fc,424hashesconferidos. #335 não implementa os atalhos de entrada336nem o consumidor de agendarE4. O commit final desta publicação acrescenta somenteQA/documentos;CIremoto,novoscomentáriosemergeaindapendentes. Não marcar issue concluída antecipadamente.
