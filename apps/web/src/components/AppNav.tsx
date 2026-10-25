import { Link, NavLink, useLocation } from "react-router-dom";
import { useAccount } from "@/lib/account";
import { AccountMenu } from "./AccountMenu";

export function AppNav() {
  const { balance, balanceError } = useAccount();
  const { pathname } = useLocation();
  return (
    <header className="app-header">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <nav className="app-nav" aria-label="Main navigation">
        <NavLink to="/" className="nav-brand"><img src="/goose.png" alt="" className="nav-goose" />Schwanki</NavLink>
        <div className="nav-links">
          {/* Review is the app; everything after the divider is for getting words in. */}
          <Link to="/" className="nav-link" aria-current={pathname === "/" || pathname === "/review" ? "page" : undefined}>Review</Link>
          <span className="nav-divider" aria-hidden="true" />
          {/* The Inbox is where synced notes land, so it belongs to Decks & notes. */}
          <Link to="/sources" className="nav-link nav-link-quiet" aria-current={pathname === "/sources" || pathname === "/inbox" ? "page" : undefined}>Decks &amp; notes</Link>
          <NavLink to="/settings" className="nav-link nav-link-quiet">Settings</NavLink>
        </div>
        <div className="nav-credit-group">
          <Link to="/billing" className="nav-credit-balance" aria-label={balanceError ? "View billing, credit balance unavailable" : balance === null ? "View billing, loading credit balance" : `${balance.toLocaleString()} credits available. View billing`}>
            <span aria-hidden="true">{balanceError ? "Credits unavailable" : balance === null ? "Credits …" : `${balance.toLocaleString()} credits`}</span>
          </Link>
          <Link to="/billing#credit-packs" className="primary-button nav-buy-credits">Buy credits</Link>
        </div>
        <AccountMenu />
      </nav>
    </header>
  );
}

