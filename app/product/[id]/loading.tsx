export default function ProductLoading() {
  return (
    <main aria-busy="true" aria-label="Loading product" style={{ padding: "28px 4%" }}>
      <div className="mavex-product-skeleton">
        <div className="mavex-skeleton mavex-skeleton-gallery" />
        <div>
          <div className="mavex-skeleton mavex-skeleton-line mavex-skeleton-short" />
          <div className="mavex-skeleton mavex-skeleton-line mavex-skeleton-name" />
          <div className="mavex-skeleton mavex-skeleton-line mavex-skeleton-short" />
          <div className="mavex-skeleton mavex-skeleton-line" />
          <div className="mavex-skeleton mavex-skeleton-line" />
          <div className="mavex-skeleton mavex-skeleton-action" />
        </div>
      </div>
    </main>
  );
}
