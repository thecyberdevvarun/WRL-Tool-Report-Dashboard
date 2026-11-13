import { useNavigate } from "react-router-dom";
import { Flame, Play, Database, Clock3 } from "lucide-react";
import { BRAZING_LINES, brazingPath } from "./brazing.config";

/* Brazing tab: no forms, no Excel. Lines are fixed, data comes from the database. */
const BrazingManagement = () => {
  const navigate = useNavigate();
  const open = (key) => navigate(brazingPath(key));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-5 py-3 shadow-sm shrink-0">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
          Brazing dashboards
        </h1>
        <p className="text-[11px] text-slate-400">
          Pick a line to open its live dashboard
        </p>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="flex items-start gap-3 px-4 py-3 mb-5 bg-orange-50 border border-orange-200 rounded-xl text-[13px] text-orange-800">
          <Database className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Brazing dashboards read straight from the database. Machines,
            operators, joints and efficiency update on their own, so there is
            nothing to enter or upload here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {BRAZING_LINES.map((line) => (
            <button
              key={line.key}
              type="button"
              onClick={() => open(line.key)}
              className="group text-left bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              <div className="h-1.5" style={{ background: line.accent }} />
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${line.accent}14` }}
                  >
                    <Flame className="w-7 h-7" style={{ color: line.accent }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                      {line.label}
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      {line.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Live data
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold">
                    <Clock3 className="w-3 h-3" />
                    Shift switches automatically
                  </span>
                </div>

                <div
                  className="mt-6 flex items-center justify-center gap-2 py-3 rounded-lg text-white font-bold text-sm transition-all group-hover:shadow-md"
                  style={{ background: line.accent }}
                >
                  <Play className="w-3.5 h-3.5" /> Open dashboard
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrazingManagement;
