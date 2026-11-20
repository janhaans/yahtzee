import { reducedMotion } from '../motion';

/** True when this laptop can show the 3D dice (WebGL works and motion is welcome). */
export function canUse3D(): boolean {
  if (reducedMotion()) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
