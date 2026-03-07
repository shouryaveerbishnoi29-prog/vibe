import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Music } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--accent)' }}>
        <Music size={32} />
        <h2 style={{ marginBottom: 0 }}>Vibe</h2>
      </div>
      <div className="nav-links">
        <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Home size={24} /> <span>Home</span>
        </NavLink>
        <NavLink to="/search" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Search size={24} /> <span>Search</span>
        </NavLink>
        <NavLink to="/library" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Library size={24} /> <span>Your Library</span>
        </NavLink>
      </div>
    </div>
  );
}
