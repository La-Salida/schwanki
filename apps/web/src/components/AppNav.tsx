import { Link, NavLink } from "react-router-dom";
import { useAccount } from "@/lib/account";
import { AccountMenu } from "./AccountMenu";

export function AppNav() {
  const { balance, balanceError } = useAccount();
  return (
    <header className="app-header">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <nav className="app-nav" aria-label="Main navigation">
        <NavLink to="/" className="nav-brand"><img src="/goose.png" alt="" className="nav-goose" />Schwanki</NavLink>
        <div className="nav-links">
          <NavLink to="/" end className="nav-link">Today</NavLink>
          <NavLink to="/inbox" className="nav-link">Inbox</NavLink>
          <span className="nav-divider" aria-hidden="true" />
          <NavLink to="/sources" className="nav-link nav-link-quiet">Decks &amp; notes</NavLink>
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

