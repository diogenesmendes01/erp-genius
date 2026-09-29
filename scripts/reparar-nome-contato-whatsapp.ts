import { PrismaClient } from "@prisma/client";
import { registrarEvento } from "../src/server/_shared/evento";

// REPARO — nome de contato WhatsApp contaminado pelo perfil da própria linha (bug 29/09/2026).
// A mensagem enviada pelo celular da linha (fromMe) trazia no pushName o perfil de quem ENVIOU,
// e ele virava o nome do contato. Este script limpa esse nome (volta a NULL) nos contatos SEM
// vínculo no ERP: a inbox passa a mostrar o número e, na próxima mensagem do contato, o nome de
// perfil real dele. Contato vinculado (aluno/responsável/lead) não é tocado — o nome vem do cadastro.
//
// Uso (DATABASE_URL do banco alvo):
//   tsx scripts/reparar-nome-contato-whatsapp.ts --nome "Diogenes Mendes"            # só lista
//   tsx scripts/reparar-nome-contato-whatsapp.ts --nome "Diogenes Mendes" --aplicar  # grava
// `--nome` pode repetir (um por perfil de linha); `--manter +55...` exclui um telefone do reparo.

function argumentos(argv: string[]) {
  const nomes: string[] = [], manter = new Set<string>();
  let aplicar = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--nome" && argv[i + 1]) nomes.push(argv[++i].trim());
    else if (argv[i] === "--manter" && argv[i + 1]) manter.add(argv[++i].trim());
    else if (argv[i] === "--aplicar") aplicar = true;
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (!nomes.length) throw new Error('Informe ao menos um --nome "Perfil da linha".');
  return { nomes, manter, aplicar };
}

/** LGPD: o relatório não imprime o telefone inteiro. */
const mascarar = (t: string) => `${t.slice(0, 5)}…${t.slice(-4)}`;

async function main() {
  const { nomes, manter, aplicar } = argumentos(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const linhas = new Set((await prisma.numeroWhatsApp.findMany({ select: { telefoneE164: true } })).map((n) => n.telefoneE164));
    const candidatos = await prisma.contatoWhatsApp.findMany({
      where: {
        OR: nomes.map((nome) => ({ nomeExibicao: { equals: nome, mode: "insensitive" as const } })),
        alunoId: null, responsavelId: null, leadId: null,
        conversas: { some: { numero: { driver: "BAILEYS" } } },
      },
      select: { id: true, telefoneE164: true, nomeExibicao: true,
        conversas: { select: { mensagens: { select: { direcao: true, origem: true, criadoEm: true }, orderBy: { criadoEm: "asc" } } } } },
    });

    const reparar = candidatos.filter((c) => !linhas.has(c.telefoneE164) && !manter.has(c.telefoneE164));
    console.log(`Candidatos: ${candidatos.length} · a reparar: ${reparar.length} · modo: ${aplicar ? "APLICAR" : "somente leitura"}`);
    for (const c of reparar) {
      const msgs = c.conversas.flatMap((v) => v.mensagens).sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
      const recebidas = msgs.filter((m) => m.direcao === "ENTRADA").length;
      const primeira = msgs[0] ? `${msgs[0].direcao}${msgs[0].direcao === "SAIDA" && !msgs[0].origem ? " (celular)" : ""}` : "—";
      console.log(`  ${mascarar(c.telefoneE164)} · "${c.nomeExibicao}" · 1ª mensagem: ${primeira} · recebidas: ${recebidas} · enviadas: ${msgs.length - recebidas}`);
    }

    // Lead com o nome do perfil da linha: não é reparado aqui (o nome do lead é cadastro) — só listado.
    const leads = await prisma.lead.findMany({
      where: { OR: nomes.map((nome) => ({ nome: { equals: nome, mode: "insensitive" as const } })) },
      select: { id: true, codigo: true, nome: true, telefoneE164: true },
    });
    if (leads.length) {
      console.log(`Leads com o mesmo nome (conferir e renomear na tela de Leads): ${leads.length}`);
      for (const l of leads) console.log(`  ${l.codigo ?? l.id} · "${l.nome}" · ${l.telefoneE164 ? mascarar(l.telefoneE164) : "sem telefone"}`);
    }

    if (!aplicar || !reparar.length) return;
    await prisma.$transaction(async (tx) => {
      for (const c of reparar) {
        // Condicional: se o nome mudou desde a leitura (mensagem nova do contato), não sobrescreve.
        const r = await tx.contatoWhatsApp.updateMany({ where: { id: c.id, nomeExibicao: c.nomeExibicao }, data: { nomeExibicao: null } });
        if (!r.count) continue;
        await registrarEvento(tx, { tipo: "NomeContatoReparado", agregadoTipo: "ContatoWhatsApp", agregadoId: c.id, autorId: null,
          payload: { motivo: "perfil_da_linha_em_mensagem_fromMe", nomeAnterior: c.nomeExibicao } });
      }
    });
    console.log("Reparo aplicado.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
