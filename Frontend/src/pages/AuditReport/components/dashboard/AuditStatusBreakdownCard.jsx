// ──────────────────────────────────────────────────────────────────────────
// Audit Status Breakdown card — approved/pending/rejected/draft bars, plus a
// quick-action button to jump straight to the approval queue when there's
// something waiting.
// ──────────────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import { MdPendingActions } from "react-icons/md";
import { FaHourglassHalf, FaArrowRight } from "react-icons/fa";
import { ProgressBar, CardSkeleton } from "../../components/common";

export default function AuditStatusBreakdownCard({ loading, stats }) {
  const navigate = useNavigate();
  if (loading) return <CardSkeleton rows={5} />;

  const { totalAudits, approvedCount, submittedCount, rejectedCount, draftCount, reworkCount } = stats;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 bg-amber-50 rounded-lg">
          <MdPendingActions className="text-amber-500 text-sm" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Audit Status Breakdown</h3>
          <p className="text-[11px] text-slate-400">Distribution across all {totalAudits} audits</p>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <ProgressBar value={approvedCount} max={totalAudits} color="bg-emerald-400" label="Approved" count={approvedCount} />
        <ProgressBar value={submittedCount} max={totalAudits} color="bg-amber-400" label="Pending" count={submittedCount} />
        <ProgressBar value={rejectedCount} max={totalAudits} color="bg-red-400" label="Rejected" count={rejectedCount} />
        <ProgressBar value={reworkCount} max={totalAudits} color="bg-orange-400" label="Rework" count={reworkCount} />
        <ProgressBar value={draftCount} max={totalAudits} color="bg-slate-300" label="Draft" count={draftCount} />
      </div>

      {submittedCount > 0 && (
        <button
          onClick={() => navigate("/auditreport/audit-approval")}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-300"
        >
          <FaHourglassHalf size={11} aria-hidden="true" />
          {submittedCount} audit{submittedCount !== 1 ? "s" : ""} waiting for approval
          <FaArrowRight size={10} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
