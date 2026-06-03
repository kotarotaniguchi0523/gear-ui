export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-slate-300 mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}
