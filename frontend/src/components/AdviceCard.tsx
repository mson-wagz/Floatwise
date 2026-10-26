import type { Advice } from "../api/client";
import { ksh, pct } from "../lib/format";

export default function AdviceCard({ advice }: { advice: Advice }) {
  return (
    <div className="rounded-xl border p-4 space-y-2">
      <p className="text-lg font-medium">{advice.text}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Stockout risk</dt>
        <dd>{pct(advice.stockout_probability)}</dd>
        <dt>Restock amount</dt>
        <dd>{ksh(advice.restock_amount_ksh)}</dd>
      </dl>
      {advice.verified && (
        <span className="text-xs text-green-700">
          Numbers checked against simulation ({advice.evidence.n_runs.toLocaleString()} runs)
        </span>
      )}
    </div>
  );
}