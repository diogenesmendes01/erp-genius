// Trilha de navegação (breadcrumb) do shell — docs/42-auditoria-frontend-ux.md, E2. Em nível 4, 5, 6
// a tela não dizia onde se estava nem como subir: "Voltar" tinha 65 redações e o menu lateral só
// conhece a área. A trilha é derivada do caminho: cada ancestral que é uma PÁGINA vira um link.
//
// Chaves: rotas com page.tsx, com `*` no lugar de cada segmento dinâmico ([id], [propostaId]…).
// Um teste confere que toda chave (e todo destino de SEM_PAGINA) existe no sistema de arquivos —
// a trilha nunca aponta para um 404. Rota fora do mapa simplesmente não aparece na trilha.

export const ROTULOS_TRILHA: Record<string, string> = {
  // Áreas
  "/academico": "Acadêmico",
  "/alunos": "Alunos",
  "/carteiras": "Carteiras",
  "/comissoes": "Comissões",
  "/configuracao": "Configuração",
  "/diario": "Diário de aulas",
  "/empresas": "Empresas",
  "/financeiro": "Financeiro",
  "/home": "Home",
  "/inbox": "Inbox",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/preferencias": "Preferências",
  "/secretaria": "Secretaria",

  // Acadêmico
  "/academico/admissoes": "Admissões",
  "/academico/admissoes/*": "Janela de admissão",
  "/academico/admissoes/excecoes": "Exceções de ingresso",
  "/academico/admissoes/excecoes/*": "Exceção de ingresso",
  "/academico/avaliacoes": "Avaliações",
  "/academico/avaliacoes/*": "Avaliações da matrícula",
  "/academico/avaliacoes/*/*": "Avaliação",
  "/academico/avaliacoes/*/equivalencia": "Aproveitamento",
  "/academico/avaliacoes/*/extras": "Oportunidades extras",
  "/academico/avaliacoes/*/fechamento": "Fechamento do nível",
  "/academico/calendario": "Calendário",
  "/academico/calendario/novo": "Novo calendário",
  "/academico/calendario/*": "Calendário",
  "/academico/calendario/*/replanejamento": "Replanejamento",
  "/academico/calendario/*/revisoes": "Revisões",
  "/academico/correcoes": "Correções",
  "/academico/correcoes/*": "Correção",
  "/academico/equivalencias": "Aproveitamentos",
  "/academico/equivalencias/*": "Proposta de aproveitamento",
  "/academico/grades": "Grades",
  "/academico/grades/nova": "Nova grade",
  "/academico/grades/*": "Grade",
  "/academico/indisponibilidades": "Indisponibilidades docentes",
  "/academico/modalidades/quantidade": "Quantidade de aulas",
  "/academico/recuperacoes": "Recuperações",
  "/academico/recuperacoes/*": "Recuperação",
  "/academico/recuperacoes/designadas": "Minhas recuperações",
  "/academico/recuperacoes/planos": "Planos de recuperação",
  "/academico/recuperacoes/planos/*": "Plano de recuperação",
  "/academico/regras": "Regras de avaliação",
  "/academico/regras/*": "Regra do nível",
  "/academico/regras/turmas/*": "Regra da turma",
  "/academico/reposicoes": "Reposições",
  "/academico/segundas-chamadas/agendas": "Agendas de segunda chamada",
  "/academico/segundas-chamadas/minhas": "Minhas segundas chamadas",
  "/academico/segundas-chamadas/pendentes-agenda": "Segundas chamadas pendentes",
  "/academico/segundas-chamadas/*/*": "Segunda chamada",

  // Alunos
  "/alunos/*": "Ficha do aluno",
  "/alunos/*/academico": "Acadêmico",
  "/alunos/*/agenda-aditivo": "Agenda para aditivo",
  "/alunos/*/financeiro": "Financeiro",
  "/alunos/*/movimentacoes": "Movimentações",
  "/alunos/*/portal": "Portal",
  "/alunos/*/creditos/*": "Crédito",
  "/alunos/turma/*": "Alunos da turma",

  // Configuração
  "/configuracao/catalogo": "Catálogo",
  "/configuracao/contratos": "Contratos",
  "/configuracao/contratos/novo": "Novo modelo",
  "/configuracao/contratos/*": "Modelo de contrato",
  "/configuracao/migracao": "Migração",
  "/configuracao/migracao/*": "Lote",
  "/configuracao/operacao": "Operação",
  "/configuracao/operacao/avisos-diario": "Avisos do diário",
  "/configuracao/paises": "Países",
  "/configuracao/turmas": "Turmas",
  "/configuracao/usuarios": "Usuários",
  "/configuracao/whatsapp": "WhatsApp",
  "/configuracao/whatsapp/numeros": "Números",
  "/configuracao/whatsapp/templates": "Templates",
  "/configuracao/whatsapp/politica": "Política da régua",
  "/configuracao/whatsapp/avisos-agenda": "Avisos da agenda",
  "/configuracao/whatsapp/comercial": "Comercial",
  "/configuracao/whatsapp/reguas": "Régua comercial",

  // Diário
  "/diario/encontros": "Encontros",
  "/diario/encontros/*": "Encontro",
  "/diario/encontros/*/cancelamento": "Cancelamento",
  "/diario/encontros/*/correcao": "Correção",
  "/diario/encontros/*/gravacao": "Gravação",
  "/diario/encontros/*/remarcacao": "Remarcação",
  "/diario/excecoes-gravacao": "Exceções de gravação",
  "/diario/pendencias": "Pendências",
  "/diario/regularizacoes": "Regularizações de aula",
  "/diario/regularizacoes-gravacao": "Regularizações de gravação",
  "/diario/reposicoes": "Reposições",

  // Empresas, leads
  "/empresas/*": "Empresa",
  "/leads/*": "Ficha do lead",
  "/leads/*/contratacao": "Contratação",

  // Financeiro
  "/financeiro/acertos-cobertura": "Correções de cobertura",
  "/financeiro/acertos-taxa": "Acertos de taxa",
  "/financeiro/continuidade": "Continuidade mensal",
  "/financeiro/desistencias": "Desistências",
  "/financeiro/migracao": "Conciliação da migração",
  "/financeiro/migracao/*": "Linha da migração",
  "/financeiro/permuta": "Permutas",
  "/financeiro/recebimentos": "Recebimentos",

  // Matrículas (o registro tem o próprio cabeçalho com as seções)
  "/matriculas/nova": "Nova matrícula",
  "/matriculas/*": "Matrícula",
  "/matriculas/*/contrato": "Contrato",
  "/matriculas/*/contrato/aditivos": "Aditivos",
  "/matriculas/*/contrato/aditivos/*": "Proposta de aditivo",
  "/matriculas/*/contrato/substituicoes": "Substituições",
  "/matriculas/*/desistencia": "Desistência",
  "/matriculas/*/ocorrencias-financeiras": "Ocorrências financeiras",

  // Secretaria
  "/secretaria/avisos-agenda": "Avisos da agenda",
  "/secretaria/desistencias": "Desistências",
  "/secretaria/envios-portal": "Envios do portal",
  "/secretaria/reservas": "Reservas",
  "/secretaria/reservas/*": "Reserva",
};

/** Segmentos que não têm página própria mas fazem parte do caminho: a trilha mostra o destino que os representa. */
export const SEM_PAGINA: Record<string, { href: string; rotulo: string }> = {
  "/matriculas": { href: "/secretaria", rotulo: "Matrículas" },
};

export type ItemTrilha = { href: string; rotulo: string; atual: boolean };

const prefixosDasChaves = new Set(
  [...Object.keys(ROTULOS_TRILHA), ...Object.keys(SEM_PAGINA)].flatMap((chave) => {
    const partes = chave.split("/").filter(Boolean);
    return partes.map((_, i) => "/" + partes.slice(0, i + 1).join("/"));
  }),
);

/** Identificadores (cuid, uuid, códigos numerados) têm dígito; segmentos estáticos das rotas, não. */
const pareceIdentificador = (segmento: string) => /\d/.test(segmento);

/**
 * Trilha do caminho atual: os ancestrais conhecidos (links) e, se conhecido, o próprio (atual).
 * Cada segmento é comparado primeiro literalmente ("novo", "reservas"). Fora do mapa, só um
 * segmento com cara de identificador é tratado como dinâmico (`*`); um segmento estático
 * desconhecido ENCERRA a trilha — tratá-lo como `*` levaria a uma página de registro com um id
 * inventado ("/academico/recuperacoes/tentativas" não é a recuperação "tentativas").
 * Query string e barra final são ignoradas.
 */
export function trilhaDoCaminho(caminho: string): ItemTrilha[] {
  const segmentos = caminho.split(/[?#]/)[0].split("/").filter(Boolean);
  const itens: ItemTrilha[] = [];
  let padrao = "";
  for (const [i, segmento] of segmentos.entries()) {
    const literal = `${padrao}/${segmento}`;
    if (prefixosDasChaves.has(literal)) padrao = literal;
    else if (pareceIdentificador(segmento) && prefixosDasChaves.has(`${padrao}/*`)) padrao = `${padrao}/*`;
    else break;
    const href = "/" + segmentos.slice(0, i + 1).join("/");
    const atual = i === segmentos.length - 1;
    const rotulo = ROTULOS_TRILHA[padrao];
    if (rotulo) itens.push({ href, rotulo, atual });
    else if (SEM_PAGINA[padrao]) itens.push({ ...SEM_PAGINA[padrao], atual: false });
  }
  return itens;
}
