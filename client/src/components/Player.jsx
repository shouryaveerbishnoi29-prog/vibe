import React, { useContext, useState } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, ListPlus, ListMusic } from 'lucide-react';
import axios from 'axios';
import QueuePanel from './QueuePanel';
import PlaylistModal from './PlaylistModal';

export default function Player() {
  const { 
    currentSong, isPlaying, playPause, progress, duration, seek, playNext, playPrev
  } = useContext(PlayerContext);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  if (!currentSong) return null;

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const image = currentSong.image?.find(img => img.quality === '150x150') || currentSong.image?.[0];

  return (
    <>
      <div className="player-bar fade-in-up">
        {/* Top row: song info + playlist + queue */}
        <div className="player-info">
          {image && <img src={image.url} alt="Cover" />}
          <div className="player-info-text">
            <div className="title">{currentSong.title}</div>
            <div className="artist">{currentSong.subtitle}</div>
          </div>
          <button className="control-btn mobile-action-btn" onClick={() => setShowPlaylistModal(true)} title="Add to Playlist">
            <ListPlus size={20} />
          </button>
          <button className="control-btn mobile-action-btn" onClick={() => setShowQueue(true)} title="Queue">
            <ListMusic size={18} />
          </button>
        </div>

        {/* Center: transport controls */}
        <div className="player-controls">
          <div className="control-buttons">
            <button className="control-btn" onClick={playPrev}><SkipBack size={20} /></button>
            <button className="control-btn play-pause-btn" onClick={playPause}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
            </button>
            <button className="control-btn" onClick={playNext}><SkipForward size={20} /></button>
          </div>
          
          <div className="progress-container">
            <span>{formatTime(progress)}</span>
            <div 
              className="progress-bar"
              onClick={(e) => {
                const bounds = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - bounds.left) / bounds.width;
                seek(Math.max(0, Math.min(duration, percent * duration)));
              }}
              onTouchStart={(e) => {
                const bar = e.currentTarget;
                const handleTouch = (ev) => {
                  const touch = ev.touches[0];
                  const bounds = bar.getBoundingClientRect();
                  const percent = (touch.clientX - bounds.left) / bounds.width;
                  seek(Math.max(0, Math.min(duration, percent * duration)));
                };
                handleTouch(e);
                const onMove = (ev) => { ev.preventDefault(); handleTouch(ev); };
                const onEnd = () => {
                  document.removeEventListener('touchmove', onMove);
                  document.removeEventListener('touchend', onEnd);
                };
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend', onEnd);
              }}
            >
              <div 
                className="progress-fill" 
                style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Desktop only: right side */}
        <div className="player-extra">
          <button className="control-btn" onClick={() => setShowPlaylistModal(true)} title="Add to Playlist">
            <ListPlus size={22} />
          </button>
          <button className="control-btn" onClick={() => setShowQueue(true)} title="Queue">
            <ListMusic size={22} />
          </button>
        </div>
      </div>

      {showQueue && <QueuePanel onClose={() => setShowQueue(false)} />}
      {showPlaylistModal && <PlaylistModal song={currentSong} onClose={() => setShowPlaylistModal(false)} />}
    </>
  );
}
