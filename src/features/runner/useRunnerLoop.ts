// src/features/runner/useRunnerLoop.ts — Game loop via useFrameCallback

import { useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';
import {
  type GameDimensions,
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
  checkAABB,
  OBSTACLE_DEFS,
  PICKUP_DEFS,
  OBSTACLE_HITBOX_INSET,
  BOTTLE_HITBOX_INSET_TOP,
  BOTTLE_HITBOX_INSET_SIDE,
  NEAR_MISS_GAP,
  NEAR_MISS_BONUS,
  MAX_COMBO,
  FLYING_OBSTACLE_Y_OFFSET,
  FLYING_OBSTACLE_MIN_SCORE,
  PALETTE_INTERVAL,
  PICKUP_SIZE,
} from './runner-types';

interface ObsData { active: SharedValue<boolean>; x: SharedValue<number>; type: SharedValue<number>; }
interface PkpData { active: SharedValue<boolean>; x: SharedValue<number>; type: SharedValue<number>; y: SharedValue<number>; }

export function useRunnerLoop(dims: GameDimensions) {
  const bottleY = useSharedValue(dims.groundY);
  const jumpVelocity = useSharedValue(0);
  const isJumping = useSharedValue(false);
  const canDoubleJump = useSharedValue(false);
  const isDoubleJumping = useSharedValue(false);
  const landingTrigger = useSharedValue(0);

  const gameState = useSharedValue('idle');
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

  const obs = useMemo<ObsData[]>(() => Array.from({length:OBSTACLE_POOL_SIZE},(_,i)=>({active:obsActive[i],x:obsX[i],type:obsType[i]})), []);
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
  const lastCollectedDiscount = useSharedValue(0);

  const airCombo = useSharedValue(0);
  const nearMissTrigger = useSharedValue(0);
  const popupTrigger = useSharedValue(0);
  const popupBonus = useSharedValue(0);

  const resetGame = useCallback(() => {
    gameState.value = 'idle';
    bottleY.value = dims.groundY;
    jumpVelocity.value = 0;
    isJumping.value = false;
    canDoubleJump.value = false;
    isDoubleJumping.value = false;
    score.value = 0;
    speed.value = BASE_SPEED;
    spawnAccumulator.value = 0;
    nextSpawnDistance.value = 400;
    pickupSpawnAccumulator.value = 0;
    nextPickupDistance.value = 700;
    deathTimer.value = 0;
    lastCollectedDiscount.value = 0;
    airCombo.value = 0;
    nearMissTrigger.value = 0;

    for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) { obsActive[i].value = false; obsX[i].value = dims.width + 100; obsType[i].value = 0; nearMissState[i].value = 0; }
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
      if (state === 'dying') {
        speed.value = currentSpeed * 0.25;
      } else {
        speed.value = currentSpeed;
      }

      if (state === 'playing') { score.value += currentSpeed * dt * 0.01; }

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
        }
      }

      const scrollDist = speed.value * dt;
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
          const obsRealW = def.width - OBSTACLE_HITBOX_INSET * 2;
          const groundObsY = dims.groundY - def.height;
          const airborneObsY = dims.groundY - FLYING_OBSTACLE_Y_OFFSET;
          const obsY = def.airborne ? airborneObsY : groundObsY;
          const obsH = def.airborne ? def.height - OBSTACLE_HITBOX_INSET : def.height;
          if (checkAABB(bx, by, bw, bh, obsX[i].value + OBSTACLE_HITBOX_INSET, obsY, obsRealW, obsH)) {
            gameState.value = 'dying';
            deathTimer.value = 0;
            speed.value = currentSpeed * 0.25;
            break;
          }

          const obsCenter = obsX[i].value + def.width / 2;
          const bottleLeft = dims.bottleX;
          const obsTop = def.airborne ? dims.groundY - FLYING_OBSTACLE_Y_OFFSET : dims.groundY - def.height;
          const bottleBottom = bottleY.value;

          if (nearMissState[i].value === 0 && obsCenter < bottleLeft && obsCenter > bottleLeft - 40) {
            nearMissState[i].value = 1;
            const nearBottom = bottleBottom < obsTop && bottleBottom > obsTop - NEAR_MISS_GAP;
            const triggers = def.airborne ? nearBottom : (nearBottom && isJumping.value);
            if (triggers) {
              nearMissState[i].value = 2;
              score.value += NEAR_MISS_BONUS;
              nearMissTrigger.value = (nearMissTrigger.value % 999) + 1;
              popupBonus.value = NEAR_MISS_BONUS;
              popupTrigger.value = (popupTrigger.value % 9999) + 1;
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
          if (checkAABB(bx, by, bw, bh, pkpX[i].value, pkpY[i].value, PICKUP_SIZE, PICKUP_SIZE)) {
            const def = PICKUP_DEFS[pkpType[i].value];
            if (def) {
              if (airCombo.value < MAX_COMBO) airCombo.value += 1;
              const comboBonus = airCombo.value > 1 ? def.scoreBonus * airCombo.value : def.scoreBonus;
              score.value += comboBonus;
              lastCollectedDiscount.value = def.discount;
              popupBonus.value = comboBonus;
              popupTrigger.value = (popupTrigger.value % 9999) + 1;
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
          const canFly = score.value > FLYING_OBSTACLE_MIN_SCORE && Math.random() < 0.3;
          const poolLen = OBSTACLE_DEFS.length;
          const typeIdx = canFly ? poolLen - 1 : Math.floor(Math.random() * (poolLen - 1));
          obsType[freeSlot].value = typeIdx;
          obsX[freeSlot].value = dims.width + 50;
          obsActive[freeSlot].value = true;
          nearMissState[freeSlot].value = 0;

          if (Math.random() < getDoubleObstacleChance(score.value)) {
            let s2 = -1;
            for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) { if (i !== freeSlot && !obsActive[i].value) { s2 = i; break; } }
            if (s2 >= 0) {
              const canFly2 = score.value > FLYING_OBSTACLE_MIN_SCORE && Math.random() < 0.3;
              const poolLen2 = OBSTACLE_DEFS.length;
              obsType[s2].value = canFly2 ? poolLen2 - 1 : Math.floor(Math.random() * (poolLen2 - 1));
              obsX[s2].value = obsX[freeSlot].value + OBSTACLE_DEFS[typeIdx].width + 80 + Math.random() * 60;
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
    lastCollectedDiscount,
    airCombo,
    nearMissTrigger,
    popupTrigger,
    popupBonus,
  };
}
