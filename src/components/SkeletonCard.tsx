export function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl p-3 animate-pulse">
      <div className="aspect-square rounded-lg bg-secondary mb-3" />
      <div className="h-3 bg-secondary rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-secondary rounded w-1/2" />
    </div>
  );
}
