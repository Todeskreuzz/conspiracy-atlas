import { useEffect, useRef } from 'react';
import type { Core } from 'cytoscape';
import { useT } from '../i18n';

const W = 200;
const H = 130;

/** Lightweight overview map drawn on a canvas. Click or drag to move the viewport. */
export function Minimap({ cy }: { cy: Core }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useT();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let transform = { scale: 1, ox: 0, oy: 0 };

    const draw = () => {
      frame = 0;
      const bb = cy.elements().boundingBox();
      if (!Number.isFinite(bb.w) || bb.w === 0) return;
      const scale = Math.min(W / bb.w, H / bb.h) * 0.9;
      const ox = (W - bb.w * scale) / 2 - bb.x1 * scale;
      const oy = (H - bb.h * scale) / 2 - bb.y1 * scale;
      transform = { scale, ox, oy };
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(20,16,12,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(201,55,44,0.35)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      cy.edges(':visible').forEach((e) => {
        const s = e.source().position();
        const tt = e.target().position();
        ctx.moveTo(s.x * scale + ox, s.y * scale + oy);
        ctx.lineTo(tt.x * scale + ox, tt.y * scale + oy);
      });
      ctx.stroke();
      cy.nodes(':visible').forEach((n) => {
        const p = n.position();
        ctx.fillStyle = n.selected() ? '#e8c547' : n.data('kind') === 'theory' ? '#e0574b' : '#d8c8a6';
        ctx.fillRect(p.x * scale + ox - 2, p.y * scale + oy - 1.5, 4, 3);
      });
      const ext = cy.extent();
      ctx.strokeStyle = '#e8c547';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(ext.x1 * scale + ox, ext.y1 * scale + oy, ext.w * scale, ext.h * scale);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    cy.on('viewport position add remove select unselect style', schedule);
    schedule();

    const moveTo = (evt: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((evt.clientX - rect.left) / rect.width) * W;
      const my = ((evt.clientY - rect.top) / rect.height) * H;
      const gx = (mx - transform.ox) / transform.scale;
      const gy = (my - transform.oy) / transform.scale;
      const z = cy.zoom();
      cy.pan({ x: cy.width() / 2 - gx * z, y: cy.height() / 2 - gy * z });
    };
    let dragging = false;
    const down = (e: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      moveTo(e);
    };
    const move = (e: PointerEvent) => dragging && moveTo(e);
    const up = () => (dragging = false);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    return () => {
      cy.off('viewport position add remove select unselect style', schedule);
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    };
  }, [cy]);

  return <canvas ref={ref} className="wall__minimap" width={W} height={H} aria-label={t('wall.minimap')} role="img" />;
}
