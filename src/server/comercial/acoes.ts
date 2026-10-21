"use server";

import { revalidatePath } from "next/cache";
import { Papel, EtapaLead, CategoriaDocumento, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { hashEntrada, marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import {
  exigirSessao,
  exigirSessaoComPapel,
  exigirPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  resolverDonoLead,
  normalizarTelefoneE164,
  podeCheckinExperimental,
  professorNoEscopoExperimental,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import { moverEtapaTx } from "@/server/crm/mover-etapa";
import { escopoPessoas, garantirPessoaTx } from "@/server/crm/pessoas";
import {
  EVENTO_EXPERIMENTAL_ATRIBUIDA,
  professorAtribuido,
} from "./experimental";

/** DDI do país do lead (para normalizar o telefone); "" se sem país. */
async function ddiDoPais(paisId?: string | null): Promise<string> {
  if (!paisId) return "";
  return (await prisma.pais.findUnique({ where: { id: paisId } }))?.ddi ?? "";
}
import {
  LeadSchema,
  CriarLeadSchema,
  ResumoSchema,
  DatasSchema,
  InteracaoSchema,
  PerdaSchema,
  AgendarExperimentalSchema,
  NotaInternaSchema,
  type LeadInput,
  type CriarLeadInput,
  type ResumoInput,
  type DatasInput,
  type InteracaoInput,
  type PerdaInput,
  type AgendarExperimentalInput,
  type NotaInternaInput,
} from "./schema";
import { Temperatura } from "@prisma/client";
import { analisarComDatasDaEscola } from "@/server/_shared/validacao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { ultimoEventoDoAutor } from "@/server/_shared/idempotencia";

/** Valida que `professorId` aponta para um usuário com papel PROFESSOR. */
async function exigirProfessorValido(professorId: string) {
  const professor = await prisma.usuario.findUnique({ where: { id: professorId } });
  if (!professor) throw new ErroRegra("Professor não encontrado.");
  if (!professor.papeis.includes(Papel.PROFESSOR)) {
    throw new ErroRegra("Usuário informado não é professor.");
  }
}

const PAPEIS_COMERCIAL: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];

const DATA_CIVIL_LITERAL = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * O banco mantém datas como instantes. No evento, porém, conservamos também a
 * data civil que a pessoa informou quando ela estava explícita e válida. Isso
 * evita que uma leitura histórica escolha retroativamente um fuso inexistente.
 */
function dataCivilOriginal(valor: unknown, normalizada: Date | undefined) {
  if (typeof valor !== "string" || !normalizada) return null;
  const partes = DATA_CIVIL_LITERAL.exec(valor);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  if (calendario.getUTCFullYear() !== ano || calendario.getUTCMonth() !== mes - 1 || calendario.getUTCDate() !== dia) return null;
  return normalizada.getFullYear() === ano && normalizada.getMonth() === mes - 1 && normalizada.getDate() === dia ? valor : null;
}

function revalidarLead() {
  revalidatePath("/funil");
  // A inbox mostra o funil do lead no cockpit da thread — mudou o lead, a thread reflete.
  revalidatePath("/inbox");
}

/** Carrega o lead garantindo que o usuário pode vê-lo (vendedor só os próprios). */
async function exigirLeadVisivel(id: string, usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  exigirPapel(usuario, ...PAPEIS_COMERCIAL);
  const lead = await tx.oportunidade.findFirst({ where: { AND: [{ id }, await escopoComercialAtual(usuario, tx)] } });
  if (!lead) throw new ErroPermissao("Oportunidade fora da sua carteira.");
  return lead;
}

async function exigirDestinoComercial(usuario: UsuarioSessao, id: string | null, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!id) {
    if (!usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroRegra("Selecione um vendedor da sua equipe.");
    return;
  }
  const destino = await tx.usuario.findFirst({ where: { id, ativo: true, papeis: { has: Papel.VENDEDOR } }, select: { id: true, gerenteComercialId: true } });
  if (!destino) throw new ErroRegra("Selecione um vendedor ativo.");
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && destino.id !== usuario.id &&
    !(usuario.papeis.includes(Papel.GERENTE_COMERCIAL) && destino.gerenteComercialId === usuario.id)) {
    throw new ErroPermissao("O vendedor não pertence à sua equipe.");
  }
}

async function exigirDocumentoPermitido(leadId: string, categoria: CategoriaDocumento, usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!Object.values(CategoriaDocumento).includes(categoria)) throw new ErroRegra("Categoria inválida.");
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return;
  if (categoria === CategoriaDocumento.OUTRO) throw new ErroRegra("Classifique o documento pela finalidade antes de compartilhá-lo.");
  if (usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    const matricula = await tx.matricula.findUnique({ where: { leadId }, select: { secretariaAssumiuEm: true } });
    if (matricula?.secretariaAssumiuEm) return;
    // Acumular secretaria não revoga a coleta inicial já autorizada pela carteira.
    if (!usuario.papeis.some((p) => p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL || p === Papel.PROFESSOR)) throw new ErroPermissao("Assuma a matrícula antes de alterar os documentos administrativos.");
  }
  if (categoria === CategoriaDocumento.TESTE_NIVEL && usuario.papeis.includes(Papel.PROFESSOR)) {
    const experimental = await tx.oportunidade.findFirst({ where: { id: leadId, professorExperimentalId: usuario.id }, select: { id: true } });
    if (experimental) return;
  }
  await exigirLeadVisivel(leadId, usuario, tx);
  const matricula = await tx.matricula.findUnique({ where: { leadId }, select: { secretariaAssumiuEm: true } });
  if (matricula?.secretariaAssumiuEm && categoria !== CategoriaDocumento.PROPOSTA) throw new ErroPermissao("Solicite a correção documental à secretaria.");
}

export async function criarLead(input: CriarLeadInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const { chaveIdempotencia, ...dados } = CriarLeadSchema.parse(input);
    // Idempotência (#166): a chave e o hash da entrada vão no payload do `LeadCriado`.
    const marca = chaveIdempotencia ? { chaveIdempotencia, entradaHash: hashEntrada(dados) } : null;

    // Vendedor vira dono por padrão; só gerente/admin podem atribuir a outro vendedor.
    // O servidor ignora qualquer vendedorDonoId enviado por um vendedor (doc 09).
    const donoId = resolverDonoLead(autor, dados.vendedorDonoId);
    await exigirDestinoComercial(autor, donoId);
    const ddi = await ddiDoPais(dados.paisId);

    const id = await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "LeadCriado", agregadoTipo: "Lead", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outros dados. Recarregue a página e confira se a oportunidade já aparece antes de repetir.",
        });
        if (repetido) return repetido.agregadoId;
      }
      const codigo = await gerarCodigo("lead");
      const telefoneE164 = normalizarTelefoneE164(dados.telefoneE164, ddi);
      // `Empresa` não tem dono nem carteira; o escopo possível é o cadastro estar ativo. Inexistente ou
      // inativa devolve a mesma mensagem, em vez de estourar a FK (P2003) num erro genérico.
      let empresaId = dados.empresaId || null;
      if (dados.criarEmpresa && (empresaId || dados.pessoaId)) {
        throw new ErroRegra("Oportunidade de empresa nova não leva empresa nem contato já existentes.");
      }
      if (empresaId) {
        const empresa = await tx.empresa.findFirst({ where: { id: empresaId, ativo: true }, select: { id: true } });
        if (!empresa) throw new ErroRegra("Empresa não encontrada.");
      } else if (dados.criarEmpresa) {
        // Ruling (C2 da R1 do #196): no modo Empresa a oportunidade nasce ligada a uma `Empresa` prospect, criada
        // com o nome e o contato digitados, e nenhuma `Pessoa` recebe o nome da empresa. Participantes
        // (`ParticipanteOportunidade`) entram depois, pela ficha.
        const codigoEmpresa = await gerarCodigo("empresa", tx);
        const empresa = await tx.empresa.create({
          data: {
            codigo: codigoEmpresa,
            nome: dados.nome,
            paisId: dados.paisId || null,
            contatoTelefone: telefoneE164,
            contatoEmail: dados.email || null,
            origemCanal: dados.origemCanal ?? null,
          },
        });
        empresaId = empresa.id;
        await registrarEvento(tx, {
          tipo: "EmpresaCriada",
          agregadoTipo: "Empresa",
          agregadoId: empresa.id,
          autorId: autor.id,
          payload: { codigo: codigoEmpresa, nome: empresa.nome, origem: "oportunidade" },
        });
      }
      // Comportamento intencional nesta fase (R1 do PR #194, C2): com `pessoaId` informado, o telefone não
      // entra em `ContatoWhatsApp`; e o `email` digitado só vai para a Pessoa quando ela é criada aqui (via
      // `garantirPessoaTx`). Pessoa já existente — informada, achada pelo contato ou pelo aluno/responsável —
      // não tem telefone nem e-mail atualizados por esta ação.
      let pessoaId = dados.pessoaId || null;
      if (pessoaId) {
        // Fora do escopo do autor (ou lápide) é indistinguível de inexistente: não vaza o contato.
        const existente = await tx.pessoa.findFirst({
          where: { AND: [{ id: pessoaId }, await escopoPessoas(autor, tx)] },
          select: { id: true },
        });
        if (!existente) throw new ErroRegra("Contato não encontrado.");
      } else if (!dados.criarEmpresa) {
        pessoaId = (
          await garantirPessoaTx(
            tx,
            { nome: dados.nome, telefoneE164, email: dados.email || null, origemCanal: dados.origemCanal },
            autor.id,
          )
        ).pessoaId;
      }
      const lead = await tx.oportunidade.create({
        data: {
          codigo,
          nome: dados.nome,
          telefoneE164,
          pessoaId,
          origemCanal: dados.origemCanal ?? null,
          empresaId,
          paisId: dados.paisId || null,
          segmento: dados.segmento,
          temperatura: dados.temperatura,
          b2b: dados.criarEmpresa || dados.b2b,
          vendedorDonoId: donoId,
          origemCampanha: dados.origemCampanha || null,
          origemConjunto: dados.origemConjunto || null,
          origemAnuncio: dados.origemAnuncio || null,
          origemPalavra: dados.origemPalavra || null,
          valorPrevisto: dados.valorPrevisto ?? null,
          planoPrevisto: dados.planoPrevisto || null,
          comissaoPrevista: dados.comissaoPrevista ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadCriado",
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        autorId: autor.id,
        payload: { codigo, nome: lead.nome, segmento: lead.segmento, b2b: lead.b2b, pessoaId, empresaId, ...marca },
      });
      if (donoId) {
        await registrarEvento(tx, {
          tipo: "LeadAtribuido",
          agregadoTipo: "Lead",
          agregadoId: lead.id,
          autorId: autor.id,
          payload: { de: null, para: donoId },
        });
      }
      return lead.id;
    });

    revalidarLead();
    return { id };
  });
}

// ── Cockpit do vendedor na inbox (doc 08 §CRM alimentado pela conversa) ──────
// Ações pequenas para o vendedor operar o funil SEM sair da conversa. Reusam as mesmas
// garantias das telas: papel comercial, escopo row-level do lead e evento auditável.

/**
 * NOTA INTERNA sobre o lead: comentário da equipe, **nunca enviado ao contato**.
 * Distinta de `registrarInteracao` (que registra um contato REAL — ligação/presencial).
 * Com `chaveIdempotencia` (#166), o reenvio da mesma tentativa não grava outra nota (a chave vai no payload do Evento).
 */
export async function registrarNotaInterna(leadId: string, input: NotaInternaInput & { chaveIdempotencia?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    const { nota } = NotaInternaSchema.parse(input);
    const marca = marcaIdempotencia(ChaveIdempotenciaSchema.optional().parse(input.chaveIdempotencia), { leadId, nota });

    await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "NotaInterna", agregadoTipo: "Lead", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra nota. Recarregue a página e confira se a nota já aparece no histórico antes de repetir.",
        });
        if (repetido) return;
      }
      await registrarEvento(tx, {
        tipo: "NotaInterna",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { nota, ...marca },
      });
    });
    revalidarLead();
  });
}

/** Temperatura do lead em 1 clique (Quente/Morno/Frio) — sem abrir o formulário inteiro. */
export async function definirTemperatura(leadId: string, temperatura: Temperatura): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(leadId, autor);
    if (!Object.values(Temperatura).includes(temperatura)) throw new ErroRegra("Temperatura inválida.");
    if (lead.temperatura === temperatura) return;

    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({ where: { id: leadId }, data: { temperatura } });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { de: lead.temperatura, temperatura, campo: "temperatura" },
      });
    });
    revalidarLead();
  });
}

export async function editarLead(id: string, input: LeadInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const dados = LeadSchema.parse(input);
    const ddi = await ddiDoPais(dados.paisId);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${id} FOR UPDATE`;
      const leadAtual = await exigirLeadVisivel(id, autor, tx);
      const matricula = await tx.matricula.findUnique({ where: { leadId: id }, select: { secretariaAssumiuEm: true } });
      const alteraCadastro = dados.nome !== leadAtual.nome || normalizarTelefoneE164(dados.telefoneE164, ddi) !== leadAtual.telefoneE164 || (dados.paisId || null) !== leadAtual.paisId;
      if (matricula?.secretariaAssumiuEm && alteraCadastro && !autor.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA)) throw new ErroPermissao("A secretaria assumiu a matrícula. Solicite a correção cadastral.");
      await tx.oportunidade.update({
        where: { id },
        data: {
          nome: dados.nome,
          telefoneE164: normalizarTelefoneE164(dados.telefoneE164, ddi),
          paisId: dados.paisId || null,
          segmento: dados.segmento,
          temperatura: dados.temperatura,
          b2b: dados.b2b,
          origemCampanha: dados.origemCampanha || null,
          origemConjunto: dados.origemConjunto || null,
          origemAnuncio: dados.origemAnuncio || null,
          origemPalavra: dados.origemPalavra || null,
          valorPrevisto: dados.valorPrevisto ?? null,
          planoPrevisto: dados.planoPrevisto || null,
          comissaoPrevista: dados.comissaoPrevista ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { nome: dados.nome, temperatura: dados.temperatura },
      });
    });
    revalidarLead();
  });
}

export async function atualizarResumo(id: string, input: ResumoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = ResumoSchema.parse(input);
    // Evento na MESMA transação da mutação (issue #1: resumo alterava sem auditoria).
    // Tipo específico ResumoAtualizado com payload completo, consumido pela linha
    // do tempo da ficha do lead (issue #43).
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          interesse: dados.interesse || null,
          objetivo: dados.objetivo || null,
          urgencia: dados.urgencia || null,
          orcamento: dados.orcamento || null,
          objecao: dados.objecao || null,
          proximaAcao: dados.proximaAcao || null,
        },
      });
      await registrarEvento(tx, {
        tipo: "ResumoAtualizado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          interesse: dados.interesse || null,
          objetivo: dados.objetivo || null,
          urgencia: dados.urgencia || null,
          orcamento: dados.orcamento || null,
          objecao: dados.objecao || null,
          proximaAcao: dados.proximaAcao || null,
        },
      });
    });
    revalidarLead();
  });
}

export async function atualizarDatas(id: string, input: DatasInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = analisarComDatasDaEscola(DatasSchema, input, await fusoDaEscola());
    // Evento na MESMA transação da mutação (issue #1: datas alteravam sem auditoria).
    // Tipo específico DatasAtualizadas com payload completo, consumido pela linha
    // do tempo da ficha do lead (issue #43).
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          proximoFollowUp: dados.proximoFollowUp ?? null,
          dataExperimental: dados.dataExperimental ?? null,
          dataProposta: dados.dataProposta ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "DatasAtualizadas",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          proximoFollowUp: dados.proximoFollowUp?.toISOString() ?? null,
          proximoFollowUpCivil: dataCivilOriginal(input.proximoFollowUp, dados.proximoFollowUp),
          dataExperimental: dados.dataExperimental?.toISOString() ?? null,
          dataProposta: dados.dataProposta?.toISOString() ?? null,
          dataPropostaCivil: dataCivilOriginal(input.dataProposta, dados.dataProposta),
        },
      });
    });
    revalidarLead();
  });
}

export async function moverEtapa(id: string, etapa: EtapaLead): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    // Máquina de estados, trava da linha e Evento na mesma transação: ver crm/mover-etapa.ts.
    await prisma.$transaction((tx) => moverEtapaTx(tx, autor, id, etapa));
    revalidarLead();
  });
}

/** Com `chaveIdempotencia` (#166), o reenvio da mesma tentativa não grava outra interação (a chave vai no payload do Evento). */
export async function registrarInteracao(id: string, input: InteracaoInput & { chaveIdempotencia?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = InteracaoSchema.parse(input);
    const payload = { canal: dados.canal || null, nota: dados.nota };
    const marca = marcaIdempotencia(ChaveIdempotenciaSchema.optional().parse(input.chaveIdempotencia), { leadId: id, ...payload });
    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "InteracaoRegistrada", agregadoTipo: "Lead", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra interação. Recarregue a página e confira o histórico antes de repetir.",
        });
        if (repetido) return;
      }
      await registrarEvento(tx, {
        tipo: "InteracaoRegistrada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { ...payload, ...marca },
      });
    });
    revalidarLead();
  });
}

/** Agenda a experimental e (opcionalmente) grava o professor responsável na FK
 * `professorExperimentalId` — escopo que a Home do professor e o check-in usam
 * (Issue #13). O vínculo também é auditado no event log. */
export async function agendarExperimental(
  id: string,
  input: AgendarExperimentalInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = AgendarExperimentalSchema.parse(input);
    const data = new Date(dados.dataISO);
    if (isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    // Schema normaliza "" → null; `?? null` cobre o campo ausente. Sempre
    // persistimos a FK para que "Definir depois" limpe o responsável anterior.
    const professorId = dados.professorId ?? null;
    if (professorId) await exigirProfessorValido(professorId);

    // Estado atual da FK para auditar só quando o responsável mudar (incl. remoção).
    const anterior = await professorAtribuido(prisma, id);
    const mudouProfessor = professorId !== anterior;
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          dataExperimental: data,
          professorExperimentalId: professorId,
          // (Re)agendar abre uma OCORRÊNCIA nova: a confirmação do compromisso ANTERIOR não
          // vale para o novo horário (review PR #56). Sem este reset o lead ficaria
          // "confirmado" para sempre e a resposta ao novo lembrete nem gravaria evento.
          experimentalConfirmadaEm: null,
          // B8 (doc 32): remarcar É a ação humana que o pedido de REAGENDAR esperava —
          // libera a cadência pré-experimental para a ocorrência nova.
          aguardandoReagendamentoEm: null,
        },
      });
      await registrarEvento(tx, {
        tipo: "ExperimentalAgendada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: data.toISOString() },
      });
      // Auditoria do vínculo: mesmo evento para atribuição/remanejamento e
      // remoção (professorId null). Só registra quando houve mudança.
      if (mudouProfessor) {
        await registrarEvento(tx, {
          tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
          agregadoTipo: "Lead",
          agregadoId: id,
          autorId: autor.id,
          payload: { de: anterior, professorId },
        });
      }
    });
    revalidarLead();
    revalidatePath("/home");
  });
}

export async function enviarProposta(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    await prisma.$transaction(async (tx) => {
      const agora = new Date();
      await tx.oportunidade.update({
        where: { id },
        data: { etapa: EtapaLead.PROPOSTA, dataProposta: agora },
      });
      await registrarEvento(tx, {
        tipo: "PropostaEnviada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: agora.toISOString() },
      });
    });
    revalidarLead();
  });
}

export async function marcarPerdido(id: string, input: PerdaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = PerdaSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      // Idempotência por natureza (#166, 5º lote): a mesma perda, já registrada por quem repete, com o mesmo motivo
      // e a mesma observação, devolve ok sem outro `LeadPerdido` (antes, cada reenvio gravava um). A trava do lead
      // serializa o clique duplo. Qualquer outro caso segue como antes.
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const atual = await tx.oportunidade.findUnique({ where: { id }, select: { etapa: true } });
      if (atual?.etapa === EtapaLead.PERDIDO) {
        const p = await ultimoEventoDoAutor(tx, { tipo: "LeadPerdido", agregadoTipo: "Lead", agregadoId: id, autorId: autor.id });
        if (p && p.motivoPerda === dados.motivoPerda && p.observacao === (dados.observacao || null)) return;
      }
      await tx.oportunidade.update({
        where: { id },
        data: { etapa: EtapaLead.PERDIDO, motivoPerda: dados.motivoPerda },
      });
      await registrarEvento(tx, {
        tipo: "LeadPerdido",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { motivoPerda: dados.motivoPerda, observacao: dados.observacao || null },
      });
    });
    revalidarLead();
  });
}

export async function anexarDocumentoLead(
  leadId: string,
  doc: { categoria: CategoriaDocumento; nome: string; url: string },
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    if (!doc.url) throw new ErroRegra("Faça o upload do arquivo antes de salvar.");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${leadId} FOR UPDATE`;
      await exigirDocumentoPermitido(leadId, doc.categoria, autor, tx);
      await exigirArquivoVinculavel(autor, doc.url, { leadId, categoriaDocumento: doc.categoria }, tx);
      // Idempotência por natureza (#166): cada upload tem URL própria, e o lead está travado acima. O reenvio do
      // mesmo upload, com a mesma categoria e o mesmo nome, devolve o documento já anexado sem gravar outro
      // registro nem outro Evento; com outro nome é recusado.
      const jaAnexado = await tx.documento.findFirst({ where: { leadId, url: doc.url, arquivado: false }, select: { categoria: true, nome: true } });
      if (jaAnexado) {
        if (jaAnexado.categoria === doc.categoria && jaAnexado.nome === doc.nome) return;
        throw new ErroRegra("Este arquivo já está anexado a esta oportunidade com outro nome. Recarregue a página e confira os documentos.");
      }
      await tx.documento.create({
        data: { leadId, categoria: doc.categoria, nome: doc.nome, url: doc.url },
      });
      await registrarEvento(tx, {
        tipo: "DocumentoAnexado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { categoria: doc.categoria, nome: doc.nome },
      });
    });
    revalidarLead();
  });
}

/** Arquiva o documento (soft-delete — doc 10 §6: ninguém apaga nada). */
export async function arquivarDocumentoLead(documentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const doc = await prisma.documento.findUnique({ where: { id: documentoId } });
    if (!doc) throw new ErroRegra("Documento não encontrado.");
    if (!doc.leadId) throw new ErroPermissao("Use a secretaria para alterar o documento da matrícula.");
    const leadId = doc.leadId;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE "leadId" = ${leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR UPDATE`;
      await exigirDocumentoPermitido(leadId, doc.categoria, autor, tx);
      // Estado-alvo (#166): o documento já arquivado não é arquivado de novo nem ganha outro Evento.
      const atual = await tx.documento.findUnique({ where: { id: documentoId }, select: { arquivado: true } });
      if (atual?.arquivado) return;
      const contratoEmUso = await tx.matricula.findFirst({ where: { contratoDocumentoId: documentoId, contratoOk: true }, select: { id: true } });
      if (contratoEmUso) throw new ErroRegra("Registre a substituição contratual antes de arquivar um contrato confirmado.");
      await tx.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
      await registrarEvento(tx, {
        tipo: "DocumentoArquivado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { documentoId, nome: doc.nome },
      });
    });
    revalidarLead();
  });
}

/** Check-in da experimental (professor): Compareceu → Experimental Realizada · Faltou → No-show.
 * Devolve o lead à fila do comercial (doc 09 §Visão do Professor).
 *
 * Escopo do professor (Issue #13): valida papel, etapa atual (precisa haver uma
 * experimental AGENDADA) e a associação professor↔experimental (FK
 * `professorExperimentalId`). Fora do escopo → ErroPermissao; etapa errada →
 * ErroRegra. */
export async function checkinExperimental(leadId: string, compareceu: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    // 1) papel: só professor (Admin passa em exigirPapel)
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.PROFESSOR);

    const etapa = compareceu ? EtapaLead.EXPERIMENTAL_REALIZADA : EtapaLead.NO_SHOW;
    const proximaAcao = compareceu ? "Comercial: apresentar proposta" : "Remarcar experimental";
    const tipo = compareceu ? "ExperimentalRealizada" : "NoShow";

    // Tudo na transação, com o lead travado: o clique duplo é serializado (antes, os dois gravavam o Evento).
    const repetido = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.oportunidade.findUnique({ where: { id: leadId } });
      if (!lead) throw new ErroRegra("Lead não encontrado.");

      // 2) escopo: o professor precisa estar atribuído a esta experimental (FK).
      //    Admin (passa em temPapel mas não é professor literal) ignora o vínculo.
      const ehAdmin = autor.papeis.includes(Papel.ADMINISTRADOR);
      if (!ehAdmin) {
        if (!professorNoEscopoExperimental(lead.professorExperimentalId, autor.id)) {
          throw new ErroPermissao("Esta experimental não está atribuída a você.");
        }
      }

      // Idempotência por natureza (#166, 5º lote): o mesmo check-in, já registrado por quem repete, devolve ok sem
      // gravar de novo. Vem antes da etapa, que o próprio check-in já mudou.
      if (lead.etapa === etapa) {
        const ultimo = await tx.evento.findFirst({
          where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: { in: ["ExperimentalRealizada", "NoShow"] } },
          orderBy: { criadoEm: "desc" }, select: { tipo: true, autorId: true },
        });
        if (ultimo?.tipo === tipo && ultimo.autorId === autor.id) return true;
      }

      // 3) etapa/agendamento: só vale enquanto há uma experimental agendada
      if (!podeCheckinExperimental(lead.etapa)) {
        throw new ErroRegra("Não há experimental agendada para check-in neste lead.");
      }

      await tx.oportunidade.update({ where: { id: leadId }, data: { etapa, proximaAcao } });
      await registrarEvento(tx, {
        tipo,
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { data: new Date().toISOString() },
      });
      return false;
    });
    if (repetido) return;
    revalidatePath("/home");
    revalidatePath("/funil");
  });
}

/** Atribui (ou remaneja) o professor responsável por uma experimental — define o
 * escopo que a Home do professor e o check-in usam (Issue #13). Comercial/Admin.
 * Grava a FK `professorExperimentalId` (fonte de verdade) e audita no event log. */
export async function atribuirProfessorExperimental(
  leadId: string,
  professorId: string,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    await exigirProfessorValido(professorId);

    const anterior = await professorAtribuido(prisma, leadId);
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id: leadId },
        data: { professorExperimentalId: professorId },
      });
      await registrarEvento(tx, {
        tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { de: anterior, professorId },
      });
    });
    revalidarLead();
    revalidatePath("/home");
  });
}

/** Redistribui a carteira; beneficiários de comissões anteriores permanecem intactos. */
export async function atribuirDono(
  id: string,
  vendedorId: string,
  motivo?: string,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const lead = await exigirLeadVisivel(id, autor, tx);
      await exigirDestinoComercial(autor, vendedorId, tx);
      if (lead.vendedorDonoId === vendedorId) return;
      await tx.oportunidade.update({ where: { id }, data: { vendedorDonoId: vendedorId } });
      // Responsável preenchido conta como assumido (regra do backfill da M2): quem estava "Na fila" passa a
      // EM_ATENDIMENTO; AGUARDANDO_CLIENTE e EM_ATENDIMENTO mantêm o status.
      await tx.atendimentoWhatsApp.updateMany({ where: { leadId: id, finalidade: "COMERCIAL", encerradoEm: null, status: "ABERTO_SEM_RESPONSAVEL" }, data: { responsavelId: vendedorId, status: "EM_ATENDIMENTO" } });
      await tx.atendimentoWhatsApp.updateMany({ where: { leadId: id, finalidade: "COMERCIAL", encerradoEm: null }, data: { responsavelId: vendedorId } });
      if (lead.vendedorDonoId) await tx.intencaoMensagem.updateMany({ where: { OR: [{ leadId: id }, { atendimento: { is: { leadId: id, finalidade: "COMERCIAL" } } }], origem: "HUMANO", autorId: lead.vendedorDonoId, status: { in: ["PENDENTE", "ADIADA"] } }, data: { status: "CANCELADA", motivoFalha: "Carteira transferida; revisar responsável antes de enviar." } });
      await registrarEvento(tx, {
        tipo: "LeadAtribuido",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: lead.vendedorDonoId, para: vendedorId, motivo: motivo || null },
      });
    });
    revalidarLead();
  });
}
