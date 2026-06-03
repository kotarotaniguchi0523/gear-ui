import { AlertCircle } from "lucide-react";

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span className="whitespace-pre-wrap break-words">{message}</span>
    </div>
  );
}
