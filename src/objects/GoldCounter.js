// -----------------------------------------------------------------------------
// GoldCounter — a finished counter (every memory, momo or letter found) turns
// gold: its panel swaps to 'panel-gold' (made in Boot) and its "10/10" text
// is tinted gold. Used by the HUD and the Fishing scene.
// -----------------------------------------------------------------------------
import { COLORS } from '../config.js';

/** Make a counter's panel + text gold (complete) or the usual cream/ink. */
export function setGold(panel, text, complete) {
  const key = complete && panel.scene.textures.exists('panel-gold') ? 'panel-gold' : 'panel';
  if (panel.texture.key !== key) panel.setTexture(key);
  text.setTint(complete ? COLORS.goldText : COLORS.ink);
}
