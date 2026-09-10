import { useMemo } from 'react';
import { Track } from '../types';

export function useTelemetry(tracks: Track[]) {
  return useMemo(() => {
    let authorisedCount = 0;
    let unregisteredCount = 0;
    let outOfEnvelopeCount = 0;
    let lostLinkCount = 0;

    let maxSpeed = 0;
    let maxAltitude = 0;

    tracks.forEach((t) => {
      if (t.current_classification === 'AUTHORISED') authorisedCount++;
      else if (t.current_classification === 'UNREGISTERED') unregisteredCount++;
      else if (t.current_classification === 'OUT_OF_ENVELOPE') outOfEnvelopeCount++;
      else if (t.current_classification === 'LOST_LINK') lostLinkCount++;

      if (t.speed > maxSpeed) maxSpeed = t.speed;
      if (t.altitude > maxAltitude) maxAltitude = t.altitude;
    });

    return {
      totalActiveTracks: tracks.length,
      authorisedCount,
      unregisteredCount,
      outOfEnvelopeCount,
      lostLinkCount,
      maxSpeed: Math.round(maxSpeed),
      maxAltitude: Math.round(maxAltitude),
    };
  }, [tracks]);
}
