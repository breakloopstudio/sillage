// src/features/runner/useRunnerLoop.ts — Game loop via useFrameCallback

import { useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';
import {
  type GameDimensions,
  type GameStateValue,
  GRAVITY,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  BASE_SPEED,
  MAX_SPEED,
  SPEED_INCREMENT_PER_POINT,
  BOTTLE_WIDTH,
  BOTTLE_HEIGHT,
  OBSTACLE_POOL_SIZE,
  PICKUP_POOL_SIZE,
  getSpawnDistance,
  getPickupSpawnDistance,
  getDoubleObstacleChance,
  pickObstacleType,
  checkAABB,
  OBSTACLE_DEFS,
  PICKUP_DEFS,
  OBSTACLE_HITBOX_INSET,
  BOTTLE_HITBOX_INSET_TOP,
  BOTTLE_HITBOX_INSET_SIDE,
  NEAR_MISS_GAP,
  NEAR_MISS_BONUS,
  MAX_COMBO,
  DROP_START_HEIGHT,
  DROP_TELEGRAPH,
  DROP_FALL_SPEED,
  PALETTE_INTERVAL,
  PICKUP_SIZE,
  POWER_DURATION,
  SLOW_FACTOR,
  MAGNET_RADIUS,
  MAX_LIVES,
  INVULN_DURATION,
  JUMP_BUFFER,
  HIT_STOP_DURATION,
  FEVER_DURATION,
  FEVER_MAX,
  FEVER_GAIN_PICKUP,
  FEVER_GAIN_NEARMISS,
  FEVER_SCORE_MULT,
} from './runner-types';

interface ObsData { active: SharedValue<boolean>; x: SharedValue<number>; type: SharedValue<number>; y: SharedValue<number>; dropAt: SharedValue<number>; }
interface PkpData { active: SharedValue<boolean>; x: SharedValue<number>; type: SharedValue<number>; y: SharedValue<number>; }

export function useRunnerLoop(dims: GameDimensions) {
  const bottleY = useSharedValue(dims.groundY);
  const jumpVelocity = useSharedValue(0);
  const isJumping = useSharedValue(false);
  const canDoubleJump = useSharedValue(false);
  const isDoubleJumping = useSharedValue(false);
  const landingTrigger = useSharedValue(0);

  const gameState = useSharedValue<GameStateValue>('idle');
  const score = useSharedValue(0);
  const speed = useSharedValue(BASE_SPEED);

  const oa0=useSharedValue(false); const ox0=useSharedValue(0); const ot0=useSharedValue(0);
  const oa1=useSharedValue(false); const ox1=useSharedValue(0); const ot1=useSharedValue(0);
  const oa2=useSharedValue(false); const ox2=useSharedValue(0); const ot2=useSharedValue(0);
  const oa3=useSharedValue(false); const ox3=useSharedValue(0); const ot3=useSharedValue(0);
  const oa4=useSharedValue(false); const ox4=useSharedValue(0); const ot4=useSharedValue(0);
  const oa5=useSharedValue(false); const ox5=useSharedValue(0); const ot5=useSharedValue(0);
  const oa6=useSharedValue(false); const ox6=useSharedValue(0); const ot6=useSharedValue(0);
  const oa7=useSharedValue(false); const ox7=useSharedValue(0); const ot7=useSharedValue(0);

  const obsActive: SharedValue<boolean>[] = [oa0,oa1,oa2,oa3,oa4,oa5,oa6,oa7];
  const obsX: SharedValue<number>[] = [ox0,ox1,ox2,ox3,ox4,ox5,ox6,ox7];
  const obsType: SharedValue<number>[] = [ot0,ot1,ot2,ot3,ot4,ot5,ot6,ot7];

  const oy0=useSharedValue(0); const oy1=useSharedValue(0); const oy2=useSharedValue(0); const oy3=useSharedValue(0);
  const oy4=useSharedValue(0); const oy5=useSharedValue(0); const oy6=useSharedValue(0); const oy7=useSharedValue(0);
  const obsY: SharedValue<number>[] = [oy0,oy1,oy2,oy3,oy4,oy5,oy6,oy7];

  const da0=useSharedValue(0); const da1=useSharedValue(0); const da2=useSharedValue(0); const da3=useSharedValue(0);
  const da4=useSharedValue(0); const da5=useSharedValue(0); const da6=useSharedValue(0); const da7=useSharedValue(0);
  const dropAt: SharedValue<number>[] = [da0,da1,da2,da3,da4,da5,da6,da7];

  const nm0=useSharedValue(0); const nm1=useSharedValue(0); const nm2=useSharedValue(0); const nm3=useSharedValue(0);
  const nm4=useSharedValue(0); const nm5=useSharedValue(0); const nm6=useSharedValue(0); const nm7=useSharedValue(0);
  const nearMissState: SharedValue<number>[] = [nm0,nm1,nm2,nm3,nm4,nm5,nm6,nm7];

  const pa0=useSharedValue(false); const px0=useSharedValue(0); const pt0=useSharedValue(0); const py0=useSharedValue(0);
  const pa1=useSharedValue(false); const px1=useSharedValue(0); const pt1=useSharedValue(0); const py1=useSharedValue(0);
  const pa2=useSharedValue(false); const px2=useSharedValue(0); const pt2=useSharedValue(0); const py2=useSharedValue(0);
  const pa3=useSharedValue(false); const px3=useSharedValue(0); const pt3=useSharedValue(0); const py3=useSharedValue(0);

  const pkpActive: SharedValue<boolean>[] = [pa0,pa1,pa2,pa3];
  const pkpX: SharedValue<number>[] = [px0,px1,px2,px3];
  const pkpType: SharedValue<number>[] = [pt0,pt1,pt2,pt3];
  const pkpY: SharedValue<number>[] = [py0,py1,py2,py3];

  const obs = useMemo<ObsData[]>(() => Array.from({length:OBSTACLE_POOL_SIZE},(_,i)=>({active:obsActive[i],x:obsX[i],type:obsType[i],y:obsY[i],dropAt:dropAt[i]})), []);
  const pkp = useMemo<PkpData[]>(() => Array.from({length:PICKUP_POOL_SIZE},(_,i)=>({active:pkpActive[i],x:pkpX[i],type:pkpType[i],y:pkpY[i]})), []);

  const bgOffset = useSharedValue(0);
  const midOffset = useSharedValue(0);
  const groundOffset = useSharedValue(0);
  const speedLineOffset = useSharedValue(0);
  const palettePhase = useSharedValue(0);

  const spawnAccumulator = useSharedValue(0);
  const nextSpawnDistance = useSharedValue(350);
  const pickupSpawnAccumulator = useSharedValue(0);
  const nextPickupDistance = useSharedValue(700);

  const deathTimer = useSharedValue(0);

  const airCombo = useSharedValue(0);
  const nearMissTrigger = useSharedValue(0);
  const popupTrigger = useSharedValue(0);
  const popupBonus = useSharedValue(0);
  const popupCombo = useSharedValue(0);

  const distance = useSharedValue(0);
  const maxCombo = useSharedValue(0);
  const nearMissCount = useSharedValue(0);
  const collectBurstTrigger = useSharedValue(0);

  const gameTime = useSharedValue(0);
  const shieldActive = useSharedValue(false);
  const magnetUntil = useSharedValue(0);
  const doubleUntil = useSharedValue(0);
  const slowUntil = useSharedValue(0);
  const shieldBreakTrigger = useSharedValue(0);
  const lastCollectedPickup = useSharedValue(0);

  // Compteurs de collecte par type (worklet) — précis même si plusieurs pickups sont
  // ramassés la même frame (aimant), contrairement à `lastCollectedPickup` qui coalesce.
  // Source de vérité pour la composition, la mission « Récolte » et la suggestion parfum.
  const pc0 = useSharedValue(0);
  const pc1 = useSharedValue(0);
  const pc2 = useSharedValue(0);
  const pc3 = useSharedValue(0);
  const pickupCounts: SharedValue<number>[] = [pc0, pc1, pc2, pc3];

  const lives = useSharedValue(MAX_LIVES);
  const invulnUntil = useSharedValue(0);
  const crackTrigger = useSharedValue(0);

  // Game-feel : hit-stop (micro-freeze du monde à l'impact) + jump buffer (un tap posé
  // juste avant l'atterrissage déclenche le saut au contact). `lastTapTime` est écrit par
  // le geste (RunnerGame) quand un tap ne peut pas être exécuté immédiatement ;
  // `bufferJumpTrigger` notifie le saut bufferisé pour jouer son + haptique côté JS.
  const hitStopUntil = useSharedValue(0);
  const lastTapTime = useSharedValue(-999);
  const bufferJumpTrigger = useSharedValue(0);

  // Mode Fièvre : jauge 0..FEVER_MAX remplie par les pickups et frôlés ; pleine →
  // `feverUntil` (invincibilité + ×2 + éclats collectables) et la jauge retombe à 0.
  const feverGauge = useSharedValue(0);
  const feverUntil = useSharedValue(0);
  const feverStartTrigger = useSharedValue(0);

  const resetGame = useCallback(() => {
    gameState.value = 'idle';
    bottleY.value = dims.groundY;
    jumpVelocity.value = 0;
    isJumping.value = false;
    canDoubleJump.value = true;
    isDoubleJumping.value = false;
    score.value = 0;
    speed.value = BASE_SPEED;
    spawnAccumulator.value = 0;
    nextSpawnDistance.value = 400;
    pickupSpawnAccumulator.value = 0;
    nextPickupDistance.value = 700;
    deathTimer.value = 0;
    airCombo.value = 0;
    nearMissTrigger.value = 0;
    popupCombo.value = 0;
    distance.value = 0;
    maxCombo.value = 0;
    nearMissCount.value = 0;
    collectBurstTrigger.value = 0;
    gameTime.value = 0;
    shieldActive.value = false;
    magnetUntil.value = 0;
    doubleUntil.value = 0;
    slowUntil.value = 0;
    shieldBreakTrigger.value = 0;
    lastCollectedPickup.value = 0;
    pc0.value = 0;
    pc1.value = 0;
    pc2.value = 0;
    pc3.value = 0;
    lives.value = MAX_LIVES;
    invulnUntil.value = 0;
    crackTrigger.value = 0;
    hitStopUntil.value = 0;
    lastTapTime.value = -999;
    bufferJumpTrigger.value = 0;
    feverGauge.value = 0;
    feverUntil.value = 0;
    feverStartTrigger.value = 0;

    for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) { obsActive[i].value = false; obsX[i].value = dims.width + 100; obsType[i].value = 0; nearMissState[i].value = 0; obsY[i].value = 0; dropAt[i].value = 0; }
    for (let i = 0; i < PICKUP_POOL_SIZE; i++) { pkpActive[i].value = false; pkpX[i].value = 0; pkpType[i].value = 0; pkpY[i].value = 0; }

    bgOffset.value = 0;
    midOffset.value = 0;
    groundOffset.value = 0;
    speedLineOffset.value = 0;
    palettePhase.value = 0;
  }, [dims]);

  const frameCallback = useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    const dt = Math.min((timeSincePreviousFrame ?? 16) / 1000, 0.05);
    if (dt <= 0) return;

    const state = gameState.value;

    if (state === 'playing' || state === 'dying') {
      const currentSpeed = Math.min(BASE_SPEED + score.value * SPEED_INCREMENT_PER_POINT, MAX_SPEED);
      const slowFactor = state === 'playing' && gameTime.value < slowUntil.value ? SLOW_FACTOR : 1;
      if (state === 'dying') {
        speed.value = currentSpeed * 0.25;
      } else {
        speed.value = currentSpeed * slowFactor;
      }

      if (state === 'playing') {
        gameTime.value += dt;
        // Hit-stop : le temps de jeu continue d'avancer (pour sortir du freeze), mais le
        // monde (score, physique, obstacles, pickups) est figé quelques frames à l'impact.
        if (gameTime.value < hitStopUntil.value) return;
        const doubleMult = gameTime.value < doubleUntil.value ? 2 : 1;
        const feverMult = gameTime.value < feverUntil.value ? FEVER_SCORE_MULT : 1;
        score.value += currentSpeed * slowFactor * dt * 0.01 * doubleMult * feverMult;
      }

      if (isJumping.value) {
        bottleY.value += jumpVelocity.value * dt;
        jumpVelocity.value += GRAVITY * dt;
        if (bottleY.value >= dims.groundY) {
          bottleY.value = dims.groundY;
          isJumping.value = false;
          canDoubleJump.value = true;
          isDoubleJumping.value = false;
          airCombo.value = 0;
          landingTrigger.value = landingTrigger.value + 1;
          // Jump buffer : un tap posé dans les JUMP_BUFFER secondes avant l'atterrissage
          // déclenche un saut immédiat au contact (supprime les morts « j'avais tapé ! »).
          if (gameTime.value - lastTapTime.value < JUMP_BUFFER) {
            lastTapTime.value = -999;
            jumpVelocity.value = JUMP_VELOCITY;
            isJumping.value = true;
            bufferJumpTrigger.value = (bufferJumpTrigger.value % 9999) + 1;
          }
        }
      }

      const scrollDist = speed.value * dt;
      if (state === 'playing') { distance.value += scrollDist; }
      bgOffset.value = (bgOffset.value + scrollDist * 0.15) % 1200;
      midOffset.value = (midOffset.value + scrollDist * 0.4) % 1400;
      groundOffset.value = (groundOffset.value + scrollDist) % 80;
      speedLineOffset.value = (speedLineOffset.value + scrollDist * 1.5) % 600;

      if (state === 'playing') {
        palettePhase.value = Math.floor(score.value / PALETTE_INTERVAL);
      }

      const bx = dims.bottleX + BOTTLE_HITBOX_INSET_SIDE;
      const by = bottleY.value - BOTTLE_HEIGHT + BOTTLE_HITBOX_INSET_TOP;
      const bw = BOTTLE_WIDTH - BOTTLE_HITBOX_INSET_SIDE * 2;
      const bh = BOTTLE_HEIGHT - BOTTLE_HITBOX_INSET_TOP;

      for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) {
        if (!obsActive[i].value) { nearMissState[i].value = 0; continue; }
        obsX[i].value -= scrollDist;

        if (state === 'playing') {
          const def = OBSTACLE_DEFS[obsType[i].value];
          // Position verticale réelle (oy) selon le type d'obstacle.
          if (def.falling) {
            // Goutte : immobilisée en haut pendant la télégraphie, puis chute jusqu'au sol.
            if (gameTime.value >= dropAt[i].value && obsY[i].value < dims.groundY - def.height) {
              obsY[i].value = Math.min(dims.groundY - def.height, obsY[i].value + DROP_FALL_SPEED * dt);
            }
          } else {
            obsY[i].value = dims.groundY - def.height;
          }
          const obsRealW = def.width - OBSTACLE_HITBOX_INSET * 2;
          const obsTopY = obsY[i].value;
          const obsH = def.height;
          // La goutte n'est dangereuse qu'une fois quasi au sol (obstacle à sauter).
          const dropSafe = def.falling && obsTopY < dims.groundY - def.height - 2;
          if (!dropSafe && checkAABB(bx, by, bw, bh, obsX[i].value + OBSTACLE_HITBOX_INSET, obsTopY, obsRealW, obsH)) {
            if (gameTime.value < feverUntil.value) {
              // Fièvre : l'éclat se brise en points, aucun dégât.
              obsActive[i].value = false;
              nearMissState[i].value = 0;
              score.value += 15;
              popupBonus.value = 15;
              popupCombo.value = 0;
              popupTrigger.value = (popupTrigger.value % 9999) + 1;
              collectBurstTrigger.value = (collectBurstTrigger.value % 9999) + 1;
              continue;
            }
            if (shieldActive.value) {
              shieldActive.value = false;
              obsActive[i].value = false;
              nearMissState[i].value = 0;
              shieldBreakTrigger.value = (shieldBreakTrigger.value % 9999) + 1;
              continue;
            }
            if (gameTime.value < invulnUntil.value) {
              continue;
            }
            obsActive[i].value = false;
            nearMissState[i].value = 0;
            lives.value -= 1;
            if (lives.value <= 0) {
              lives.value = 0;
              gameState.value = 'dying';
              deathTimer.value = 0;
              speed.value = currentSpeed * 0.25;
              break;
            }
            invulnUntil.value = gameTime.value + INVULN_DURATION;
            crackTrigger.value = (crackTrigger.value % 9999) + 1;
            hitStopUntil.value = gameTime.value + HIT_STOP_DURATION;
            continue;
          }

          const obsCenter = obsX[i].value + def.width / 2;
          const bottleLeft = dims.bottleX;
          const obsTop = obsY[i].value;
          const bottleBottom = bottleY.value;

          if (nearMissState[i].value === 0 && obsCenter < bottleLeft && obsCenter > bottleLeft - 40) {
            nearMissState[i].value = 1;
            const nearBottom = bottleBottom < obsTop && bottleBottom > obsTop - NEAR_MISS_GAP;
            if (nearBottom && isJumping.value) {
              nearMissState[i].value = 2;
              score.value += NEAR_MISS_BONUS;
              nearMissTrigger.value = (nearMissTrigger.value % 999) + 1;
              nearMissCount.value += 1;
              popupBonus.value = NEAR_MISS_BONUS;
              popupCombo.value = 0;
              popupTrigger.value = (popupTrigger.value % 9999) + 1;
              if (gameTime.value >= feverUntil.value) {
                feverGauge.value += FEVER_GAIN_NEARMISS;
                if (feverGauge.value >= FEVER_MAX) {
                  feverGauge.value = 0;
                  feverUntil.value = gameTime.value + FEVER_DURATION;
                  feverStartTrigger.value = (feverStartTrigger.value % 9999) + 1;
                }
              }
            }
          }
        }

        if (obsX[i].value < -100) {
          obsActive[i].value = false;
          nearMissState[i].value = 0;
        }
      }

      for (let i = 0; i < PICKUP_POOL_SIZE; i++) {
        if (!pkpActive[i].value) continue;
        pkpX[i].value -= scrollDist;
        if (state === 'playing') {
          if (gameTime.value < magnetUntil.value) {
            const dx = dims.bottleX - pkpX[i].value;
            const dy = (bottleY.value - BOTTLE_HEIGHT / 2) - pkpY[i].value;
            if (dx * dx + dy * dy < MAGNET_RADIUS * MAGNET_RADIUS) {
              const pull = Math.min(1, dt * 12);
              pkpX[i].value += dx * pull;
              pkpY[i].value += dy * pull;
            }
          }
          if (checkAABB(bx, by, bw, bh, pkpX[i].value, pkpY[i].value, PICKUP_SIZE, PICKUP_SIZE)) {
            const def = PICKUP_DEFS[pkpType[i].value];
            if (def) {
              if (airCombo.value < MAX_COMBO) airCombo.value += 1;
              if (airCombo.value > maxCombo.value) maxCombo.value = airCombo.value;
              const comboBonus = airCombo.value > 1 ? def.scoreBonus * airCombo.value : def.scoreBonus;
              score.value += comboBonus;
              if (def.power === 'magnet') magnetUntil.value = gameTime.value + POWER_DURATION.magnet;
              else if (def.power === 'shield') shieldActive.value = true;
              else if (def.power === 'double') doubleUntil.value = gameTime.value + POWER_DURATION.double;
              else if (def.power === 'slow') slowUntil.value = gameTime.value + POWER_DURATION.slow;
              lastCollectedPickup.value = pkpType[i].value + 1;
              pickupCounts[pkpType[i].value].value += 1;
              popupBonus.value = comboBonus;
              popupCombo.value = airCombo.value;
              popupTrigger.value = (popupTrigger.value % 9999) + 1;
              collectBurstTrigger.value = (collectBurstTrigger.value % 9999) + 1;
              if (gameTime.value >= feverUntil.value) {
                feverGauge.value += FEVER_GAIN_PICKUP;
                if (feverGauge.value >= FEVER_MAX) {
                  feverGauge.value = 0;
                  feverUntil.value = gameTime.value + FEVER_DURATION;
                  feverStartTrigger.value = (feverStartTrigger.value % 9999) + 1;
                }
              }
            }
            pkpActive[i].value = false;
          }
        }
        if (pkpX[i].value < -80) { pkpActive[i].value = false; }
      }

      if (state === 'dying') {
        deathTimer.value += dt;
        if (bottleY.value >= dims.groundY && isJumping.value) { bottleY.value = dims.groundY; isJumping.value = false; }
        if (deathTimer.value > 1.2) { gameState.value = 'gameover'; }
      }
    }

    if (state === 'playing') {
      const scrollDist = speed.value * dt;
      spawnAccumulator.value += scrollDist;
      if (spawnAccumulator.value >= nextSpawnDistance.value) {
        spawnAccumulator.value = 0;
        let freeSlot = -1;
        for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) { if (!obsActive[i].value) { freeSlot = i; break; } }
        if (freeSlot >= 0) {
          const typeIdx = pickObstacleType(score.value);
          const def = OBSTACLE_DEFS[typeIdx];
          const chuteTime = DROP_START_HEIGHT / DROP_FALL_SPEED;
          obsType[freeSlot].value = typeIdx;
          obsX[freeSlot].value = dims.width + 50;
          if (def.falling) {
            // Compensation de la CHUTE seule (pas de la télégraphie) : la flaque tombe à
            // ~screenW+50 (à droite du flacon) tandis que l'ombre reste visible ~0,3 s
            // avant l'impact. Compenser aussi la télégraphie la rendrait hors écran.
            obsX[freeSlot].value = dims.width + 50 + speed.value * chuteTime;
            obsY[freeSlot].value = dims.groundY - DROP_START_HEIGHT;
            dropAt[freeSlot].value = gameTime.value + DROP_TELEGRAPH;
          } else {
            obsY[freeSlot].value = dims.groundY - def.height;
          }
          obsActive[freeSlot].value = true;
          nearMissState[freeSlot].value = 0;

          if (Math.random() < getDoubleObstacleChance(score.value)) {
            let s2 = -1;
            for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) { if (i !== freeSlot && !obsActive[i].value) { s2 = i; break; } }
            if (s2 >= 0) {
              const typeIdx2 = pickObstacleType(score.value);
              const def2 = OBSTACLE_DEFS[typeIdx2];
              // Espacement basé sur la position d'ATTERRISSAGE effective du 1er obstacle
              // (au sol) — évite la double compensation qui éloignait trop deux gouttes.
              const land1 = obsX[freeSlot].value - (def.falling ? speed.value * (DROP_TELEGRAPH + chuteTime) : 0);
              const land2 = land1 + def.width + 120 + Math.random() * 80;
              obsType[s2].value = typeIdx2;
              if (def2.falling) {
                obsX[s2].value = land2 + speed.value * (DROP_TELEGRAPH + chuteTime);
                obsY[s2].value = dims.groundY - DROP_START_HEIGHT;
                dropAt[s2].value = gameTime.value + DROP_TELEGRAPH;
              } else {
                obsX[s2].value = land2;
                obsY[s2].value = dims.groundY - def2.height;
              }
              obsActive[s2].value = true;
              nearMissState[s2].value = 0;
            }
          }
        }
        nextSpawnDistance.value = getSpawnDistance(score.value);
      }

      pickupSpawnAccumulator.value += scrollDist;
      if (pickupSpawnAccumulator.value >= nextPickupDistance.value) {
        pickupSpawnAccumulator.value = 0;
        let freeSlot = -1;
        for (let i = 0; i < PICKUP_POOL_SIZE; i++) { if (!pkpActive[i].value) { freeSlot = i; break; } }
        if (freeSlot >= 0) {
          const typeIdx = Math.floor(Math.random() * PICKUP_DEFS.length);
          const def = PICKUP_DEFS[typeIdx];
          pkpType[freeSlot].value = typeIdx;
          pkpX[freeSlot].value = dims.width + 80;
          let alt = def.altitude;
          if (alt === 'very_high' && score.value < 1200) alt = 'high';
          else if (alt === 'high' && score.value < 600) alt = 'medium';
          let y: number;
          switch (alt) { case 'low': y=dims.groundY-85; break; case 'medium': y=dims.groundY-135; break; case 'high': y=dims.groundY-185; break; case 'very_high': y=dims.groundY-235; break; default: y=dims.groundY-85; }
          pkpY[freeSlot].value = y;
          pkpActive[freeSlot].value = true;
        }
        nextPickupDistance.value = getPickupSpawnDistance(score.value);
      }
    }
  }, false);

  return {
    bottleY, jumpVelocity, isJumping, canDoubleJump, isDoubleJumping, landingTrigger,
    gameState, score, speed,
    obs, pkp,
    bgOffset, midOffset, groundOffset,
    speedLineOffset, palettePhase,
    frameCallback, resetGame,
    lastCollectedPickup,
    airCombo,
    nearMissTrigger,
    popupTrigger,
    popupBonus,
    popupCombo,
    distance,
    maxCombo,
    nearMissCount,
    collectBurstTrigger,
    gameTime,
    shieldActive,
    magnetUntil,
    doubleUntil,
    slowUntil,
    shieldBreakTrigger,
    lives,
    invulnUntil,
    crackTrigger,
    hitStopUntil,
    lastTapTime,
    bufferJumpTrigger,
    feverGauge,
    feverUntil,
    feverStartTrigger,
    pickupCounts,
  };
}
