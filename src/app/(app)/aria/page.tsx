import { Papel } from "@prisma/client";
import type { AcaoAgenteIATipo, EtapaLead } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { lerOpcao, lerTexto, type ParametrosUrl } from "@/lib/pagina-url";
import { Aviso } from "@/components/Aviso";
import { capacidadesAria } from "@/server/aria/permissoes-tela";
import { carregarTelaAria } from "@/server/aria/tela";
import { ACOES_MATRIZ, ETAPAS_ARIA } from "@/server/aria/matriz";
import { Abas } from "./_componentes/Abas";
import { ABAS_ARIA, ABAS_DE_EDICAO } from "./_componentes/abas";
import { AvisoEdicaoNoComputador } from "./_componentes/AvisoEdicaoNoComputador";
import { BarraPublicar } from "./_componentes/BarraPublicar";
import { Cabecalho } from "./_componentes/Cabecalho";
import { Comportamento } from "./_componentes/Comportamento";
import { Confianca } from "./_componentes/Confianca";
import { Conhecimento } from "./_componentes/Conhecimento";
import { Handoff } from "./_componentes/Handoff";
import { Historico } from "./_componentes/Historico";
import { Playground } from "./_componentes/Playground";
import { Permissoes } from "./_componentes/Permissoes";
import { VisaoGeral } from "./_componentes/VisaoGeral";

const RESULTADOS = ["PENDENTES", "EXECUTADAS", "REJEITADAS", "DESFEITAS"] as const;

export default async function AriaPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  const params = (await searchParams) ?? {};
  const aba = lerOpcao(params, "aba", ABAS_ARIA) ?? "visao";
  const dias = ([1, 7, 30] as const).find((d) => String(d) === lerTexto(params, "dias")) ?? 7;
  const cap = capacidadesAria(usuario);
  const filtros = {
    busca: lerTexto(params, "busca"),
    acao: lerOpcao(params, "acao", ACOES_MATRIZ) ?? "",
    etapa: lerOpcao(params, "etapa", ETAPAS_ARIA) ?? "",
    resultado: lerOpcao(params, "resultado", RESULTADOS) ?? "",
  };
  const [dados, configuracao] = await Promise.all([
    carregarTelaAria(usuario, aba, {
      dias,
      busca: filtros.busca || undefined,
      acao: (filtros.acao || undefined) as AcaoAgenteIATipo | undefined,
      etapa: (filtros.etapa || undefined) as EtapaLead | undefined,
      resultado: (filtros.resultado || undefined) as (typeof RESULTADOS)[number] | undefined,
      cursor: lerTexto(params, "cursor", 200) || undefined,
    }),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
  ]);
  const { config } = dados;
  const baseVersaoId = dados.publicada?.id ?? null;
  const podeEditar = cap.has("editarComportamento");
  const edicao = ABAS_DE_EDICAO.includes(aba);

  return (
    <div className="pb-32 md:pb-24">
      <Cabecalho
        nome={config.nome}
        funcao={config.funcao}
        versaoPublicada={dados.publicada?.numero ?? null}
        estado={dados.estado}
        pausada={dados.pausada}
        motivoPausa={dados.motivoPausa}
        supervisao={dados.supervisao}
        podeMudarEstado={cap.has("mudarEstado")}
        podePausar={cap.has("pausar")}
        verProvedor={cap.has("verProvedor")}
      />
      {!dados.publicada && (
        <Aviso tom="info" className="mt-3" titulo="A Aria ainda não foi publicada">
          Faça a primeira configuração nas abas e publique. Enquanto não houver versão publicada, ela não atende ninguém.
        </Aviso>
      )}
      <Abas ativa={aba} />

      <div className="mt-6">
        {edicao && <AvisoEdicaoNoComputador />}
        <div className={edicao ? "max-md:hidden" : undefined}>
          {aba === "visao" && dados.visao && <VisaoGeral visao={dados.visao} dias={dias} nome={config.nome} />}
          {aba === "comportamento" && <Comportamento config={config} baseVersaoId={baseVersaoId} podeEditar={podeEditar} />}
          {aba === "permissoes" && <Permissoes config={config} baseVersaoId={baseVersaoId} podeEditar={cap.has("editarMatriz")} />}
          {aba === "conhecimento" && <Conhecimento config={config} baseVersaoId={baseVersaoId} podeEditar={podeEditar} fontes={dados.fontes ?? []} />}
          {aba === "handoff" && <Handoff config={config} baseVersaoId={baseVersaoId} podeEditar={podeEditar} />}
          {aba === "confianca" && (
            <Confianca
              config={config}
              baseVersaoId={baseVersaoId}
              podeEditar={podeEditar}
              podeEditarExpiracao={cap.has("editarConfianca")}
              supervisao={dados.supervisao}
              podeLigarSupervisao={cap.has("ligarSupervisao")}
              podeDesligarSupervisao={cap.has("desligarSupervisao")}
            />
          )}
          {aba === "historico" && dados.historico && (
            <Historico
              itens={dados.historico.itens}
              proximo={dados.historico.proximo}
              podeDecidir={cap.has("decidirHistorico")}
              fuso={configuracao?.fusoInstitucional ?? "America/Sao_Paulo"}
              filtros={filtros}
            />
          )}
        </div>
        {aba === "playground" && <Playground paises={dados.paises ?? []} temRascunho={!!dados.rascunho} nome={config.nome} />}
      </div>

      <BarraPublicar diff={dados.diff} podePublicar={cap.has("publicar")} podeDescartar={podeEditar} />
    </div>
  );
}
