import React, { useEffect, useRef, useState } from 'react';
import { ExpeditionReport, ExpeditionRoomEvent } from '../types/game';
import { soundFX } from '../utils/sound';

interface ExpeditionCanvasProps {
  mode: 'TITLE_BACKDROP' | 'EXPEDITION_LIVE';
  report: ExpeditionReport | null;
  activeRoomIdx: number;
  simSpeed: 1 | 2 | 4;
  reducedMotion: boolean;
  onRoomAdvance?: (nextIdx: number) => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

export const ExpeditionCanvas: React.FC<ExpeditionCanvasProps> = React.memo(({
  mode,
  report,
  activeRoomIdx,
  simSpeed,
  reducedMotion,
  onRoomAdvance
}) => {
  const [camera, setCamera] = useState({ x:0, y:0 });
  const cameraRef = useRef(camera);
  const moveCamera = (x:number,y:number) => {
    const next = { x:Math.max(-284,Math.min(284,x)), y:Math.max(-50,Math.min(50,y)) };
    cameraRef.current=next; setCamera(next);
  };
  const drag = useRef<{id:number;x:number;y:number} | null>(null);
  useEffect(() => { moveCamera((1-activeRoomIdx)*284,0); },[activeRoomIdx,report?.id]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ mode, report, activeRoomIdx, simSpeed, reducedMotion, onRoomAdvance });

  useEffect(() => {
    propsRef.current = { mode, report, activeRoomIdx, simSpeed, reducedMotion, onRoomAdvance };
  }, [mode, report, activeRoomIdx, simSpeed, reducedMotion, onRoomAdvance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Input state: separate continuous held keys from edge-triggered justPressed
    const heldKeys = new Set<string>();
    const justPressed = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const code = e.code;
      if (!heldKeys.has(code)) {
        justPressed.add(code);
      }
      heldKeys.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const onBlur = () => {
      heldKeys.clear();
      justPressed.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // Pooled particles (120 max, zero GC allocations in loop)
    const POOL_SIZE = 120;
    const particles: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      alpha: 0,
      decay: 1,
      color: '#D97706'
    }));

    const spawnBurst = (x: number, y: number, color: string, count: number, speedSpread: number) => {
      let spawned = 0;
      for (let i = 0; i < POOL_SIZE && spawned < count; i++) {
        if (!particles[i].active) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.3 + Math.random() * 0.7) * speedSpread;
          particles[i].active = true;
          particles[i].x = x;
          particles[i].y = y;
          particles[i].vx = Math.cos(angle) * speed;
          particles[i].vy = Math.sin(angle) * speed - 15;
          particles[i].size = 2 + Math.random() * 4;
          particles[i].alpha = 1;
          particles[i].decay = 0.65 + Math.random() * 0.6;
          particles[i].color = color;
          spawned++;
        }
      }
    };

    // Simulation state inside loop
    let animFrameId = 0;
    let lastTime = performance.now();

    let shakeIntensity = 0;
    let hitstopTimer = 0;
    let hitFlashAlpha = 0;
    let roomPhaseTimer = 0;
    let lastTriggeredRoom = -1;
    let heroSquashX = 1;
    let heroSquashY = 1;

    const resize = () => {
      if (!canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.parentElement.clientWidth * dpr;
      canvas.height = canvas.parentElement.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05) * propsRef.current.simSpeed;

      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 500;
      const { mode: curMode, report: curReport, activeRoomIdx: curRoomIdx, reducedMotion: isReduced } = propsRef.current;

      // Edge-triggered Space action to step room or trigger burst
      if (justPressed.has('Space') && curMode === 'EXPEDITION_LIVE' && curReport) {
        if (propsRef.current.onRoomAdvance) {
          const next = (curRoomIdx + 1) % curReport.rooms.length;
          propsRef.current.onRoomAdvance(next);
        }
      }
      justPressed.clear();

      // Continuous WASD camera inspection offset
      const panSpeed = 140 * dt;
      let {x:camPanX,y:camPanY}=cameraRef.current;
      if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) camPanX -= panSpeed;
      if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) camPanX += panSpeed;
      if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) camPanY -= panSpeed;
      if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) camPanY += panSpeed;
      if (camPanX !== cameraRef.current.x || camPanY !== cameraRef.current.y) moveCamera(camPanX,camPanY);
      camPanX=cameraRef.current.x; camPanY=cameraRef.current.y;

      // Handle brief 30-80ms simulation hitstop on heavy impacts
      if (hitstopTimer > 0) {
        hitstopTimer -= rawDt;
        animFrameId = requestAnimationFrame(loop);
        return;
      }

      roomPhaseTimer += dt;
      if (curRoomIdx !== lastTriggeredRoom) {
        lastTriggeredRoom = curRoomIdx;
        roomPhaseTimer = 0;
        const roomEvt: ExpeditionRoomEvent | undefined = curReport?.rooms[curRoomIdx];
        if (roomEvt && curMode === 'EXPEDITION_LIVE') {
          if (roomEvt.outcome === 'TRAP_TRIGGERED' || roomEvt.outcome === 'REACTION_FAILURE') {
            hitstopTimer = isReduced ? 0 : 0.055; // 55ms hitstop
            shakeIntensity = isReduced ? 0 : roomEvt.outcome === 'REACTION_FAILURE' ? 11 : 7;
            hitFlashAlpha = isReduced ? 0 : 0.28;
            heroSquashX = 1.28;
            heroSquashY = 0.74;
            soundFX.playImpact(roomEvt.outcome === 'REACTION_FAILURE');
            spawnBurst(
              width * 0.52,
              height * 0.54,
              roomEvt.outcome === 'REACTION_FAILURE' ? '#F59E0B' : '#F43F5E',
              28,
              95
            );
          } else if (roomEvt.outcome === 'TRAP_BYPASSED' || roomEvt.outcome === 'COUNTER_SUCCEEDED') {
            heroSquashX = 0.86;
            heroSquashY = 1.18;
            soundFX.playBrew();
            spawnBurst(width * 0.52, height * 0.52, '#10B981', 22, 75);
          }
        }
      }

      // Decay squash & shake
      heroSquashX += (1 - heroSquashX) * Math.min(1, dt * 8);
      heroSquashY += (1 - heroSquashY) * Math.min(1, dt * 8);
      shakeIntensity *= Math.pow(0.04, dt);
      hitFlashAlpha = Math.max(0, hitFlashAlpha - dt * 1.8);

      const shakeX = isReduced ? 0 : (Math.random() - 0.5) * 2 * shakeIntensity;
      const shakeY = isReduced ? 0 : (Math.random() - 0.5) * 2 * shakeIntensity;

      // Clear deep obsidian background
      ctx.fillStyle = '#0B0E14';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(camPanX + shakeX, camPanY + shakeY);

      // Subtle architectural subterranean masonry grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      const gridStep = 48;
      const slowPan = curMode === 'TITLE_BACKDROP' && !isReduced ? (now * 0.012) % gridStep : 0;
      for (let gx = -gridStep; gx < width + gridStep; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx - slowPan, 0);
        ctx.lineTo(gx - slowPan, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      if (curMode === 'TITLE_BACKDROP') {
        // Atmospheric Title Screen Live World Cutaway: Twin alchemical condensers + subterranean dungeon corridor
        const cy = height * 0.55;
        ctx.fillStyle = '#111622';
        ctx.fillRect(0, cy + 40, width, height - cy);
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, cy + 40);
        ctx.lineTo(width, cy + 40);
        ctx.stroke();

        // Ambient floating alchemical & sulphur motes
        if (Math.random() < 0.35 && !isReduced) {
          spawnBurst(
            width * (0.2 + Math.random() * 0.6),
            cy + 20,
            Math.random() > 0.5 ? '#D97706' : '#10B981',
            1,
            24
          );
        }
      } else if (curReport) {
        // Render 3-Room Dungeon Cross-Section
        const floorY = height * 0.68;
        const roomW = 260;
        const startX = (width - roomW * 3 - 48) / 2;

        // Corridor floor
        ctx.fillStyle = '#131926';
        ctx.fillRect(startX - 24, floorY, roomW * 3 + 96, 18);

        curReport.rooms.forEach((rm, idx) => {
          const rx = startX + idx * (roomW + 24);
          const ry = floorY - 170;
          const isCurrent = idx === curRoomIdx;

          // Room chamber frame
          ctx.fillStyle = isCurrent ? '#161F30' : '#0F1420';
          ctx.strokeStyle = isCurrent
            ? rm.outcome === 'REACTION_FAILURE'
              ? '#F59E0B'
              : rm.outcome === 'TRAP_TRIGGERED'
              ? '#F43F5E'
              : '#10B981'
            : 'rgba(148, 163, 184, 0.16)';
          ctx.lineWidth = isCurrent ? 2 : 1;
          ctx.beginPath();
          ctx.roundRect(rx, ry, roomW, 170, 8);
          ctx.fill();
          ctx.stroke();

          // Sulphur Fog visual haze inside room if present
          if (rm.chemicalReaction?.includes('Sulphur') || rm.hazardName.includes('Sulphur')) {
            const pulse = isReduced ? 0.16 : 0.14 + Math.sin(now * 0.004 + idx) * 0.05;
            ctx.fillStyle = `rgba(234, 179, 8, ${pulse})`;
            ctx.fillRect(rx + 6, ry + 34, roomW - 12, 128);
          }

          // Room Header
          ctx.fillStyle = '#94A3B8';
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.fillText(`ROOM 0${rm.roomIndex} · ${rm.triggerType}`, rx + 12, ry + 22, roomW-24);

          // Pressure Plate / Trigger Telegraph on Floor
          const plateX = rx + roomW * 0.55;
          const plateDepressed = rm.outcome === 'TRAP_TRIGGERED' || rm.outcome === 'REACTION_FAILURE';
          ctx.fillStyle = plateDepressed ? '#F43F5E' : rm.outcome === 'TRAP_BYPASSED' ? '#10B981' : '#D97706';
          ctx.fillRect(plateX - 24, floorY - (plateDepressed ? 3 : 7), 48, plateDepressed ? 3 : 7);

          // Windup telegraph arc
          if (isCurrent) {
            const windupPct = Math.min(1, roomPhaseTimer / 1.2);
            ctx.strokeStyle = plateDepressed ? 'rgba(244, 63, 94, 0.55)' : 'rgba(16, 185, 129, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(plateX, floorY - 48, 26, -Math.PI * 0.8, -Math.PI * 0.8 + Math.PI * 1.6 * windupPct);
            ctx.stroke();
          }

          // Hazard mechanism icon/silhouette
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
          const shortHazard = rm.hazardName.length > 26 ? rm.hazardName.slice(0, 25) + '…' : rm.hazardName;
          ctx.fillText(shortHazard, rx + 12, ry + 46);

          // Mass readout vs Threshold
          if (rm.triggerMassThresholdKg > 0) {
            ctx.fillStyle = rm.heroEffectiveMassKg < rm.triggerMassThresholdKg ? '#34D399' : '#FBBF24';
            ctx.font = '500 11px "JetBrains Mono", monospace';
            ctx.fillText(
              `Hero ${rm.heroEffectiveMassKg}kg vs Plate ${rm.triggerMassThresholdKg}kg`,
              rx + 12,
              ry + 66
            );
          }

          // Hero Squad Avatar with Squash-and-Stretch & Chicken-Morph visual indicator
          const isChickenMorphed = rm.heroEffectiveMassKg <= 30;
          const hx = rx + roomW * 0.28;
          const hy = floorY - 8;

          ctx.save();
          ctx.translate(hx, hy);
          ctx.scale(isCurrent ? heroSquashX : 1, isCurrent ? heroSquashY : 1);

          if (isChickenMorphed) {
            // Draw nimble Featherweight / Bantam Rooster silhouette
            ctx.fillStyle = '#FDE68A';
            ctx.beginPath();
            ctx.arc(0, -14, 11, 0, Math.PI * 2);
            ctx.fill();
            // Red comb
            ctx.fillStyle = '#F43F5E';
            ctx.fillRect(-3, -29, 6, 5);
            // Beak
            ctx.fillStyle = '#D97706';
            ctx.beginPath();
            ctx.moveTo(10, -16);
            ctx.lineTo(17, -13);
            ctx.lineTo(10, -10);
            ctx.fill();
          } else {
            // Armored Hero Vanguard silhouette
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.roundRect(-12, -38, 24, 34, 5);
            ctx.fill();
            // Shield
            ctx.fillStyle = '#94A3B8';
            ctx.fillRect(6, -32, 9, 22);
          }
          ctx.restore();

          // Outcome label inside room bottom
          const badgeColor =
            rm.outcome === 'TRAP_BYPASSED' || rm.outcome === 'COUNTER_SUCCEEDED'
              ? '#10B981'
              : rm.outcome === 'REACTION_FAILURE'
              ? '#F59E0B'
              : '#F43F5E';
          ctx.fillStyle = badgeColor;
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.fillText(
            `${rm.outcome.replace('_', ' ')} · -${rm.damageDealt}HP · +${rm.lootSecured}g`,
            rx + 12,
            ry + 154
          );
        });
      }

      // Update & draw pooled particles
      for (let i = 0; i < POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 38 * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          p.active = false;
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Hit flash overlay
      if (hitFlashAlpha > 0) {
        ctx.fillStyle = `rgba(245, 158, 11, ${hitFlashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0B0E14]">
      <canvas
        aria-label="Dungeon expedition camera. Drag to pan; arrow keys or WASD also pan."
        tabIndex={mode === 'EXPEDITION_LIVE' ? 0 : -1}
        data-camera-x={camera.x.toFixed(2)} data-camera-y={camera.y.toFixed(2)}
        onPointerDown={e => { if (mode !== 'EXPEDITION_LIVE') return; e.currentTarget.setPointerCapture(e.pointerId); drag.current={id:e.pointerId,x:e.clientX,y:e.clientY}; }}
        onPointerMove={e => { const d=drag.current; if (!d || d.id!==e.pointerId) return;
          moveCamera(cameraRef.current.x+e.clientX-d.x,cameraRef.current.y+e.clientY-d.y);
          drag.current={id:e.pointerId,x:e.clientX,y:e.clientY}; }}
        onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }}
        onLostPointerCapture={() => { drag.current=null; }}
        ref={canvasRef}
        className="block w-full h-full max-w-full"
        style={{ touchAction: mode === 'EXPEDITION_LIVE' ? 'none' : 'pan-y' }}
      />
    </div>
  );
});
