import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Music, Zap } from 'lucide-react';
import { PlayerContext } from '../context/PlayerContext';

export default function Sidebar() {
  const { performanceMode, setPerformanceMode } = useContext(PlayerContext);

  return (
    <div className="sidebar">
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
