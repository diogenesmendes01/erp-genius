"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPagadorPreparacao } from "@/server/secretaria/pagador-preparacao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
type Dados = { nome: string; paisId: string; documento?: string | null; email?: string | null; telefoneE164?: string | null; endereco?: string | null };

/** Tipos de pagador com identificação digitada (o ALUNO copia o cadastro do próprio aluno). */
export const TIPOS_COM_IDENTIFICACAO = ["RESPONSAVEL", "EMPRESA"] as const;
export type TipoComIdentificacao = (typeof TIPOS_COM_IDENTIFICACAO)[number];
/** Campos da identificação, na ordem da tela. */
export const CAMPOS_DO_PAGADOR = ["nome", "paisId", "documento", "email", "telefoneE164", "endereco"] as const;
type Campo = (typeof CAMPOS_DO_PAGADOR)[number];
export type Identificacao = Record<Campo, string>;

const VAZIA: Identificacao = { nome: "", paisId: "", documento: "", email: "", telefoneE164: "", endereco: "" };
const ehTipoComIdentificacao = (t: string): t is TipoComIdentificacao => (TIPOS_COM_IDENTIFICACAO as readonly string[]).includes(t);

/** Rascunho inicial por tipo: o tipo registrado começa com os dados atuais; o outro, vazio. */
export function rascunhosIniciais(atual: { tipo: string; dados: Dados } | null): Record<TipoComIdentificacao, Identificacao> {
  const doAtual = (t: TipoComIdentificacao): Identificacao => atual?.tipo === t ? {
    nome: atual.dados.nome ?? "", paisId: atual.dados.paisId ?? "", documento: atual.dados.documento ?? "",
    email: atual.dados.email ?? "", telefoneE164: atual.dados.telefoneE164 ?? "", endereco: atual.dados.endereco ?? "",
  } : { ...VAZIA };
  return { RESPONSAVEL: doAtual("RESPONSAVEL"), EMPRESA: doAtual("EMPRESA") };
}

export function PagadorFormulario({ matriculaId, versao, paises, atual }: { matriculaId: string; versao: number; paises: { id: string; nome: string }[]; atual: { tipo: string; dados: Dados } | null }) {
  const [tipo, setTipo] = useState(atual?.tipo ?? ""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  // Um rascunho por tipo (docs/43 §6 item 3; docs/42 L562): antes, `dados` só valia quando o tipo era o
  // registrado e o <fieldset key={tipo}> remontava os campos — trocar "Responsável" por "Empresa" (ou clicar por
  // engano) apagava nome, país, documento, e-mail, telefone e endereço. Agora cada tipo guarda o que foi
  // digitado nele, e voltar ao tipo devolve tudo.
  const [rascunhos, setRascunhos] = useState(() => rascunhosIniciais(atual));
  const chave = useRef<string | null>(null), router = useRouter();
  const identificacao = ehTipoComIdentificacao(tipo) ? rascunhos[tipo] : null;
  const ligar = (campo: Campo) => ({
    name: campo,
    value: identificacao ? identificacao[campo] : "",
    onChange: (e: { target: { value: string } }) => {
      if (!ehTipoComIdentificacao(tipo)) return;
      const valor = e.target.value;
      setRascunhos((r) => ({ ...r, [tipo]: { ...r[tipo], [campo]: valor } }));
    },
  });
  return <form className="space-y-3" onSubmit={async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); setOcupado(true); setErro("");
    const texto = (n: string) => String(f.get(n) ?? "").trim();
    try {
      chave.current ??= crypto.randomUUID();
      const pagador = tipo === "ALUNO" ? { tipo: "ALUNO" as const } : { tipo: tipo as "RESPONSAVEL" | "EMPRESA", dados: { nome: texto("nome"), paisId: texto("paisId"), documento: texto("documento") || undefined, email: texto("email") || undefined, telefoneE164: texto("telefoneE164") || undefined, endereco: texto("endereco") || undefined } };
      const r = await registrarPagadorPreparacao({ matriculaId, versaoEsperada: versao, pagador, motivo: texto("motivo"), chaveIdempotencia: chave.current });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_RESULTADO_INCERTO); }
    finally { setOcupado(false); }
  }}>
    <label className="block">Quem pagará<select required value={tipo} onChange={(e) => setTipo(e.target.value)} className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="ALUNO">Próprio aluno</option><option value="RESPONSAVEL">Responsável</option><option value="EMPRESA">Empresa</option></select></label>
    {tipo === "ALUNO" ? <p>Será registrada uma cópia dos dados atuais do próprio aluno. Confira o cadastro antes de continuar.</p> : identificacao && <fieldset className="space-y-2"><legend>Identificação do pagador</legend>
      <p className="text-sm">Trocar o tipo de pagador não apaga o que já foi preenchido: cada tipo guarda os próprios dados.</p>
      <label className="block">Nome ou razão social<input {...ligar("nome")} required maxLength={200} className="ml-2 rounded border p-2" /></label>
      <label className="block">País<select {...ligar("paisId")} required className="ml-2 rounded border p-2"><option value="">Selecione</option>{paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="block">Documento<input {...ligar("documento")} maxLength={100} className="ml-2 rounded border p-2" /></label>
      <label className="block">E-mail<input {...ligar("email")} type="email" maxLength={254} className="ml-2 rounded border p-2" /></label>
      <label className="block">Telefone internacional<input {...ligar("telefoneE164")} placeholder="+50688887777" pattern="\+[1-9][0-9]{7,14}" className="ml-2 rounded border p-2" /></label>
      <label className="block">Endereço<CampoTexto {...ligar("endereco")} maxLength={1000} className="block rounded border p-2" /></label>
    </fieldset>}
    <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block rounded border p-2" /></label>
    <button disabled={ocupado || !tipo} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar pagador desta matrícula"}</button>{erro && <p role="alert">{erro}</p>}
  </form>;
}
