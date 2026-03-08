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
        <div 
          onClick={() => setPerformanceMode(!performanceMode)}
          className={`nav-item performance-toggle ${performanceMode ? 'active' : ''}`}
        >
          <Zap size={24} fill={performanceMode ? 'var(--accent)' : 'none'} />
          <span>{performanceMode ? 'Speed: High' : 'Speed Mode'}</span>
        </div>
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
