// ──────────────────────────────────────────────────────────────────────────
// useDashboardData — owns all data-fetching + derived-metric logic for the
// Audit Dashboard. Extracted verbatim (same calls, same aggregation math,
// same error handling) from the old Auditdashboard.jsx so the page component
// itself can stay focused on layout/composition.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import useAuditData from "../../../hooks/useAuditData";
import { pct } from "../utils/formatters";

const EMPTY_CP_AGG = { pass: 0, fail: 0, warning: 0, na: 0, pending: 0, total: 0 };

export default function useDashboardData() {
  const { loadAudits, fetchAuditModelSummary, fetchAuditStats } = useAuditData();

  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [stats, setStats] = useState(null);
  const [modelSummary, setModelSummary] = useState([]);
  const [recentAudits, setRecentAudits] = useState([]);
  const [cpAgg, setCpAgg] = useState(EMPTY_CP_AGG);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, modelRes, recentRes] = await Promise.all([
        fetchAuditStats(),
        fetchAuditModelSummary({}),
        loadAudits({ limit: 10, page: 1, lite: true }),
      ]);

      const summary = statsRes?.data?.summary || null;
      setStats(summary);
      setModelSummary(modelRes?.data || []);
      setRecentAudits(recentRes?.data || []);

      // Checkpoint totals are summed server-side across every audit.
      setCpAgg({
        pass: summary?.CpPass || 0,
        fail: summary?.CpFail || 0,
        warning: summary?.CpWarning || 0,
        na: summary?.CpNa || 0,
        pending: summary?.CpPending || 0,
        total: summary?.CpTotal || 0,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      toast.error("Failed to load dashboard: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAuditStats, fetchAuditModelSummary, loadAudits]);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived metrics ───────────────────────────────────────────────────
  const totalAudits = stats?.TotalAudits || 0;
  const approvedCount = stats?.ApprovedCount || 0;
  const submittedCount = stats?.SubmittedCount || 0;
  const rejectedCount = stats?.RejectedCount || 0;
  const draftCount = stats?.DraftCount || 0;
  const reworkCount = stats?.ReworkCount || 0;
  const approvalRate = pct(approvedCount, totalAudits);
  const cpPassRate = pct(cpAgg.pass, cpAgg.total);

  const modelTotals = modelSummary.reduce(
    (acc, r) => ({
      production: acc.production + r.production,
      auditRequired: acc.auditRequired + r.auditRequired,
      auditDone: acc.auditDone + r.auditDone,
      pending: acc.pending + r.pending,
    }),
    { production: 0, auditRequired: 0, auditDone: 0, pending: 0 },
  );

  const topPendingModels = [...modelSummary]
    .filter((m) => m.pending > 0)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 5);

  return {
    loading,
    lastRefreshed,
    refresh: loadDashboard,
    stats: { totalAudits, approvedCount, submittedCount, rejectedCount, draftCount, reworkCount, approvalRate },
    cpAgg,
    cpPassRate,
    modelSummary,
    modelTotals,
    topPendingModels,
    recentAudits,
  };
}
