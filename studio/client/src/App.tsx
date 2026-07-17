import { Link, NavLink, Outlet } from "react-router-dom";
import { useApi } from "./hooks/useApi.ts";
import { api } from "./api.ts";

export function App() {
  const doctor = useApi(() => api.doctor(), []);
  const errors = doctor.data?.summary.errors ?? 0;
  const warnings = doctor.data?.summary.warnings ?? 0;

  return (
    <div className="flex h-full flex-col">
      <header className="relative border-b border-sumi-100/70 bg-washi-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/characters" className="group flex shrink-0 items-baseline gap-2 sm:gap-3">
            <span className="font-display text-lg leading-none text-sumi-900">
              Shitate
            </span>
            <span
              aria-hidden
              className="inline-block h-1 w-1 shrink-0 rounded-full bg-shu-500"
            />
            <span className="font-display text-lg leading-none text-sumi-900">
              Studio
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-[13px] font-medium sm:gap-5 sm:text-sm">
            <NavLink
              to="/characters"
              className={({ isActive }) =>
                `ink-underline whitespace-nowrap font-serif ${isActive ? "is-active text-sumi-900" : "text-sumi-300 hover:text-sumi-900"}`
              }
            >
              キャラクター
            </NavLink>
            <NavLink
              to="/doctor"
              className={({ isActive }) =>
                `ink-underline flex items-center gap-1.5 whitespace-nowrap font-serif ${isActive ? "is-active text-sumi-900" : "text-sumi-300 hover:text-sumi-900"}`
              }
            >
              診断
              {errors > 0 ? (
                <span className="hanko-shu py-0" title={`${errors} errors`}>
                  {errors}
                </span>
              ) : warnings > 0 ? (
                <span className="hanko-experimental py-0" title={`${warnings} warnings`}>
                  {warnings}
                </span>
              ) : null}
            </NavLink>
          </nav>
        </div>
        <div className="sumi-divider absolute bottom-0 left-0" />
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
