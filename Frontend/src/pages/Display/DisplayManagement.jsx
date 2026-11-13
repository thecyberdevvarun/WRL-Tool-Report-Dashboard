import { useSearchParams } from "react-router-dom";
import { Factory, Flame } from "lucide-react";
import ProductionManagement from "./ProductionDashboard/ProductionManagement";
import BrazingManagement from "./BrazingDashboard/BrazingManagement";

/* One tab per dashboard type. To add a new type later, add one entry here.
   The tab is kept in the URL (?type=brazing) so Exit from a dashboard returns to the same tab. */
const TABS = [
  {
    key: "production",
    label: "Production",
    Icon: Factory,
    Component: ProductionManagement,
  },
  {
    key: "brazing",
    label: "Brazing",
    Icon: Flame,
    Component: BrazingManagement,
  },
];

const Management = () => {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.key === params.get("type")) ?? TABS[0];
  const Active = active.Component;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div
        role="tablist"
        className="shrink-0 flex gap-1 px-5 bg-white border-b border-slate-200"
      >
        {TABS.map(({ key, label, Icon }) => {
          const on = key === active.key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              onClick={() => setParams({ type: key }, { replace: true })}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
                on
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Active />
      </div>
    </div>
  );
};

export default Management;
