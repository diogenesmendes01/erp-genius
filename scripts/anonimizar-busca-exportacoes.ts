import { PrismaClient } from "@prisma/client";
import { anonimizarBuscaExportacoes, CORTE_PADRAO, LOTE_PADRAO } from "../src/server/lgpd/anonimizar-busca-exportacoes";

// LGPD (#165, decisão D5): anonimiza o texto da busca guardado nos eventos `DadosExportados` anteriores
// à #119 (25/09/2026). `payload.filtros.busca` em texto vira `{ aplicada: true, caracteres: n }`, o mesmo
// formato que o código grava desde a #119. Nenhum outro campo muda. Idempotente.
//
// Uso (DATABASE_URL do banco alvo; em produção, SÓ depois do backup — scripts/backup-producao.sh):
//   tsx scripts/anonimizar-busca-exportacoes.ts                    # simulação: só conta, não grava
//   tsx scripts/anonimizar-busca-exportacoes.ts --aplicar          # grava, em lotes, e registra o Evento
// Opções: `--corte 2026-09-26T03:00:00Z` (padrão: fim de 25/09 em Brasília) e `--lote 500`.
// A saída mostra só contagens e datas, nunca o texto da busca.

function argumentos(argv: string[]) {
  let aplicar = false, corte = CORTE_PADRAO, lote = LOTE_PADRAO;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--aplicar") aplicar = true;
    else if (argv[i] === "--corte" && argv[i + 1]) corte = new Date(argv[++i]);
    else if (argv[i] === "--lote" && argv[i + 1]) lote = Number(argv[++i]);
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (Number.isNaN(corte.getTime())) throw new Error("--corte precisa ser uma data ISO (ex.: 2026-09-26T03:00:00Z).");
  return { aplicar, corte, lote };
}

async function main() {
  const { aplicar, corte, lote } = argumentos(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    console.log(`Modo: ${aplicar ? "APLICAR" : "simulação (nada é gravado; use --aplicar)"} · corte: ${corte.toISOString()} · lote: ${lote}`);
    const r = await anonimizarBuscaExportacoes(prisma, { aplicar, corte, lote });
    console.log(`DadosExportados com o texto da busca antes do corte: ${r.candidatos}`);
    if (!aplicar) {
      console.log(`Seriam anonimizadas: ${r.candidatos} linha(s) · criadas entre ${r.intervalo.de ?? "—"} e ${r.intervalo.ate ?? "—"}`);
      return;
    }
    console.log(`Anonimizadas: ${r.afetados} linha(s) em ${r.lotes} lote(s) · criadas entre ${r.intervalo.de ?? "—"} e ${r.intervalo.ate ?? "—"}`);
    console.log(`Evento de auditoria: BuscaExportacaoAnonimizada ${r.eventoId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
