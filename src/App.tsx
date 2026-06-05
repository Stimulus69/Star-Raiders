import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'
import {
  AppContainer, GameView, SplashScreen, BasicLoading, BasicTimeoutDialog,
  useGameInit, useAssetLoader, useGameRuntime, useAssets,
} from '@seedleap/loopit-runtime'
import {
  useSocial,
  useSocialGameStateQuery,
  useSocialSetGameStateMutation,
  useSocialGameStateCounterQuery,
  useSocialIncrementGameStateCounterMutation,
  useSocialCurrentUserProfileQuery,
  useSocialSubmitRankItemMutation,
  useSocialRankListQuery
} from '@seedleap/loopit-runtime/social'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { GameInitConfig } from '@seedleap/loopit-runtime'

import { MANIFEST } from './assets'
import { Game } from './Game'
import { HangarUI } from './HangarUI'
import { GameEngine } from './gameEngine'
import { getLevelTarget } from './constants'

import './index.css'

const GAME_INIT_CONFIG: GameInitConfig = {
  autoStart: true,
}

function CustomSpaceLoadingScreen() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 2000 // 2 seconds smooth simulation
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const nextProgress = Math.min(99, Math.floor((elapsed / duration) * 100))
      setProgress(nextProgress)
    }, 30)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 text-white z-50">
      {/* Background Starfield Effect */}
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,rgba(8,47,73,0.5)_0%,rgba(0,0,0,1)_80%)] pointer-events-none" />
      
      {/* Custom Title Image / Logo */}
      <div className="w-64 h-64 md:w-80 md:h-80 relative flex items-center justify-center mb-8 animate-pulse">
        {/* Soft blue backglow */}
        <div className="absolute inset-0 bg-blue-500/15 blur-3xl rounded-full" />
        <img 
          src="/assets/image/user_input_32297c@r1.png" 
          className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]" 
          alt="Star Raiders" 
        />
      </div>

      {/* Loading Status */}
      <div className="w-full max-w-[240px] text-center relative z-10">
        <div className="text-[10px] font-bold tracking-[0.25em] text-blue-400 mb-2 uppercase animate-pulse">
          Initializing Warp Drive
        </div>
        
        {/* Space-like Blue Loading Bar */}
        <div className="w-full bg-blue-950/40 border border-blue-500/30 rounded-full h-2.5 p-0.5 shadow-[0_0_10px_rgba(59,130,246,0.1)] overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_#3b82f6]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Percentage text */}
        <div className="text-[9px] font-semibold text-blue-300/60 mt-1.5 font-mono">
          {progress}%
        </div>
      </div>
    </div>
  )
}

const queryClient = new QueryClient()

function App() {
  useGameInit(GAME_INIT_CONFIG)
  useAssetLoader(MANIFEST)
  const [view, setView] = useState<'game' | 'hangar'>('game')
  
  return (
    <QueryClientProvider client={queryClient}>
      <AppContainer>
        <GameView>
          <MainFlow view={view} setView={setView} />
        </GameView>
        <SplashScreen>
          <CustomSpaceLoadingScreen />
          <BasicTimeoutDialog custom />
        </SplashScreen>
      </AppContainer>
    </QueryClientProvider>
  )
}

function MainFlow({ view, setView }: any) {
  const { assets, isReady } = useAssets()
  const { paused } = useGameRuntime()
  const social = useSocial()
  
  const [credits, setCredits] = useState(0)
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [currentShipIndex, setCurrentShipIndex] = useState(0)
  const [unlockedShips, setUnlockedShips] = useState<number[]>([0])
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0)
  const [hasBetaBadge, setHasBetaBadge] = useState(false)
  const [hasLoadedSave, setHasLoadedSave] = useState(false)

  const globalKillsQuery = useSocialGameStateCounterQuery(social, {
    game_key: 'global_kills',
    target_type: 'game'
  }, {
    enabled: social.isReady,
    refetchInterval: social.isReady ? 5000 : false
  })

  const incrementKillsMutation = useSocialIncrementGameStateCounterMutation(social)
  const leaderboardMutation = useSocialSubmitRankItemMutation(social)
  
  const rankListQuery = useSocialRankListQuery(social, {
    rank_name: 'void_hunters_leaderboard',
    query_type: 'top',
    rank_limit_num: 20
  }, {
    enabled: social.isReady,
    refetchInterval: social.isReady ? 15000 : false
  })

  const isRankOne = rankListQuery.data?.my_rank?.rank === 1

  const meQuery = useSocialCurrentUserProfileQuery(social, { enabled: social.isReady })
  
  const xpTarget = getLevelTarget(level)
  
  const saveMutation = useSocialSetGameStateMutation(social)
  const loadQuery = useSocialGameStateQuery(social, { game_key: 'void_hunters_save_meta', query_type: 'own' }, { enabled: social.isReady && !hasLoadedSave })

  const engineRef = useRef<GameEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new GameEngine()
  }
  const engine = engineRef.current

  // Load state exactly once when ready
  useEffect(() => {
    if (!social.isReady || hasLoadedSave || loadQuery.isLoading) return
    let loadedLevel = level
    let loadedXp = xp
    let loadedHasBetaBadge = hasBetaBadge
    if (loadQuery.isSuccess && loadQuery.data && loadQuery.data.length > 0) {
      const data = loadQuery.data[0].value
      if (data) {
        if (typeof data.credits === 'number') setCredits(data.credits)
        if (typeof data.xp === 'number') { setXp(data.xp); loadedXp = data.xp; }
        if (typeof data.level === 'number') { setLevel(data.level); loadedLevel = data.level; }
        if (typeof data.currentShipIndex === 'number') setCurrentShipIndex(data.currentShipIndex)
        if (Array.isArray(data.unlockedShips)) setUnlockedShips(data.unlockedShips)
        if (typeof data.currentAreaIndex === 'number') setCurrentAreaIndex(data.currentAreaIndex)
        if (typeof data.hasBetaBadge === 'boolean') { setHasBetaBadge(data.hasBetaBadge); loadedHasBetaBadge = data.hasBetaBadge; }
      }
    }
    setHasLoadedSave(true)
    // Submit leaderboard score right after loading
    leaderboardMutation.mutate({
      rank_name: 'void_hunters_leaderboard',
      rank_name_score: loadedLevel * 10000000000 + loadedXp * 10 + (loadedHasBetaBadge ? 1 : 0)
    })
  }, [social.isReady, loadQuery.isSuccess, loadQuery.data, loadQuery.isLoading, hasLoadedSave])

  // Save game helper
  const triggerSave = (updates: any = {}) => {
    if (!social.isReady) return
    const payload = {
      credits, xp, level, currentShipIndex, unlockedShips, currentAreaIndex, hasBetaBadge,
      ...updates
    }
    saveMutation.mutate({
      key: 'void_hunters_save_meta',
      value: JSON.stringify(payload),
      scope: 'private',
      skip_audit: true
    })
  }

  // Periodic save & leaderboard submit
  useEffect(() => {
    if (!hasLoadedSave) return
    const interval = setInterval(() => {
      triggerSave()
      if (social.isReady) {
        leaderboardMutation.mutate({
          rank_name: 'void_hunters_leaderboard',
          rank_name_score: level * 10000000000 + xp * 10 + (hasBetaBadge ? 1 : 0)
        })
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [credits, xp, level, currentShipIndex, unlockedShips, currentAreaIndex, hasBetaBadge, hasLoadedSave, social.isReady])

  useEffect(() => {
    engine.currentShipIndex = currentShipIndex
    if (engine.currentAreaIndex !== currentAreaIndex || engine.portals.length === 0) {
      engine.currentAreaIndex = currentAreaIndex
      engine.setupPortals()
      engine.setupDebris()
      engine.setupStars()
    }
  }, [currentShipIndex, currentAreaIndex, engine])

  useEffect(() => {
    engine.hasBetaBadge = hasBetaBadge
    engine.isRankOne = isRankOne
    if (meQuery.isSuccess && meQuery.data?.nickname) {
      engine.playerNickname = meQuery.data.nickname
    } else {
      engine.playerNickname = 'HUNTER_1'
    }
  }, [hasBetaBadge, isRankOne, meQuery.isSuccess, meQuery.data, engine])

  useEffect(() => {
    engine.isHangarOpen = view === 'hangar' || paused
  }, [view, paused, engine])

  useEffect(() => {
    engine.onAddCredits = (c) => setCredits(prev => prev + c)
    engine.onAddXp = (x) => setXp(prev => prev + x)
    engine.onEnemyKilled = () => {
      incrementKillsMutation.mutate({ game_key: 'global_kills', step: 1, target_type: 'game' })
      const currentGlobalKills = globalKillsQuery.data?.current_count ?? 0
      if (!hasBetaBadge && currentGlobalKills < 10000) {
        setHasBetaBadge(true)
        triggerSave({ hasBetaBadge: true })
        if (social.isReady) {
          leaderboardMutation.mutate({
            rank_name: 'void_hunters_leaderboard',
            rank_name_score: level * 10000000000 + xp * 10 + 1
          })
        }
      }
    }
    engine.playSound = (id) => assets?.sound_effect?.[id as any]?.start()
    engine.createSpritePlayer = () => assets?.sprite?.explosion?.createPlayer()
    engine.onGameOver = () => {
      setCredits(prev => {
        const newCredits = Math.floor(prev * 0.75)
        triggerSave({ currentAreaIndex: 0, credits: newCredits })
        return newCredits
      })
      setCurrentAreaIndex(0)
      engine.currentAreaIndex = 0
      engine.reset(currentShipIndex)
    }
    engine.onPortalEnter = (targetIdx, reqLvl, fromIdx) => {
      if (level >= reqLvl) {
        setCurrentAreaIndex(targetIdx)
        engine.currentAreaIndex = targetIdx
        engine.reset(currentShipIndex, fromIdx, true) // pass keepHp = true
        triggerSave({ currentAreaIndex: targetIdx })
      } else {
        engine.addTextParticle(`Need Level ${reqLvl}!`, engine.playerX, engine.playerY - 40)
      }
    }
  }, [engine, assets, currentShipIndex, level, triggerSave, hasBetaBadge, globalKillsQuery.data, incrementKillsMutation])

  useEffect(() => {
    if (xp >= xpTarget) {
      setXp(prev => prev - xpTarget)
      setLevel(l => l + 1)
      const nextLevel = level + 1
      const nextXp = xp - xpTarget
      triggerSave({ xp: nextXp, level: nextLevel })
      if (social.isReady) {
        leaderboardMutation.mutate({
          rank_name: 'void_hunters_leaderboard',
          rank_name_score: nextLevel * 10000000000 + nextXp * 10 + (hasBetaBadge ? 1 : 0)
        })
      }
    }
  }, [xp, xpTarget, level, triggerSave, social.isReady, hasBetaBadge])

  if (!isReady) return null

  return (
    <>
      <Game 
        engine={engine} 
        onHangarToggle={() => setView('hangar')} 
        credits={credits}
        level={level}
        xp={xp}
        xpTarget={xpTarget}
        globalKills={globalKillsQuery.data?.current_count ?? 0}
        social={social}
      />
      {view === 'hangar' && (
        <HangarUI 
          onClose={() => setView('game')}
          credits={credits}
          xp={xp}
          level={level}
          currentShipIndex={currentShipIndex}
          unlockedShips={unlockedShips}
          currentAreaIndex={currentAreaIndex}
          globalKills={globalKillsQuery.data?.current_count ?? 0}
          assets={assets}
          social={social}
          onBuyShip={(idx: number, price: number) => {
            if (credits >= price) {
              setCredits(c => c - price)
              setUnlockedShips(u => [...u, idx])
              setCurrentShipIndex(idx)
              engine.reset(idx)
              assets?.sound_effect?.sfx_buy?.start()
              triggerSave({ credits: credits - price, unlockedShips: [...unlockedShips, idx], currentShipIndex: idx })
            }
          }}
          onEquipShip={(idx: number) => {
            setCurrentShipIndex(idx)
            engine.reset(idx)
            triggerSave({ currentShipIndex: idx })
          }}
          onSelectArea={(idx: number) => {
            setCurrentAreaIndex(idx)
            engine.reset(currentShipIndex)
          }}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
