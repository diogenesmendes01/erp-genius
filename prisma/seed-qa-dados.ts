import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import {
  EtapaLead,
  FinalidadeAtendimentoWhatsApp,
  FormaPagamento,
  MotivoPerda,
  OrigemCanal,
  Papel,
  Prisma,
  PrismaClient,
  StatusAluno,
  StatusAprovacao,
  StatusAtendimentoWhatsApp,
  StatusCobranca,
  StatusComissao,
  StatusFaturaB2B,
  StatusMatricula,
  StatusMensagem,
  StatusPagamentoInformado,
  StatusTarefa,
  StatusTurma,
  Temperatura,
  TipoAjuste,
  TipoAprovacao,
  TipoMovimentacao,
  TipoTarefa,
} from "@prisma/client";
import { DOMINIO_EMAIL_QA, PREFIXO_NOME, qaId } from "./seed-qa-comum";

// Seed de DADOS de QA (complementa prisma/seed.ts e prisma/seed-qa.ts; ver README §"Base de QA").
//
// Entrada: JSON com os dados reais das planilhas operacionais (QA_DADOS_JSON). O JSON NÃO fica no repositório (dados
// pessoais reais); o formato está em `DadosReais` abaixo. Sem o arquivo o script aborta sem gravar nada.
//
// Idempotente: todo registro tem `id` determinístico (`qa_<entidade>_<chave>`) e é gravado com upsert, ou com
// createMany + skipDuplicates nos de chave única composta. Re-rodar devolve os registros ao estado do seed.
// Remoção: prisma/cleanup-qa.ts apaga só o que tem id `qa_`.
//
//   QA_SEED_PASSWORD='...' QA_DADOS_JSON=/caminho/qa-dados-reais.json npx tsx prisma/seed-qa-dados.ts
//
// Segurança: nenhum envio real é disparado. Mensagens de WhatsApp são gravadas como histórico (ENTREGUE/LIDA, nunca
// NA_FILA), réguas ficam em SHADOW, contatos inventados usam telefones fictícios e e-mails @qa.geniusidiomas.test.

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);
const HOJE = new Date(process.env.QA_HOJE ?? new Date().toISOString().slice(0, 10) + "T12:00:00Z");
const FUSO_CR = "America/Costa_Rica";

// ---------- formato do JSON (gerado das planilhas) ----------
type ProfessorReal = { nome: string; tipo: string; valorHora: number; fixoMensal: number };
type TurmaReal = {
  id: string; nome: string; status: string; modalidade: string; professor: string | null; dias: string | null;
  horario: string | null; inicio: string | null; fim: string | null; obs: string | null; horasAula: number | null;
};
type AlunoReal = {
  id: string; nome: string; status: string; contato: string | null; email: string | null; documento: string | null;
  turma: string | null; modalidade: string | null; moeda: string | null; mensalidade: number | null; diaVenc: number | null;
  obs: string | null;
};
type HistoricoReal = { id: string; aluno: string; turma: string | null; entrada: string | null; saida: string | null; status: string; obs: string | null };
type MensalidadeReal = {
  aluno: string; competencia: string; moeda: string | null; valor: number | null; dia: number | null; status: string;
  data: string | null; recebido: number | null; obs: string | null;
};
type FeriadoReal = { data: string; motivo: string | null };
type PlanoAulaReal = { professor: string; titulo: string | null; modulo: string; aula: number; pagina: string; data: string | null };
type DadosReais = {
  professores: ProfessorReal[]; turmas: TurmaReal[]; alunos: AlunoReal[]; historico: HistoricoReal[];
  mensalidades: MensalidadeReal[]; feriados: FeriadoReal[]; planoAulas: PlanoAulaReal[];
};

// ---------- tabela comercial oficial 2026 (pública: tabelas de preço CR/PA e Guia do Vendedor) ----------
const MOEDA = { CR: "CRC", PA: "USD" } as const;
const MATRICULA_UNICA = { CR: 10000, PA: 20 } as const;
type RefPreco = { tipo: "MENSALIDADE" | "HORA_PARTICULAR"; valor: number; nota: string };
const TABELA_PRECOS: Record<string, Record<"CR" | "PA", RefPreco>> = {
  Regular: { CR: { tipo: "MENSALIDADE", valor: 25000, nota: "Anual 1x/semana" }, PA: { tipo: "MENSALIDADE", valor: 50, nota: "Anual 1x/semana" } },
  "Semi-intensiva": { CR: { tipo: "MENSALIDADE", valor: 45000, nota: "Anual 2x/semana" }, PA: { tipo: "MENSALIDADE", valor: 80, nota: "Anual 2x/semana" } },
  Intensiva: { CR: { tipo: "MENSALIDADE", valor: 68500, nota: "Curso Completo 8x, 3x/semana" }, PA: { tipo: "MENSALIDADE", valor: 130, nota: "Curso Completo 8x, 3x/semana" } },
  "Super-intensiva": { CR: { tipo: "MENSALIDADE", valor: 110000, nota: "Curso Completo 6x, 5x/semana" }, PA: { tipo: "MENSALIDADE", valor: 220, nota: "Curso Completo 6x, 5x/semana" } },
  Particular: { CR: { tipo: "HORA_PARTICULAR", valor: 13000, nota: "aula avulsa; pacotes 4h 12.000, 8h 11.500, 12h 10.500" }, PA: { tipo: "HORA_PARTICULAR", valor: 25, nota: "aula avulsa; pacotes 4h 23, 8h 22, 12h 20" } },
};
/** Planos na ordem de oferta do Guia do Vendedor. Benefícios: Mensal não tem nenhum. */
const TABELA_PLANOS = [
  { nome: "Curso Completo", meses: 12, acrescimo: 0, beneficios: "diploma por módulo + geral, reposição particular 2x/mês, conversação 1x/semana" },
  { nome: "Anual", meses: 12, acrescimo: 0, beneficios: "diploma por módulo + geral, reposição particular 2x/mês, conversação 1x/semana" },
  { nome: "Semestral", meses: 6, acrescimo: 0.05, beneficios: "diploma por módulo + geral, reposição particular 2x/mês, conversação 1x/semana" },
  { nome: "Trimestral", meses: 3, acrescimo: 0.1, beneficios: "diploma por módulo + geral, reposição particular 1x/mês, conversação 1x/semana" },
  { nome: "Mensal", meses: 1, acrescimo: 0.15, beneficios: "sem benefícios (sem diploma, reposição ou conversação)" },
] as const;
/** Parcelas do Curso Completo onde a tabela fixa valor próprio (Semi-intensiva 14x). */
const CURSO_COMPLETO: Partial<Record<string, Record<"CR" | "PA", number>>> = { "Semi-intensiva": { CR: 43400, PA: 77 }, Regular: { CR: 25000, PA: 50 } };
function precoPlano(mod: string, iso: "CR" | "PA", plano: (typeof TABELA_PLANOS)[number]): number {
  const base = TABELA_PRECOS[mod]?.[iso].valor ?? TABELA_PRECOS.Regular![iso].valor;
  if (plano.nome === "Curso Completo") return CURSO_COMPLETO[mod]?.[iso] ?? base;
  const v = base * (1 + plano.acrescimo);
  return iso === "CR" ? Math.round(v / 50) * 50 : Math.round(v * 100) / 100;
}

// ---------- utilidades ----------
const dia = (iso: string) => new Date(`${iso}T12:00:00Z`);
const emailQa = (local: string) => `${local}@${DOMINIO_EMAIL_QA}`;
const telefoneFicticio = (n: number) => `+5060000${String(n).padStart(4, "0")}`;
const pick = <T,>(lista: readonly T[], i: number): T => lista[i % lista.length] as T;

function e164(contato: string | null): string | null {
  if (!contato) return null;
  const digitos = contato.replace(/\D/g, "");
  return digitos.length >= 8 ? `+${digitos}` : null;
}
function paisPorTelefone(tel: string | null): "CR" | "PA" | "SV" {
  if (tel?.startsWith("+507")) return "PA";
  if (tel?.startsWith("+503")) return "SV";
  return "CR";
}
function separarNome(nome: string): { primeiroNome: string; sobrenome: string | null } {
  const partes = nome.trim().split(/\s+/);
  return { primeiroNome: partes[0] ?? nome, sobrenome: partes.slice(1).join(" ") || null };
}
const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const ROTULO_DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function diasSemana(dias: string | null): number[] {
  if (!dias) return [];
  const norm = dias.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return Object.entries(DIAS).filter(([nome]) => norm.includes(nome)).map(([, n]) => n).sort();
}
/** "7-9pm", "7:30-9:30pm", "10:30am-12:30pm", "10-12am" -> ["19:00","21:00"]. */
function horario(h: string | null): [string, string] | null {
  if (!h) return null;
  const m = h.replace(/\s/g, "").toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?-(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  const conv = (hh: number, sufixo: string | undefined) => (hh === 12 ? 12 : sufixo === "pm" ? hh + 12 : hh);
  const fimH = conv(Number(m[4]), m[6]);
  let iniH = conv(Number(m[1]), m[3] ?? m[6]);
  if (iniH > fimH) iniH = Number(m[1]); // "10-12am": o início é de manhã
  const fmt = (hh: number, mm: string | undefined) => `${String(hh).padStart(2, "0")}:${mm ?? "00"}`;
  return [fmt(iniH, m[2]), fmt(fimH, m[5])];
}

async function codigo(chave: "lead" | "aluno" | "matricula" | "cobranca" | "turma" | "empresa" | "fatura"): Promise<string> {
  // Mesmo algoritmo de src/lib/codigo.ts (não importado para o script rodar fora do bundle do Next).
  const prefixo = { lead: "L", aluno: "A", matricula: "M", cobranca: "C", turma: "T", empresa: "E", fatura: "F" }[chave];
  const c = await prisma.contador.upsert({ where: { chave }, update: { valor: { increment: 1 } }, create: { chave, valor: 1 } });
  return `${prefixo}-${String(c.valor).padStart(6, "0")}`;
}
/** Preenche `codigo` só quando o registro ainda não tem (re-rodar não consome contador). */
async function garantirCodigo(
  tabela: "aluno" | "turma" | "matricula" | "cobranca" | "oportunidade" | "empresa" | "faturaB2B",
  id: string,
): Promise<void> {
  const chave = ({ aluno: "aluno", turma: "turma", matricula: "matricula", cobranca: "cobranca", oportunidade: "lead", empresa: "empresa", faturaB2B: "fatura" } as const)[tabela];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- delegate dinâmico com o mesmo formato em todas as tabelas
  const delegate = (prisma as any)[tabela] as { findUnique: Function; update: Function };
  const atual = (await delegate.findUnique({ where: { id }, select: { codigo: true } })) as { codigo: string | null } | null;
  if (atual && !atual.codigo) await delegate.update({ where: { id }, data: { codigo: await codigo(chave) } });
}

const contagem: Record<string, number> = {};
const conta = (k: string, n = 1) => (contagem[k] = (contagem[k] ?? 0) + n);

// ---------- 1. configuração ----------
type Catalogo = {
  paises: Record<"CR" | "PA" | "SV", string>;
  tipoDoc: Record<"CR" | "PA" | "SV", string | null>;
  idiomaId: string;
  niveis: Record<string, string>;
  modalidades: Record<string, string>;
  produtos: Record<string, string>; // por id de modalidade
};

async function configurar(adminId: string): Promise<Catalogo> {
  const paises = await prisma.pais.findMany();
  const porIso = (iso: string) => {
    const p = paises.find((x) => x.codigoISO === iso);
    if (!p) throw new Error(`País ${iso} não existe: rode o seed principal antes.`);
    return p.id;
  };
  // Costa Rica e Panamá ativos (há alunos com +507). El Salvador fica como está.
  await prisma.pais.updateMany({ where: { codigoISO: { in: ["CR", "PA"] } }, data: { status: "ATIVO" } });
  await prisma.pais.update({ where: { codigoISO: "CR" }, data: { fuso: FUSO_CR } });
  await prisma.pais.update({ where: { codigoISO: "PA" }, data: { fuso: "America/Panama" } });
  const pa = { CR: porIso("CR"), PA: porIso("PA"), SV: porIso("SV") };
  const tipos = await prisma.tipoDocumento.findMany();
  const tipoDoc = {
    CR: tipos.find((t) => t.paisId === pa.CR)?.id ?? null,
    PA: tipos.find((t) => t.paisId === pa.PA)?.id ?? null,
    SV: tipos.find((t) => t.paisId === pa.SV)?.id ?? null,
  };

  const idioma = await prisma.idioma.findFirst({ orderBy: { id: "asc" } });
  if (!idioma) throw new Error("Idioma não existe: rode o seed principal antes.");
  const niveis = Object.fromEntries((await prisma.nivel.findMany({ where: { idiomaId: idioma.id } })).map((n) => [n.codigo, n.id]));
  for (const c of ["A1", "A2", "B1", "B2", "C1", "C2"]) if (!niveis[c]) throw new Error(`Nível ${c} ausente no catálogo.`);

  const mods = await prisma.modalidade.findMany();
  const modalidades = Object.fromEntries(mods.map((m) => [m.nome, m.id]));
  // Modalidade Empresa (B2B) inventada: o catálogo do seed principal não tem.
  const modEmpresa = await prisma.modalidade.upsert({
    where: { id: qaId("modalidade", "empresa") },
    update: {},
    create: { id: qaId("modalidade", "empresa"), nome: `${PREFIXO_NOME}Empresa`, segmento: "EMPRESA", frequencia: "2x/semana", horasAula: 1.5, duracaoPorNivel: "3 meses", aulasPorNivel: 24, minimoAbrir: 3 },
  });
  modalidades["Empresa"] = modEmpresa.id;

  const produtos: Record<string, string> = Object.fromEntries((await prisma.produto.findMany()).map((p) => [p.modalidadeId, p.id]));
  if (!produtos[modEmpresa.id]) {
    const p = await prisma.produto.upsert({
      where: { id: qaId("produto", "empresa") }, update: {},
      create: { id: qaId("produto", "empresa"), idiomaId: idioma.id, modalidadeId: modEmpresa.id },
    });
    produtos[modEmpresa.id] = p.id;
  }
  // Produto oferecido em CR e PA (ProdutoPais é único por produto+país).
  for (const produtoId of Object.values(produtos)) {
    for (const [iso, moeda] of [["CR", "CRC"], ["PA", "USD"]] as const) {
      await prisma.produtoPais.upsert({
        where: { produtoId_paisId: { produtoId, paisId: pa[iso] } },
        update: {},
        create: { id: qaId("produtopais", `${produtoId}-${iso}`), produtoId, paisId: pa[iso], moeda },
      });
    }
  }
  // Preços de referência = tabela pública oficial (Costa Rica ₡ / Panamá $), valor do plano Anual/Curso Completo.
  // O ERP guarda um preço ativo por país+produto+tipo; as variantes de plano (Mensal +15%, Trimestral +10%,
  // Semestral +5%) ficam em TABELA_PLANOS e são aplicadas nas matrículas/propostas inventadas.
  for (const [mod, porPais] of Object.entries(TABELA_PRECOS)) {
    const modalidadeId = modalidades[mod];
    const produtoId = modalidadeId ? produtos[modalidadeId] : undefined;
    if (!modalidadeId || !produtoId) continue;
    for (const iso of ["CR", "PA"] as const) {
      const ref = porPais[iso];
      const itens: ["MENSALIDADE" | "MATRICULA" | "HORA_PARTICULAR", number][] = [[ref.tipo, ref.valor], ["MATRICULA", MATRICULA_UNICA[iso]]];
      for (const [tipoCobranca, valor] of itens) {
        const dados = { valor: D(valor), moeda: MOEDA[iso], versaoEstudo: `Tabela pública 2026 · ${ref.nota}` };
        const chave = { paisId: pa[iso], produtoId, modalidadeId, tipoCobranca, ativo: true };
        const existente = await prisma.precoReferencia.findFirst({ where: { ...chave, NOT: { id: { startsWith: "qa_" } } } });
        if (existente) await prisma.precoReferencia.update({ where: { id: existente.id }, data: dados });
        else {
          const id = qaId("preco", `${mod}-${iso}-${tipoCobranca}`);
          await prisma.precoReferencia.upsert({ where: { id }, update: dados, create: { id, ...chave, ...dados } });
        }
        conta("PrecoReferencia");
      }
    }
  }

  await prisma.configFinanceiro.upsert({ where: { id: "financeiro" }, update: {}, create: { id: "financeiro", diaPrevisaoPagamentoComissao: 10 } });
  await prisma.configComercial.upsert({ where: { id: "comercial" }, update: {}, create: { id: "comercial" } });
  // Câmbio de referência (inventado): só leitura em relatórios.
  await prisma.taxaCambio.upsert({ where: { id: qaId("cambio", "crc") }, update: {}, create: { id: qaId("cambio", "crc"), moeda: "CRC", unidadesPorUsd: D(505), vigenteEm: dia("2026-10-01") } });
  await prisma.taxaCambio.upsert({ where: { id: qaId("cambio", "brl") }, update: {}, create: { id: qaId("cambio", "brl"), moeda: "BRL", unidadesPorUsd: D("5.40"), vigenteEm: dia("2026-10-01") } });
  // Réguas: todas em SHADOW (avaliam e registram, não enviam).
  await prisma.politicaRegua.updateMany({ where: { estado: "ATIVA" }, data: { estado: "SHADOW" } });
  await prisma.politicaRegua.upsert({
    where: { id: qaId("regua", "cobranca") }, update: { estado: "SHADOW" },
    create: { id: qaId("regua", "cobranca"), nome: `${PREFIXO_NOME}Régua de cobrança`, estado: "SHADOW" },
  });
  void adminId;
  return { paises: pa, tipoDoc, idiomaId: idioma.id, niveis, modalidades, produtos };
}

// ---------- 2. usuários (professores reais + conta do portal) ----------
async function professores(dados: DadosReais, senhaHash: string): Promise<Record<string, string>> {
  const nomes = new Set<string>(dados.professores.map((p) => p.nome));
  for (const t of dados.turmas) if (t.professor) nomes.add(t.professor);
  const mapa: Record<string, string> = {};
  for (const nome of nomes) {
    const chave = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ".");
    const email = emailQa(`prof.${chave}`);
    const u = await prisma.usuario.upsert({
      where: { email },
      update: { nome, papeis: [Papel.PROFESSOR], ativo: true, senhaHash },
      create: { id: qaId("professor", chave), nome, email, papeis: [Papel.PROFESSOR], senhaHash },
    });
    mapa[nome] = u.id;
    mapa[chave] = u.id;
    conta("Usuario (professor)");
  }
  // Grafias diferentes entre abas ("Celia"/"Célia").
  if (mapa["Celia"]) mapa["Célia"] = mapa["Celia"];
  return mapa;
}

// ---------- 3. turmas ----------
const MOD_PLANILHA: Record<string, string> = { Regular: "Regular", "Semi Intensivo": "Semi-intensiva", Intensivo: "Intensiva", Particular: "Particular", "Sem modalidade": "Regular" };

function nivelDaTurma(turmaId: string, plano: PlanoAulaReal[]): string {
  // Módulo corrente = o último módulo com aula datada até hoje no plano da turma (título começa com o id da turma).
  const daTurma = plano.filter((p) => p.titulo?.trim().split(/\s+/)[0] === turmaId && p.data && dia(p.data) <= HOJE);
  daTurma.sort((a, b) => (a.data! < b.data! ? -1 : 1));
  return daTurma.at(-1)?.modulo ?? "A1";
}

async function turmas(dados: DadosReais, cat: Catalogo, profs: Record<string, string>): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  for (const t of dados.turmas) {
    const modalidadeId = cat.modalidades[MOD_PLANILHA[t.modalidade] ?? "Regular"]!;
    const dias = diasSemana(t.dias);
    const h = horario(t.horario);
    const id = qaId("turma", t.id);
    const status = t.status === "Ativa" ? StatusTurma.EM_ANDAMENTO : StatusTurma.PLANEJADA;
    const registro = {
      nome: t.nome, modalidadeId, nivelId: cat.niveis[nivelDaTurma(t.id, dados.planoAulas)]!,
      professorId: t.professor ? profs[t.professor] ?? null : null, online: true, diasSemana: dias,
      horarioInicio: h?.[0] ?? null, horarioFim: h?.[1] ?? null,
      diasHorario: dias.length && h ? `${dias.map((d) => ROTULO_DIA[d]).join(", ")} · ${h[0]}–${h[1]}` : null,
      dataInicio: t.inicio ? dia(t.inicio) : dia("2026-07-01"), dataFim: t.fim ? dia(t.fim) : null,
      cronograma: t.obs, capacidade: t.modalidade === "Particular" ? 1 : 12, status, rolling: false,
    };
    await prisma.turma.upsert({ where: { id }, update: registro, create: { id, ...registro } });
    await garantirCodigo("turma", id);
    if (registro.professorId) {
      const vid = qaId("vinculo", t.id);
      await prisma.vinculoDocente.upsert({ where: { id: vid }, update: {}, create: { id: vid, turmaId: id, professorId: registro.professorId, inicio: registro.dataInicio } });
    }
    mapa[t.id] = id;
    conta("Turma (real)");
  }
  // Inventadas: cobrem ABERTA e CONCLUIDA, que a planilha não tem.
  const inventadas: [string, StatusTurma, string, string, string | null, string | null][] = [
    ["aberta-b1", StatusTurma.ABERTA, "Regular", "B1", "2026-11-03", null],
    ["aberta-kids", StatusTurma.ABERTA, "Kids Regular", "A1", "2026-11-07", null],
    ["concluida-a1", StatusTurma.CONCLUIDA, "Semi-intensiva", "A1", "2026-03-02", "2026-06-26"],
    ["empresa", StatusTurma.EM_ANDAMENTO, "Empresa", "A2", "2026-08-03", null],
  ];
  for (const [chave, status, mod, nivel, inicio, fim] of inventadas) {
    const id = qaId("turma", chave);
    const registro = {
      nome: `${PREFIXO_NOME}Turma ${chave}`, modalidadeId: cat.modalidades[mod]!, nivelId: cat.niveis[nivel]!,
      professorId: Object.values(profs)[0] ?? null, diasSemana: [2, 4], horarioInicio: "18:00", horarioFim: "20:00",
      diasHorario: "Ter, Qui · 18:00–20:00", dataInicio: inicio ? dia(inicio) : null, dataFim: fim ? dia(fim) : null, status,
    };
    await prisma.turma.upsert({ where: { id }, update: registro, create: { id, ...registro } });
    await garantirCodigo("turma", id);
    mapa[chave] = id;
    conta("Turma (inventada)");
  }
  return mapa;
}

// ---------- 4. alunos, matrículas, histórico ----------
type AlunoGravado = { alunoId: string; matriculaId: string; moeda: string; paisId: string; status: StatusMatricula; turmaId: string | null; mensalidade: number | null; diaVenc: number };

async function alunosReais(dados: DadosReais, cat: Catalogo, turmasMap: Record<string, string>, adminId: string): Promise<AlunoGravado[]> {
  const gravados: AlunoGravado[] = [];
  const turmaPorId = new Map(dados.turmas.map((t) => [t.id, t]));
  for (const a of dados.alunos) {
    const tel = e164(a.contato);
    const iso = paisPorTelefone(tel);
    const { primeiroNome, sobrenome } = separarNome(a.nome);
    const statusAluno = a.status === "Inativo" ? StatusAluno.ENCERRADO : StatusAluno.ATIVO;
    const alunoId = qaId("aluno", a.id);
    const dadosAluno = {
      primeiroNome, sobrenome, paisId: cat.paises[iso], tipoDocumentoId: a.documento ? cat.tipoDoc[iso] : null,
      documento: a.documento, email: a.email, telefoneE164: tel, whatsapp: Boolean(tel), paisResidencia: iso,
      status: statusAluno, observacoes: a.obs ? `Planilha: ${a.obs}` : null,
    };
    await prisma.aluno.upsert({ where: { id: alunoId }, update: dadosAluno, create: { id: alunoId, ...dadosAluno } });
    await garantirCodigo("aluno", alunoId);
    conta("Aluno (real)");

    const turma = a.turma ? turmaPorId.get(a.turma) : undefined;
    const modalidadeId = cat.modalidades[MOD_PLANILHA[a.modalidade ?? turma?.modalidade ?? "Regular"] ?? "Regular"]!;
    const status = a.status === "Ativo" ? StatusMatricula.ATIVA : a.status === "Inativo" ? StatusMatricula.ENCERRADA : StatusMatricula.AGUARDANDO;
    const moeda = a.moeda ?? (iso === "CR" ? "CRC" : "USD");
    const matriculaId = qaId("matricula", a.id);
    const ativa = status !== StatusMatricula.AGUARDANDO;
    const dadosMatricula = {
      alunoId, produtoId: cat.produtos[modalidadeId]!, paisId: cat.paises[iso], moeda, status, diaVencimento: a.diaVenc ?? 5,
      mesesPlano: 12, contratoOk: ativa, pagamentoTaxaOk: ativa, primeiraMensalidadeOk: ativa,
      ativadaEm: ativa ? dia("2026-07-06") : null, nivelInicialId: cat.niveis["A1"]!,
      // Migração das planilhas: o preço é o da planilha, não o de referência.
      precoReferenciaAusente: true, justificativaSemPreco: "Valor herdado da planilha operacional (migração jul/2026)",
    };
    await prisma.matricula.upsert({ where: { id: matriculaId }, update: dadosMatricula, create: { id: matriculaId, ...dadosMatricula } });
    await garantirCodigo("matricula", matriculaId);
    conta(`Matricula ${status}`);
    gravados.push({ alunoId, matriculaId, moeda, paisId: cat.paises[iso], status, turmaId: a.turma ? turmasMap[a.turma] ?? null : null, mensalidade: a.mensalidade, diaVenc: a.diaVenc ?? 5 });
  }

  // Histórico real: cada linha vira uma alocação (com vigência) e uma movimentação.
  const porAluno = new Map<string, HistoricoReal[]>();
  for (const h of dados.historico) porAluno.set(h.aluno, [...(porAluno.get(h.aluno) ?? []), h]);
  for (const [alu, linhas] of porAluno) {
    linhas.sort((x, y) => (x.entrada ?? "") < (y.entrada ?? "") ? -1 : 1);
    let turmaAnterior: string | null = null;
    for (const h of linhas) {
      const turmaId = h.turma ? turmasMap[h.turma] : undefined;
      if (!turmaId) continue;
      const alunoId = qaId("aluno", alu);
      const matriculaId = qaId("matricula", alu);
      const encerrada = Boolean(h.saida) || gravados.find((g) => g.alunoId === alunoId)?.status === StatusMatricula.ENCERRADA;
      const id = qaId("alocacao", h.id);
      const aloc = {
        alunoId, matriculaId, turmaId, ativa: !encerrada,
        // vigência histórica só é aceita como proveniência MIGRACAO (fim > início)
        ...(h.entrada
          ? { provenienciaVinculo: "MIGRACAO" as const, inicioVigencia: dia(h.entrada), fimVigencia: h.saida && h.saida > h.entrada ? dia(h.saida) : null }
          : { provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null }),
        encerradaEm: encerrada ? (h.saida ? dia(h.saida) : HOJE) : null,
      };
      await prisma.alocacaoTurma.upsert({ where: { id }, update: aloc, create: { id, ...aloc } });
      conta("AlocacaoTurma");
      const mid = qaId("mov", h.id);
      const mov = {
        alunoId, matriculaId, tipo: turmaAnterior ? TipoMovimentacao.TROCA_TURMA : TipoMovimentacao.MATRICULA,
        turmaOrigemId: turmaAnterior, turmaDestinoId: turmaId, motivo: h.obs, usuarioId: adminId,
        criadoEm: h.entrada ? dia(h.entrada) : HOJE,
      };
      await prisma.movimentacaoAluno.upsert({ where: { id: mid }, update: mov, create: { id: mid, ...mov } });
      conta("MovimentacaoAluno");
      turmaAnterior = turmaId;
    }
  }
  // Encerramentos reais (alunos inativos) como movimentação.
  for (const g of gravados.filter((x) => x.status === StatusMatricula.ENCERRADA)) {
    const mid = qaId("mov-enc", g.alunoId);
    const mov = { alunoId: g.alunoId, matriculaId: g.matriculaId, tipo: TipoMovimentacao.ENCERRAMENTO, statusOrigem: StatusAluno.ATIVO, statusDestino: StatusAluno.ENCERRADO, motivo: "Aluno inativo na planilha operacional", usuarioId: adminId };
    await prisma.movimentacaoAluno.upsert({ where: { id: mid }, update: mov, create: { id: mid, ...mov } });
    conta("MovimentacaoAluno");
  }
  return gravados;
}

/** Alunos inventados: menores com responsáveis e os status de matrícula que a planilha não tem. */
async function alunosInventados(cat: Catalogo, turmasMap: Record<string, string>, adminId: string): Promise<AlunoGravado[]> {
  const nomes = ["Valentina Solano", "Mateo Brenes", "Isabella Quirós", "Santiago Ureña", "Camila Zúñiga", "Thiago Alfaro", "Mariana Céspedes", "Emiliano Rojas", "Lucía Villalobos", "Gael Montero", "Sofía Arguedas", "Benjamín Salazar"];
  const statuses = [StatusMatricula.RASCUNHO, StatusMatricula.AGUARDANDO, StatusMatricula.ATIVA, StatusMatricula.PAUSADA, StatusMatricula.CANCELADA, StatusMatricula.ENCERRADA];
  const kidsId = cat.modalidades["Kids Regular"] ?? cat.modalidades["Regular"]!;
  const gravados: AlunoGravado[] = [];
  for (const [i, nome] of nomes.entries()) {
    const { primeiroNome, sobrenome } = separarNome(nome);
    const status = pick(statuses, i);
    const menor = i < 8;
    const alunoId = qaId("aluno", `inv-${i + 1}`);
    const dadosAluno = {
      primeiroNome: `${PREFIXO_NOME}${primeiroNome}`, sobrenome, paisId: cat.paises.CR, tipoDocumentoId: cat.tipoDoc.CR,
      documento: `1${String(1000 + i).padStart(8, "0")}`, email: emailQa(`aluno${i + 1}`), telefoneE164: telefoneFicticio(100 + i),
      whatsapp: true, nascimento: dia(menor ? `201${i % 6}-0${(i % 9) + 1}-15` : "1995-05-10"), paisResidencia: "CR",
      status: status === StatusMatricula.PAUSADA ? StatusAluno.PAUSADO : status === StatusMatricula.ENCERRADA || status === StatusMatricula.CANCELADA ? StatusAluno.ENCERRADO : StatusAluno.ATIVO,
    };
    await prisma.aluno.upsert({ where: { id: alunoId }, update: dadosAluno, create: { id: alunoId, ...dadosAluno } });
    await garantirCodigo("aluno", alunoId);
    conta("Aluno (inventado)");
    if (menor) {
      for (const papel of ["FINANCEIRO", "EMERGENCIA"] as const) {
        const rid = qaId("resp", `inv-${i + 1}-${papel}`);
        const resp = { nome: `${PREFIXO_NOME}${papel === "FINANCEIRO" ? "Mãe" : "Tio"} de ${primeiroNome}`, parentesco: papel === "FINANCEIRO" ? "Mãe" : "Tio", telefoneE164: telefoneFicticio(300 + i * 2 + (papel === "FINANCEIRO" ? 0 : 1)), email: emailQa(`resp${i + 1}${papel.toLowerCase()}`) };
        await prisma.responsavel.upsert({ where: { id: rid }, update: resp, create: { id: rid, ...resp } });
        const arid = qaId("aluno-resp", `inv-${i + 1}-${papel}`);
        await prisma.alunoResponsavel.upsert({ where: { id: arid }, update: { papel }, create: { id: arid, alunoId, responsavelId: rid, papel } });
        conta("Responsavel");
      }
    }
    const matriculaId = qaId("matricula", `inv-${i + 1}`);
    const ativou = ([StatusMatricula.ATIVA, StatusMatricula.PAUSADA, StatusMatricula.ENCERRADA] as StatusMatricula[]).includes(status);
    const plano = pick(TABELA_PLANOS, i);
    const modTabela = menor ? "Regular" : pick(["Regular", "Semi-intensiva", "Intensiva"], i);
    const mensalidade = precoPlano(modTabela, "CR", plano);
    const modalidadeId = menor ? kidsId : cat.modalidades[modTabela]!;
    const dadosMatricula = {
      alunoId, produtoId: cat.produtos[modalidadeId]!, paisId: cat.paises.CR, moeda: "CRC", status, diaVencimento: pick([5, 10, 15], i), mesesPlano: plano.meses,
      contratoOk: ativou, pagamentoTaxaOk: ativou, primeiraMensalidadeOk: ativou, ativadaEm: ativou ? dia("2026-08-03") : null,
      ativadaComPendencia: i === 2, contratoEnviadoEm: status === StatusMatricula.AGUARDANDO ? dia("2026-10-20") : null,
      nivelInicialId: cat.niveis["A1"]!,
    };
    await prisma.matricula.upsert({ where: { id: matriculaId }, update: dadosMatricula, create: { id: matriculaId, ...dadosMatricula } });
    await garantirCodigo("matricula", matriculaId);
    conta(`Matricula ${status}`);
    const turmaId = ativou ? turmasMap[menor ? "aberta-kids" : "aberta-b1"]! : null;
    if (turmaId) {
      const aid = qaId("alocacao", `inv-${i + 1}`);
      const aloc = { alunoId, matriculaId, turmaId, ativa: status === StatusMatricula.ATIVA };
      await prisma.alocacaoTurma.upsert({ where: { id: aid }, update: aloc, create: { id: aid, ...aloc } });
      conta("AlocacaoTurma");
    }
    const tipoMov = status === StatusMatricula.PAUSADA ? TipoMovimentacao.PAUSA : status === StatusMatricula.ENCERRADA || status === StatusMatricula.CANCELADA ? TipoMovimentacao.ENCERRAMENTO : TipoMovimentacao.MATRICULA;
    const mid = qaId("mov", `inv-${i + 1}`);
    const mov = { alunoId, matriculaId, tipo: tipoMov, turmaDestinoId: turmaId, motivo: `${PREFIXO_NOME}cenário ${status} · plano ${plano.nome} ${mensalidade} CRC/mês · ${plano.beneficios}`, usuarioId: adminId };
    await prisma.movimentacaoAluno.upsert({ where: { id: mid }, update: mov, create: { id: mid, ...mov } });
    conta("MovimentacaoAluno");
    gravados.push({ alunoId, matriculaId, moeda: "CRC", paisId: cat.paises.CR, status, turmaId, mensalidade, diaVenc: dadosMatricula.diaVencimento });
  }
  // Uma reativação (pausa -> retomada) para o histórico.
  const pausado = gravados.find((g) => g.status === StatusMatricula.PAUSADA);
  if (pausado) {
    const mid = qaId("mov", "inv-reativacao-prevista");
    const mov = { alunoId: pausado.alunoId, matriculaId: pausado.matriculaId, tipo: TipoMovimentacao.REATIVACAO, statusOrigem: StatusAluno.PAUSADO, statusDestino: StatusAluno.ATIVO, motivo: `${PREFIXO_NOME}reativação de pausa anterior (jul/2026)`, usuarioId: adminId, criadoEm: dia("2026-07-20") };
    await prisma.movimentacaoAluno.upsert({ where: { id: mid }, update: mov, create: { id: mid, ...mov } });
    conta("MovimentacaoAluno");
  }
  return gravados;
}

/**
 * Upsert de cobrança sem `INSERT ... ON CONFLICT`: o trigger BEFORE INSERT de saldo avaliaria os dados de criação
 * contra as destinações já gravadas e abortaria a re-execução.
 */
async function gravarCobranca(id: string, dados: Prisma.CobrancaUncheckedUpdateInput, criacao: Prisma.CobrancaUncheckedCreateInput): Promise<void> {
  if (await prisma.cobranca.findUnique({ where: { id }, select: { id: true } })) await prisma.cobranca.update({ where: { id }, data: dados });
  else await prisma.cobranca.create({ data: criacao });
}

/**
 * Baixa pelo caminho oficial do caixa: Recebimento (sem cobrança singular) + DestinacaoRecebimento COBRANCA e o
 * acumulado da cobrança na MESMA transação (triggers fin04_211). Recebimento e destinação são imutáveis: se a baixa
 * já existe, não faz nada (idempotente).
 */
async function registrarPagamento(p: { chave: string; cobrancaId: string; matriculaId: string; autorId: string; valor: number; moeda: string; forma: FormaPagamento; data: Date }): Promise<void> {
  const recebimentoId = qaId("rec", p.chave);
  if (await prisma.recebimento.findUnique({ where: { id: recebimentoId }, select: { id: true } })) return;
  const cob = await prisma.cobranca.findUniqueOrThrow({ where: { id: p.cobrancaId }, select: { valorNegociado: true } });
  const saldo = Number(cob.valorNegociado) - p.valor;
  await prisma.$transaction([
    prisma.recebimento.create({ data: { id: recebimentoId, chaveIdempotencia: recebimentoId, titularMatriculaId: p.matriculaId, autorId: p.autorId, valor: D(p.valor), moeda: p.moeda, forma: p.forma, dataPagamento: p.data } }),
    prisma.destinacaoRecebimento.create({ data: { id: qaId("dest", p.chave), recebimentoId, cobrancaId: p.cobrancaId, autorId: p.autorId, tipo: "COBRANCA", valor: D(p.valor), evidencia: `${PREFIXO_NOME}baixa importada da planilha operacional`, chaveIdempotencia: recebimentoId } }),
    prisma.cobranca.update({ where: { id: p.cobrancaId }, data: { valorRecebido: D(p.valor), saldo: D(Math.max(0, saldo)), formaPagamento: p.forma, ...(saldo <= 0 ? { status: StatusCobranca.PAGO, pagoEm: p.data } : {}) } }),
  ]);
  conta("Recebimento + Destinacao");
}

// ---------- 5. cobranças ----------
async function cobrancasReais(dados: DadosReais, gravados: AlunoGravado[], adminId: string, finId: string): Promise<void> {
  const porAluno = new Map(dados.alunos.map((a) => [a.id, a]));
  let n = 0;
  for (const m of dados.mensalidades) {
    const a = porAluno.get(m.aluno);
    const valor = m.valor ?? a?.mensalidade;
    if (!valor) continue; // particular por hora sem valor mensal: não há o que cobrar
    const matriculaId = qaId("matricula", m.aluno);
    const moeda = m.moeda ?? a?.moeda ?? "CRC";
    const diaVenc = Math.min(Math.max(m.dia ?? a?.diaVenc ?? 5, 1), 28);
    const vencimento = dia(`${m.competencia}-${String(diaVenc).padStart(2, "0")}`);
    const vencido = vencimento < HOJE;
    let status: StatusCobranca; let valorRecebido: number | null = null; let valorNegociado = valor; let comentario = m.obs;
    switch (m.status) {
      case "Pago": status = StatusCobranca.PAGO; valorRecebido = m.recebido ?? valor; break;
      case "Parcial": status = vencido ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE; valorRecebido = m.recebido ?? Math.round(valor / 2); break;
      case "Pendente": status = vencido ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE; break;
      case "Isento": case "Não cobrar": status = StatusCobranca.CANCELADA; valorNegociado = 0; comentario = `${m.status} (planilha)${m.obs ? ` — ${m.obs}` : ""}`; break;
      default: status = StatusCobranca.CANCELADA; // "Cancelado"
    }
    const id = qaId("cob", `${m.aluno}-${m.competencia}`);
    const forma = moeda === "CRC" ? FormaPagamento.TRANSFERENCIA : FormaPagamento.CARTAO;
    // Status/saldo antes da baixa; o valor recebido só entra pela destinação do recebimento.
    const statusAntes = status === StatusCobranca.PAGO ? (vencido ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE) : status;
    const registro = {
      matriculaId, tipo: "MENSALIDADE" as const, competencia: m.competencia, valorOriginal: D(valor), valorNegociado: D(valorNegociado),
      moeda, vencimento, comentario, coberturaInicio: dia(`${m.competencia}-01`),
      coberturaFim: new Date(Date.UTC(Number(m.competencia.slice(0, 4)), Number(m.competencia.slice(5, 7)), 0, 12)),
    };
    await gravarCobranca(id, registro, { id, ...registro, status: statusAntes, saldo: D(valorNegociado) });
    await garantirCodigo("cobranca", id);
    if (valorRecebido) {
      await registrarPagamento({ chave: `${m.aluno}-${m.competencia}`, cobrancaId: id, matriculaId, autorId: finId, valor: Math.min(valorRecebido, valorNegociado), moeda, forma, data: m.data ? dia(m.data) : vencimento });
    }
    conta(`Cobranca ${status}${m.status === "Parcial" ? " (parcial)" : ""}`);
    if (m.status === "Isento" || m.status === "Não cobrar") {
      const aid = qaId("ajuste", `${m.aluno}-${m.competencia}`);
      const aj = { matriculaId, cobrancaId: id, tipo: TipoAjuste.BOLSA, valorDe: D(valor), valorPara: D(0), descontoValor: D(valor), descontoPct: D(100), moeda, vigencia: "ESTA_COBRANCA" as const, motivo: comentario ?? "Isento", autorId: adminId };
      await prisma.ajusteFinanceiro.upsert({ where: { id: aid }, update: aj, create: { id: aid, ...aj } });
      conta("AjusteFinanceiro");
    }
    n++;
  }
  void gravados; void n;
}

/** Cenários financeiros que a planilha não cobre: taxa de matrícula, inadimplência 1/30/90 dias, informes, ajustes. */
async function cobrancasInventadas(inv: AlunoGravado[], reais: AlunoGravado[], adminId: string, finId: string, fin2Id: string, vendedores: string[]): Promise<void> {
  const ativos = inv.filter((g) => g.status === StatusMatricula.ATIVA || g.status === StatusMatricula.PAUSADA || g.status === StatusMatricula.ENCERRADA);
  const atrasos = [1, 30, 90];
  for (const [i, g] of [...inv].entries()) {
    // taxa de matrícula em todas as inventadas: paga nas ativadas, pendente nas demais
    const pago = g.status !== StatusMatricula.RASCUNHO && g.status !== StatusMatricula.AGUARDANDO;
    const id = qaId("cob", `inv-${i + 1}-matricula`);
    const venc = dia("2026-08-01");
    const reg = { matriculaId: g.matriculaId, tipo: "MATRICULA" as const, valorOriginal: D(MATRICULA_UNICA.CR), valorNegociado: D(MATRICULA_UNICA.CR), moeda: "CRC", vencimento: g.status === StatusMatricula.AGUARDANDO ? dia("2026-10-30") : venc, comentario: `${PREFIXO_NOME}taxa de matrícula` };
    await gravarCobranca(id, reg, { id, ...reg, saldo: D(MATRICULA_UNICA.CR), status: g.status === StatusMatricula.CANCELADA ? StatusCobranca.CANCELADA : StatusCobranca.PENDENTE });
    await garantirCodigo("cobranca", id);
    if (pago) await registrarPagamento({ chave: `inv-${i + 1}-matricula`, cobrancaId: id, matriculaId: g.matriculaId, autorId: finId, valor: MATRICULA_UNICA.CR, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, data: venc });
    const reg_ = { status: pago ? StatusCobranca.PAGO : g.status === StatusMatricula.CANCELADA ? StatusCobranca.CANCELADA : StatusCobranca.PENDENTE };
    conta(`Cobranca ${reg_.status}`);
  }
  for (const [i, g] of ativos.entries()) {
    const dias = pick(atrasos, i);
    const venc = new Date(HOJE.getTime() - dias * 86_400_000);
    const id = qaId("cob", `inv-atraso-${i + 1}`);
    const reg = { matriculaId: g.matriculaId, tipo: "MENSALIDADE" as const, competencia: venc.toISOString().slice(0, 7), valorOriginal: D(g.mensalidade!), valorNegociado: D(g.mensalidade!), saldo: D(g.mensalidade!), moeda: "CRC", vencimento: venc, status: StatusCobranca.ATRASADO, comentario: `${PREFIXO_NOME}inadimplência ${dias} dia(s)` };
    await gravarCobranca(id, reg, { id, ...reg });
    await garantirCodigo("cobranca", id);
    conta("Cobranca ATRASADO (inventada)");
  }
  // Pagamentos informados (portal/secretaria) sobre cobranças reais em aberto: A_CONFERIR, CONFIRMADO, REJEITADO.
  const abertas = await prisma.cobranca.findMany({ where: { id: { startsWith: "qa_cob_alu-" }, status: { in: ["PENDENTE", "ATRASADO"] }, valorRecebido: null }, orderBy: { id: "asc" }, take: 9 });
  for (const [i, c] of abertas.entries()) {
    const status = pick([StatusPagamentoInformado.A_CONFERIR, StatusPagamentoInformado.REJEITADO, StatusPagamentoInformado.A_CONFERIR], i);
    const id = qaId("informe", c.id);
    const reg = { cobrancaId: c.id, autorId: finId, status, valor: c.valorNegociado, moeda: c.moeda, forma: FormaPagamento.TRANSFERENCIA, dataPagamento: HOJE, comentario: `${PREFIXO_NOME}comprovante enviado pelo aluno`, conferenteId: status === StatusPagamentoInformado.REJEITADO ? fin2Id : null, conferidoEm: status === StatusPagamentoInformado.REJEITADO ? HOJE : null, motivoConferencia: status === StatusPagamentoInformado.REJEITADO ? `${PREFIXO_NOME}valor não encontrado no extrato` : null };
    await prisma.pagamentoInformado.upsert({ where: { id }, update: reg, create: { id, chaveIdempotencia: id, ...reg } });
    conta(`PagamentoInformado ${status}`);
  }
  // Ajustes financeiros (todas as formas) e aprovações (todos os tipos e status).
  const alvo = reais.filter((g) => g.status === StatusMatricula.ATIVA && g.mensalidade).slice(0, 12);
  const tiposAjuste = [TipoAjuste.DESCONTO, TipoAjuste.ALTERACAO_VALOR, TipoAjuste.PERDAO, TipoAjuste.RENEGOCIACAO];
  const tiposAprov = [TipoAprovacao.DESCONTO, TipoAprovacao.BOLSA, TipoAprovacao.ALTERACAO_VALOR, TipoAprovacao.PERDAO_DIVIDA, TipoAprovacao.COMISSAO_EXCEPCIONAL];
  const statusAprov = [StatusAprovacao.PENDENTE, StatusAprovacao.APROVADA, StatusAprovacao.REJEITADA];
  for (const [i, g] of alvo.entries()) {
    const de = g.mensalidade!;
    const para = Math.round(de * 0.85);
    const vendedorId = pick(vendedores, i);
    const tipoAprov = pick(tiposAprov, i);
    const st = pick(statusAprov, i);
    const apid = qaId("aprov", `${i + 1}`);
    const ap = { tipo: tipoAprov, status: st, solicitanteId: vendedorId, aprovadorId: st === StatusAprovacao.PENDENTE ? null : adminId, alvoTipo: "Matricula", alvoId: g.matriculaId, payload: { descontoPct: 15, valorDe: de, valorPara: para }, vigencia: "PROXIMOS_MESES" as const, motivo: `${PREFIXO_NOME}${tipoAprov.toLowerCase()} acima da alçada`, impactoMensal: D(de - para), decididoEm: st === StatusAprovacao.PENDENTE ? null : HOJE };
    await prisma.aprovacao.upsert({ where: { id: apid }, update: ap, create: { id: apid, ...ap } });
    conta(`Aprovacao ${st}`);
    if (st !== StatusAprovacao.APROVADA && i >= tiposAjuste.length) continue;
    const ajid = qaId("ajuste", `inv-${i + 1}`);
    const aj = { matriculaId: g.matriculaId, tipo: pick(tiposAjuste, i), valorDe: D(de), valorPara: D(para), descontoValor: D(de - para), descontoPct: D(15), moeda: g.moeda, vigencia: "PROXIMOS_MESES" as const, motivo: `${PREFIXO_NOME}ajuste de cenário`, autorId: finId, aprovacaoId: st === StatusAprovacao.APROVADA ? apid : null, vendedorId, paisId: g.paisId };
    await prisma.ajusteFinanceiro.upsert({ where: { id: ajid }, update: aj, create: { id: ajid, ...aj } });
    conta("AjusteFinanceiro");
  }
  // Comissões: todos os status.
  const statusCom = [StatusComissao.PENDENTE, StatusComissao.APROVADA, StatusComissao.PAGA, StatusComissao.ESTORNADA];
  for (const [i, g] of reais.filter((x) => x.status === StatusMatricula.ATIVA && x.mensalidade).slice(0, 16).entries()) {
    const st = pick(statusCom, i);
    const id = qaId("comissao", `${i + 1}`);
    const base = g.mensalidade!;
    const reg = { matriculaId: g.matriculaId, vendedorId: pick(vendedores, i), percentual: D(10), valorBase: D(base), valor: D(base * 0.1), moeda: g.moeda, status: st, dataPrevistaPagamento: dia("2026-11-10"), aprovadaEm: st === StatusComissao.PENDENTE ? null : dia("2026-10-15"), pagaEm: st === StatusComissao.PAGA ? dia("2026-10-20") : null };
    await prisma.comissao.upsert({ where: { id }, update: reg, create: { id, ...reg } });
    conta(`Comissao ${st}`);
  }
}

// ---------- 6. calendário, aulas, presença, avaliações ----------
async function academico(dados: DadosReais, turmasMap: Record<string, string>, gpId: string, adminId: string): Promise<void> {
  // Calendário escolar: feriados reais 2026/2027. A tabela é imutável por trigger (histórico): grava só se a versão
  // de QA ainda não existir, e o cleanup não consegue removê-la (ver README).
  const chave = "qa-seed-feriados-2026-2027";
  const existe = await prisma.versaoCalendarioEscolar.findFirst({ where: { preparadorId: gpId, chaveIdempotencia: chave } });
  if (!existe) {
    const ultima = await prisma.versaoCalendarioEscolar.aggregate({ _max: { versao: true } });
    const periodos = dados.feriados.map((f, i) => ({ id: `feriado-${f.data}`, nome: f.motivo ?? `Feriado ${i + 1}`, tipo: "FERIADO", inicio: f.data, fim: f.data }));
    await prisma.versaoCalendarioEscolar.create({
      data: {
        id: qaId("calendario", "2026-2027"), versao: (ultima._max.versao ?? 0) + 1, preparadorId: gpId, fusoInstitucional: FUSO_CR, periodos,
        motivo: "Feriados 2026/2027 do cronograma pedagógico", chaveIdempotencia: chave, entradaHash: "seed-qa",
        decisao: { create: { id: qaId("decisao-calendario", "2026-2027"), decisorId: adminId, aprovada: true, motivo: "Calendário conferido (seed QA)" } },
      },
    });
    conta("VersaoCalendarioEscolar");
  }
  const feriados = new Set(dados.feriados.map((f) => f.data));

  // Aulas: plano real (página/módulo) das turmas com aulas datadas + aulas nos dias da grade até hoje.
  const aulas: Prisma.AulaCreateManyInput[] = [];
  for (const p of dados.planoAulas) {
    const turmaReal = p.titulo?.trim().split(/\s+/)[0];
    const turmaId = turmaReal ? turmasMap[turmaReal] : undefined;
    if (!turmaId || !p.data) continue;
    aulas.push({ id: qaId("aula", `${turmaReal}-${p.data}`), turmaId, data: dia(p.data), conteudo: `${p.modulo} · aula ${p.aula} · ${/^P\d/.test(p.pagina) ? `prova ${p.pagina}` : `páginas ${p.pagina}`}` });
  }
  for (const t of dados.turmas) {
    const turmaId = turmasMap[t.id];
    const dias = diasSemana(t.dias);
    if (!turmaId || !dias.length || t.status !== "Ativa") continue;
    for (let d = dia(t.inicio ?? "2026-07-06"); d <= HOJE; d = new Date(d.getTime() + 86_400_000)) {
      const iso = d.toISOString().slice(0, 10);
      if (!dias.includes(d.getUTCDay()) || feriados.has(iso)) continue;
      aulas.push({ id: qaId("aula", `${t.id}-${iso}`), turmaId, data: d, conteudo: null });
    }
  }
  const r = await prisma.aula.createMany({ data: aulas, skipDuplicates: true });
  conta("Aula", r.count);

  // Presenças nas aulas passadas para os alunos alocados (≈85% presentes, determinístico).
  const alocs = await prisma.alocacaoTurma.findMany({ where: { id: { startsWith: "qa_" } }, select: { alunoId: true, turmaId: true, inicioVigencia: true, fimVigencia: true } });
  const aulasGravadas = await prisma.aula.findMany({ where: { turmaId: { startsWith: "qa_" }, data: { lte: HOJE } }, select: { id: true, turmaId: true, data: true } });
  const presencas: Prisma.PresencaCreateManyInput[] = [];
  for (const [i, a] of aulasGravadas.entries()) {
    for (const [j, al] of alocs.filter((x) => x.turmaId === a.turmaId).entries()) {
      if (al.inicioVigencia && a.data < al.inicioVigencia) continue;
      if (al.fimVigencia && a.data > al.fimVigencia) continue;
      const falta = (i * 7 + j * 3) % 13 === 0 || (i + j) % 11 === 0;
      presencas.push({ id: qaId("pres", `${a.id.slice(8)}-${al.alunoId.slice(8)}`), aulaId: a.id, alunoId: al.alunoId, presente: !falta, observacao: falta && j % 2 === 0 ? `${PREFIXO_NOME}falta justificada` : null });
    }
  }
  for (let k = 0; k < presencas.length; k += 2000) conta("Presenca", (await prisma.presenca.createMany({ data: presencas.slice(k, k + 2000), skipDuplicates: true })).count);

  // Avaliações P1/P2 nas turmas em grupo, notas inventadas (inclui reprovados < 70 para recuperação).
  const grupo = dados.turmas.filter((t) => t.status === "Ativa" && t.modalidade !== "Particular" && turmasMap[t.id]);
  for (const t of grupo) {
    const turmaId = turmasMap[t.id]!;
    for (const [k, nome] of ["P1", "P2"].entries()) {
      const avId = qaId("aval", `${t.id}-${nome}`);
      await prisma.avaliacao.upsert({ where: { id: avId }, update: {}, create: { id: avId, turmaId, nome, peso: D(k === 0 ? 1 : 1.5), data: dia(k === 0 ? "2026-08-10" : "2026-09-21") } });
      conta("Avaliacao");
      const alunos = alocs.filter((a) => a.turmaId === turmaId);
      const notas = alunos.map((a, j) => ({ id: qaId("nota", `${t.id}-${nome}-${a.alunoId.slice(8)}`), avaliacaoId: avId, alunoId: a.alunoId, valor: D(j % 5 === 4 ? 55 + j : 72 + ((j * 7 + k * 5) % 28)) }));
      conta("Nota", (await prisma.nota.createMany({ data: notas, skipDuplicates: true })).count);
    }
  }
}

// ---------- 7. CRM ----------
async function crm(cat: Catalogo, vendedores: string[], profId: string, adminId: string): Promise<void> {
  const etapas = Object.values(EtapaLead);
  const motivos = Object.values(MotivoPerda);
  const temps = Object.values(Temperatura);
  const canais = Object.values(OrigemCanal);
  const nomes = ["Andrés", "Daniela", "Esteban", "Gabriela", "Javier", "Karla", "Luis", "María", "Nicolás", "Paola", "Ricardo", "Silvia", "Tomás", "Verónica", "Adrián", "Beatriz", "Carlos", "Diana", "Fabián", "Jimena"];
  const sobrenomes = ["Mora", "Jiménez", "Vargas", "Rodríguez", "Castro", "Solís", "Araya", "Chaves", "Calderón", "Herrera"];
  for (let i = 0; i < 200; i++) {
    const etapa = i < 180 ? pick(etapas, i) : EtapaLead.PERDIDO; // garante os 9 motivos com folga
    const id = qaId("lead", i + 1);
    const pais = i % 4 === 3 ? "PA" : "CR";
    const plano = pick(TABELA_PLANOS, i);
    const modLead = pick(["Regular", "Semi-intensiva", "Intensiva", "Super-intensiva", "Regular"], i * 7);
    const planoLead = modLead === "Intensiva" || modLead === "Super-intensiva" ? TABELA_PLANOS[0] : plano;
    const reg = {
      nome: `${PREFIXO_NOME}${pick(nomes, i)} ${pick(sobrenomes, i * 3 + 1)}`, telefoneE164: telefoneFicticio(1000 + i), paisId: cat.paises[pais],
      segmento: i % 9 === 0 ? ("KIDS" as const) : i % 13 === 0 ? ("EMPRESA" as const) : ("ADULTO" as const), b2b: i % 13 === 0,
      temperatura: pick(temps, i), etapa, origemCanal: pick(canais, i), vendedorDonoId: i % 17 === 0 ? null : pick(vendedores, i),
      professorExperimentalId: etapa === EtapaLead.EXPERIMENTAL_AGENDADA || etapa === EtapaLead.EXPERIMENTAL_REALIZADA ? profId : null,
      interesse: pick(["Inglês para trabalho", "Viagem", "Português", "Certificação", "Kids"], i), objetivo: pick(["Conversação", "Entrevista", "Mudança de país"], i),
      dataExperimental: etapa === EtapaLead.EXPERIMENTAL_AGENDADA ? new Date(HOJE.getTime() + ((i % 5) + 1) * 86_400_000) : etapa === EtapaLead.EXPERIMENTAL_REALIZADA || etapa === EtapaLead.NO_SHOW ? new Date(HOJE.getTime() - ((i % 5) + 1) * 86_400_000) : null,
      dataProposta: etapa === EtapaLead.PROPOSTA || etapa === EtapaLead.AGUARDANDO_MATRICULA ? HOJE : null,
      valorPrevisto: etapa === EtapaLead.PROPOSTA || etapa === EtapaLead.AGUARDANDO_MATRICULA || etapa === EtapaLead.MATRICULADO ? D(precoPlano(modLead, pais, planoLead)) : null,
      planoPrevisto: etapa === EtapaLead.PROPOSTA || etapa === EtapaLead.AGUARDANDO_MATRICULA ? `${modLead} · ${planoLead.nome} (${planoLead.meses} meses)` : null,
      motivoPerda: etapa === EtapaLead.PERDIDO ? pick(motivos, i) : null,
      proximaAcao: etapa === EtapaLead.PERDIDO || etapa === EtapaLead.MATRICULADO ? null : "Retomar contato",
      proximoFollowUp: etapa === EtapaLead.PERDIDO || etapa === EtapaLead.MATRICULADO ? null : new Date(HOJE.getTime() + ((i % 7) - 2) * 86_400_000), // inclui follow-ups vencidos
      criadoEm: new Date(HOJE.getTime() - (i % 60) * 86_400_000),
    };
    await prisma.oportunidade.upsert({ where: { id }, update: reg, create: { id, ...reg } });
    await garantirCodigo("oportunidade", id);
    conta(`Lead ${etapa}`);
  }
  // Tarefas: todos os tipos, status e prioridades.
  const tipos = Object.values(TipoTarefa);
  const sts = Object.values(StatusTarefa);
  const setores = Object.values(FinalidadeAtendimentoWhatsApp);
  for (let i = 0; i < 30; i++) {
    const status = pick(sts, i);
    const id = qaId("tarefa", i + 1);
    const reg = {
      titulo: `${PREFIXO_NOME}${pick(["Ligar para lead", "Enviar proposta", "Cobrar mensalidade", "Confirmar experimental", "Reunião de alinhamento"], i)}`,
      tipo: pick(tipos, i), setor: pick(setores, i), status, prioridade: i % 4 === 0 ? ("ALTA" as const) : ("NORMAL" as const),
      inicioEm: new Date(HOJE.getTime() + ((i % 9) - 4) * 86_400_000), dataCivil: new Date(HOJE.getTime() + ((i % 9) - 4) * 86_400_000).toISOString().slice(0, 10), fusoOrigem: FUSO_CR, responsavelId: pick(vendedores, i), criadorId: adminId,
      leadId: qaId("lead", (i % 200) + 1), concluidaEm: status === StatusTarefa.CONCLUIDA ? HOJE : null, concluidaPorId: status === StatusTarefa.CONCLUIDA ? pick(vendedores, i) : null,
      resultado: status === StatusTarefa.CONCLUIDA ? "Feito" : null, canceladaEm: status === StatusTarefa.CANCELADA ? HOJE : null, motivoCancelamento: status === StatusTarefa.CANCELADA ? "Lead perdido" : null,
    };
    await prisma.tarefa.upsert({ where: { id }, update: reg, create: { id, ...reg } });
    conta("Tarefa");
  }
  // Metas do mês por vendedor (3 métricas) e uma meta geral.
  const comp = HOJE.toISOString().slice(0, 7);
  for (const [i, v] of [...vendedores, null].entries()) {
    for (const metrica of ["MATRICULAS", "EXPERIMENTAIS_REALIZADAS"] as const) {
      const id = qaId("meta", `${comp}-${i}-${metrica}`);
      await prisma.metaComercial.upsert({ where: { id }, update: {}, create: { id, competencia: comp, usuarioId: v, metrica, valor: D(metrica === "MATRICULAS" ? 8 : 15), criadaPorId: adminId } });
      conta("MetaComercial");
    }
  }
}

// ---------- 8. B2B ----------
async function b2b(cat: Catalogo, inv: AlunoGravado[]): Promise<void> {
  const empresas = [["Tecnológica Andina S.A.", "3-101-000001"], ["Hotel Pacífico Ltda.", "3-102-000002"], ["Banco Central QA", "3-101-000003"]] as const;
  const stFatura = Object.values(StatusFaturaB2B);
  for (const [i, [nome, doc]] of empresas.entries()) {
    const id = qaId("empresa", i + 1);
    const reg = { nome: `${PREFIXO_NOME}${nome}`, paisId: cat.paises.CR, documento: doc, contatoNome: `${PREFIXO_NOME}RH ${i + 1}`, contatoEmail: emailQa(`rh${i + 1}`), contatoTelefone: telefoneFicticio(2000 + i), diaVencimento: 10, segmentoMercado: pick(["Tecnologia", "Hotelaria", "Finanças"], i), porte: pick(["Média", "Grande"], i) };
    await prisma.empresa.upsert({ where: { id }, update: reg, create: { id, ...reg } });
    await garantirCodigo("empresa", id);
    conta("Empresa");
    for (const [k, comp] of ["2026-07", "2026-08", "2026-09", "2026-10"].entries()) {
      const fid = qaId("fatura", `${i + 1}-${comp}`);
      const st = pick(stFatura, i + k);
      const freg = { empresaId: id, competencia: comp, moeda: "CRC", valorTotal: D(350000 + i * 50000), status: st, vencimento: dia(`${comp}-10`), pagoEm: st === StatusFaturaB2B.PAGA ? dia(`${comp}-09`) : null };
      await prisma.faturaB2B.upsert({ where: { id: fid }, update: freg, create: { id: fid, ...freg } });
      await garantirCodigo("faturaB2B", fid);
      conta(`FaturaB2B ${st}`);
    }
  }
  // Duas matrículas adultas inventadas passam a ser pagas por empresa.
  for (const [i, g] of inv.filter((x) => x.status === StatusMatricula.ATIVA).slice(0, 2).entries()) {
    await prisma.matricula.update({ where: { id: g.matriculaId }, data: { empresaId: qaId("empresa", i + 1) } });
  }
}

// ---------- 9. WhatsApp (histórico, sem envio) ----------
async function whatsapp(inv: AlunoGravado[], vendedores: string[], finId: string, secId: string): Promise<void> {
  const numero = await prisma.numeroWhatsApp.findFirst({ where: { ativo: true }, orderBy: { criadoEm: "asc" } });
  if (!numero) { console.warn("Sem NumeroWhatsApp ativo: conversas de QA não gravadas."); return; }
  const finalidades = Object.values(FinalidadeAtendimentoWhatsApp);
  const stAt = Object.values(StatusAtendimentoWhatsApp);
  for (let i = 0; i < 50; i++) {
    const finalidade = pick(finalidades, i);
    const status = pick(stAt, i);
    const leadId = finalidade === "COMERCIAL" ? qaId("lead", (i % 200) + 1) : null;
    const alunoId = finalidade !== "COMERCIAL" && inv.length ? pick(inv, i).alunoId : null;
    const tel = finalidade === "COMERCIAL" ? telefoneFicticio(1000 + (i % 200)) : telefoneFicticio(100 + (i % inv.length));
    const cid = qaId("wa-contato", i + 1);
    await prisma.contatoWhatsApp.upsert({ where: { id: cid }, update: {}, create: { id: cid, telefoneE164: tel, nomeExibicao: `${PREFIXO_NOME}Contato ${i + 1}`, leadId, alunoId } });
    const convId = qaId("wa-conversa", i + 1);
    const ultima = new Date(HOJE.getTime() - (i % 10) * 3_600_000);
    await prisma.conversaWhatsApp.upsert({ where: { id: convId }, update: {}, create: { id: convId, numeroId: numero.id, contatoId: cid, ultimaMensagemEm: ultima, ultimoInboundEm: ultima, naoLidas: status === "ABERTO_SEM_RESPONSAVEL" ? 2 : 0 } });
    const atId = qaId("wa-atend", i + 1);
    const responsavelId = status === "ABERTO_SEM_RESPONSAVEL" ? null : finalidade === "COMERCIAL" ? pick(vendedores, i) : finalidade === "FINANCEIRO" ? finId : secId;
    await prisma.atendimentoWhatsApp.upsert({
      where: { id: atId }, update: {},
      create: { id: atId, conversaId: convId, contextoChave: `qa-${finalidade.toLowerCase()}-${i + 1}`, finalidade, status, responsavelId, leadId, alunoId, ultimaMensagemEm: ultima, ultimoInboundEm: ultima, primeiroInboundEm: ultima, primeiraRespostaEm: status === "ABERTO_SEM_RESPONSAVEL" ? null : ultima, encerradoEm: status === "ENCERRADO" ? ultima : null, naoLidas: status === "ABERTO_SEM_RESPONSAVEL" ? 2 : 0 },
    });
    conta(`AtendimentoWhatsApp ${finalidade}`);
    const textos = [["ENTRADA", "Hola, quería información sobre las clases."], ["SAIDA", "¡Hola! Claro, con gusto te ayudo."], ["ENTRADA", "¿Cuál es el precio mensual?"]] as const;
    const msgs = textos.map(([direcao, corpo], k) => ({
      id: qaId("wa-msg", `${i + 1}-${k + 1}`), conversaId: convId, numeroId: numero.id, atendimentoId: atId, direcao, corpo: `${PREFIXO_NOME}${corpo}`,
      // histórico apenas: SAIDA nunca fica NA_FILA (o despacho só pega NA_FILA), e o driver é o do número
      status: direcao === "SAIDA" ? StatusMensagem.LIDA : StatusMensagem.ENTREGUE, enviadaEm: ultima, driver: numero.driver,
      origem: direcao === "SAIDA" ? ("HUMANO" as const) : null, providerMessageId: qaId("wa-prov", `${i + 1}-${k + 1}`),
      criadoEm: new Date(ultima.getTime() - (3 - k) * 60_000),
    }));
    conta("MensagemWhatsApp", (await prisma.mensagemWhatsApp.createMany({ data: msgs, skipDuplicates: true })).count);
  }
}

// ---------- 10. portal do aluno ----------
async function portal(senhaHash: string, gravados: AlunoGravado[]): Promise<string> {
  const email = emailQa("aluno.portal");
  const alvo = gravados.find((g) => g.status === StatusMatricula.ATIVA && g.turmaId);
  if (!alvo) throw new Error("Nenhum aluno real ativo para a conta do portal.");
  const id = qaId("portal", "aluno");
  const existente = await prisma.contaPortalAluno.findUnique({ where: { id } });
  if (!existente) {
    await prisma.contaPortalAluno.create({ data: { id, alunoId: alvo.alunoId, emailVerificado: email, emailVerificadoEm: HOJE, senhaHash, ativa: true } });
  } else {
    await prisma.contaPortalAluno.update({ where: { id }, data: { emailVerificado: email, emailVerificadoEm: HOJE, senhaHash, ativa: true } });
  }
  conta("ContaPortalAluno");
  return email;
}

// ---------- main ----------
async function main() {
  const senha = process.env.QA_SEED_PASSWORD;
  const caminho = process.env.QA_DADOS_JSON;
  if (!senha || senha.length < 6) throw new Error("QA_SEED_PASSWORD ausente ou curta (mín. 6). Nada foi gravado.");
  if (!caminho) throw new Error("QA_DADOS_JSON não definida (caminho do JSON das planilhas). Nada foi gravado.");
  const dados = JSON.parse(readFileSync(caminho, "utf8")) as DadosReais;
  for (const k of ["professores", "turmas", "alunos", "historico", "mensalidades", "feriados", "planoAulas"] as const) {
    if (!Array.isArray(dados[k])) throw new Error(`JSON inválido: falta a lista "${k}".`);
  }

  const usuario = async (email: string) => {
    const u = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (!u) throw new Error(`Usuário ${email} não existe: rode npm run seed e npm run seed:qa antes.`);
    return u.id;
  };
  const adminId = await usuario("admin@genius.com");
  const gpId = await usuario("gp@genius.com");
  const finId = await usuario("financeiro@genius.com");
  const fin2Id = await usuario("financeiro2@genius.com");
  const secId = await usuario("secretaria@genius.com");
  const vendedores = [await usuario("joao@genius.com"), await usuario("vendedor2@genius.com"), await usuario("vendedor3@genius.com"), await usuario("mariana@genius.com")];

  const senhaHash = await bcrypt.hash(senha, 10);
  const cat = await configurar(adminId);
  const profs = await professores(dados, senhaHash);
  const turmasMap = await turmas(dados, cat, profs);
  const reais = await alunosReais(dados, cat, turmasMap, adminId);
  const inv = await alunosInventados(cat, turmasMap, adminId);
  await cobrancasReais(dados, reais, adminId, finId);
  await cobrancasInventadas(inv, reais, adminId, finId, fin2Id, vendedores);
  await academico(dados, turmasMap, gpId, adminId);
  await crm(cat, vendedores, Object.values(profs)[0]!, adminId);
  await b2b(cat, inv);
  await whatsapp(inv, vendedores, finId, secId);
  const emailPortal = await portal(senhaHash, reais);

  console.log("Seed de dados de QA concluído. Gravados/atualizados nesta execução:");
  for (const [k, v] of Object.entries(contagem).sort()) console.log(`  ${k.padEnd(40)} ${v}`);
  console.log(`Conta do portal do aluno: ${emailPortal} (senha = QA_SEED_PASSWORD, não exibida).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
