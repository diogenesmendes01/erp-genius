"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Resultado } from "@/server/_shared";
import { arquivarCampoDaTela, arquivarTagDaTela, salvarCampoDaTela, salvarTagDaTela } from "@/server/crm-config/acoes-tags-campos";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { EstadoVazio } from "@/components/EstadoVazio";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";

type Cor = "NEUTRA" | "MARCA" | "INFO" | "SUCESSO" | "ALERTA" | "PERIGO" | "IA";
type Tipo = "TEXTO" | "NUMERO" | "DATA" | "SELECAO" | "BOOLEANO";
type Alvo = "PESSOA" | "EMPRESA";
export interface TagLinha { id: string; nome: string; grupo: string | null; cor: Cor }
export interface CampoLinha { id: string; nome: string; tipo: Tipo; alvo: Alvo; opcoes: string[]; obrigatorio: boolean }

const CORES: { v: Cor; t: string }[] = [
  { v: "NEUTRA", t: "Neutra" }, { v: "MARCA", t: "Marca" }, { v: "INFO", t: "Azul" }, { v: "SUCESSO", t: "Verde" },
  { v: "ALERTA", t: "Amarela" }, { v: "PERIGO", t: "Vermelha" }, { v: "IA", t: "IA" },
];
const TIPOS: { v: Tipo; t: string }[] = [
  { v: "TEXTO", t: "Texto" }, { v: "NUMERO", t: "Número" }, { v: "DATA", t: "Data" }, { v: "SELECAO", t: "Lista" }, { v: "BOOLEANO", t: "Sim/Não" },
];
const ALVOS: { v: Alvo; t: string }[] = [{ v: "PESSOA", t: "Pessoa" }, { v: "EMPRESA", t: "Empresa" }];
const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export function TagsCamposPainel({ tags, campos }: { tags: TagLinha[]; campos: CampoLinha[] }) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [tagId, setTagId] = useState<string | undefined>();
  const [tNome, setTNome] = useState("");
  const [tGrupo, setTGrupo] = useState("");
  const [tCor, setTCor] = useState<Cor>("NEUTRA");
  const [campoId, setCampoId] = useState<string | undefined>();
  const [cNome, setCNome] = useState("");
  const [cTipo, setCTipo] = useState<Tipo>("TEXTO");
  const [cAlvo, setCAlvo] = useState<Alvo>("PESSOA");
  const [cOpcoes, setCOpcoes] = useState("");
  const [cObrig, setCObrig] = useState(false);
  const [arquivandoTag, setArquivandoTag] = useState<TagLinha | null>(null);
  const [arquivandoCampo, setArquivandoCampo] = useState<CampoLinha | null>(null);

  const limparTag = () => { setTagId(undefined); setTNome(""); setTGrupo(""); setTCor("NEUTRA"); };
  const limparCampo = () => { setCampoId(undefined); setCNome(""); setCTipo("TEXTO"); setCAlvo("PESSOA"); setCOpcoes(""); setCObrig(false); };
  const rodar = async (fn: () => Promise<Resultado<unknown>>, depois: () => void) => {
    const d = await acao.executar(fn);
    if (d?.tipo === "ok") { depois(); router.refresh(); }
  };

  return <div className="mt-4 grid gap-6">
    <section aria-label="Tags" className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-base font-medium">Tags</h3>
      {tags.length === 0 && <EstadoVazio>Nenhuma tag cadastrada.</EstadoVazio>}
      <ul className="mt-2 divide-y divide-gray-100 text-sm">
        {tags.map((t) => <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
          <span>{t.nome} <span className="text-xs text-gray-500">{t.grupo ?? "sem grupo"} · {CORES.find((c) => c.v === t.cor)?.t}</span></span>
          <span className="flex gap-3">
            <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => { setTagId(t.id); setTNome(t.nome); setTGrupo(t.grupo ?? ""); setTCor(t.cor); }}>Editar</button>
            <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} disabled={acao.ocupado} onClick={() => setArquivandoTag(t)}>Arquivar</button>
          </span>
        </li>)}
      </ul>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">Nome<input className={input} value={tNome} onChange={(e) => setTNome(e.target.value)} /></label>
        <label className="text-xs text-gray-600">Grupo<input className={input} value={tGrupo} onChange={(e) => setTGrupo(e.target.value)} /></label>
        <label className="text-xs text-gray-600">Cor
          <select className={input} value={tCor} onChange={(e) => setTCor(e.target.value as Cor)}>{CORES.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}</select>
        </label>
      </div>
      <button className={`${botaoClasses({ tamanho: "md" })} mt-3`} disabled={acao.ocupado} onClick={() => rodar(() => salvarTagDaTela({ id: tagId, nome: tNome, grupo: tGrupo, cor: tCor }), limparTag)}>{acao.ocupado ? "Salvando…" : tagId ? "Salvar tag" : "Criar tag"}</button>
    </section>

    <section aria-label="Campos personalizados" className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-base font-medium">Campos personalizados</h3>
      {campos.length === 0 && <EstadoVazio>Nenhum campo cadastrado.</EstadoVazio>}
      <ul className="mt-2 divide-y divide-gray-100 text-sm">
        {campos.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
          <span>{c.nome} <span className="text-xs text-gray-500">{TIPOS.find((t) => t.v === c.tipo)?.t} · {ALVOS.find((a) => a.v === c.alvo)?.t}{c.obrigatorio ? " · obrigatório" : ""}</span></span>
          <span className="flex gap-3">
            <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => { setCampoId(c.id); setCNome(c.nome); setCTipo(c.tipo); setCAlvo(c.alvo); setCOpcoes(c.opcoes.join("\n")); setCObrig(c.obrigatorio); }}>Editar</button>
            <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} disabled={acao.ocupado} onClick={() => setArquivandoCampo(c)}>Arquivar</button>
          </span>
        </li>)}
      </ul>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">Nome<input className={input} value={cNome} onChange={(e) => setCNome(e.target.value)} /></label>
        <label className="text-xs text-gray-600">Tipo
          <select className={input} value={cTipo} onChange={(e) => setCTipo(e.target.value as Tipo)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}</select>
        </label>
        <label className="text-xs text-gray-600">Vale para
          <select className={input} value={cAlvo} onChange={(e) => setCAlvo(e.target.value as Alvo)}>{ALVOS.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}</select>
        </label>
      </div>
      {cTipo === "SELECAO" && <label className="mt-3 block text-xs text-gray-600">Opções (uma por linha)
        <CampoTexto className={input} rows={4} value={cOpcoes} onChange={(e) => setCOpcoes(e.target.value)} />
      </label>}
      <label className="mt-3 flex items-center gap-1 text-sm"><input type="checkbox" checked={cObrig} onChange={(e) => setCObrig(e.target.checked)} />Obrigatório</label>
      <button className={`${botaoClasses({ tamanho: "md" })} mt-3`} disabled={acao.ocupado} onClick={() => rodar(() => salvarCampoDaTela({ id: campoId, nome: cNome, tipo: cTipo, alvo: cAlvo, opcoes: cTipo === "SELECAO" ? cOpcoes.split("\n").map((s) => s.trim()).filter(Boolean) : [], obrigatorio: cObrig }), limparCampo)}>{acao.ocupado ? "Salvando…" : campoId ? "Salvar campo" : "Criar campo"}</button>
    </section>
    <FeedbackAcao erro={acao.erro} />
    {arquivandoTag && <ConfirmarAcao
      titulo={`Arquivar a tag ${arquivandoTag.nome}?`}
      confirmacao="arquivamento da tag"
      idempotente={false}
      acao={() => arquivarTagDaTela(arquivandoTag.id)}
      aoConcluir={() => { setArquivandoTag(null); if (tagId === arquivandoTag.id) limparTag(); router.refresh(); }}
      aoCancelar={() => setArquivandoTag(null)}
    >
      <p>A tag some das listas de seleção, mas continua nos contatos e empresas que já a têm.</p>
    </ConfirmarAcao>}
    {arquivandoCampo && <ConfirmarAcao
      titulo={`Arquivar o campo ${arquivandoCampo.nome}?`}
      confirmacao="arquivamento do campo"
      idempotente={false}
      digitacao={{ rotulo: `Digite ${arquivandoCampo.nome} para confirmar`, esperado: arquivandoCampo.nome }}
      acao={() => arquivarCampoDaTela(arquivandoCampo.id, arquivandoCampo.nome)}
      aoConcluir={() => { setArquivandoCampo(null); if (campoId === arquivandoCampo.id) limparCampo(); router.refresh(); }}
      aoCancelar={() => setArquivandoCampo(null)}
    >
      <p>O campo some dos formulários, mas os valores já preenchidos são mantidos.</p>
    </ConfirmarAcao>}
  </div>;
}
