import { NavLink } from 'react-router';
import { LayoutDashboard, Ticket, Inbox, Sparkles, BookOpen, Laptop, BarChart3, Users, ScrollText, Settings, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Logo } from './Logo.jsx';

const STAFF = ['admin', 'it_support'];
const NAV = [
  {
    section: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/my-tickets', label: 'My tickets', icon: Ticket },
      { to: '/tickets', label: 'All tickets', icon: Inbox, roles: STAFF },
      { to: '/assistant', label: 'AI assistant', icon: Sparkles },
      { to: '/knowledge-base', label: 'Knowledge base', icon: BookOpen },
      { to: '/assets', label: 'IT assets', employeeLabel: 'My equipment', icon: Laptop },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
      { to: '/admin/users', label: 'User management', icon: Users, roles: ['admin'] },
      { to: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText, roles: ['admin'] },
    ],
  },
  { section: 'Account', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
];

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-6">
        <Logo />
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Close navigation">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || i.roles.includes(user.role));
          if (!items.length) return null;
          return (
            <div key={group.section}>
              <p className="px-3 pb-1.5 text-xs text-slate-500">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-white text-slate-900 before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r before:bg-brand-500'
                            : 'text-slate-500 hover:bg-white hover:text-slate-900'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`size-[18px] ${isActive ? 'text-brand-500' : 'text-slate-500 group-hover:text-slate-700'}`} aria-hidden="true" />
                          {user.role === 'employee' && item.employeeLabel ? item.employeeLabel : item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <p className="text-xs text-slate-500">Fictional demo data</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-night lg:block">{content}</aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} aria-hidden="true" />
          <aside className="relative h-full w-72 max-w-[85vw] animate-slide-up border-r border-slate-200 bg-night shadow-pop">{content}</aside>
        </div>
      )}
    </>
  );
}
