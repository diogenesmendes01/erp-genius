import { CategoriaDocumento, Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";

export interface UsuarioArquivo { id: string; papeis: Papel[] }
export interface ContextoArquivo { leadId?: string; matriculaId?: string; alunoId?: string; cobrancaId?: string; categoriaDocumento?: CategoriaDocumento }
type Banco = Prisma.TransactionClient | typeof prisma;
const tem = (u: UsuarioArquivo, ...p: Papel[]) => u.papeis.some((papel) => p.includes(papel));
const financeiro = (u: UsuarioArquivo) => tem(u, Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
const sessao = (u: UsuarioArquivo) => ({ ...u, nome: "" });

export function urlCanonica(segmentos: string[]): string { return `/api/files/${segmentos.join("/")}`; }

/** Resolve o objeto real antes de fixar a finalidade do arquivo. */
export async function validarContextoArquivo(usuario: UsuarioArquivo, contexto: ContextoArquivo, tx: Banco = prisma) {
  if (!usuario?.id) throw new ErroPermissao();
  if (contexto.cobrancaId) {
    if (!financeiro(usuario)) throw new ErroPermissao();
    if (contexto.categoriaDocumento && contexto.categoriaDocumento !== CategoriaDocumento.COMPROVANTE) throw new ErroPermissao("A cobrança aceita apenas comprovante financeiro.");
    const cobranca = await tx.cobranca.findUnique({ where: { id: contexto.cobrancaId }, select: { matricula: { select: { id: true, alunoId: true, leadId: true } } } });
    if (!cobranca || (contexto.alunoId && contexto.alunoId !== cobranca.matricula.alunoId) || (contexto.leadId && contexto.leadId !== cobranca.matricula.leadId) || (contexto.matriculaId && contexto.matriculaId !== cobranca.matricula.id))
      throw new ErroRegra("Comprovante e cobrança precisam pertencer ao mesmo atendimento.");
    return { cobrancaId: contexto.cobrancaId, matriculaId: cobranca.matricula.id, alunoId: cobranca.matricula.alunoId, leadId: cobranca.matricula.leadId, categoriaDocumento: CategoriaDocumento.COMPROVANTE };
  }
  if (contexto.matriculaId) {
    if (!tem(usuario, Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA) || contexto.leadId) throw new ErroPermissao();
    const matricula = await tx.matricula.findUnique({ where: { id: contexto.matriculaId }, select: { alunoId: true, secretariaAssumiuEm: true } });
    if (!matricula?.secretariaAssumiuEm || (contexto.alunoId && contexto.alunoId !== matricula.alunoId))
      throw new ErroPermissao("Assuma a matrícula antes de vincular seus documentos administrativos.");
    return { matriculaId: contexto.matriculaId, alunoId: matricula.alunoId, leadId: null, cobrancaId: null, categoriaDocumento: contexto.categoriaDocumento ?? null };
  }
  if (contexto.leadId) {
    const concessoes: Prisma.LeadWhereInput[] = [await escopoComercialAtual(sessao(usuario), tx)];
    if (tem(usuario, Papel.SECRETARIA_ACADEMICA)) concessoes.push({ matricula: { is: { secretariaAssumiuEm: { not: null } } } });
    if (contexto.categoriaDocumento === CategoriaDocumento.TESTE_NIVEL && tem(usuario, Papel.PROFESSOR)) concessoes.push({ professorExperimentalId: usuario.id });
    const lead = await tx.lead.findFirst({
      where: { AND: [{ id: contexto.leadId }, { OR: concessoes }] },
      select: { matricula: { select: { alunoId: true, secretariaAssumiuEm: true } } },
    });
    if (!lead || (contexto.alunoId && contexto.alunoId !== lead.matricula?.alunoId)) throw new ErroPermissao();
    return { leadId: contexto.leadId, matriculaId: null, alunoId: contexto.alunoId ?? null, cobrancaId: null, categoriaDocumento: contexto.categoriaDocumento ?? null };
  }
  if (contexto.alunoId && tem(usuario, Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA)) {
    const aluno = await tx.aluno.findUnique({ where: { id: contexto.alunoId }, select: { id: true } });
    if (aluno) return { alunoId: contexto.alunoId, leadId: null, matriculaId: null, cobrancaId: null, categoriaDocumento: contexto.categoriaDocumento ?? null };
  }
  throw new ErroPermissao("Informe um objeto autorizado para vincular o arquivo.");
}

/** Primeiro vínculo exige autoria e compare-and-set. Chamar na transação da associação. */
export async function exigirArquivoVinculavel(usuario: UsuarioArquivo, url: string, contexto: ContextoArquivo, tx: Banco = prisma) {
  if (!/^\/api\/files\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(url)) throw new ErroRegra("Use um arquivo enviado pelo sistema.");
  const destino = await validarContextoArquivo(usuario, contexto, tx);
  const registro = await tx.registroUpload.findUnique({ where: { url } });
  if (!registro) {
    // Legado continua somente no mesmo objeto E categoria; conhecer URL não autoriza
    // transformar um contrato administrativo em teste pedagógico ou proposta comercial.
    const legado = destino.cobrancaId
      ? await tx.cobranca.findFirst({ where: { id: destino.cobrancaId, comprovanteUrl: url }, select: { id: true } })
      : destino.categoriaDocumento && (destino.leadId || destino.matriculaId)
        ? await tx.documento.findFirst({ where: {
          ...(destino.leadId ? { leadId: destino.leadId } : { matriculaId: destino.matriculaId }),
          url, arquivado: false, categoria: destino.categoriaDocumento,
        }, select: { id: true } })
        : null;
    if (!legado) throw new ErroPermissao("Não foi possível comprovar a autoria deste upload. Envie o arquivo novamente.");
    return;
  }
  // Operação de confirmação sem recategorização preserva a finalidade já fixada.
  destino.categoriaDocumento ??= registro.categoriaDocumento;
  const vinculado = !!(registro.leadId || registro.matriculaId || registro.alunoId || registro.cobrancaId);
  if (!vinculado && registro.autorId !== usuario.id) throw new ErroPermissao("Este upload pertence a outro usuário.");
  const chaves = ["leadId", "matriculaId", "alunoId", "cobrancaId", "categoriaDocumento"] as const;
  for (const chave of chaves) {
    if (registro[chave] && registro[chave] !== destino[chave]) throw new ErroPermissao("Arquivo já vinculado a outro objeto ou finalidade.");
  }
  if (chaves.every((chave) => registro[chave] === destino[chave])) return;
  const alterado = await tx.registroUpload.updateMany({
    where: { id: registro.id, leadId: registro.leadId, matriculaId: registro.matriculaId, alunoId: registro.alunoId, cobrancaId: registro.cobrancaId, categoriaDocumento: registro.categoriaDocumento }, data: destino,
  });
  if (alterado.count !== 1) throw new ErroRegra("O upload foi vinculado por outra operação. Atualize a página.");
}

/** Leitura depende da finalidade atual e do objeto, inclusive após transferência. */
export async function podeLerArquivo(usuario: UsuarioArquivo, segmentos: string[]): Promise<boolean> {
  if (!usuario?.id || !usuario.papeis.length) return false;
  const url = urlCanonica(segmentos);
  const admin = tem(usuario, Papel.ADMINISTRADOR);
  const [cobranca, informe, registro] = await Promise.all([
    prisma.cobranca.findFirst({ where: { comprovanteUrl: url }, select: { id: true } }),
    prisma.pagamentoInformado.findFirst({ where: { comprovanteUrl: url }, select: { id: true } }),
    prisma.registroUpload.findUnique({ where: { url }, select: { cobrancaId: true, leadId: true, matriculaId: true, categoriaDocumento: true } }),
  ]);
  if (cobranca || informe || registro?.cobrancaId) return financeiro(usuario);
  const documento = await prisma.documento.findFirst({
    where: { url, arquivado: false },
    select: { id: true, leadId: true, matriculaId: true, categoria: true, lead: { select: { professorExperimentalId: true, matricula: { select: { secretariaAssumiuEm: true } } } } },
  });
  if (documento) {
    if ((registro?.categoriaDocumento && registro.categoriaDocumento !== documento.categoria) ||
        (registro?.leadId && registro.leadId !== documento.leadId) ||
        (registro?.matriculaId && registro.matriculaId !== documento.matriculaId)) return false;
    if (tem(usuario, Papel.FINANCEIRO) && documento.categoria === CategoriaDocumento.CONTRATO) {
      const vinculos: Prisma.MatriculaWhereInput[] = [];
      if (documento.matriculaId) vinculos.push({ id: documento.matriculaId });
      else if (documento.leadId) vinculos.push({ leadId: documento.leadId });
      if (vinculos.length && await prisma.matricula.count({ where: { contratoDocumentoId: documento.id, contratoOk: true,
        confirmacaoContratoEm: { not: null }, OR: vinculos } })) return true;
    }
    if (documento.matriculaId) {
      return tem(usuario, Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA) ||
        (tem(usuario, Papel.FINANCEIRO) && documento.categoria === CategoriaDocumento.COMPROVANTE);
    }
    if (!documento.leadId || !documento.lead) return false;
    if (admin) return true;
    if (documento.categoria === "TESTE_NIVEL" && (tem(usuario, Papel.GERENTE_PEDAGOGICO) || (tem(usuario, Papel.PROFESSOR) && documento.lead.professorExperimentalId === usuario.id))) return true;
    if (tem(usuario, Papel.SECRETARIA_ACADEMICA) && documento.lead.matricula?.secretariaAssumiuEm) return true;
    if (documento.categoria === "OUTRO") return false;
    if (tem(usuario, Papel.FINANCEIRO) && documento.categoria === "COMPROVANTE") return true;
    if (!tem(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL)) return false;
    if (documento.lead.matricula?.secretariaAssumiuEm && documento.categoria !== "PROPOSTA") return false;
    return !!await prisma.lead.findFirst({ where: { AND: [{ id: documento.leadId }, await escopoComercialAtual(sessao(usuario))] }, select: { id: true } });
  }
  const { escopoAtendimentos } = await import("@/server/whatsapp/escopo");
  const atendimento = await escopoAtendimentos(sessao(usuario));
  const escopoMidia = admin ? {} : { atendimento: { is: atendimento } };
  const mensagem = await prisma.mensagemWhatsApp.findFirst({ where: { midiaPath: url, ...escopoMidia }, select: { id: true } });
  if (mensagem) return true;
  return !!await prisma.intencaoMensagem.findFirst({ where: { midiaPath: url, ...escopoMidia }, select: { id: true } });
}
