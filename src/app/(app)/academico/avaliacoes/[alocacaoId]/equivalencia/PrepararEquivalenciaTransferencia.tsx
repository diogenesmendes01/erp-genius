"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporEquivalenciaTransferencia, revisarEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-proposta";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";

type Habilidade = typeof HABILIDADES[number];
type Revisao = NonNullable<Extract<Awaited<ReturnType<typeof revisarEquivalenciaTransferencia>>, { ok: true }>["dado"]>;
type Fonte = Revisao["fontes"][number];
type Destino = { id: string; label: string; diasHorario: string | null; vagas: number };

const nomesHabilidade: Record<Habilidade, string> = {
  FALA: "Comunicação oral",
  COMPREENSAO_ORAL: "Compreensão oral",
  LEITURA: "Leitura",
  ESCRITA: "Escrita",
};

const chaveRequisito = (codigoAvaliacao: string, habilidade: Habilidade) => `${codigoAvaliacao}\u0000${habilidade}`;
const nota = (valor: string) => valor.replace(".", ",");
function rotuloFonte(fonte: Fonte) {
  if (fonte.tipoFonte === "RECUPERACAO") return `Recuperação de ${nomesHabilidade[fonte.habilidade]} · nota ${nota(fonte.nota)}`;
  if (fonte.tipoFonte === "APROVEITAMENTO") return `Aproveitamento anterior ${fonte.codigoAvaliacao} · ${nomesHabilidade[fonte.habilidade]} · nota ${nota(fonte.nota)}`;
  return `Avaliação regular ${fonte.codigoAvaliacao} · ${nomesHabilidade[fonte.habilidade]} · nota ${nota(fonte.nota)}`;
}

export function PrepararEquivalenciaTransferencia({
  matriculaId,
  alocacaoOrigemId,
  destinos,
}: {
  matriculaId: string;
  alocacaoOrigemId: string;
  destinos: Destino[];
}) {
  const router = useRouter();
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const [turmaDestinoId, setTurmaDestinoId] = useState("");
  const [base, setBase] = useState<Revisao | null>(null);
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [registrada, setRegistrada] = useState(false);

  const requisitos = base?.projecao.itens ?? [];
  const fontesPorHabilidade = useMemo(() => {
    const fontes = new Map<Habilidade, { referenciaId: string; rotulo: string }[]>();
    for (const fonte of base?.fontes ?? []) {
      const lista = fontes.get(fonte.habilidade) ?? [];
      lista.push({ referenciaId: fonte.referenciaId, rotulo: rotuloFonte(fonte) });
      fontes.set(fonte.habilidade, lista);
    }
    return fontes;
  }, [base]);

  function mapeamentosAtuais() {
    return requisitos.flatMap((requisito) => {
      const referenciaFonteId = selecoes[chaveRequisito(requisito.codigoAvaliacao, requisito.habilidade)];
      return referenciaFonteId ? [{
        referenciaFonteId,
        codigoAvaliacaoDestino: requisito.codigoAvaliacao,
        habilidadeDestino: requisito.habilidade,
      }] : [];
    });
  }

  async function revisar() {
    if (!turmaDestinoId) {
      setErro("Selecione a turma de destino antes de conferir.");
      return;
    }
    setOcupado(true); setErro(""); setMensagem("");
    try {
      const r = await revisarEquivalenciaTransferencia({
        matriculaId,
        alocacaoOrigemId,
        turmaDestinoId,
        mapeamentos: mapeamentosAtuais(),
      });
      if (!r.ok || !r.dado) {
        setErro(r.ok ? "A revisão não retornou dados. Tente novamente." : r.erro);
        return;
      }
      setBase(r.dado);
      setRevisao(r.dado);
      setSelecoes((atuais) => Object.fromEntries(Object.entries(atuais).filter(([chave]) =>
        r.dado!.projecao.itens.some((item) => chave === chaveRequisito(item.codigoAvaliacao, item.habilidade)),
      )));
    } catch {
      setErro("Não foi possível conferir as condições atuais. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!revisao || registrada) {
      setErro("Confira o mapeamento atual antes de encaminhar a proposta.");
      return;
    }
    const motivo = String(new FormData(evento.currentTarget).get("motivo") ?? "").trim();
    const entrada = {
      matriculaId,
      alocacaoOrigemId,
      turmaDestinoId,
      mapeamentos: mapeamentosAtuais(),
      estadoHash: revisao.estadoHash,
      versaoEsperada: revisao.versaoAtual,
      motivo,
    };
    const assinatura = JSON.stringify(entrada);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    setOcupado(true); setErro(""); setMensagem("");
    try {
      const r = await proporEquivalenciaTransferencia({ ...entrada, chaveIdempotencia: tentativa.current.chave });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setRegistrada(true);
      setMensagem("Proposta registrada para decisão independente. Nenhuma transferência ou lançamento foi aplicado.");
      router.push(`/academico/equivalencias/${encodeURIComponent(r.dado!.id)}`);
    } catch {
      setErro("O resultado não foi confirmado. Tente novamente com os mesmos dados.");
    } finally {
      setOcupado(false);
    }
  }

  function alterarDestino(id: string) {
    setTurmaDestinoId(id);
    setBase(null); setRevisao(null); setSelecoes({}); setErro(""); setMensagem("");
    tentativa.current = null;
  }

  function alterarSelecao(chave: string, referenciaFonteId: string) {
    setSelecoes((atuais) => ({ ...atuais, [chave]: referenciaFonteId }));
    setRevisao(null); setErro(""); setMensagem(""); setRegistrada(false);
    tentativa.current = null;
  }

  return <form className="space-y-5" onSubmit={enviar}>
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-medium">1. Escolher destino e conferir requisitos</h2>
      <p>Esta preparação usa somente registros já oficializados na turma de origem. Ela não cria notas, não reserva vaga e não transfere a matrícula.</p>
      <label className="block">Turma de destino
        <select required value={turmaDestinoId} disabled={ocupado || registrada} onChange={(e) => alterarDestino(e.target.value)} className="mt-1 block w-full rounded border p-2">
          <option value="">Selecione uma turma equivalente</option>
          {destinos.map((destino) => <option key={destino.id} value={destino.id}>{destino.label}{destino.diasHorario ? ` · ${destino.diasHorario}` : ""} · {destino.vagas} vaga(s)</option>)}
        </select>
      </label>
      <button type="button" disabled={ocupado || registrada || !turmaDestinoId} onClick={() => void revisar()} className="rounded border px-3 py-2">
        {ocupado ? "Conferindo…" : base ? "Atualizar requisitos" : "Carregar requisitos e fontes"}
      </button>
    </section>

    {base && <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-medium">2. Indicar a fonte de cada requisito</h2>
      <p>Selecione somente uma fonte da mesma habilidade ou mantenha o requisito pendente. A pendência fica explícita para a decisão pedagógica.</p>
      {requisitos.map((requisito) => {
        const chave = chaveRequisito(requisito.codigoAvaliacao, requisito.habilidade);
        const fontes = fontesPorHabilidade.get(requisito.habilidade) ?? [];
        return <fieldset key={chave} className="space-y-2 rounded border p-3" disabled={ocupado || registrada}>
          <legend className="font-medium">Avaliação de destino {requisito.codigoAvaliacao} · {nomesHabilidade[requisito.habilidade]} · peso {nota(requisito.pesoAvaliacao)}</legend>
          <label className="block">Fonte oficial da mesma habilidade
            <select value={selecoes[chave] ?? ""} onChange={(e) => alterarSelecao(chave, e.target.value)} className="mt-1 block w-full rounded border p-2">
              <option value="">Manter pendente</option>
              {fontes.map((fonte) => <option key={fonte.referenciaId} value={fonte.referenciaId}>{fonte.rotulo}</option>)}
            </select>
          </label>
          {!fontes.length && <p role="status">Nenhum registro oficial desta habilidade está disponível para indicar.</p>}
        </fieldset>;
      })}
      <button type="button" disabled={ocupado || registrada} onClick={() => void revisar()} className="rounded border px-3 py-2">
        {ocupado ? "Conferindo…" : "Revisar mapeamento selecionado"}
      </button>
      {!revisao && <p role="status">Depois de alterar uma seleção, revise o mapeamento antes de encaminhar a proposta.</p>}
    </section>}

    {revisao && <section className="space-y-3 rounded border p-4" aria-live="polite">
      <h2 className="text-xl font-medium">3. Prévia conferida</h2>
      <p>{revisao.projecao.itens.filter((item) => item.situacao === "APROVEITADO").length} requisito(s) com fonte indicada e {revisao.projecao.pendencias.length} pendência(s) explícita(s).</p>
      <ul className="list-disc space-y-1 pl-5">{revisao.projecao.itens.map((item) => {
        const fonte = item.fonte ? base?.fontes.find((atual) => atual.referenciaId === item.fonte!.referenciaId) : null;
        return <li key={chaveRequisito(item.codigoAvaliacao, item.habilidade)}>Avaliação de destino {item.codigoAvaliacao} · {nomesHabilidade[item.habilidade]} · peso {nota(item.pesoAvaliacao)}: {fonte ? rotuloFonte(fonte) : "pendente"}.</li>;
      })}</ul>
      {revisao.projecao.pendencias.length > 0 && <p role="status">Os requisitos pendentes não receberão aproveitamento nesta proposta; eles permanecem para acompanhamento na turma de destino.</p>}
      {revisao.projecao.fontesReutilizadas.length > 0 && <p role="status">Uma mesma fonte foi indicada para mais de um requisito. A decisão independente avaliará esse impacto.</p>}
      <p>Esta prévia representa o estado atual das regras, da matrícula e das fontes. Se qualquer condição mudar, a proposta exigirá nova revisão.</p>
    </section>}

    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-medium">4. Encaminhar para decisão independente</h2>
      <label className="block">Motivo da proposta
        <textarea name="motivo" required minLength={5} maxLength={4000} disabled={ocupado || registrada} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="block"><input type="checkbox" required disabled={ocupado || registrada} /> Conferi a prévia e compreendo que a decisão e a execução são etapas separadas.</label>
      <button disabled={ocupado || registrada || !revisao} className="rounded bg-brand-solid px-4 py-2 text-white">{ocupado ? "Registrando…" : "Registrar proposta para decisão"}</button>
    </section>
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
