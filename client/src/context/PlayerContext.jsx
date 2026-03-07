import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

export const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
    const audioRef = useRef(new Audio());
    const [currentSong, setCurrentSong] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isShuffled, setIsShuffled] = useState(false);
    const [isRadioMode, setIsRadioMode] = useState(false); // auto-generate queue

    useEffect(() => {
        const audio = audioRef.current;
        const setAudioData = () => { setDuration(audio.duration); setProgress(audio.currentTime); };
        const setAudioTime = () => setProgress(audio.currentTime);
        const handleEnded = () => handleNext();

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        if ('mediaSession' in navigator && currentSong) {
            const highResImage = currentSong.image?.find(img => img.quality === '500x500') || currentSong.image?.[currentSong.image.length - 1];
            navigator.mediaSession.metadata = new window.MediaMetadata({
                title: currentSong.title,
                artist: currentSong.subtitle || 'Unknown Artist',
                artwork: highResImage ? [{ src: highResImage.url, sizes: '500x500', type: 'image/jpeg' }] : []
            });
            navigator.mediaSession.setActionHandler('play', play);
            navigator.mediaSession.setActionHandler('pause', pause);
            navigator.mediaSession.setActionHandler('previoustrack', playPrev);
            navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
        }

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentSong, queue, currentIndex, isRadioMode]);

    const getBestFormatUrl = (downloadUrls) => {
        if (!downloadUrls) return null;
        const highest = downloadUrls.find(u => u.quality === '320kbps') || downloadUrls.find(u => u.quality === '160kbps') || downloadUrls[0];
        return highest ? highest.url : null;
    };

    const startPlaying = (song) => {
        const url = getBestFormatUrl(song.downloadUrl);
        if (url) {
            audioRef.current.src = url;
            audioRef.current.play().then(() => {
                setIsPlaying(true);
                setCurrentSong(song);
                axios.post('/api/listen', song).catch(e => console.error(e));
            }).catch(e => console.error("Playback failed", e));
        }
    };

    // Generate a radio queue of similar songs based on the artist
    const generateRadioQueue = async (song) => {
        try {
            const artist = song.subtitle?.split(',')[0] || song.title;
            const res = await axios.get(`/api/search?q=${encodeURIComponent(artist)}`);
            const results = res.data?.data?.results || [];
            // Filter out the current song itself and limit to 20
            const radioSongs = results
                .filter(s => s.id !== song.id)
                .slice(0, 20);
            return radioSongs;
        } catch(e) {
            console.error("Radio queue generation failed:", e.message);
            return [];
        }
    };

    // Main play function
    const playSong = async (song, playlistQueue = null) => {
        if (playlistQueue) {
            // Playing from a playlist/list — use that as the queue
            setIsRadioMode(false);
            let finalQueue = [...playlistQueue];
            if (isShuffled) {
                // Keep clicked song first, shuffle the rest
                finalQueue = finalQueue.filter(s => s.id !== song.id);
                finalQueue.sort(() => Math.random() - 0.5);
                finalQueue.unshift(song);
            }
            setQueue(finalQueue);
            const idx = finalQueue.findIndex(s => s.id === song.id);
            setCurrentIndex(idx !== -1 ? idx : 0);
            startPlaying(song);
        } else {
            // Playing a random solo song — enter radio mode
            setIsRadioMode(true);
            const radioSongs = await generateRadioQueue(song);
            const fullQueue = [song, ...radioSongs];
            setQueue(fullQueue);
            setCurrentIndex(0);
            startPlaying(song);
        }
    };

    const addToQueue = (song) => {
        setQueue(prev => [...prev, song]);
    };

    const removeFromQueue = (index) => {
        if (index === currentIndex) return;
        setQueue(prev => {
            const newQ = [...prev];
            newQ.splice(index, 1);
            return newQ;
        });
        if (index < currentIndex) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const reorderQueue = (fromIndex, toIndex) => {
        setQueue(prev => {
            const newQ = [...prev];
            const [moved] = newQ.splice(fromIndex, 1);
            newQ.splice(toIndex, 0, moved);
            return newQ;
        });
        // Adjust currentIndex
        if (fromIndex === currentIndex) {
            setCurrentIndex(toIndex);
        } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
            setCurrentIndex(prev => prev - 1);
        } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const shufflePlay = (songs) => {
        // Clear everything and play in random order
        setIsRadioMode(false);
        const shuffled = [...songs].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setCurrentIndex(0);
        startPlaying(shuffled[0]);
    };

    const playSequential = (songs) => {
        // Clear everything and play in order
        setIsRadioMode(false);
        setIsShuffled(false);
        setQueue([...songs]);
        setCurrentIndex(0);
        startPlaying(songs[0]);
    };

    const toggleShuffle = () => {
        setIsShuffled(prev => !prev);
    };

    const playPause = () => {
        if (!currentSong) return;
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play(); setIsPlaying(true); }
    };
    const play = () => { if(currentSong) { audioRef.current.play(); setIsPlaying(true); } };
    const pause = () => { if(currentSong) { audioRef.current.pause(); setIsPlaying(false); } };

    const handleNext = async () => {
        if (currentIndex < queue.length - 1) {
            const nextSong = queue[currentIndex + 1];
            setCurrentIndex(currentIndex + 1);
            startPlaying(nextSong);
        } else if (isRadioMode && currentSong) {
            // Auto-extend the queue with more radio songs
            const moreSongs = await generateRadioQueue(currentSong);
            if (moreSongs.length > 0) {
                const newQ = [...queue, ...moreSongs];
                setQueue(newQ);
                setCurrentIndex(queue.length); // first of the new batch
                startPlaying(moreSongs[0]);
            }
        }
    };

    const playNext = () => handleNext();

    const playPrev = () => {
        if (progress > 3) {
            // If more than 3 seconds in, restart current song
            audioRef.current.currentTime = 0;
            setProgress(0);
        } else if (currentIndex > 0) {
            const prevSong = queue[currentIndex - 1];
            setCurrentIndex(currentIndex - 1);
            startPlaying(prevSong);
        }
    };

    const seek = (time) => {
        audioRef.current.currentTime = time;
        setProgress(time);
    };

    return (
        <PlayerContext.Provider value={{
            currentSong, isPlaying, progress, duration,
            playSong, playPause, playNext, playPrev, seek,
            queue, currentIndex,
            addToQueue, removeFromQueue, reorderQueue,
            shufflePlay, playSequential, isShuffled, toggleShuffle,
            isRadioMode
        }}>
            {children}
        </PlayerContext.Provider>
    );
};
