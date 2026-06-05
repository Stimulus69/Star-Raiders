export const SHIPS = [
  { index: 0, assetId: 'ship_1', name: 'Scout', price: 0, damage: 15, fireRate: 1.5, speed: 200, maxHp: 100, trailColor: '0, 220, 255', trailSize: 4 },
  { index: 1, assetId: 'ship_2', name: 'Fighter', price: 500, damage: 35, fireRate: 2.0, speed: 210, maxHp: 250, trailColor: '255, 100, 0', trailSize: 5 },
  { index: 2, assetId: 'ship_3', name: 'Cruiser', price: 1500, damage: 70, fireRate: 2.2, speed: 180, maxHp: 600, trailColor: '255, 0, 50', trailSize: 6 },
  { index: 3, assetId: 'ship_4', name: 'Strike', price: 5000, damage: 130, fireRate: 2.5, speed: 230, maxHp: 1200, trailColor: '180, 0, 255', trailSize: 5 },
  { index: 4, assetId: 'ship_5', name: 'Bomber', price: 10000, damage: 300, fireRate: 1.8, speed: 160, maxHp: 3000, trailColor: '0, 255, 100', trailSize: 7 },
  { index: 5, assetId: 'ship_6', name: 'Frigate', price: 20000, damage: 450, fireRate: 2.6, speed: 190, maxHp: 6000, trailColor: '255, 200, 0', trailSize: 7 },
  { index: 6, assetId: 'ship_7', name: 'Heavy Frigate', price: 50000, damage: 900, fireRate: 2.8, speed: 180, maxHp: 15000, trailColor: '255, 0, 200', trailSize: 8 },
  { index: 7, assetId: 'ship_8', name: 'Destroyer', price: 75000, damage: 1700, fireRate: 3.0, speed: 170, maxHp: 30000, trailColor: '0, 100, 255', trailSize: 8 },
  { index: 8, assetId: 'ship_9', name: 'Battlecruiser', price: 125000, damage: 3500, fireRate: 3.2, speed: 165, maxHp: 75000, trailColor: '255, 255, 255', trailSize: 9 },
  { index: 9, assetId: 'ship_10', name: 'Titan', price: 250000, damage: 8000, fireRate: 3.5, speed: 150, maxHp: 200000, trailColor: '255, 50, 0', trailSize: 12 },
]

export const AREAS = [
  { index: 0, bgId: 'bg_area1', name: 'Asteroid Field', requiredLevel: 1 },
  { index: 1, bgId: 'bg_area2', name: 'Deep Nebula', requiredLevel: 5 },
  { index: 2, bgId: 'bg_area2', name: 'Abyssal Void', requiredLevel: 15 },
]

export const ENEMIES = [
  { index: 0, assetId: 'alien_1', name: 'Scavenger', hp: 40, speed: 100, damage: 10, xp: 15, credits: 10, size: 40, fireRate: 0.5 },
  { index: 1, assetId: 'alien_2', name: 'Raider', hp: 150, speed: 60, damage: 25, xp: 45, credits: 30, size: 60, fireRate: 1 },
  { index: 2, assetId: 'alien_3', name: 'Interceptor', hp: 1000, speed: 120, damage: 100, xp: 150, credits: 100, size: 50, fireRate: 1.5 },
  { index: 3, assetId: 'alien_4', name: 'Gunship', hp: 5000, speed: 80, damage: 400, xp: 500, credits: 350, size: 80, fireRate: 2 },
  { index: 4, assetId: 'alien_5', name: 'Corruptor', hp: 20000, speed: 140, damage: 1500, xp: 2000, credits: 1200, size: 60, fireRate: 3 },
  { index: 5, assetId: 'alien_6', name: 'Dreadnought', hp: 100000, speed: 90, damage: 5000, xp: 8000, credits: 5000, size: 100, fireRate: 4 },
]

export function getLevelTarget(level: number) {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

export const MAP_WIDTH = 3000
export const MAP_HEIGHT = 3000
