import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

// Trava de pg_proc: cada migration desta fase acrescenta o próprio nome em NOVAS.
const BASE = [
  "guard_identidade_destinatario_aviso_agenda",
  "validar_contexto_financeiro_atendimento_whatsapp",
  "validar_destino_direto_pedagogico_atual_265",
  "validar_intencao_destino_direto_pedagogico_atual_265",
  "validar_intencao_pedagogica_264",
];
const NOVAS: string[] = ["impedir_atendimento_em_grupo"];
const HASH_BASE: Record<string, string> = {
  guard_identidade_destinatario_aviso_agenda: "e572bc232c823241c656314c34df1a6b",
  validar_contexto_financeiro_atendimento_whatsapp: "f73eef8ea4a2c107115e367c3ea04e3d",
  validar_destino_direto_pedagogico_atual_265: "9df47f4f56f5a61122f28f62836b5af2",
  validar_intencao_destino_direto_pedagogico_atual_265: "21a332497435c9ebf0ad188fcee87c38",
  validar_intencao_pedagogica_264: "c891ca31460be811c75b15cba3e85409",
};

describe("pg_proc do WhatsApp", () => {
  it("funções de WhatsApp: base intacta + só as novas desta fase", async () => {
    const f = await prisma.$queryRaw<{ proname: string; hash: string }[]>`SELECT p.proname, md5(p.prosrc) AS hash FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosrc ~* '(whatsapp|IntencaoMensagem)' ORDER BY 1`;
    expect(f.map((x) => x.proname)).toEqual([...BASE, ...NOVAS].sort());
    for (const nome of BASE.filter((n) => n !== "guard_identidade_destinatario_aviso_agenda"))
      expect(f.find((x) => x.proname === nome)?.hash).toBe(HASH_BASE[nome]);
    const desligados = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int n FROM pg_trigger WHERE tgname LIKE 'validar_%' AND tgenabled <> 'O'`;
    expect(desligados[0].n).toBe(0);
  });
});
