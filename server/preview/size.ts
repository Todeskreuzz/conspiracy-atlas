/**
 * Open Graph card. 1200×630 is the usual recommendation, but encoding that many pixels
 * costs more than the 10 ms of CPU time on the Workers Free plan. 800×420 keeps the
 * same ratio and still counts as a large summary card.
 */
export const CARD_W = 800;
export const CARD_H = 420;
