export function Placeholder({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {hint ?? "Em construção — esta tela será montada a partir do design (docs/09-fase0-telas.md)."}
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
        Conteúdo da tela aparece aqui
      </div>
    </div>
  );
}
