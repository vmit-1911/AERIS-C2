import { useState, useCallback, useRef } from 'react';
import { Track } from '../types';

export const MAX_TRAIL_POINTS = 500;

export function useTracks() {
  const [tracks, setTracks] = useState<Map<string, Track>>(new Map());
  const [trails, setTrails] = useState<Map<string, [number, number][]>>(new Map());
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [followDrone, setFollowDrone] = useState<boolean>(false);

  // Keep ref for access inside callbacks without stale closures
  const tracksRef = useRef<Map<string, Track>>(tracks);
  tracksRef.current = tracks;
  const trailsRef = useRef<Map<string, [number, number][]>>(trails);
  trailsRef.current = trails;

  const setInitialTracks = useCallback((trackList: Track[]) => {
    const newTracks = new Map<string, Track>();
    const newTrails = new Map<string, [number, number][]>();

    trackList.forEach((t) => {
      newTracks.set(t.drone_id, t);
      if (typeof t.latitude === 'number' && typeof t.longitude === 'number') {
        newTrails.set(t.drone_id, [[t.latitude, t.longitude]]);
      }
    });

    setTracks(newTracks);
    setTrails(newTrails);
  }, []);

  const updateTrack = useCallback((track: Track) => {
    if (!track || !track.drone_id) return;

    setTracks((prev) => {
      const next = new Map(prev);
      next.set(track.drone_id, track);
      return next;
    });

    if (typeof track.latitude === 'number' && typeof track.longitude === 'number') {
      const newPoint: [number, number] = [track.latitude, track.longitude];
      setTrails((prev) => {
        const next = new Map(prev);
        const existingTrail = next.get(track.drone_id) || [];
        // Only append if position is different from last point
        const last = existingTrail[existingTrail.length - 1];
        if (!last || last[0] !== newPoint[0] || last[1] !== newPoint[1]) {
          const updatedTrail = [...existingTrail, newPoint];
          if (updatedTrail.length > MAX_TRAIL_POINTS) {
            updatedTrail.shift();
          }
          next.set(track.drone_id, updatedTrail);
        }
        return next;
      });
    }
  }, []);

  const selectTrack = useCallback((droneId: string | null) => {
    setSelectedDroneId(droneId);
  }, []);

  const toggleFollow = useCallback(() => {
    setFollowDrone((prev) => !prev);
  }, []);

  const selectedTrack = selectedDroneId ? tracks.get(selectedDroneId) || null : null;
  const tracksList = Array.from(tracks.values());

  return {
    tracks,
    tracksList,
    trails,
    selectedDroneId,
    selectedTrack,
    followDrone,
    selectTrack,
    updateTrack,
    setInitialTracks,
    setFollowDrone,
    toggleFollow,
  };
}
