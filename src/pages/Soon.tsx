export function Soon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-3xl font-light tracking-tight">{title}</h1>
      <div className="card mt-6 p-6 text-muted">This page is coming in the next step. 🍗</div>
    </div>
  );
}