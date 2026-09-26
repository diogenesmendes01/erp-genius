"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirCorrecaoConclusaoReposicao, proporCorrecaoConclusaoReposicao } from "@/server/diario/reposicao-individual";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

type Fonte = {
  concluida: boolean;
  encontro: null | { id: string; inicio: string; fim: string; fuso: string; realizadaEm: string };
  entrega: null | { id: string; versao: number; entregueEm: string; resumo: string; atividade: string };
  validadaEm: string | null;
  evidencia: string;
};

type Dados = {
  reposicao: { id: string; modalidade: "PARTICULAR" | "GRAVACAO"; origem: { inicio: string; fim: string; fuso: string } };
  conclusao: { id: string; versao: number; concluidaPor: string; fonte: Fonte };
  consultaHistorica: boolean;
  conclusaoAnteriorVersao: number | null;
  conclusaoSeguinteVersao: number | null;
  ultimaConclusaoVersao: number;
  vigente: { fonte: Fonte; origem: "CONCLUSAO_ORIGINAL" | "CORRECAO_APROVADA" };
  versaoEsperada: number;
  podePropor: boolean;
  fontesDisponiveis: {
    encontros: { id: string; inicio: string; fim: string; fuso: string; realizadaEm: string }[];
    entregas: { id: string; versao: number; entregueEm: string; resumo: string; atividade: string; evidencia: string }[];
  };
  correcoes: {
    id: string; versao: number; criadaEm: string; autor: string; motivo: string; propostaHash: string;
    antes: Fonte; fonte: Fonte;
    decisao: null | { aprovada: boolean; motivo: string; decididaEm: string; decisor: string };
    podeRejeitar: boolean; podeAprovar: boolean;
    impactosHash: string | null;
    impactos: { id: string; status: "APROVADA" | "EXECUTADA"; destino: string; casoId?: string | null }[];
    temImpactos: boolean;
    podeVerCasos: boolean;
    impedimentoAprovacao: string | null;
  }[];
};

function dataHora(valor: string, fuso: string) {
  try { return `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor))} (${fuso})`; }
  catch { return `${valor.replace("T", " ").replace("Z", " UTC")} (${fuso})`; }
}

function FonteResumo({ fonte, titulo, fusoExibicao }: { fonte: Fonte; titulo: string; fusoExibicao: string }) {
  return <div className="space-y-1 rounded bg-gray-50 p-3">
    <p className="font-medium">{titulo}</p>
    {!fonte.concluida && <p>Conclusão retirada. Não há nova fonte de realização ou validação.</p>}
    {fonte.concluida && fonte.encontro && <p>Encontro particular realizado em {dataHora(fonte.encontro.realizadaEm, fusoExibicao)}. Encontro: {dataHora(fonte.encontro.inicio, fusoExibicao)} a {dataHora(fonte.encontro.fim, fusoExibicao)} (origem {fonte.encontro.fuso}).</p>}
    {fonte.concluida && fonte.entrega && <>
      <p>Entrega gravada — versão {fonte.entrega.versao}, entregue em {dataHora(fonte.entrega.entregueEm, "UTC")}.</p>
      {fonte.validadaEm && <p>Validação registrada em {dataHora(fonte.validadaEm, "UTC")}.</p>}
      <p className="whitespace-pre-wrap">Resumo: {fonte.entrega.resumo}</p>
      <p className="whitespace-pre-wrap">Atividade: {fonte.entrega.atividade}</p>
    </>}
    <p className="whitespace-pre-wrap text-sm">Evidência: {fonte.evidencia}</p>
  </div>;
}

function isoUtc(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const data = new Date(`${texto}:00Z`);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export function CorrecoesConclusaoReposicao({ dados, mostrarPreparacao, fusoExibicao }: { dados: Dados; mostrarPreparacao: boolean; fusoExibicao: string }) {
  return <div className="space-y-5">
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-medium">{dados.consultaHistorica ? "Conclusão e fonte históricas" : "Conclusão e fonte vigentes"}</h2>
      <p>Reposição {dados.reposicao.modalidade === "PARTICULAR" ? "particular" : "por gravação"}. Aula de origem: {dataHora(dados.reposicao.origem.inicio, fusoExibicao)} a {dataHora(dados.reposicao.origem.fim, fusoExibicao)} (exibido em {fusoExibicao}; origem {dados.reposicao.origem.fuso}).</p>
      <p>Conclusão original versão {dados.conclusao.versao}, registrada por {dados.conclusao.concluidaPor}. As datas da fonte abaixo são exibidas com o fuso correspondente.</p>
      <FonteResumo titulo={dados.consultaHistorica ? "Fonte efetiva nesta conclusão histórica" : dados.vigente.origem === "CORRECAO_APROVADA" ? "Fonte vigente após correção aprovada" : "Fonte vigente da conclusão original"} fonte={dados.vigente.fonte} fusoExibicao={fusoExibicao} />
    </section>
    {mostrarPreparacao && dados.podePropor && <ProporCorrecao dados={dados} />}
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Histórico de correções</h2>
      {!dados.correcoes.length && <EstadoVazio>Não há correções nesta página.</EstadoVazio>}
      {dados.correcoes.map((correcao) => <article key={correcao.id} className="space-y-3 rounded border p-4">
        <h3 className="font-medium">Proposta versão {correcao.versao}</h3>
        <p>Preparada por {correcao.autor} em {dataHora(correcao.criadaEm, fusoExibicao)}.</p>
        <p className="whitespace-pre-wrap">Motivo: {correcao.motivo}</p>
        <div className="grid gap-3 lg:grid-cols-2"><FonteResumo titulo="Fonte anterior na sequência de propostas" fonte={correcao.antes} fusoExibicao={fusoExibicao} /><FonteResumo titulo="Depois proposto" fonte={correcao.fonte} fusoExibicao={fusoExibicao} /></div>
        {correcao.decisao ? <div className="rounded bg-gray-50 p-3"><p className="font-medium">{correcao.decisao.aprovada ? "Correção aprovada" : "Correção rejeitada"}</p><p>Decisão de {correcao.decisao.decisor} em {dataHora(correcao.decisao.decididaEm, fusoExibicao)}.</p><p className="whitespace-pre-wrap">{correcao.decisao.motivo}</p></div>
          : <><p role="status">A fonte vigente permanece a mesma até uma aprovação independente.</p><DecidirCorrecao correcao={correcao} /></>}
        {correcao.decisao?.aprovada && correcao.temImpactos && <ImpactosAprovados correcao={correcao} />}
      </article>)}
    </section>
  </div>;
}

function ImpactosAprovados({ correcao }: { correcao: Dados["correcoes"][number] }) {
  if (!correcao.podeVerCasos) return <p role="status">A Gestão Pedagógica acompanha as dependências acadêmicas desta correção aprovada.</p>;
  return <div className="space-y-2 rounded bg-gray-50 p-3"><p className="font-medium">Dependências acadêmicas em acompanhamento</p><p>A correção não desfaz movimentações já registradas.</p>{correcao.impactos.map((impacto) => <p key={impacto.id}>Destino {impacto.destino} — {impacto.status === "EXECUTADA" ? "movimentação já executada" : "movimentação aprovada"}. {impacto.casoId ? <a className="underline" href={`/academico/correcoes/revisoes/${encodeURIComponent(impacto.casoId)}`}>Ver revisão</a> : "A revisão está sendo preparada pela gestão."}</p>)}</div>;
}

function ProporCorrecao({ dados }: { dados: Dados }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [escolhaAtual, setEscolhaAtual] = useState("");
  const router = useRouter();
  const modalidade = dados.reposicao.modalidade;
  return <form className="space-y-3 rounded border p-4" onChange={() => setErro("")} onSubmit={(evento) => {
    evento.preventDefault(); const formulario = new FormData(evento.currentTarget);
    const escolha = String(formulario.get("fonte") ?? "");
    const comum = { reposicaoId: dados.reposicao.id, conclusaoId: dados.conclusao.id, versaoAnterior: dados.versaoEsperada, motivo: String(formulario.get("motivo") ?? ""), evidencia: String(formulario.get("evidencia") ?? "") };
    let fonte: { concluida: false } | { concluida: true; encontroReposicaoId: string; realizadaEm: string } | { concluida: true; entregaId: string; validadaEm: string };
    if (escolha === "RETIRAR") fonte = { concluida: false };
    else if (modalidade === "PARTICULAR") {
      const encontro = dados.fontesDisponiveis.encontros.find((item) => item.id === escolha);
      if (!encontro) { setErro("Selecione um encontro listado para esta reposição ou retire a conclusão."); return; }
      fonte = { concluida: true, encontroReposicaoId: encontro.id, realizadaEm: encontro.realizadaEm };
    } else {
      const entrega = dados.fontesDisponiveis.entregas.find((item) => item.id === escolha), validadaEm = isoUtc(formulario.get("validadaEm"));
      if (!entrega || !validadaEm) { setErro("Selecione uma entrega listada e informe a validação em UTC."); return; }
      fonte = { concluida: true, entregaId: entrega.id, validadaEm };
    }
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await proporCorrecaoConclusaoReposicao({ ...comum, ...fonte });
        if (!resultado.ok) { setErro(resultado.erro); return; }
        router.refresh();
      } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    });
  }}><fieldset disabled={ocupado} className="space-y-3">
    <h2 className="text-xl font-medium">Propor correção</h2>
    <p>A proposta conserva a fonte vigente até a decisão independente. Escolha uma fonte conferida desta reposição ou retire a conclusão sem substituir a fonte.</p>
    <label className="block">Resultado proposto<select name="fonte" required value={escolhaAtual} onChange={(evento) => setEscolhaAtual(evento.target.value)} className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="RETIRAR">Retirar a conclusão, sem nova fonte</option>{modalidade === "PARTICULAR" && dados.fontesDisponiveis.encontros.map((encontro) => <option key={encontro.id} value={encontro.id}>Encontro realizado em {dataHora(encontro.realizadaEm, encontro.fuso)}</option>)}{modalidade === "GRAVACAO" && dados.fontesDisponiveis.entregas.map((entrega) => <option key={entrega.id} value={entrega.id}>Entrega versão {entrega.versao} — {dataHora(entrega.entregueEm, "UTC")}</option>)}</select></label>
    {modalidade === "GRAVACAO" && escolhaAtual !== "RETIRAR" && <><label className="block">Horário da validação (UTC)<input name="validadaEm" type="datetime-local" required className="block rounded border p-2" /></label><div className="space-y-2">{dados.fontesDisponiveis.entregas.map((entrega) => <details key={entrega.id} className="rounded bg-gray-50 p-3"><summary>Material da entrega versão {entrega.versao}</summary><p className="whitespace-pre-wrap">Resumo: {entrega.resumo}</p><p className="whitespace-pre-wrap">Atividade: {entrega.atividade}</p><p className="whitespace-pre-wrap">Evidência: {entrega.evidencia}</p></details>)}</div></>}
    {modalidade === "PARTICULAR" && !dados.fontesDisponiveis.encontros.length && <EstadoVazio role="status">Não há encontro próprio ministrado com presença disponível para esta correção.</EstadoVazio>}
    {modalidade === "GRAVACAO" && !dados.fontesDisponiveis.entregas.length && <EstadoVazio role="status">Não há entrega completa disponível para esta correção.</EstadoVazio>}
    <label className="block">Motivo da correção<CampoTexto name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <label className="block">Evidência da correção<CampoTexto name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar proposta"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}

function DecidirCorrecao({ correcao }: { correcao: Dados["correcoes"][number] }) {
  const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState(""); const router = useRouter();
  if (!correcao.podeRejeitar) return <p role="status">Aguardando decisão independente ou uma conferência atualizada.</p>;
  return <form className="space-y-3 border-t pt-3" onSubmit={(evento) => {
    evento.preventDefault(); const formulario = new FormData(evento.currentTarget); const escolha = formulario.get("decisao");
    if (escolha !== "aprovar" && escolha !== "rejeitar") { setErro("Selecione uma decisão."); return; }
    iniciar(async () => {
      setErro("");
      try {
        const resultado = await decidirCorrecaoConclusaoReposicao({ correcaoId: correcao.id, propostaHash: correcao.propostaHash, aprovar: escolha === "aprovar", motivo: String(formulario.get("motivo") ?? ""), ...(escolha === "aprovar" && correcao.impactosHash ? { impactosHash: correcao.impactosHash } : {}) });
        if (!resultado.ok) { setErro(resultado.erro); return; }
        router.refresh();
      } catch { setErro(MSG_DECISAO_INCERTA); }
    });
  }}><fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Decisão independente</legend><p className="text-sm">Rejeitar não atesta que a fonte atual esteja correta. Aprovar exige que esta seja a proposta mais recente e que a fonte ainda seja válida.</p>
    <div className="space-y-2 rounded bg-gray-50 p-3"><p className="font-medium">Dependências acadêmicas</p><p>A correção não desfaz movimentações acadêmicas. {correcao.impactos.length ? "As mudanças abaixo exigem conferência pedagógica após a aprovação." : "Não há mudança acadêmica vinculada para revisar."}</p>{!!correcao.impactos.length && <ul className="list-disc pl-5">{correcao.impactos.map((impacto) => <li key={impacto.id}>Destino {impacto.destino} — {impacto.status === "EXECUTADA" ? "movimentação já executada" : "movimentação aprovada"}.</li>)}</ul>}</div>
    <MensagemStatus texto={correcao.impedimentoAprovacao} />
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option>{correcao.podeAprovar && correcao.impactosHash && <option value="aprovar">Aprovar correção</option>}<option value="rejeitar">Rejeitar proposta</option></select></label>
    {(!correcao.podeAprovar || !correcao.impactosHash) && <p role="status">Esta proposta não pode ser aprovada no estado atual, mas ainda pode ser rejeitada.</p>}
    <label className="block">Motivo da decisão<CampoTexto name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </fieldset>{erro && <p role="alert">{erro}</p>}</form>;
}
