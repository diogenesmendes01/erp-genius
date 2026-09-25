"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPagadorPreparacao } from "@/server/secretaria/pagador-preparacao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
type Dados = { nome: string; paisId: string; documento?: string | null; email?: string | null; telefoneE164?: string | null; endereco?: string | null };
export function PagadorFormulario({ matriculaId, versao, paises, atual }: { matriculaId: string; versao: number; paises: { id: string; nome: string }[]; atual: { tipo: string; dados: Dados } | null }) {
  const [tipo, setTipo] = useState(atual?.tipo ?? ""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const chave = useRef<string | null>(null), router = useRouter();
  const dados = atual?.tipo === tipo ? atual.dados : null;
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
    {tipo === "ALUNO" ? <p>Será registrada uma cópia dos dados atuais do próprio aluno. Confira o cadastro antes de continuar.</p> : tipo && <fieldset key={tipo} className="space-y-2"><legend>Identificação do pagador</legend>
      <label className="block">Nome ou razão social<input name="nome" required maxLength={200} defaultValue={dados?.nome} className="ml-2 rounded border p-2" /></label>
      <label className="block">País<select name="paisId" required defaultValue={dados?.paisId ?? ""} className="ml-2 rounded border p-2"><option value="">Selecione</option>{paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="block">Documento<input name="documento" maxLength={100} defaultValue={dados?.documento ?? ""} className="ml-2 rounded border p-2" /></label>
      <label className="block">E-mail<input name="email" type="email" maxLength={254} defaultValue={dados?.email ?? ""} className="ml-2 rounded border p-2" /></label>
      <label className="block">Telefone internacional<input name="telefoneE164" placeholder="+50688887777" pattern="\+[1-9][0-9]{7,14}" defaultValue={dados?.telefoneE164 ?? ""} className="ml-2 rounded border p-2" /></label>
      <label className="block">Endereço<CampoTexto name="endereco" maxLength={1000} defaultValue={dados?.endereco ?? ""} className="block rounded border p-2" /></label>
    </fieldset>}
    <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block rounded border p-2" /></label>
    <button disabled={ocupado || !tipo} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar pagador desta matrícula"}</button>{erro && <p role="alert">{erro}</p>}
  </form>;
}
