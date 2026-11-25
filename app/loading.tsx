export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading MAVEX store" style={{ padding: "40px 6%" }}>
      <div className="mavex-skeleton mavex-skeleton-title" />
      <div className="mavex-skeleton-grid">
        {[0, 1, 2, 3].map((item) => <div className="mavex-skeleton mavex-skeleton-product" key={item} />)}
      </div>
    </main>
  );
}
