import { useRef, useEffect, useState } from 'react'
import { useGameRuntime, useCanvasGameLoop, useAssets } from '@seedleap/loopit-runtime'
import { useSocialGameStateQuery, useSocialSetGameStateMutation } from '@seedleap/loopit-runtime/social'
import { GameEngine, Portal } from './gameEngine'
import { MAP_WIDTH, MAP_HEIGHT, SHIPS, AREAS, ENEMIES } from './constants'

export function Game({ 
  engine, 
  onHangarToggle,
  credits,
  level,
  xp,
  xpTarget,
  globalKills = 0,
  social
}: { 
  engine: GameEngine, 
  onHangarToggle: () => void,
  credits: number,
  level: number,
  xp: number,
  xpTarget: number,
  globalKills?: number,
  social?: any
}) {
  const { maxPixelRatio, width, height } = useGameRuntime()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { assets } = useAssets()
  const [isAtBase, setIsAtBase] = useState(engine.isAtBase)
  const [activePortal, setActivePortal] = useState<Portal | null>(engine.activePortal)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')

  const chatMessagesQuery = useSocialGameStateQuery(social, {
    game_key: 'void_hunters_global_chat',
    query_type: 'global',
    limit: 30
  }, {
    enabled: social?.isReady && isChatOpen,
    refetchInterval: isChatOpen ? 3000 : false
  })

  const ownChatQuery = useSocialGameStateQuery(social, {
    game_key: 'void_hunters_global_chat',
    query_type: 'own'
  }, {
    enabled: social?.isReady && isChatOpen,
    refetchInterval: isChatOpen ? 3000 : false
  })

  const sendChatMessageMutation = useSocialSetGameStateMutation(social)

  const handleSendMessage = () => {
    if (!chatInput.trim() || !social?.isReady) return
    const ownItem = ownChatQuery.data?.[0]
    const existingMessages = (ownItem?.value as any)?.messages || []
    
    const newMsg = {
      id: Math.random().toString(),
      text: chatInput.trim(),
      time: Date.now(),
      hasBetaBadge: engine.hasBetaBadge,
      isRankOne: engine.isRankOne
    }
    
    const updatedMessages = [...existingMessages, newMsg].slice(-15)

    sendChatMessageMutation.mutate({
      key: 'void_hunters_global_chat',
      value: JSON.stringify({ messages: updatedMessages }),
      scope: 'public',
      skip_audit: false
    }, {
      onSuccess: () => {
        setChatInput('')
        chatMessagesQuery.refetch()
        ownChatQuery.refetch()
      }
    })
  }

  const chatScrollRef = useRef<HTMLDivElement>(null)

  const mergedLength = (() => {
    let len = 0
    const ownMessages = (ownChatQuery.data?.[0]?.value as any)?.messages
    if (ownMessages) {
      len += ownMessages.length
    }
    if (chatMessagesQuery.data) {
      chatMessagesQuery.data.forEach((item) => {
        const otherMsgs = (item?.value as any)?.messages
        if (otherMsgs) {
          len += otherMsgs.length
        }
      })
    }
    return len
  })()

  useEffect(() => {
    if (isChatOpen && chatScrollRef.current) {
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTo({
            top: chatScrollRef.current.scrollHeight,
            behavior: 'smooth'
          })
        }
      }, 60)
    }
  }, [mergedLength, isChatOpen])

  useEffect(() => {
    engine.onAtBaseChange = setIsAtBase
    engine.onActivePortalChange = setActivePortal
    setIsAtBase(engine.isAtBase)
    setActivePortal(engine.activePortal)
  }, [engine])

  useEffect(() => {
    engine.width = width
    engine.height = height
  }, [width, height, engine])

  useCanvasGameLoop({
    canvasRef,
    update: (dtSeconds) => engine.update(dtSeconds),
    draw: (ctx, frame) => {
      const w = frame.logicalWidth
      const h = frame.logicalHeight
      
      // Calculate Camera
      let camX = engine.playerX - w / 2
      let camY = engine.playerY - h / 2
      camX = Math.max(0, Math.min(MAP_WIDTH - w, camX))
      camY = Math.max(0, Math.min(MAP_HEIGHT - h, camY))
      
      // 1. Draw Background
      ctx.fillStyle = '#050510'
      ctx.fillRect(0, 0, w, h)

      const playerShipInfo = SHIPS[engine.currentShipIndex]
      const playerSpeed = Math.hypot(engine.joystickDir.x, engine.joystickDir.y) * playerShipInfo.speed
      
      for (const star of engine.stars) {
        let sx = (star.x - camX * star.z) % w
        if (sx < 0) sx += w
        let sy = (star.y - camY * star.z) % h
        if (sy < 0) sy += h
        
        if (playerSpeed > 5) {
          ctx.strokeStyle = star.color
          ctx.lineWidth = star.r * 1.5
          ctx.lineCap = 'round'
          ctx.globalAlpha = 0.7
          
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          const stretchLen = (playerSpeed / 18) * star.z
          ctx.lineTo(sx - engine.joystickDir.x * stretchLen, sy - engine.joystickDir.y * stretchLen)
          ctx.stroke()
          
          ctx.globalAlpha = 1.0
          ctx.lineCap = 'butt'
        } else {
          ctx.fillStyle = star.color
          ctx.beginPath()
          ctx.arc(sx, sy, star.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const areaDef = AREAS[engine.currentAreaIndex]
      const bgImg = assets?.image?.[areaDef.bgId]
      if (bgImg) {
        ctx.save()
        ctx.globalAlpha = 0.4
        ctx.globalCompositeOperation = 'screen'
        const px = camX * 0.1
        const py = camY * 0.1
        ctx.drawImage(bgImg, -px, -py, MAP_WIDTH * 1.2, MAP_HEIGHT * 1.2)
        ctx.restore()
      }
      
      if (engine.currentAreaIndex === 0) {
        const planetImg = assets?.image?.planet_1
        if (planetImg) {
          ctx.save()
          const parallax = 0.05
          const planetWorldX = MAP_WIDTH * 0.8
          const planetWorldY = MAP_HEIGHT * 0.2
          
          const screenX = (planetWorldX - camX) * parallax + w * 0.5 * (1 - parallax)
          const screenY = (planetWorldY - camY) * parallax + h * 0.5 * (1 - parallax)
          
          ctx.translate(screenX, screenY)
          ctx.rotate(engine.time * 0.01)
          ctx.globalAlpha = 0.6
          
          const size = 300
          ctx.drawImage(planetImg, -size / 2, -size / 2, size, size)
          ctx.restore()
        }
      }
      
      // 2. Apply Camera Transform for World Entities
      ctx.save()
      ctx.translate(-camX, -camY)
      
      // Space Debris & Asteroids
      for (const d of engine.debrisList) {
        const dImg = assets?.image?.[d.assetId]
        if (dImg) {
          ctx.save()
          ctx.translate(d.x, d.y)
          ctx.rotate(d.angle)
          const size = 60 * d.scale
          ctx.drawImage(dImg, -size / 2, -size / 2, size, size)
          ctx.restore()
        }
      }
      
      // Home Base
      if (engine.currentAreaIndex === 0) {
        ctx.save()
        ctx.translate(engine.baseX, engine.baseY)
        
        const stationImg = assets?.image?.base_station
        if (stationImg) {
          ctx.save()
          ctx.rotate(engine.time * 0.05)
          ctx.drawImage(stationImg, -200, -200, 400, 400)
          
          // Realistic Warning lights
          const t = engine.time % 2
          const isStrobe = (t > 0 && t < 0.05) || (t > 0.15 && t < 0.2)
          
          const numStrobes = 4
          for (let i = 0; i < numStrobes; i++) {
            const angle = (i / numStrobes) * Math.PI * 2
            const r = 180 
            const lx = Math.cos(angle) * r
            const ly = Math.sin(angle) * r
            
            ctx.save()
            ctx.translate(lx, ly)
            ctx.fillStyle = `rgba(255, 255, 255, 0.4)`
            ctx.beginPath()
            ctx.arc(0, 0, 2, 0, Math.PI * 2)
            ctx.fill()
            
            if (isStrobe) {
               ctx.fillStyle = `rgba(255, 255, 255, 0.9)`
               ctx.beginPath()
               ctx.arc(0, 0, 6, 0, Math.PI * 2)
               ctx.fill()
            }
            ctx.restore()
          }
          
          const numWindows = 12
          for (let i = 0; i < numWindows; i++) {
            const angle = (i / numWindows) * Math.PI * 2
            const r = 80
            const lx = Math.cos(angle) * r
            const ly = Math.sin(angle) * r
            
            ctx.save()
            ctx.translate(lx, ly)
            ctx.fillStyle = `rgba(255, 220, 100, 0.8)`
            ctx.beginPath()
            ctx.arc(0, 0, 1.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          ctx.restore()
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('HOME BASE', 0, engine.baseRadius + 20)
        ctx.restore()
      }
      
      // Map Bounds
      ctx.strokeStyle = 'rgba(255,0,0,0.3)'
      ctx.lineWidth = 10
      ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
      
      // Portals
      for (const p of engine.portals) {
        ctx.save()
        ctx.translate(p.x, p.y)
        
        const portalImg = assets?.image?.portal_structure
        if (portalImg) {
          ctx.rotate(engine.time * 0.2)
          ctx.drawImage(portalImg, -p.radius * 2, -p.radius * 2, p.radius * 4, p.radius * 4)
        } else {
          ctx.fillStyle = '#444'
          ctx.beginPath()
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
        
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`To ${AREAS[p.targetAreaIndex].name}`, p.x, p.y - p.radius * 1.5 - 25)
        ctx.fillStyle = '#0df'
        ctx.fillText(`Lvl ${p.reqLevel}+`, p.x, p.y - p.radius * 1.5 - 5)
        
        const distToPlayer = Math.hypot(p.x - engine.playerX, p.y - engine.playerY)
        if (distToPlayer < p.radius + 100) {
          ctx.fillStyle = 'rgba(160, 0, 255, 0.8)'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 40, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
          
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 16px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('TAP', p.x, p.y - 10)
          ctx.fillText('WARP', p.x, p.y + 10)
          ctx.textBaseline = 'alphabetic'
        }
      }
      
      // Enemies
      for (const e of engine.enemies) {
        const eDef = ENEMIES[e.typeIndex]
        const eImg = assets?.image?.[eDef.assetId]
        ctx.save()
        ctx.translate(e.x, e.y)
        ctx.rotate(e.angle - Math.PI / 2)
        if (eImg) {
          ctx.drawImage(eImg, -e.radius * 1.5, -e.radius * 1.5, e.radius * 3, e.radius * 3)
        } else {
          ctx.fillStyle = '#f00'
          ctx.beginPath()
          ctx.arc(0, 0, e.radius, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
        
        if (engine.targetEnemy === e) {
          ctx.save()
          ctx.translate(e.x, e.y)
          ctx.rotate(engine.time * 2)
          ctx.strokeStyle = '#0df'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, e.radius + 15, 0, Math.PI * 2)
          ctx.moveTo(-e.radius - 25, 0); ctx.lineTo(-e.radius - 5, 0)
          ctx.moveTo(e.radius + 5, 0); ctx.lineTo(e.radius + 25, 0)
          ctx.moveTo(0, -e.radius - 25); ctx.lineTo(0, -e.radius - 5)
          ctx.moveTo(0, e.radius + 5); ctx.lineTo(0, e.radius + 25)
          ctx.stroke()
          ctx.restore()
        }
        
        const hpPct = e.hp / e.maxHp
        ctx.fillStyle = 'rgba(255,0,0,0.5)'
        ctx.fillRect(e.x - 20, e.y - e.radius - 15, 40, 4)
        ctx.fillStyle = e.aggro ? '#f00' : '#ff0'
        ctx.fillRect(e.x - 20, e.y - e.radius - 15, 40 * hpPct, 4)
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(eDef.name, e.x, e.y + e.radius + 20)
      }
      
      // Projectiles
      for (const p of engine.projectiles) {
        const pImg = assets?.image?.[p.assetId]
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.isPlayer ? p.angle + Math.PI / 2 : p.angle - Math.PI / 2)
        if (pImg) {
          ctx.drawImage(pImg, -p.radius * 1.5, -p.radius * 1.5, p.radius * 3, p.radius * 3)
        } else {
          ctx.fillStyle = p.isPlayer ? '#0df' : '#f05'
          ctx.beginPath()
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      
      // Allies
      for (const a of engine.allies) {
        const allyShipDef = SHIPS[a.shipIndex]
        const allyImg = assets?.image?.[allyShipDef.assetId]
        ctx.save()
        ctx.translate(a.x, a.y)
        ctx.rotate(a.angle + Math.PI / 2)
        if (allyImg) {
          ctx.drawImage(allyImg, -25, -25, 50, 50)
        } else {
          ctx.fillStyle = '#0ff'
          ctx.fillRect(-15, -15, 30, 30)
        }
        ctx.restore()
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        const badge = a.hasBetaBadge ? ' [BETA]' : ''
        ctx.fillText(`${a.name}${badge}`, a.x, a.y + 35)
      }
      
      // Player
      const shipDef = SHIPS[engine.currentShipIndex]
      const playerImg = assets?.image?.[shipDef.assetId]
      ctx.save()
      ctx.translate(engine.playerX, engine.playerY)
      ctx.rotate(engine.playerAngle + Math.PI / 2)
      if (playerImg) {
        ctx.drawImage(playerImg, -30, -30, 60, 60)
      } else {
        ctx.fillStyle = '#0f0'
        ctx.fillRect(-20, -20, 40, 40)
      }
      ctx.restore()
      
      const isMaker = import.meta.env.DEV || 
                      engine.playerNickname?.toLowerCase() === 'stimulus';

      ctx.fillStyle = isMaker ? '#ffd700' : 'rgba(255, 255, 255, 0.9)'
      ctx.font = isMaker ? 'bold 11px monospace' : '11px monospace'
      ctx.textAlign = 'center'
      
      if (isMaker) {
        ctx.shadowColor = '#ffd700'
        ctx.shadowBlur = 4
      }

      const badgesToDraw = []
      if (engine.isRankOne && assets?.image?.user_input_8c1154) {
        badgesToDraw.push(assets.image.user_input_8c1154)
      }
      if (engine.hasBetaBadge && assets?.image?.user_input_3f15db) {
        badgesToDraw.push(assets.image.user_input_3f15db)
      }

      if (badgesToDraw.length > 0) {
        const badgeSize = 20
        const gap = 4
        const totalWidth = badgesToDraw.length * badgeSize + (badgesToDraw.length - 1) * gap
        let currentX = engine.playerX - totalWidth / 2
        
        badgesToDraw.forEach((badgeImg) => {
          ctx.drawImage(badgeImg, currentX, engine.playerY + 36, badgeSize, badgeSize)
          currentX += badgeSize + gap
        })
        
        ctx.fillText(engine.playerNickname, engine.playerX, engine.playerY + 70)
      } else {
        ctx.fillText(engine.playerNickname, engine.playerX, engine.playerY + 42)
      }
      ctx.shadowBlur = 0
      
      // Particles
      for (const pt of engine.particles) {
        if (pt.spritePlayer) {
          pt.spritePlayer.tick(ctx, frame.dtSeconds, pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size)
        } else if (pt.text) {
          ctx.fillStyle = `rgba(255, 255, 0, ${pt.life / pt.maxLife})`
          ctx.font = 'bold 24px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(pt.text, pt.x, pt.y)
        } else if (pt.color && pt.color.startsWith('engine:')) {
          const colorValues = pt.color.split(':')[1] || '0, 220, 255'
          const lifeRatio = pt.life / pt.maxLife
          const r = Math.max(0.1, pt.size * lifeRatio)
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r)
          grad.addColorStop(0, `rgba(255, 255, 255, ${lifeRatio})`)
          grad.addColorStop(0.3, `rgba(${colorValues}, ${lifeRatio * 0.8})`)
          grad.addColorStop(1, `rgba(${colorValues}, 0)`)
          
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
        } else if (pt.color) {
          ctx.fillStyle = pt.color
          ctx.globalAlpha = pt.life / pt.maxLife
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.maxLife), 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1.0
        }
      }
      
      ctx.restore()
      
      // 3. Draw HUD (Screen Space)
      const hpPct = Math.max(0, engine.playerHp) / shipDef.maxHp
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(10, 10, 150, 20)
      ctx.fillStyle = '#f00'
      ctx.fillRect(10, 10, 150, 20)
      ctx.fillStyle = '#0f0'
      ctx.fillRect(10, 10, 150 * hpPct, 20)
      ctx.fillStyle = '#fff'
      ctx.font = '12px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`HP: ${Math.max(0, Math.floor(engine.playerHp))}`, 15, 24)
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(10, 35, 150, 40)
      ctx.fillStyle = '#ff0'
      ctx.fillText(`CREDITS: ${credits}`, 15, 52)
      ctx.fillStyle = '#0df'
      ctx.fillText(`LEVEL: ${level}`, 15, 70)
      
      const xpPct = xp / xpTarget
      ctx.fillStyle = '#333'
      ctx.fillRect(10, 80, 150, 6)
      ctx.fillStyle = '#0df'
      ctx.fillRect(10, 80, 150 * xpPct, 6)
      
      // Radar pointers
      for (const portal of engine.portals) {
        const dx = portal.x - engine.playerX
        const dy = portal.y - engine.playerY
        const dist = Math.hypot(dx, dy)
        if (dist > Math.max(w, h) * 0.5) {
          const angle = Math.atan2(dy, dx)
          const radiusX = w / 2 - 40
          const radiusY = h / 2 - 40
          const px = w / 2 + Math.cos(angle) * radiusX
          const py = h / 2 + Math.sin(angle) * radiusY
          
          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(angle)
          ctx.fillStyle = '#a0f'
          ctx.beginPath()
          ctx.moveTo(15, 0)
          ctx.lineTo(-10, 10)
          ctx.lineTo(-10, -10)
          ctx.fill()
          
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.rotate(-angle)
          ctx.fillText(`To ${AREAS[portal.targetAreaIndex].name}`, 0, 20)
          ctx.restore()
        }
      }
      if (engine.currentAreaIndex === 0) {
        const dx = engine.baseX - engine.playerX
        const dy = engine.baseY - engine.playerY
        const dist = Math.hypot(dx, dy)
        if (dist > Math.max(w, h) * 0.5) {
          const angle = Math.atan2(dy, dx)
          const radiusX = w / 2 - 40
          const radiusY = h / 2 - 40
          const px = w / 2 + Math.cos(angle) * radiusX
          const py = h / 2 + Math.sin(angle) * radiusY
          
          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(angle)
          ctx.fillStyle = '#0f8'
          ctx.beginPath()
          ctx.moveTo(15, 0)
          ctx.lineTo(-10, 10)
          ctx.lineTo(-10, -10)
          ctx.fill()
          
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.rotate(-angle)
          ctx.fillText(`BASE`, 0, 20)
          ctx.restore()
        }
      }
    },
    options: { canvas: { maxPixelRatio } },
  })

  const [stickPos, setStickPos] = useState({ x: 0, y: 0 })
  const joystickTouchId = useRef<number | null>(null)
  const joystickDownTime = useRef(0)
  const joystickMoved = useRef(false)

  const updateJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    let dx = e.clientX - centerX
    let dy = e.clientY - centerY
    const maxDist = rect.width / 2 - 20
    const dist = Math.hypot(dx, dy)
    
    if (dist > 20) {
      joystickMoved.current = true
    }

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist
      dy = (dy / dist) * maxDist
    }
    
    if (joystickMoved.current) {
      setStickPos({ x: dx, y: dy })
      engine.joystickDir = { x: dx / maxDist, y: dy / maxDist }
    } else {
      setStickPos({ x: 0, y: 0 })
      engine.joystickDir = { x: 0, y: 0 }
    }
  }

  const getTouchWorldPos = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const screenX = (clientX - rect.left) * scaleX
    const screenY = (clientY - rect.top) * scaleY
    
    let camX = engine.playerX - width / 2
    let camY = engine.playerY - height / 2
    camX = Math.max(0, Math.min(MAP_WIDTH - width, camX))
    camY = Math.max(0, Math.min(MAP_HEIGHT - height, camY))
    
    return { x: screenX + camX, y: screenY + camY }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = getTouchWorldPos(e.clientX, e.clientY)
    if (!pos) return
    
    for (const p of engine.portals) {
      const distToPlayer = Math.hypot(p.x - engine.playerX, p.y - engine.playerY)
      if (distToPlayer < p.radius + 100) {
        const distToTap = Math.hypot(p.x - pos.x, p.y - pos.y)
        if (distToTap < 50) {
          if (engine.onPortalEnter) {
            engine.onPortalEnter(p.targetAreaIndex, p.reqLevel, engine.currentAreaIndex)
          }
          return
        }
      }
    }
    
    let tappedEnemy = null
    for (const enemy of engine.enemies) {
      if (Math.hypot(enemy.x - pos.x, enemy.y - pos.y) < enemy.radius + 40) {
        tappedEnemy = enemy
        break
      }
    }
    
    if (tappedEnemy) {
      engine.targetEnemy = tappedEnemy
    } else {
      engine.targetEnemy = null
    }
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-auto select-none touch-none bg-black">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block touch-none"
        onPointerDown={handlePointerDown}
      />
      
      {/* Joystick */}
      <div 
        className="absolute bottom-8 right-8 w-24 h-24 bg-white/10 rounded-full border-2 border-white/20 pointer-events-auto touch-none flex items-center justify-center backdrop-blur-sm"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          joystickTouchId.current = e.pointerId
          joystickDownTime.current = Date.now()
          joystickMoved.current = false
          updateJoystick(e)
        }}
        onPointerMove={(e) => {
          if (joystickTouchId.current === e.pointerId) {
            e.stopPropagation()
            updateJoystick(e)
          }
        }}
        onPointerUp={(e) => {
          if (joystickTouchId.current === e.pointerId) {
            e.stopPropagation()
            joystickTouchId.current = null
            setStickPos({ x: 0, y: 0 })
            engine.joystickDir = { x: 0, y: 0 }
            
            if (!joystickMoved.current && Date.now() - joystickDownTime.current < 400) {
              engine.targetNearestEnemy()
            }
          }
        }}
        onPointerCancel={(e) => {
          if (joystickTouchId.current === e.pointerId) {
            e.stopPropagation()
            joystickTouchId.current = null
            setStickPos({ x: 0, y: 0 })
            engine.joystickDir = { x: 0, y: 0 }
          }
        }}
      >
        <div 
          className="w-10 h-10 bg-white/40 rounded-full shadow-lg border border-white/50"
          style={{ transform: `translate(${stickPos.x}px, ${stickPos.y}px)` }}
        />
      </div>

      {/* Fire Button */}
      <div 
        className="absolute bottom-8 left-8 w-20 h-20 bg-red-600/50 rounded-full border-2 border-red-400/50 pointer-events-auto touch-none flex items-center justify-center backdrop-blur-sm active:bg-red-500/80 active:scale-95 transition-transform"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          engine.isFiring = true
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          engine.isFiring = false
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          engine.isFiring = false
        }}
      >
        <div className="text-white/80 font-bold tracking-wider text-sm pointer-events-none">
          FIRE
        </div>
      </div>

      {activePortal && (
        <div 
          className="absolute bottom-32 left-8 w-16 h-16 bg-purple-600/80 rounded-full border-2 border-purple-300 shadow-[0_0_15px_rgba(160,32,240,0.8)] pointer-events-auto touch-none flex flex-col items-center justify-center backdrop-blur-md active:scale-95 transition-transform animate-pulse"
          onPointerDown={(e) => {
            e.stopPropagation()
            if (engine.onPortalEnter) {
              engine.onPortalEnter(activePortal.targetAreaIndex, activePortal.reqLevel, engine.currentAreaIndex)
            }
          }}
        >
          <div className="text-white font-bold tracking-widest text-xs pointer-events-none mb-0.5">
            WARP
          </div>
        </div>
      )}

      {/* Chat Icon */}
      <button 
        className="absolute bottom-36 right-14 w-10 h-10 bg-purple-950/80 border border-purple-500/50 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer pointer-events-auto backdrop-blur-md z-40"
        onClick={(e) => {
          e.stopPropagation()
          setIsChatOpen(!isChatOpen)
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-purple-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.1.103.146.25.11.391l-.645 2.505a.375.375 0 00.472.453l2.673-1.07a.75.75 0 01.52 0c1.074.4 2.234.62 3.427.62z" />
        </svg>
      </button>

      {/* Chat Window */}
      {isChatOpen && (
        <div className="absolute bottom-36 left-4 right-4 max-w-[300px] h-64 bg-gray-950/90 border-2 border-purple-500/40 rounded-xl shadow-2xl flex flex-col p-3 backdrop-blur-lg pointer-events-auto z-40">
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-purple-900/30">
            <span className="text-[10px] font-black tracking-widest text-purple-400">NEBULA COMLINK</span>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setIsChatOpen(false)
              }}
              className="text-gray-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto mb-2 space-y-2.5 pr-1 text-left scrollbar-thin">
            {(() => {
              const isLoading = chatMessagesQuery.isLoading || ownChatQuery.isLoading
              const allMessages: any[] = []
              
              if (ownChatQuery.data && ownChatQuery.data.length > 0) {
                const ownItem = ownChatQuery.data[0]
                const ownMsgs = (ownItem?.value as any)?.messages || []
                ownMsgs.forEach((msg: any) => {
                  allMessages.push({
                    id: msg.id || Math.random().toString(),
                    text: msg.text,
                    time: msg.time || ownItem.updated_time,
                    nickname: ownItem.nickname || engine.playerNickname || 'YOU',
                    avatar_url: ownItem.avatar_url || null,
                    hasBetaBadge: msg.hasBetaBadge || false,
                    isRankOne: msg.isRankOne || false
                  })
                })
              }
              
              if (chatMessagesQuery.data) {
                chatMessagesQuery.data.forEach((item) => {
                  const otherMsgs = (item?.value as any)?.messages || []
                  otherMsgs.forEach((msg: any) => {
                    allMessages.push({
                      id: msg.id || Math.random().toString(),
                      text: msg.text,
                      time: msg.time || item.updated_time,
                      nickname: item.nickname || 'Hunter',
                      avatar_url: item.avatar_url || null,
                      hasBetaBadge: msg.hasBetaBadge || false,
                      isRankOne: msg.isRankOne || false
                    })
                  })
                })
              }
              
              if (isLoading && allMessages.length === 0) {
                return <div className="text-center py-8 text-gray-500 text-[9px] animate-pulse">Establishing connection...</div>
              }
              
              if (allMessages.length === 0) {
                return <div className="text-center py-8 text-gray-600 text-[9px]">No transmissions.</div>
              }
              
              const sorted = allMessages.sort((a, b) => {
                const tA = a.time ? new Date(a.time).getTime() : 0
                const tB = b.time ? new Date(b.time).getTime() : 0
                return tA - tB
              })
              
              return sorted.map((item, idx) => {
                const isStimulus = item.nickname?.toLowerCase() === 'stimulus'
                return (
                  <div key={item.id || idx} className="text-[9.5px] leading-relaxed break-words py-1 border-b border-purple-900/10 flex flex-wrap items-center gap-x-1">
                    <span className={`font-bold ${isStimulus ? 'text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'text-white'}`}>
                      {item.nickname}:
                    </span>
                    
                    <div className="inline-flex items-center gap-0.5 flex-shrink-0">
                      {item.isRankOne && assets?.image?.user_input_8c1154?.src && (
                        <img 
                          src={assets.image.user_input_8c1154.src} 
                          className="object-contain" 
                          style={{ width: '12px', height: '12px' }}
                          alt="1st" 
                        />
                      )}
                      {item.hasBetaBadge && assets?.image?.user_input_3f15db?.src && (
                        <img 
                          src={assets.image.user_input_3f15db.src} 
                          className="object-contain" 
                          style={{ width: '12px', height: '12px' }}
                          alt="Beta" 
                        />
                      )}
                    </div>

                    <span className="text-gray-200">{item.text}</span>
                    
                    <span className="text-[6.5px] text-gray-500 ml-auto font-mono">
                      {item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                )
              })
            })()}
          </div>

          <div className="flex gap-1.5 items-center">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage()
              }}
              placeholder="Broadcast message..."
              className="flex-1 min-w-0 bg-gray-900/80 border border-purple-900 text-[10px] text-white rounded px-2 py-1.5 focus:outline-none focus:border-purple-500"
              maxLength={80}
            />
            <button 
              onClick={handleSendMessage}
              disabled={((sendChatMessageMutation as any).isLoading || (sendChatMessageMutation as any).isPending) || !chatInput.trim()}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[9px] font-black transition-all disabled:opacity-50"
            >
              SEND
            </button>
          </div>
        </div>
      )}

      {/* Hangar/Base Button */}
      <div className="absolute top-4 right-4 pointer-events-auto flex flex-col items-end">
        {isAtBase && engine.currentAreaIndex === 0 ? (
          <button 
            className="bg-blue-600/80 border-2 border-blue-400 text-white font-bold py-2 px-4 rounded shadow-lg backdrop-blur"
            onClick={onHangarToggle}
          >
            HANGAR
          </button>
        ) : (
          <div className="bg-gray-800/80 border-2 border-red-500/50 text-red-400 font-bold py-2 px-4 rounded shadow-lg backdrop-blur text-sm text-right">
            RETURN TO BASE<br/>TO UPGRADE
          </div>
        )}
      </div>
    </div>
  )
}
