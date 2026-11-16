import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Menu, Bell, ChevronRight, LogOut, User, Settings, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCrumbs } from '../../context/BreadcrumbContext.jsx';
import { dashboardApi } from '../../api/endpoints.js';
import { Avatar } from '../ui/Layout.jsx';
import { RoleBadge } from '../ui/Badges.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import { describeActivity } from '../../utils/labels.js';
import { timeAgo } from '../../utils/format.js';

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Breadcrumbs() {
  const crumbs = useCrumbs();
  if (!crumbs.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate text-slate-500 hover:text-slate-800">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-slate-900" aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const SEEN_KEY = 'opsdesk.notifications.seenAt';
// localStorage can be unavailable (private mode, blocked storage); the badge is only a convenience.
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '1970-01-01';
  } catch {
    return '1970-01-01';
  }
};
const writeSeen = (v) => {
  try {
    localStorage.setItem(SEEN_KEY, v);
  } catch {
    /* ignore */
  }
};

function NotificationMenu() {
  const { open, setOpen, ref } = usePopover();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['notifications'], queryFn: dashboardApi.notifications, refetchInterval: 60000 });
  const [seenAt, setSeenAt] = useState(readSeen);
  const unread = data.filter((n) => n.createdAt > seenAt).length;

  const toggle = () => {
    setOpen(!open);
    if (!open && data[0]) {
      writeSeen(data[0].createdAt);
      setSeenAt(data[0].createdAt);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} aria-expanded={open}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-slide-up rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <p className="text-xs text-slate-500">Recent updates on your tickets</p>
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {isLoading && <li className="px-4 py-6 text-center text-sm text-slate-500">Loading…</li>}
            {isError && <li className="px-4 py-6 text-center text-sm text-red-600">Could not load notifications.</li>}
            {!isLoading && !isError && data.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">You're all caught up.</li>}
            {data.map((n) => (
              <li key={n.id}>
                <Link to={`/tickets/${n.ticket.id}`} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-slate-50">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{n.actorName ?? 'System'}</span> {describeActivity(n, n.actorName)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {n.ticket.ticketNumber} · {n.ticket.subject} · {timeAgo(n.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, ref } = usePopover();
  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };
  return (
    <div className="relative" ref={ref}>
      {/* The accessible name comes from the content ("Sam Carter account menu"), so it always
          starts with the visible name — voice-control users can say what they see. */}
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100" aria-expanded={open}>
        <Avatar name={user.fullName} />
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-slate-900">{user.fullName}</span>
        </span>
        {/* On phones the name is hidden visually; keep it for screen readers. */}
        <span className="sr-only sm:hidden">{user.fullName}</span>
        <span className="sr-only"> account menu</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-slide-up rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop" role="menu">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
            <User className="size-4 text-slate-500" /> Profile
          </Link>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
            <Settings className="size-4 text-slate-500" /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
            <LogOut className="size-4 text-slate-500" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenu }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} className="-ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <ButtonLink to="/tickets/new" size="sm" icon={Plus} className="hidden sm:inline-flex">
        New ticket
      </ButtonLink>
      <NotificationMenu />
      <UserMenu />
    </header>
  );
}
