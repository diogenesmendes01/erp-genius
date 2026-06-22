"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkinExperimental } from "@/server/comercial/acoes";

interface Turma {
  id: string;
  label: string;
  diasHorario: string | null;
  alunos: number;
}
interface Experimental {
  id: string;
  nome: string;
  data: string;
}

export function HomeProfessor({
  nome,
  turmas,
  experimentais,
}: {
  nome: string;
  turmas: Turma[];
  experimentais: Experimental[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<string | null>(null);

  async function checkin(id: string, compareceu: boolean) {
    setErro(null);
    setPendente(id + compareceu);
    const r = await checkinExperimental(id, compareceu);
    setPendente(null);
    if (!r.ok) setErro(r.erro);
    else router.refresh();
  }

  const proxima = [...experimentais].sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Olá, {nome.split(" ")[0]}</h1>
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {proxima && (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="text-xs font-medium text-brand-700">Próxima aula experimental</div>
          <div className="mt-1 text-lg font-medium text-gray-800">
            {new Date(proxima.data).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {proxima.nome}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Experimentais para check-in</h2>
        {experimentais.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma experimental agendada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {experimentais.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{e.nome}</span>
                  <span className="ml-2 text-gray-500">
                    {new Date(e.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkin(e.id, true)}
                    disabled={pendente === e.id + "true"}
                    className="rounded-md bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Compareceu
                  </button>
                  <button
                    onClick={() => checkin(e.id, false)}
                    disabled={pendente === e.id + "false"}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Faltou
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Minhas turmas</h2>
        {turmas.length === 0 ? (
          <p className="text-sm text-gray-400">Você não tem turmas atribuídas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {turmas.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <Link href={`/alunos/turma/${t.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {t.label}
                </Link>
                <span className="text-xs text-gray-500">{t.diasHorario ?? "Horário a definir"} · {t.alunos} alunos</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
