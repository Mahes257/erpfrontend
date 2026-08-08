import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, FolderKanban, Package, ShoppingCart,
  Calculator, BarChart3, Settings, Moon, Sun, Bell, LogOut, ChevronDown, Search, Menu, ClipboardList, CirclePlay
} from 'lucide-react';
import { clearAuth, getStoredUser } from '../../services/authService';
import { useTheme } from '../Common';
import './AppLayout.css';

const PAGE_TITLES = [
  { pattern: /^\/dashboard/, title: 'Dashboard' },
  { pattern: /^\/contacts/, title: 'Contacts' },
  { pattern: /^\/pipeline/, title: 'Leads' },
  { pattern: /^\/leads\/(new|\d+\/edit)/, title: 'Leads' },
  { pattern: /^\/leads/, title: 'Leads' },
  { pattern: /^\/clients/, title: 'Clients' },
  { pattern: /^\/followups/, title: 'Follow-ups' },
  { pattern: /^\/cprs/, title: 'CPR' },
  { pattern: /^\/cost-workouts/, title: 'Cost Workout' },
  { pattern: /^\/quotations/, title: 'Quotations' },
  { pattern: /^\/sales-contracts/, title: 'Sales Contracts' },
  { pattern: /^\/sales-orders/, title: 'Sales Orders' },
  { pattern: /^\/delivery-challans/, title: 'Delivery Challans' },
  { pattern: /^\/proforma-invoices/, title: 'Proforma Invoices' },
  { pattern: /^\/invoices/, title: 'Invoices' },
  { pattern: /^\/payment-receipts/, title: 'Payment Receipts' },
  { pattern: /^\/credit-notes/, title: 'Credit Notes' }
];

function useMediaQuery(query, onChange) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handleChange = () => {
      setMatches(mql.matches);
      onChange?.(mql.matches);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query, onChange]);

  return matches;
}

function NavItem({ icon: Icon, label, active, onClick, onTipStart, onTipEnd, hidden, disabled }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onTipStart}
      onMouseLeave={onTipEnd}
      onFocus={onTipStart}
      onBlur={onTipEnd}
      className={`sb-nav-item${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      disabled={disabled}
      title={disabled ? `${label} (Coming Soon)` : undefined}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="sb-label">{label}</span>
      {disabled && <span className="sb-coming-soon-badge">Coming Soon</span>}
    </button>
  );
}

function NavGroup({ icon: Icon, label, open, onToggle, children, id, onTipStart, onTipEnd, hidden, forceOpen, nested, active }) {
  if (hidden) return null;
  const isOpen = forceOpen || open;
  return (
    <div className={`sb-group${nested ? ' sb-group--nested' : ''}`} data-open={isOpen}>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onTipStart}
        onMouseLeave={onTipEnd}
        onFocus={onTipStart}
        onBlur={onTipEnd}
        className={`sb-nav-item${active ? ' is-active' : ''}`}
        aria-expanded={isOpen}
        aria-controls={id}
        aria-label={label}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="sb-label sb-label--flex">{label}</span>
        <ChevronDown className={`sb-group-chevron${isOpen ? ' rotated' : ''}`} aria-hidden="true" />
      </button>
      <div className="sb-group-children" id={id}>
        <div className="sb-group-children-inner">{children}</div>
      </div>
    </div>
  );
}

function SubItem({ label, active, onClick, hidden, disabled }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={`sb-subitem${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      title={disabled ? `${label} (Coming Soon)` : undefined}
    >
      {label}
      {disabled && <span className="sb-coming-soon-badge">Coming Soon</span>}
    </button>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(true);
  const [crmOpen, setCrmOpen] = useState(true);
  const [cprOpen, setCprOpen] = useState(true);
  const [salesExecOpen, setSalesExecOpen] = useState(true);
  const [tooltip, setTooltip] = useState(null);
  const [menuSearch, setMenuSearch] = useState('');

  const handleMediaChange = useCallback((mobile) => {
    if (mobile) {
      setIsHovered(false);
      setTooltip(null);
    } else {
      setMobileOpen(false);
    }
  }, []);

  const isMobile = useMediaQuery('(max-width: 768px)', handleMediaChange);

  const user = getStoredUser();
  const expanded = isMobile ? mobileOpen : isHovered;

  const asideRef = useRef(null);
  const hamburgerRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isMobile && mobileOpen) {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    if (isMobile && mobileOpen) {
      asideRef.current?.focus();
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [isMobile, mobileOpen]);

  const go = (path) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
    if (menuSearch) setMenuSearch('');
  };

  const handleSignOut = () => {
    clearAuth();
    navigate('/signin', { replace: true });
  };

  const showTip = (e, label) => {
    if (isMobile || expanded) {
      setTooltip(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, x: rect.right + 12, y: rect.top + rect.height / 2 });
  };

  const hideTip = () => setTooltip(null);

  const activeMenu =
    location.pathname === '/dashboard' || location.pathname === '/'
      ? 'Dashboard'
      : location.pathname.startsWith('/contacts')
        ? 'Contacts'
        : location.pathname.startsWith('/pipeline')
          ? 'Leads'
          : location.pathname.startsWith('/leads')
            ? 'Leads'
            : location.pathname.startsWith('/clients')
            ? 'Clients'
            : location.pathname.startsWith('/followups')
              ? 'Follow-ups'                : location.pathname.startsWith('/cost-workouts')
                  ? 'Cost Workout'
                  : location.pathname.startsWith('/cprs')
                    ? 'CPR'
                    : location.pathname.startsWith('/quotations')
                      ? 'Quotations'
                      : location.pathname.startsWith('/sales-contracts')
                        ? 'Sales Contracts'
                        : location.pathname.startsWith('/sales-orders')
                          ? 'Sales Orders'
                          : location.pathname.startsWith('/delivery-challans')
                            ? 'Delivery Challans'
                            : location.pathname.startsWith('/proforma-invoices')
                              ? 'Proforma Invoices'
                              : location.pathname.startsWith('/invoices')
                                ? 'Invoices'
                                : location.pathname.startsWith('/credit-notes')
                                  ? 'Credit Notes'
                                  : location.pathname.startsWith('/payment-receipts')
                                    ? 'Payment Receipts'
                                    : '';

  const cprActive = (() => {
    if (!location.pathname.startsWith('/cost-workouts') && !location.pathname.startsWith('/cprs')) return '';
    if (location.pathname.startsWith('/cost-workouts')) return 'Cost Workout (CW)';
    if (location.pathname === '/cprs/new') return 'New CPR';
    if (location.pathname === '/cprs/reports') return 'CPR Reports';
    return 'CPR List';
  })();

  const title = PAGE_TITLES.find((entry) => entry.pattern.test(location.pathname))?.title || 'Dashboard';

  const avatarLetter = (user?.fullName || 'A').charAt(0).toUpperCase();

  const showTipDashboard = (e) => showTip(e, 'Dashboard');
  const showTipContacts = (e) => showTip(e, 'Contacts');
  const showTipSales = (e) => showTip(e, 'Sales');
  const showTipSalesExec = (e) => showTip(e, 'Sales Execution');
  const showTipCrm = (e) => showTip(e, 'CRM');
  const showTipCpr = (e) => showTip(e, 'Customer Purchase Request');
  const showTipDark = (e) => showTip(e, 'Dark Mode');
  const showTipBell = (e) => showTip(e, 'Notifications');
  const showTipSignOut = (e) => showTip(e, 'Sign Out');

  // Menu search filter (mirrors VT.Sidebar.filterMenu in the original ERP):
  // items whose label (or a group's child label) contains the query stay visible;
  // groups with a matching child auto-expand while a query is active.
  const query = menuSearch.trim().toLowerCase();
  const matchQ = (text) => !query || text.toLowerCase().includes(query);
  // While a search is active the groups are visually pinned open (forceOpen);
  // make toggles inert so the underlying open-state isn't silently mutated.
  const toggleSales = () => { if (!query) setSalesOpen((o) => !o); };
  const toggleCrm = () => { if (!query) setCrmOpen((o) => !o); };
  const toggleCpr = () => { if (!query) setCprOpen((o) => !o); };
  const toggleSalesExec = () => { if (!query) setSalesExecOpen((o) => !o); };
  // Active group highlighting mirrors the ERP reference: a group header is
  // highlighted whenever one of its child routes is the current page.
  const salesExecGroupActive = ['Quotations', 'Sales Contracts', 'Sales Orders', 'Delivery Challans', 'Proforma Invoices', 'Invoices', 'Credit Notes', 'Payment Receipts'].includes(activeMenu);
  const crmGroupActive = ['Leads', 'Clients', 'Follow-ups'].includes(activeMenu);
  const cprGroupActive = Boolean(cprActive);
  const salesActive = crmGroupActive || cprGroupActive || salesExecGroupActive;
  const crmVisible = matchQ('CRM') || matchQ('Leads') || matchQ('Clients') || matchQ('Follow-ups') || matchQ('Contacts');
  const cprVisible =
    matchQ('Customer Purchase Request') ||
    matchQ('New CPR') ||
    matchQ('CPR List') ||
    matchQ('Cost Workout') ||
    matchQ('CPR Reports');
  const salesExecVisible =
    matchQ('Sales Execution') ||
    matchQ('Quotations') ||
    matchQ('Sales Contracts') ||
    matchQ('Sales Orders') ||
    matchQ('Proforma Invoices') ||
    matchQ('Delivery Challans') ||
    matchQ('Invoices') ||
    matchQ('Credit Notes') ||
    matchQ('Payment Receipts') ||
    matchQ('Sales Reports');
  const salesVisible = matchQ('Sales') || crmVisible || cprVisible || salesExecVisible;

  // Auto-expand the Sales -> child-group chain when the current route changes
  // into a nested module (mirrors the ERP reference's openActiveSection on
  // navigation). Keyed on pathname only, so manually collapsing a group while
  // staying on the same page is preserved.
  const pathname = location.pathname;
  useEffect(() => {
    if (query) return; // never mutate group state while menu search is active
    // Route-driven group expansion mirrors the ERP reference's openActiveSection:
    // landing on a nested page opens its parent chain. State mutation is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (salesActive && !salesOpen) setSalesOpen(true);
    if (crmGroupActive && !crmOpen) setCrmOpen(true);
    if (cprGroupActive && !cprOpen) setCprOpen(true);
    if (salesExecGroupActive && !salesExecOpen) setSalesExecOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="app-shell flex min-h-screen bg-app font-sans antialiased text-slate-800 overflow-x-hidden">
      <aside
        id="app-sidebar"
        ref={asideRef}
        className={`app-sidebar${expanded ? ' expanded' : ''}${isMobile ? ' app-sidebar--mobile' : ''}${isMobile && mobileOpen ? ' is-open' : ''}`}
        aria-label="Sidebar navigation"
        tabIndex={isMobile ? -1 : undefined}
        inert={isMobile ? !mobileOpen : undefined}
        onMouseEnter={isMobile ? undefined : () => setIsHovered(true)}
        onMouseLeave={isMobile ? undefined : () => { setIsHovered(false); setTooltip(null); }}
      >
        <div className="sb-top">
          {/* Brand */}
          <div className="sb-logo">
            <div className="sb-brand-mark"><div className="sb-brand-dot" /></div>
            <span className="sb-label sb-logo-text">VISHAK TECH</span>
          </div>

          {/* User profile */}
          <div className="sb-profile">
            <div className="sb-avatar" aria-hidden="true">{avatarLetter}</div>
            <div className="sb-profile-info">
              <span className="sb-profile-name">{user?.fullName || 'Admin User'}</span>
              <span className="sb-profile-role">{user?.role || 'Administrator'}</span>
            </div>
          </div>

          {/* Menu search */}
          <div className="sb-search">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search menu..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="sb-search-input"
                aria-label="Search menu"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="sb-nav" aria-label="Primary">
            <NavItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeMenu === 'Dashboard'}
              onClick={() => go('/dashboard')}
              onTipStart={showTipDashboard}
              onTipEnd={hideTip}
              hidden={!matchQ('Dashboard')}
            />
            <NavItem
              icon={Users}
              label="Contacts"
              active={activeMenu === 'Contacts'}
              onClick={() => go('/contacts')}
              onTipStart={showTipContacts}
              onTipEnd={hideTip}
              hidden={!matchQ('Contacts')}
            />
            <NavGroup
              icon={ShoppingBag}
              label="Sales"
              open={salesOpen}
              onToggle={toggleSales}
              id="sb-sales"
              onTipStart={showTipSales}
              onTipEnd={hideTip}
              hidden={!salesVisible}
              forceOpen={Boolean(query)}
            >
              <NavGroup
                icon={FolderKanban}
                label="CRM"
                open={crmOpen}
                onToggle={toggleCrm}
                id="sb-crm"
                onTipStart={showTipCrm}
                onTipEnd={hideTip}
                hidden={!crmVisible}
                forceOpen={Boolean(query)}
                nested
              >
                <SubItem label="Leads" onClick={() => go('/leads')} hidden={!matchQ('Leads')} />
                <SubItem label="Clients" onClick={() => go('/clients')} hidden={!matchQ('Clients')} />
                <SubItem label="Follow-ups" onClick={() => go('/followups')} hidden={!matchQ('Follow-ups')} />
              </NavGroup>
              <NavGroup
                icon={ClipboardList}
                label="Customer Purchase Request"
                open={cprOpen}
                onToggle={toggleCpr}
                id="sb-sales-cpr"
                onTipStart={showTipCpr}
                onTipEnd={hideTip}
                hidden={!cprVisible}
                forceOpen={Boolean(query)}
                nested
              >
                <SubItem label="New CPR" onClick={() => go('/cprs/new')} hidden={!matchQ('New CPR')} />
                <SubItem label="CPR List" onClick={() => go('/cprs')} hidden={!matchQ('CPR List')} />
                <SubItem label="Cost Workout (CW)" onClick={() => go('/cost-workouts')} hidden={!matchQ('Cost Workout')} />
                <SubItem label="CPR Reports" onClick={() => go('/cprs/reports')} hidden={!matchQ('CPR Reports')} />
              </NavGroup>
              <NavGroup
                icon={CirclePlay}
                label="Sales Execution"
                open={salesExecOpen}
                onToggle={toggleSalesExec}
                id="sb-sales-execution"
                onTipStart={showTipSalesExec}
                onTipEnd={hideTip}
                hidden={!salesExecVisible}
                forceOpen={Boolean(query)}
                nested
              >
                <SubItem label="Quotations" onClick={() => go('/quotations')} hidden={!matchQ('Quotations')} />
                <SubItem label="Sales Contracts" onClick={() => go('/sales-contracts')} hidden={!matchQ('Sales Contracts')} />
                <SubItem label="Sales Orders" onClick={() => go('/sales-orders')} hidden={!matchQ('Sales Orders')} />
                <SubItem label="Delivery Challans" onClick={() => go('/delivery-challans')} hidden={!matchQ('Delivery Challans')} />
                <SubItem label="Proforma Invoices" onClick={() => go('/proforma-invoices')} hidden={!matchQ('Proforma Invoices')} />
                <SubItem label="Invoices" onClick={() => go('/invoices')} hidden={!matchQ('Invoices')} />
                <SubItem label="Credit Notes" onClick={() => go('/credit-notes')} hidden={!matchQ('Credit Notes')} />
                <SubItem label="Payment Receipts" onClick={() => go('/payment-receipts')} hidden={!matchQ('Payment Receipts')} />
                <SubItem label="Sales Reports" disabled hidden={!matchQ('Sales Reports')} />
              </NavGroup>
            </NavGroup>

            {/* Module placeholders (ERP shows these as Coming Soon until built) */}
            <NavItem icon={Package} label="Inventory" disabled hidden={!matchQ('Inventory')} onTipStart={(e) => showTip(e, 'Inventory')} onTipEnd={hideTip} />
            <NavItem icon={ShoppingCart} label="Purchase" disabled hidden={!matchQ('Purchase')} onTipStart={(e) => showTip(e, 'Purchase')} onTipEnd={hideTip} />
            <NavItem icon={Calculator} label="Accounts" disabled hidden={!matchQ('Accounts')} onTipStart={(e) => showTip(e, 'Accounts')} onTipEnd={hideTip} />
            <NavItem icon={Users} label="HRMS" disabled hidden={!matchQ('HRMS')} onTipStart={(e) => showTip(e, 'HRMS')} onTipEnd={hideTip} />
            <NavItem icon={BarChart3} label="Reports" disabled hidden={!matchQ('Reports')} onTipStart={(e) => showTip(e, 'Reports')} onTipEnd={hideTip} />
            <NavItem icon={Settings} label="Settings" active={matchQ('Settings') && location.pathname.startsWith('/settings')} onClick={() => go('/settings')} hidden={!matchQ('Settings')} onTipStart={(e) => showTip(e, 'Settings')} onTipEnd={hideTip} />

          </nav>
        </div>

        {/* Bottom utilities */}
        <div className="sb-bottom">
          <button
            type="button"
            onClick={toggleTheme}
            className={`sb-nav-item${isDark ? ' is-active is-theme-toggle' : ''}`}
            onMouseEnter={showTipDark}
            onMouseLeave={hideTip}
            aria-label="Dark Mode"
            aria-pressed={isDark}
          >
            {isDark ? <Sun className="w-4 h-4 shrink-0" aria-hidden="true" /> : <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />}
            <span className="sb-label">Dark Mode</span>
          </button>
          <button
            type="button"
            className="sb-nav-item"
            onMouseEnter={showTipBell}
            onMouseLeave={hideTip}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="sb-label">Notifications</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="sb-nav-item sb-nav-item--danger"
            onMouseEnter={showTipSignOut}
            onMouseLeave={hideTip}
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="sb-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {isMobile && mobileOpen && (
        <div className="sb-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-surface border-b border-slate-200 flex items-center gap-2 px-4 sm:px-6 shrink-0">
          {isMobile && (
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Open sidebar"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <span className="text-sm font-semibold text-slate-400">{title}</span>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      {!expanded &&
        tooltip &&
        createPortal(
          <span className="sb-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.label}
          </span>,
          document.body
        )}
    </div>
  );
}
