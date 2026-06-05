import { SpritePlayer } from '@seedleap/loopit-runtime'
import { MAP_WIDTH, MAP_HEIGHT, SHIPS, AREAS, ENEMIES } from './constants'

export class Entity {
  id = Math.random()
  x = 0
  y = 0
  radius = 20
  vx = 0
  vy = 0
  angle = 0
  dead = false
}

export class Projectile extends Entity {
  isPlayer = true
  isFromAlly = false
  damage = 10
  assetId = ''
  targetEntity?: Enemy | 'player'
}

export class Enemy extends Entity {
  typeIndex = 0
  hp = 1
  maxHp = 1
  lastFireTime = 0
  damage = 10
  credits = 0
  xp = 0
  speed = 100
  aggro = false
  wanderAngle = Math.random() * Math.PI * 2
}

export class Particle extends Entity {
  life = 1
  maxLife = 1
  text?: string
  spritePlayer?: SpritePlayer
  size = 40
  color?: string
}

export class Ally extends Entity {
  name = ''
  hasBetaBadge = false
  targetEnemy: Enemy | null = null
  lastFireTime = 0
  speed = 150
  shipIndex = 0
  wanderAngle = Math.random() * Math.PI * 2
}

export class Portal {
  x = 0
  y = 0
  radius = 60
  targetAreaIndex = 0
  reqLevel = 1
}

export class Debris extends Entity {
  assetId = ''
  scale = 1
  rotSpeed = 0
}

export class GameEngine {
  width = 400
  height = 580
  
  playerX = MAP_WIDTH / 2
  playerY = MAP_HEIGHT / 2
  joystickDir = { x: 0, y: 0 }
  playerAngle = -Math.PI / 2
  playerHp = 100
  
  projectiles: Projectile[] = []
  enemies: Enemy[] = []
  particles: Particle[] = []
  portals: Portal[] = []
  debrisList: Debris[] = []
  
  baseX = MAP_WIDTH / 2
  baseY = MAP_HEIGHT / 2
  baseRadius = 250
  isAtBase = true
  onAtBaseChange?: (isAtBase: boolean) => void

  activePortal: Portal | null = null
  onActivePortalChange?: (portal: Portal | null) => void
  
  targetEnemy: Enemy | null = null
  isFiring = false
  
  stars: {x: number, y: number, z: number, r: number, color: string, vx: number, vy: number}[] = []
  allies: Ally[] = []
  
  playerNickname = 'HUNTER_1'
  hasBetaBadge = false
  isRankOne = false
  
  lastPlayerFireTime = 0
  time = 0
  
  // Handlers provided by React layer
  onAddCredits?: (c: number) => void
  onAddXp?: (x: number) => void
  onEnemyKilled?: () => void
  onGameOver?: () => void
  onPortalEnter?: (targetAreaIndex: number, reqLevel: number, fromAreaIndex: number) => void
  playSound?: (id: string) => void
  createSpritePlayer?: () => SpritePlayer | null | undefined
  
  // Up-to-date state from React
  currentShipIndex = 0
  currentAreaIndex = 0
  isHangarOpen = false
  
  reset(shipIndex: number, fromAreaIndex?: number, keepHp = false) {
    const shipDef = SHIPS[shipIndex]
    if (!keepHp) {
      this.playerHp = shipDef.maxHp
    }
    this.joystickDir = { x: 0, y: 0 }
    this.playerAngle = -Math.PI / 2
    this.projectiles = []
    this.enemies = []
    this.particles = []
    this.time = 0
    this.lastPlayerFireTime = 0
    this.targetEnemy = null
    this.isFiring = false
    this.setupPortals()
    this.setupDebris()
    this.setupStars()
    this.setupAllies()
    
    if (fromAreaIndex !== undefined) {
      const portal = this.portals.find(p => p.targetAreaIndex === fromAreaIndex)
      if (portal) {
        this.playerX = portal.x
        this.playerY = portal.y + 100
      } else {
        this.playerX = MAP_WIDTH / 2
        this.playerY = MAP_HEIGHT / 2
      }
    } else {
      this.playerX = MAP_WIDTH / 2
      this.playerY = MAP_HEIGHT / 2
    }

    const distToBase = Math.hypot(this.playerX - this.baseX, this.playerY - this.baseY)
    this.isAtBase = this.currentAreaIndex === 0 && distToBase < this.baseRadius
    this.onAtBaseChange?.(this.isAtBase)
  }
  
  isEntityOnScreen(x: number, y: number, padding = 40): boolean {
    let camX = this.playerX - this.width / 2
    let camY = this.playerY - this.height / 2
    camX = Math.max(0, Math.min(MAP_WIDTH - this.width, camX))
    camY = Math.max(0, Math.min(MAP_HEIGHT - this.height, camY))
    
    return (
      x >= camX - padding &&
      x <= camX + this.width + padding &&
      y >= camY - padding &&
      y <= camY + this.height + padding
    )
  }

  targetNearestEnemy() {
    let nearestE: Enemy | null = null
    let minDist = 800
    for (const e of this.enemies) {
      if (!this.isEntityOnScreen(e.x, e.y)) continue
      const d = Math.hypot(e.x - this.playerX, e.y - this.playerY)
      if (d < minDist) {
        minDist = d
        nearestE = e
      }
    }
    this.targetEnemy = nearestE
  }

  setupPortals() {
    this.portals = []
    if (this.currentAreaIndex === 0) {
      const p = new Portal()
      p.x = 2500
      p.y = 500
      p.targetAreaIndex = 1
      p.reqLevel = AREAS[1].requiredLevel
      this.portals.push(p)
    } else if (this.currentAreaIndex === 1) {
      const p1 = new Portal()
      p1.x = 500
      p1.y = 2500
      p1.targetAreaIndex = 0
      p1.reqLevel = 1
      this.portals.push(p1)
      
      const p2 = new Portal()
      p2.x = 2500
      p2.y = 500
      p2.targetAreaIndex = 2
      p2.reqLevel = AREAS[2].requiredLevel
      this.portals.push(p2)
    } else if (this.currentAreaIndex === 2) {
      const p = new Portal()
      p.x = 500
      p.y = 2500
      p.targetAreaIndex = 1
      p.reqLevel = AREAS[1].requiredLevel
      this.portals.push(p)
    }
  }

  setupStars() {
    let colors = ['#ffffff']
    if (this.currentAreaIndex === 0) {
      colors = ['#ffffff', '#e6f2ff', '#ccddff']
    } else if (this.currentAreaIndex === 1) {
      colors = ['#00ddff', '#ff00aa', '#aa00ff', '#ffffff']
    } else if (this.currentAreaIndex === 2) {
      colors = ['#ff2222', '#880000', '#550055', '#333333', '#ffffff']
    }
    
    const count = this.currentAreaIndex === 2 ? 40 : 80;

    this.stars = Array.from({length: count}).map(() => ({
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.5 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5
    }))
  }

  setupAllies() {
    this.allies = []
  }

  setupDebris() {
    this.debrisList = []
    const count = this.currentAreaIndex === 0 ? 40 : (this.currentAreaIndex === 1 ? 20 : 10)
    const types = ['asteroid_1', 'asteroid_2', 'space_debris']
    
    for (let i = 0; i < count; i++) {
      const d = new Debris()
      d.x = Math.random() * MAP_WIDTH
      d.y = Math.random() * MAP_HEIGHT
      d.vx = (Math.random() - 0.5) * 10
      d.vy = (Math.random() - 0.5) * 10
      d.angle = Math.random() * Math.PI * 2
      d.rotSpeed = (Math.random() - 0.5) * 0.5
      d.scale = 0.5 + Math.random() * 1.5
      
      if (this.currentAreaIndex === 0) {
        d.assetId = types[Math.floor(Math.random() * 2)]
      } else if (this.currentAreaIndex === 1) {
        d.assetId = types[Math.floor(Math.random() * 3)]
      } else {
        d.assetId = Math.random() > 0.3 ? 'space_debris' : 'asteroid_1'
      }
      
      this.debrisList.push(d)
    }
  }

  addTextParticle(text: string, x: number, y: number) {
    const pt = new Particle()
    pt.x = x
    pt.y = y
    pt.text = text
    pt.life = 2
    pt.maxLife = 2
    pt.vy = -20
    this.particles.push(pt)
  }
  
  update(dt: number) {
    if (this.isHangarOpen) return
    
    this.time += dt
    const shipDef = SHIPS[this.currentShipIndex]
    
    const jLen = Math.hypot(this.joystickDir.x, this.joystickDir.y)
    if (jLen > 0.1) {
      this.playerX += this.joystickDir.x * shipDef.speed * dt
      this.playerY += this.joystickDir.y * shipDef.speed * dt
      if (!this.targetEnemy || this.isAtBase) {
        this.playerAngle = Math.atan2(this.joystickDir.y, this.joystickDir.x)
      }
      
      const particleCount = 2
      for (let i = 0; i < particleCount; i++) {
        const trail = new Particle()
        const backX = this.playerX - Math.cos(this.playerAngle) * 25
        const backY = this.playerY - Math.sin(this.playerAngle) * 25
        trail.x = backX + (Math.random() - 0.5) * 10
        trail.y = backY + (Math.random() - 0.5) * 10
        trail.vx = -Math.cos(this.playerAngle) * 100 + (Math.random() - 0.5) * 30
        trail.vy = -Math.sin(this.playerAngle) * 100 + (Math.random() - 0.5) * 30
        trail.life = 0.3 + Math.random() * 0.3
        trail.maxLife = trail.life
        trail.size = shipDef.trailSize + Math.random() * 4
        trail.color = `engine:${shipDef.trailColor}`
        this.particles.push(trail)
      }
    }
    
    this.playerX = Math.max(20, Math.min(MAP_WIDTH - 20, this.playerX))
    this.playerY = Math.max(20, Math.min(MAP_HEIGHT - 20, this.playerY))
    
    if (this.currentAreaIndex === 0) {
      const distToBase = Math.hypot(this.playerX - this.baseX, this.playerY - this.baseY)
      const currentlyAtBase = distToBase < this.baseRadius
      if (currentlyAtBase !== this.isAtBase) {
        this.isAtBase = currentlyAtBase
        this.onAtBaseChange?.(currentlyAtBase)
        if (currentlyAtBase) {
          this.targetEnemy = null
        }
      }
      if (this.isAtBase && this.playerHp < shipDef.maxHp) {
        this.playerHp = Math.min(shipDef.maxHp, this.playerHp + 50 * dt)
      }
    } else {
      if (this.isAtBase) {
        this.isAtBase = false
        this.onAtBaseChange?.(false)
      }
    }

    let nearbyPortal: Portal | null = null
    for (const p of this.portals) {
      if (Math.hypot(p.x - this.playerX, p.y - this.playerY) < p.radius + 100) {
        nearbyPortal = p
        break
      }
    }
    if (nearbyPortal !== this.activePortal) {
      this.activePortal = nearbyPortal
      this.onActivePortalChange?.(nearbyPortal)
    }

    if (this.isFiring && !this.targetEnemy && !this.isAtBase) {
      this.targetNearestEnemy()
    }

    if (!this.isAtBase) {
      if (this.targetEnemy) {
        const edist = Math.hypot(this.targetEnemy.x - this.playerX, this.targetEnemy.y - this.playerY)
        if (this.targetEnemy.dead || edist > 800 || !this.isEntityOnScreen(this.targetEnemy.x, this.targetEnemy.y)) {
          this.targetEnemy = null
        } else {
          this.playerAngle = Math.atan2(this.targetEnemy.y - this.playerY, this.targetEnemy.x - this.playerX)
        }
      }

      if (this.isFiring || this.targetEnemy) {
        if (this.time - this.lastPlayerFireTime > 1 / shipDef.fireRate) {
          this.lastPlayerFireTime = this.time
          const fireAngle = this.playerAngle
          const p = new Projectile()
          p.x = this.playerX
          p.y = this.playerY
          p.vx = Math.cos(fireAngle) * 600
          p.vy = Math.sin(fireAngle) * 600
          p.angle = fireAngle
          p.isPlayer = true
          p.damage = shipDef.damage
          p.assetId = 'laser_player'
          p.radius = 10
          p.targetEntity = this.targetEnemy || undefined
          this.projectiles.push(p)
          this.playSound?.('sfx_shoot')
        }
      }
    }
    
    const maxEnemies = this.currentAreaIndex === 0 ? 50 : 80
    if (this.enemies.length < maxEnemies) {
      const ex = Math.random() * MAP_WIDTH
      const ey = Math.random() * MAP_HEIGHT
      
      const distToPlayer = Math.hypot(ex - this.playerX, ey - this.playerY)
      const distToBase = Math.hypot(ex - this.baseX, ey - this.baseY)
      
      const isValidSpawn = distToPlayer > 400 && (this.currentAreaIndex !== 0 || distToBase > this.baseRadius + 200)
      
      if (isValidSpawn) {
        let eDef
        if (this.currentAreaIndex === 0) {
          eDef = ENEMIES[Math.random() < 0.8 ? 0 : 1]
        } else if (this.currentAreaIndex === 1) {
          eDef = ENEMIES[Math.random() < 0.7 ? 2 : 3]
        } else {
          eDef = ENEMIES[Math.random() < 0.6 ? 4 : 5]
        }
        
        const e = new Enemy()
        e.x = ex
        e.y = ey
        e.typeIndex = eDef.index
        e.hp = eDef.hp
        e.maxHp = eDef.hp
        e.radius = eDef.size / 2
        e.speed = eDef.speed
        e.damage = eDef.damage
        e.credits = eDef.credits
        e.xp = eDef.xp
        e.lastFireTime = this.time
        e.wanderAngle = Math.atan2(this.playerY - ey, this.playerX - ex)
        this.enemies.push(e)
      }
    }
    
    for (const e of this.enemies) {
      if (this.isAtBase) e.aggro = false
      
      const edx = this.playerX - e.x
      const edy = this.playerY - e.y
      const edist = Math.hypot(edx, edy)
      
      if (this.currentAreaIndex === 0) {
        const edistBase = Math.hypot(e.x - this.baseX, e.y - this.baseY)
        if (edistBase < this.baseRadius + e.radius) {
          const angle = Math.atan2(e.y - this.baseY, e.x - this.baseX)
          e.x = this.baseX + Math.cos(angle) * (this.baseRadius + e.radius)
          e.y = this.baseY + Math.sin(angle) * (this.baseRadius + e.radius)
          e.aggro = false
          if (this.targetEnemy === e) this.targetEnemy = null
        }
      }
      
      if (e.aggro) {
        e.angle = Math.atan2(edy, edx)
        if (edist > e.radius + 30) {
          e.x += Math.cos(e.angle) * e.speed * dt
          e.y += Math.sin(e.angle) * e.speed * dt
        }
        
        const eDef = ENEMIES[e.typeIndex]
        if (this.time - e.lastFireTime > 1 / eDef.fireRate && edist < 400 && this.isEntityOnScreen(e.x, e.y)) {
          e.lastFireTime = this.time
          const p = new Projectile()
          p.x = e.x
          p.y = e.y
          p.vx = Math.cos(e.angle) * 400
          p.vy = Math.sin(e.angle) * 400
          p.angle = e.angle
          p.isPlayer = false
          p.damage = e.damage
          p.assetId = 'laser_alien'
          p.radius = 10
          p.targetEntity = 'player'
          this.projectiles.push(p)
        }
      } else {
        if (Math.random() < 0.5 * dt) {
          e.wanderAngle += (Math.random() - 0.5) * 2
        }
        e.angle = e.wanderAngle
        e.x += Math.cos(e.angle) * (e.speed * 0.3) * dt
        e.y += Math.sin(e.angle) * (e.speed * 0.3) * dt
        
        if (e.x < 50 || e.x > MAP_WIDTH - 50 || e.y < 50 || e.y > MAP_HEIGHT - 50) {
          e.wanderAngle += Math.PI
          e.x = Math.max(50, Math.min(MAP_WIDTH - 50, e.x))
          e.y = Math.max(50, Math.min(MAP_HEIGHT - 50, e.y))
        }
      }
    }
    
    for (const p of this.projectiles) {
      if (p.targetEntity === 'player') {
        p.angle = Math.atan2(this.playerY - p.y, this.playerX - p.x)
        p.vx = Math.cos(p.angle) * 400
        p.vy = Math.sin(p.angle) * 400
      } else if (p.targetEntity && !p.targetEntity.dead) {
        p.angle = Math.atan2(p.targetEntity.y - p.y, p.targetEntity.x - p.x)
        p.vx = Math.cos(p.angle) * 600
        p.vy = Math.sin(p.angle) * 600
      }
      
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.x < -100 || p.x > MAP_WIDTH + 100 || p.y < -100 || p.y > MAP_HEIGHT + 100) p.dead = true
      
      if (this.currentAreaIndex === 0 && !p.isPlayer && !p.dead) {
        if (Math.hypot(p.x - this.baseX, p.y - this.baseY) < this.baseRadius) {
          p.dead = true
        }
      }
    }
    
    for (const p of this.projectiles) {
      if (p.dead) continue
      if (p.isPlayer) {
        for (const e of this.enemies) {
          if (e.dead) continue
          const dist = Math.hypot(p.x - e.x, p.y - e.y)
          if (dist < p.radius + e.radius) {
            p.dead = true
            e.hp -= p.damage
            e.aggro = true
            if (e.hp <= 0) {
              e.dead = true
              if (this.targetEnemy === e) this.targetEnemy = null
              this.onEnemyDeath(e, !p.isFromAlly)
            }
            break
          }
        }
      } else {
        const dist = Math.hypot(p.x - this.playerX, p.y - this.playerY)
        if (dist < p.radius + 20) {
          p.dead = true
          this.playerHp -= p.damage
          if (this.playerHp <= 0) this.onGameOver?.()
        }
      }
    }
    
    for (const a of this.allies) {
      if (!a.targetEnemy || a.targetEnemy.dead) {
        let nearestE: Enemy | null = null
        let minDist = 500
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - a.x, e.y - a.y)
          if (d < minDist) {
            minDist = d
            nearestE = e
          }
        }
        a.targetEnemy = nearestE
      }
      
      if (a.targetEnemy) {
        a.angle = Math.atan2(a.targetEnemy.y - a.y, a.targetEnemy.x - a.x)
        const adist = Math.hypot(a.targetEnemy.x - a.x, a.targetEnemy.y - a.y)
        if (adist > 150) {
          a.x += Math.cos(a.angle) * a.speed * dt
          a.y += Math.sin(a.angle) * a.speed * dt
        }
        
        if (this.time - a.lastFireTime > 1.2 && this.isEntityOnScreen(a.x, a.y)) {
          a.lastFireTime = this.time
          const p = new Projectile()
          p.x = a.x
          p.y = a.y
          p.vx = Math.cos(a.angle) * 500
          p.vy = Math.sin(a.angle) * 500
          p.angle = a.angle
          p.isPlayer = true
          p.isFromAlly = true
          p.damage = 15
          p.assetId = 'laser_player'
          p.radius = 8
          this.projectiles.push(p)
        }
      } else {
        if (Math.random() < 0.5 * dt) {
          a.wanderAngle += (Math.random() - 0.5) * 2
        }
        a.angle = a.wanderAngle
        a.x += Math.cos(a.angle) * (a.speed * 0.4) * dt
        a.y += Math.sin(a.angle) * (a.speed * 0.4) * dt
        
        if (a.x < 100 || a.x > MAP_WIDTH - 100 || a.y < 100 || a.y > MAP_HEIGHT - 100) {
          a.wanderAngle += Math.PI
          a.x = Math.max(100, Math.min(MAP_WIDTH - 100, a.x))
          a.y = Math.max(100, Math.min(MAP_HEIGHT - 100, a.y))
        }
      }
    }
    
    for (const pt of this.particles) {
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.life -= dt
      if (pt.life <= 0) pt.dead = true
    }
    
    for (const star of this.stars) {
      star.x += star.vx * dt
      star.y += star.vy * dt
      if (star.x < 0) star.x += 2000
      if (star.x > 2000) star.x -= 2000
      if (star.y < 0) star.y += 2000
      if (star.y > 2000) star.y -= 2000
    }
    
    for (const d of this.debrisList) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.angle += d.rotSpeed * dt
      
      if (d.x < -100) d.x += MAP_WIDTH + 200
      if (d.x > MAP_WIDTH + 100) d.x -= MAP_WIDTH + 200
      if (d.y < -100) d.y += MAP_HEIGHT + 200
      if (d.y > MAP_HEIGHT + 100) d.y -= MAP_HEIGHT + 200
    }
    
    this.projectiles = this.projectiles.filter(p => !p.dead)
    this.enemies = this.enemies.filter(e => !e.dead)
    this.particles = this.particles.filter(p => !p.dead)
  }
  
  onEnemyDeath(e: Enemy, killedByPlayer = true) {
    this.playSound?.('sfx_explosion')
    this.playSound?.('sfx_coin')
    this.onAddCredits?.(e.credits)
    this.onAddXp?.(e.xp)
    if (killedByPlayer) {
      this.onEnemyKilled?.()
    }
    
    const pt = new Particle()
    pt.x = e.x
    pt.y = e.y
    pt.life = 0.5
    pt.maxLife = 0.5
    pt.size = e.radius * 3
    const sp = this.createSpritePlayer?.()
    if (sp) {
      sp.play()
      pt.spritePlayer = sp
    }
    this.particles.push(pt)
    
    this.addTextParticle(`+${e.credits}`, e.x, e.y - 20)
  }
}
