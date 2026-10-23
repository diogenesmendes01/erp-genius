import { Papel } from "@prisma/client";
import Link from "next/link";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { listarVendedores } from "@/server/comercial/consultas";
import { listarPaisesOperacionais } from "@/server/paises/consultas";
import { listarFiltros } from "@/server/crm/filtros-salvos";
import { carregarFunil, lerFiltrosFunil } from "@/server/crm/funil";
import { historicoOportunidade, obterOportunidade } from "@/server/crm/historico";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FunilCliente } from "./FunilCliente";

type Params = Record<string, string | string[] | undefined>;

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function FunilPage({ searchParams }: { searchParams: Promise<Params> }) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
  const params = await searchParams;
  const filtros = lerFiltrosFunil(params);
  const modo = primeiro(params.modo) === "lista" ? "lista" : "quadro";
  const idAberto = primeiro(params.o).trim();
  const capacidades = [...capacidadesCrm(usuario.papeis)];
  const podeAtribuir = capacidades.includes("funil.atribuir");

  const [colunas, salvos, vendedores, paises, config, oportunidade, preferencia] = await Promise.all([
    carregarFunil(usuario, filtros),
    listarFiltros(usuario, "FUNIL"),
    listarVendedores(),
    listarPaisesOperacionais(),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    idAberto ? obterOportunidade(idAberto, usuario) : Promise.resolve(null),
    consultarPreferenciaFusoEquipe(),
  ]);
  const historico = oportunidade ? ((await historicoOportunidade(oportunidade.id, usuario)) ?? []) : [];

  const total = colunas.reduce((soma, c) => soma + c.total, 0);
  const filtrando = Object.entries(filtros).some(([k, v]) => v && !(k === "perdidosDias" && v === "todos") && !(k === "ordem" && v === "recentes"));

  // Exportação: só os filtros que a planilha de leads entende (rota valida de novo e exige a capacidade).
  const q = new URLSearchParams();
  if (filtros.busca) q.set("busca", filtros.busca);
  if (filtros.tipo) q.set("tipo", filtros.tipo);
  if (filtros.temperatura) q.set("temperatura", filtros.temperatura);
  if (filtros.donoId) q.set("dono", filtros.donoId);
  const query = q.toString();
  const podeExportar = usuario.papeis.includes(Papel.ADMINISTRADOR) || (usuario.permissoes ?? []).includes("dados.exportar_leads");

  const vazio = total === 0 ? (
    <EstadoVazio bloco acao={filtrando ? <Link href="/funil" className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Limpar filtros</Link> : undefined}>
      {filtrando ? "Nenhuma oportunidade com esses filtros." : "Nenhuma oportunidade na sua carteira."}
    </EstadoVazio>
  ) : null;

  const dir = primeiro(params.dir) === "desc" ? "desc" : "asc";

  return (
    <>
      {podeExportar && (
        <div className="mb-3 flex justify-end">
          <a href={`/api/exportacoes/leads${query ? `?${query}` : ""}`} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>
            Exportar
          </a>
        </div>
      )}
      <FunilCliente
        colunas={colunas}
        modo={modo}
        filtros={filtros}
        dirOrdem={dir}
        salvos={salvos.map((s) => ({ id: s.id, nome: s.nome, filtros: s.filtros }))}
        aberta={oportunidade ? { oportunidade, historico } : null}
        oportunidadeNaoEncontrada={!!idAberto && !oportunidade}
        capacidades={capacidades}
        podeAtribuir={podeAtribuir}
        vendedores={vendedores}
        paises={paises.map((p) => ({ id: p.id, nome: p.nome }))}
        fuso={config?.fusoInstitucional ?? undefined}
        preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
        vazio={vazio}
      />
    </>
  );
}
