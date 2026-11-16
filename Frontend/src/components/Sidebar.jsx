import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Settings, PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { useRoleAccess } from "../hooks/useRoleAccess.js";
import { ROLES } from "../config/routes.config.js";

// ── Per-module color palette (full class names for Tailwind JIT) ──────────────

const PALETTE = [
  {
    iconBg: "bg-blue-100",    iconText: "text-blue-600",
    activeIconBg: "bg-blue-600",    activeIconText: "text-white",
    activeBg: "bg-blue-50",         activeText: "text-blue-700",
    dot: "bg-blue-500",             border: "border-l-blue-500",
    itemActiveBg: "bg-blue-50",     itemActiveText: "text-blue-700",
    itemActiveDot: "bg-blue-500",   subheader: "text-blue-400",
  },
  {
    iconBg: "bg-violet-100",  iconText: "text-violet-600",
    activeIconBg: "bg-violet-600",  activeIconText: "text-white",
    activeBg: "bg-violet-50",       activeText: "text-violet-700",
    dot: "bg-violet-500",           border: "border-l-violet-500",
    itemActiveBg: "bg-violet-50",   itemActiveText: "text-violet-700",
    itemActiveDot: "bg-violet-500", subheader: "text-violet-400",
  },
  {
    iconBg: "bg-emerald-100", iconText: "text-emerald-600",
    activeIconBg: "bg-emerald-600", activeIconText: "text-white",
    activeBg: "bg-emerald-50",      activeText: "text-emerald-700",
    dot: "bg-emerald-500",          border: "border-l-emerald-500",
    itemActiveBg: "bg-emerald-50",  itemActiveText: "text-emerald-700",
    itemActiveDot: "bg-emerald-500",subheader: "text-emerald-400",
  },
  {
    iconBg: "bg-orange-100",  iconText: "text-orange-600",
    activeIconBg: "bg-orange-600",  activeIconText: "text-white",
    activeBg: "bg-orange-50",       activeText: "text-orange-700",
    dot: "bg-orange-500",           border: "border-l-orange-500",
    itemActiveBg: "bg-orange-50",   itemActiveText: "text-orange-700",
    itemActiveDot: "bg-orange-500", subheader: "text-orange-400",
  },
  {
    iconBg: "bg-rose-100",    iconText: "text-rose-600",
    activeIconBg: "bg-rose-600",    activeIconText: "text-white",
    activeBg: "bg-rose-50",         activeText: "text-rose-700",
    dot: "bg-rose-500",             border: "border-l-rose-500",
    itemActiveBg: "bg-rose-50",     itemActiveText: "text-rose-700",
    itemActiveDot: "bg-rose-500",   subheader: "text-rose-400",
  },
  {
    iconBg: "bg-cyan-100",    iconText: "text-cyan-600",
    activeIconBg: "bg-cyan-600",    activeIconText: "text-white",
    activeBg: "bg-cyan-50",         activeText: "text-cyan-700",
    dot: "bg-cyan-500",             border: "border-l-cyan-500",
    itemActiveBg: "bg-cyan-50",     itemActiveText: "text-cyan-700",
    itemActiveDot: "bg-cyan-500",   subheader: "text-cyan-400",
  },
  {
    iconBg: "bg-amber-100",   iconText: "text-amber-600",
    activeIconBg: "bg-amber-600",   activeIconText: "text-white",
    activeBg: "bg-amber-50",        activeText: "text-amber-700",
    dot: "bg-amber-500",            border: "border-l-amber-500",
    itemActiveBg: "bg-amber-50",    itemActiveText: "text-amber-700",
    itemActiveDot: "bg-amber-500",  subheader: "text-amber-400",
  },
  {
    iconBg: "bg-indigo-100",  iconText: "text-indigo-600",
    activeIconBg: "bg-indigo-600",  activeIconText: "text-white",
    activeBg: "bg-indigo-50",       activeText: "text-indigo-700",
    dot: "bg-indigo-500",           border: "border-l-indigo-500",
    itemActiveBg: "bg-indigo-50",   itemActiveText: "text-indigo-700",
    itemActiveDot: "bg-indigo-500", subheader: "text-indigo-400",
  },
  {
    iconBg: "bg-teal-100",    iconText: "text-teal-600",
    activeIconBg: "bg-teal-600",    activeIconText: "text-white",
    activeBg: "bg-teal-50",         activeText: "text-teal-700",
    dot: "bg-teal-500",             border: "border-l-teal-500",
    itemActiveBg: "bg-teal-50",     itemActiveText: "text-teal-700",
    itemActiveDot: "bg-teal-500",   subheader: "text-teal-400",
  },
  {
    iconBg: "bg-pink-100",    iconText: "text-pink-600",
    activeIconBg: "bg-pink-600",    activeIconText: "text-white",
    activeBg: "bg-pink-50",         activeText: "text-pink-700",
    dot: "bg-pink-500",             border: "border-l-pink-500",
    itemActiveBg: "bg-pink-50",     itemActiveText: "text-pink-700",
    itemActiveDot: "bg-pink-500",   subheader: "text-pink-400",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const groupItems = (section) => {
  const { items = [], subgroupConfig = [] } = section;
  if (!subgroupConfig.length) return { ungrouped: items, subgroups: [] };
  const ungrouped = items.filter((i) => !i.group);
  const subgroups = subgroupConfig
    .map((sg) => ({ ...sg, items: items.filter((i) => i.group === sg.key) }))
    .filter((sg) => sg.items.length > 0);
  return { ungrouped, subgroups };
};

// ── NavItem ───────────────────────────────────────────────────────────────────

const NavItem = ({ item, active, color }) => (
  <Link
    to={item.path}
    onClick={() => window.scrollTo(0, 0)}
    className={`flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[12.5px] font-medium transition-all duration-150 group ${
      active
        ? `${color.itemActiveBg} ${color.itemActiveText} font-semibold`
        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
    }`}
  >
    <span
      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${
        active ? `${color.itemActiveDot} scale-125` : "bg-slate-300 group-hover:bg-slate-400"
      }`}
    />
    <span className="truncate leading-tight">{item.label}</span>
  </Link>
);

// ── SubgroupHeader ────────────────────────────────────────────────────────────

const SubgroupHeader = ({ label, color }) => (
  <div className="flex items-center gap-2 px-1 pt-3 pb-1">
    <span className={`text-[9px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${color.subheader}`}>
      {label}
    </span>
    <span className="flex-1 h-px bg-slate-100" />
  </div>
);

// ── Main Sidebar ──────────────────────────────────────────────────────────────

const Sidebar = ({ isSidebarExpanded, toggleSidebar }) => {
  const { accessibleMenu, userRole } = useRoleAccess();
  const [expandedModules, setExpandedModules] = useState({});
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef(null);

  const isSuperAdmin = userRole === ROLES.SUPER_ADMIN;
  const SETTINGS_ITEMS = [
    { path: "/settings", label: "Permission Manager" },
    { path: "/settings/user-management", label: "User Management" },
  ];
  const isSettingsGroupActive = SETTINGS_ITEMS.some((i) => location.pathname === i.path);
  const isExpanded = isSidebarExpanded || isMobile;

  // Auto-expand the module containing the active route
  useEffect(() => {
    const activeModule = accessibleMenu.find((m) =>
      m.items.some((i) => location.pathname === i.path)
    );
    if (activeModule) {
      setExpandedModules((prev) => ({ ...prev, [activeModule.key]: true }));
    }
  }, [location.pathname, accessibleMenu]);

  // Auto-expand the Settings group when its own page is active
  useEffect(() => {
    if (isSettingsGroupActive) setSettingsExpanded(true);
  }, [isSettingsGroupActive]);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on navigate (mobile)
  useEffect(() => {
    if (isMobile && isSidebarExpanded) toggleSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Click outside to close (mobile)
  useEffect(() => {
    const handler = (e) => {
      if (isMobile && isSidebarExpanded && sidebarRef.current && !sidebarRef.current.contains(e.target))
        toggleSidebar();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile, isSidebarExpanded, toggleSidebar]);

  const toggleModule = (key) => {
    if (!isExpanded) { toggleSidebar(); return; }
    setExpandedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (path) => location.pathname === path;
  const isModuleActive = (items) => items.some((i) => location.pathname === i.path);

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isSidebarExpanded && (
        <div
          className="fixed inset-0 top-16 bg-slate-900/40 z-30 backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile open button */}
      {isMobile && !isSidebarExpanded && (
        <button
          className="fixed top-[72px] left-3 z-30 w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-xl shadow-md hover:text-slate-900 transition-colors md:hidden border border-slate-200"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed top-16 left-0 h-[calc(100vh-64px)] z-40 flex flex-col
          bg-white border-r border-slate-100 shadow-sm
          transition-all duration-300 ease-in-out select-none
          ${isMobile
            ? isSidebarExpanded ? "w-72 translate-x-0 shadow-xl" : "w-72 -translate-x-full"
            : isSidebarExpanded ? "w-64" : "w-[56px]"
          }
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div
          className={`flex items-center h-12 px-2.5 border-b border-slate-100 flex-shrink-0 ${
            isExpanded ? "justify-between" : "justify-center"
          }`}
        >
          {isExpanded && (
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 px-1">
              Navigation
            </span>
          )}
          <button
            onClick={toggleSidebar}
            title={isExpanded ? "Collapse" : "Expand"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            {isExpanded
              ? <PanelLeftClose className="w-4 h-4" />
              : <PanelLeftOpen className="w-4 h-4" />
            }
          </button>
        </div>

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
          {accessibleMenu.map((menu, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const MenuIcon = menu.icon;
            const moduleExpanded = !!expandedModules[menu.key];
            const moduleActive = isModuleActive(menu.items);
            const { ungrouped, subgroups } = groupItems(menu);

            return (
              <div key={menu.key}>
                {/* Module button */}
                <button
                  onClick={() => toggleModule(menu.key)}
                  title={!isExpanded ? menu.label : undefined}
                  className={`
                    relative w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-medium
                    transition-all duration-200 cursor-pointer group border-l-2
                    ${moduleActive
                      ? `${color.activeBg} ${color.activeText} ${color.border} font-semibold`
                      : "border-l-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                    }
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                      moduleActive
                        ? `${color.activeIconBg} ${color.activeIconText} shadow-sm`
                        : `${color.iconBg} ${color.iconText}`
                    }`}
                  >
                    <MenuIcon className="w-[15px] h-[15px]" />
                  </div>

                  {/* Label + arrow */}
                  {isExpanded && (
                    <>
                      <span className="flex-1 text-left truncate text-[13px]">
                        {menu.label}
                      </span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-shrink-0 text-slate-300 transition-transform duration-200 ${
                          moduleExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </>
                  )}

                  {/* Active dot in collapsed mode */}
                  {!isExpanded && moduleActive && (
                    <span className={`absolute right-1 top-1 w-1.5 h-1.5 rounded-full ${color.dot}`} />
                  )}
                </button>

                {/* Sub-items panel */}
                {isExpanded && moduleExpanded && (
                  <div className="mt-0.5 ml-[14px] pl-3 border-l-2 border-slate-100 pb-1.5">
                    {ungrouped.map((item) => (
                      <NavItem key={item.path} item={item} active={isActive(item.path)} color={color} />
                    ))}
                    {subgroups.map((sg) => (
                      <div key={sg.key}>
                        <SubgroupHeader label={sg.label} color={color} />
                        {sg.items.map((item) => (
                          <NavItem key={item.path} item={item} active={isActive(item.path)} color={color} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-slate-100 p-2 space-y-0.5">
          {isSuperAdmin && (
            <div>
              <button
                onClick={() => {
                  if (!isExpanded) { toggleSidebar(); return; }
                  setSettingsExpanded((v) => !v);
                }}
                title={!isExpanded ? "Settings" : undefined}
                className={`
                  relative w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-[13px] font-medium
                  transition-all duration-200 cursor-pointer group border-l-2
                  ${isSettingsGroupActive
                    ? "bg-indigo-50 text-indigo-700 border-l-indigo-500 font-semibold"
                    : "border-l-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }
                `}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isSettingsGroupActive ? "bg-indigo-600 text-white shadow-sm" : "bg-indigo-100 text-indigo-600"
                  }`}
                >
                  <Settings
                    className={`w-[15px] h-[15px] transition-transform duration-500 ${
                      settingsExpanded ? "rotate-45" : "group-hover:rotate-45"
                    }`}
                  />
                </div>
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left truncate">Settings</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 flex-shrink-0 text-slate-300 transition-transform duration-200 ${
                        settingsExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </>
                )}
                {!isExpanded && isSettingsGroupActive && (
                  <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </button>

              {isExpanded && settingsExpanded && (
                <div className="mt-0.5 ml-[14px] pl-3 border-l-2 border-slate-100 pb-1.5">
                  {SETTINGS_ITEMS.map((item) => (
                    <NavItem key={item.path} item={item} active={isActive(item.path)} color={PALETTE[6]} />
                  ))}
                </div>
              )}
            </div>
          )}

          {isExpanded && (
            <p className="px-3 py-2 text-[10px] text-slate-300 text-center">
              © 2025 Western Refrigeration
            </p>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
