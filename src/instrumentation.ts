export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validarAppBaseUrlNoBoot } = await import("@/server/portal-aluno/politica");
    validarAppBaseUrlNoBoot();
  }
}
