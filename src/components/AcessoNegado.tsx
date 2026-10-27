export function AcessoNegado({ recurso }: { recurso?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-medium">Acesso negado</h1>
      <p className="mt-2 text-sm text-gray-500">
        Você não tem permissão para acessar {recurso ?? "esta área"}. Fale com um administrador
        se precisar de acesso.
      </p>
    </div>
  );
}
