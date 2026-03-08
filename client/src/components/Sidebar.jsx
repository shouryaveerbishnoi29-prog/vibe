import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Music, Zap } from 'lucide-react';
import { PlayerContext } from '../context/PlayerContext';

export default function Sidebar() {
  const { performanceMode, setPerformanceMode } = useContext(PlayerContext);

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

      <div className="desktop-only" style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div 
          onClick={() => setPerformanceMode(!performanceMode)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px', 
            padding: '10px 14px', 
            borderRadius: '6px',
            color: performanceMode ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500
          }}
        >
          <Zap size={22} fill={performanceMode ? 'var(--accent)' : 'none'} />
          <span>{performanceMode ? 'High Speed On' : 'Speed Mode'}</span>
        </div>
      </div>
    </div>
  );
}
