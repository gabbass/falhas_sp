export default function Loading() {
  return (
    <main className="page route-loading-page" aria-live="polite" aria-busy="true">
      <section className="route-loading-card">
        <span className="route-loading-pill">Atualizando painel</span>
        <strong>Carregando a próxima visão…</strong>
        <p>Os dados permanecem na mesma metodologia; estamos só trocando o recorte da interface.</p>
        <div className="route-loading-bar" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}
