import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Overlay для мобильного меню */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden ${menuOpen ? 'block' : 'hidden'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 transform border-r border-slate-200 bg-white p-4 shadow-lg transition-transform duration-200 ease-out lg:relative lg:inset-auto lg:z-auto lg:w-56 lg:translate-x-0 lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 font-semibold text-slate-800">Твори Красиво</div>
        <nav className="space-y-4">
          <div>
            <div className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">Расписание</div>
            <div className="space-y-1">
              <NavLink
                to="/workshops"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Мастер-классы
              </NavLink>
              <NavLink
                to="/calendar"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Календарь
              </NavLink>
              <NavLink
                to="/bookings"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Записи
              </NavLink>
            </div>
          </div>
          <div>
            <div className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">Контент сайта</div>
            <div className="space-y-1">
              <NavLink
                to="/reviews"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Отзывы гостей
              </NavLink>
              <NavLink
                to="/gallery"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Галерея работ
              </NavLink>
            </div>
          </div>
        </nav>
        <div className="mt-8 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('adminToken');
              window.location.href = '/login';
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-6">
        {/* Кнопка меню для мобильных */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm lg:hidden"
          aria-label="Открыть меню"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Меню
        </button>
        <Outlet />
      </main>
    </div>
  );
}
