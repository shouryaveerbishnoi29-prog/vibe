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
    const [isRadioMode, setIsRadioMode] = useState(false);

    // Refs to keep event listeners updated without re-binding them
    const queueRef = useRef(queue);
    const indexRef = useRef(currentIndex);
    const radioModeRef = useRef(isRadioMode);

    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { radioModeRef.current = isRadioMode; }, [isRadioMode]);

    const play = useCallback(() => {
        if (audioRef.current.src) {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Play error:", e));
        }
    }, []);

    const pause = useCallback(() => {
        audioRef.current.pause();
        setIsPlaying(false);
    }, []);

    const getBestFormatUrl = (downloadUrls) => {
        if (!downloadUrls) return null;
        const highest = downloadUrls.find(u => u.quality === '320kbps') || downloadUrls.find(u => u.quality === '160kbps') || downloadUrls[0];
        return highest ? highest.url : null;
    };

    const startPlaying = useCallback((song) => {
        const url = getBestFormatUrl(song.downloadUrl);
        if (url) {
            const audio = audioRef.current;
            audio.pause();
            audio.src = url;
            audio.load(); // Explicit load
            audio.play().then(() => {
                setIsPlaying(true);
                setCurrentSong(song);
                axios.post('/api/listen', song).catch(e => console.error(e));
            }).catch(e => {
                console.error("Playback failed:", e);
                // On mobile, sometimes we need to try again or user might need to tap
                setIsPlaying(false);
            });
        }
    }, []);

    const generateRadioQueue = async (song) => {
        try {
            const artist = song.subtitle?.split(',')[0] || song.title;
            const res = await axios.get(`/api/search?q=${encodeURIComponent(artist)}`);
            const results = res.data?.data?.results || [];
            return results.filter(s => s.id !== song.id).slice(0, 20);
        } catch(e) {
            console.error("Radio queue failed:", e.message);
            return [];
        }
    };

    const handleNext = useCallback(async () => {
        const q = queueRef.current;
        const idx = indexRef.current;
        const radio = radioModeRef.current;

        if (idx < q.length - 1) {
            const nextIndex = idx + 1;
            const nextSong = q[nextIndex];
            setCurrentIndex(nextIndex);
            startPlaying(nextSong);
        } else if (radio && q[idx]) {
            // Radio mode extension
            const moreSongs = await generateRadioQueue(q[idx]);
            if (moreSongs.length > 0) {
                const newQ = [...q, ...moreSongs];
                setQueue(newQ);
                setCurrentIndex(q.length); 
                startPlaying(moreSongs[0]);
            }
        }
    }, [startPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        
        const setAudioData = () => { setDuration(audio.duration); setProgress(audio.currentTime); };
        const setAudioTime = () => setProgress(audio.currentTime);
        const handleEnded = () => handleNext();

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [handleNext]);

    useEffect(() => {
        if ('mediaSession' in navigator && currentSong) {
            const highResImage = currentSong.image?.find(img => img.quality === '500x500') || currentSong.image?.[currentSong.image.length - 1];
            navigator.mediaSession.metadata = new window.MediaMetadata({
                title: currentSong.title,
                artist: currentSong.subtitle || 'Unknown Artist',
                artwork: highResImage ? [{ src: highResImage.url, sizes: '500x500', type: 'image/jpeg' }] : []
            });
            navigator.mediaSession.setActionHandler('play', play);
            navigator.mediaSession.setActionHandler('pause', pause);
            navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
            navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
        }
    }, [currentSong, play, pause, handleNext]);

    const playSong = async (song, playlistQueue = null) => {
        if (playlistQueue) {
            setIsRadioMode(false);
            let finalQueue = [...playlistQueue];
            if (isShuffled) {
                finalQueue = finalQueue.filter(s => s.id !== song.id);
                finalQueue.sort(() => Math.random() - 0.5);
                finalQueue.unshift(song);
            }
            setQueue(finalQueue);
            const idx = finalQueue.findIndex(s => s.id === song.id);
            setCurrentIndex(idx !== -1 ? idx : 0);
            startPlaying(song);
        } else {
            setIsRadioMode(true);
            const radioSongs = await generateRadioQueue(song);
            const fullQueue = [song, ...radioSongs];
            setQueue(fullQueue);
            setCurrentIndex(0);
            startPlaying(song);
        }
    };

    const addToQueue = (song) => setQueue(prev => [...prev, song]);

    const removeFromQueue = (index) => {
        if (index === currentIndex) return;
        setQueue(prev => {
            const newQ = [...prev];
            newQ.splice(index, 1);
            return newQ;
        });
        if (index < currentIndex) setCurrentIndex(prev => prev - 1);
    };

    const reorderQueue = (fromIndex, toIndex) => {
        setQueue(prev => {
            const newQ = [...prev];
            const [moved] = newQ.splice(fromIndex, 1);
            newQ.splice(toIndex, 0, moved);
            return newQ;
        });
        if (fromIndex === currentIndex) setCurrentIndex(toIndex);
        else if (fromIndex < currentIndex && toIndex >= currentIndex) setCurrentIndex(prev => prev - 1);
        else if (fromIndex > currentIndex && toIndex <= currentIndex) setCurrentIndex(prev => prev + 1);
    };

    const shufflePlay = (songs) => {
        setIsRadioMode(false);
        const shuffled = [...songs].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setCurrentIndex(0);
        startPlaying(shuffled[0]);
    };

    const playSequential = (songs) => {
        setIsRadioMode(false);
        setIsShuffled(false);
        setQueue([...songs]);
        setCurrentIndex(0);
        startPlaying(songs[0]);
    };

    const toggleShuffle = () => setIsShuffled(prev => !prev);

    const playPause = () => isPlaying ? pause() : play();

    const playPrev = () => {
        const audio = audioRef.current;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
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
            playSong, playPause, playNext: handleNext, playPrev, seek,
            queue, currentIndex,
            addToQueue, removeFromQueue, reorderQueue,
            shufflePlay, playSequential, isShuffled, toggleShuffle,
            isRadioMode
        }}>
            {children}
        </PlayerContext.Provider>
    );
};
