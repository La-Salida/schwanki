import { NavLink } from "react-router-dom";

export function AppNav() {
  return (
    <header className="app-header">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <nav className="app-nav" aria-label="Main navigation">
        <NavLink to="/" className="nav-brand"><span className="nav-brand-mark" aria-hidden="true">s.</span>Schwanki</NavLink>
        <div className="nav-links">
          <NavLink to="/" end className="nav-link">Today</NavLink>
          <NavLink to="/inbox" className="nav-link">Inbox</NavLink>
          <span className="nav-divider" aria-hidden="true" />
          <NavLink to="/sources" className="nav-link nav-link-quiet">Decks &amp; notes</NavLink>
          <NavLink to="/settings" className="nav-link nav-link-quiet">Settings</NavLink>
        </div>
      </nav>
    </header>
  );
}

