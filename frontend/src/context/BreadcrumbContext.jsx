import { createContext, useContext, useEffect, useState } from 'react';

const BreadcrumbContext = createContext({ crumbs: [], setCrumbs: () => {} });

export function BreadcrumbProvider({ children }) {
  const [crumbs, setCrumbs] = useState([]);
  return <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbContext.Provider>;
}

/** Pages declare their breadcrumb trail; the top bar renders it. Also sets the document title. */
export function useBreadcrumbs(crumbs) {
  const { setCrumbs } = useContext(BreadcrumbContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    const parsed = JSON.parse(key);
    setCrumbs(parsed);
    const last = parsed.at(-1)?.label;
    document.title = last ? `${last} · OpsDesk AI` : 'OpsDesk AI';
  }, [key, setCrumbs]);
}

export const useCrumbs = () => useContext(BreadcrumbContext).crumbs;
