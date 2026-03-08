import React, { useContext } from 'react';
import { Music, Zap } from 'lucide-react';
import { PlayerContext } from '../context/PlayerContext';

export default function TopHeader() {
  const { performanceMode, setPerformanceMode } = useContext(PlayerContext);

  return (
    <div className="top-header">
      <div className="logo-group">
        <button 
          className={`speed-btn ${performanceMode ? 'active' : ''}`}
          onClick={() => setPerformanceMode(!performanceMode)}
          title="Toggle Speed Mode"
        >
          <Zap size={20} fill={performanceMode ? 'var(--accent)' : 'none'} />
        </button>
        <div className="main-logo">
          <Music size={24} color="var(--accent)" />
          <span className="logo-text">Vibe</span>
        </div>
      </div>
    </div>
  );
}
