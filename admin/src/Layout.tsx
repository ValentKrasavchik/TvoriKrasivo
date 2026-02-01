import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6 font-semibold text-slate-800">Твори Красиво</div>
        <nav className="space-y-4">
          <div>
            <div className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">Расписание</div>
            <div className="space-y-1">
              <NavLink
                to="/workshops"
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Мастер-классы
              </NavLink>
              <NavLink
                to="/calendar"
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Календарь
              </NavLink>
              <NavLink
                to="/bookings"
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
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                Отзывы гостей
              </NavLink>
              <NavLink
                to="/gallery"
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
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
