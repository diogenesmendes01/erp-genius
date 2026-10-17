import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

const RAIZ = join(process.cwd(), "src");

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? listar(caminho) : [caminho];
  });
}

function arquivosSrc() {
  return listar(RAIZ)
    .filter((c) => /\.(ts|tsx)$/.test(c) && !/\.test\.tsx?$/.test(c))
    .map((c) => ({ arquivo: relative(process.cwd(), c), conteudo: readFileSync(c, "utf8") }));
}

describe("saída de /leads", () => {
  it("nenhum link ou revalidate aponta para /leads em lugar nenhum de src", () => {
    const ofensores = arquivosSrc().filter(
      (a) => /["'`]\/leads(?:[/?"'`$]|\$\{)/.test(a.conteudo),
    );
    expect(ofensores.map((o) => o.arquivo)).toEqual([]);
  });

  it("a rota /leads não existe mais", () => expect(existsSync("src/app/(app)/leads")).toBe(false));

  it("Preparar contratação, link de pagamento e exportar leads têm casa nova", () => {
    expect(existsSync("src/app/(app)/oportunidades/[id]/contratacao/page.tsx")).toBe(true);
    expect(readFileSync("src/app/(app)/funil/PainelOportunidade.tsx", "utf-8")).toContain("registrarLinkPagamento");
    expect(readFileSync("src/app/(app)/funil/page.tsx", "utf-8")).toContain("/api/exportacoes/leads");
  });

  it("as edições da ficha antiga têm casa no painel da oportunidade (B1 da R1 do #216)", () => {
    const painel = readFileSync("src/app/(app)/funil/PainelOportunidade.tsx", "utf-8");
    const edicao = readFileSync("src/app/(app)/funil/EdicaoOportunidade.tsx", "utf-8");
    for (const secao of ["ResumoOportunidade", "DatasOportunidade", "DadosOportunidade", "DocumentosOportunidade", "InteracaoOportunidade"]) {
      expect(painel).toContain(`<${secao} `);
    }
    for (const acao of ["atualizarResumo(", "atualizarDatas(", "editarLead(", "registrarInteracao(", "anexarDocumentoLead(", "arquivarDocumentoLead("]) {
      expect(edicao).toContain(acao);
    }
  });

  it("links antigos de /leads redirecionam de forma permanente para o CRM novo (C2 da R1 do #216)", async () => {
    const regras = await nextConfig.redirects!();
    const para = (source: string) => regras.find((r) => r.source === source);
    expect(para("/leads")).toMatchObject({ destination: "/funil", permanent: true });
    expect(para("/leads/:id")).toMatchObject({ destination: "/funil?o=:id", permanent: true });
    expect(para("/leads/:id/contratacao")).toMatchObject({ destination: "/oportunidades/:id/contratacao", permanent: true });
  });
});
