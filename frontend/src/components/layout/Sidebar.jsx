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
      { to: '/my-tickets', label: 'My Tickets', icon: Ticket },
      { to: '/tickets', label: 'All Tickets', icon: Inbox, roles: STAFF },
      { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
      { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
      { to: '/assets', label: 'IT Assets', employeeLabel: 'My Equipment', icon: Laptop },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
      { to: '/admin/users', label: 'User Management', icon: Users, roles: ['admin'] },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['admin'] },
    ],
  },
  { section: 'Account', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
];

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
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
              <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`size-[18px] ${isActive ? 'text-brand-600' : 'text-slate-500 group-hover:text-slate-600'}`} aria-hidden="true" />
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
        <p className="text-xs text-slate-500">Demo environment · fictional data</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{content}</aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={onClose} aria-hidden="true" />
          <aside className="relative h-full w-72 max-w-[85vw] animate-slide-up bg-white shadow-pop">{content}</aside>
        </div>
      )}
    </>
  );
}
