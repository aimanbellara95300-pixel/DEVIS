import { TABS } from "../lib/constants.js";

export default function Sidebar({ selected, onNavigate, userEmail, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          Devis <span>Viviworks</span>
        </div>
      </div>
      
      <nav className="sidebar-nav" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={selected(id)}
            onClick={() => onNavigate(id)}
            className="sidebar-item"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-email">{userEmail}</div>
          <button className="btn ghost" type="button" onClick={onSignOut}>
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
  );
}
