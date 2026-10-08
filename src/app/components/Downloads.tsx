import { saveFile } from "../download.ts";
import type { OutputFile } from "../../worker/protocol.ts";

export interface DownloadItem {
  label: string;
  file: OutputFile;
  note?: string;
  primary?: boolean;
}

export function Downloads({ items }: { items: DownloadItem[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((it) => (
        <div key={it.file.name} className="max-w-xs space-y-1">
          <button
            type="button"
            onClick={() => {
              saveFile(it.file);
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
              it.primary
                ? "bg-indigo-700 text-white hover:bg-indigo-600"
                : "border border-slate-400 bg-white hover:bg-slate-100"
            }`}
          >
            ⬇ {it.label}
          </button>
          <p className="font-mono text-xs break-all text-slate-600">{it.file.name}</p>
          {it.note && <p className="text-sm font-medium text-red-800">⚠ {it.note}</p>}
        </div>
      ))}
    </div>
  );
}
