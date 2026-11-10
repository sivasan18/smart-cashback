import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Zap, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { session, signIn, loading: authLoading } = useAuthStore()
  const navigate = useNavigate()

  // Initial State is OFF (Lamp starts dark / locked)
  const [isLampOn, setIsLampOn] = useState(false)
  const [isPullingCord, setIsPullingCord] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [hintPulse, setHintPulse] = useState(false)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // DOM Refs
  const emailInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Automatic redirect if already authenticated
  useEffect(() => {
    if (session) {
      navigate('/billing', { replace: true })
    }
  }, [session, navigate])

  if (session) {
    return null
  }

  // Realistic mechanical click synthesizer using Web Audio API
  const playLampClickSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05)

      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.06)
    } catch {
      // Audio context handled silently
    }
  }

  // Toggle Lamp on pulling cord or clicking switch
  const toggleLamp = () => {
    setIsPullingCord(true)
    playLampClickSound()

    setTimeout(() => {
      setIsPullingCord(false)
    }, 700)

    setIsLampOn(prev => {
      const next = !prev
      if (next) {
        // Auto-focus email field once illuminated
        setTimeout(() => {
          emailInputRef.current?.focus()
        }, 400)
      } else {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      }
      return next
    })
  }

  // Trigger gentle shake when user tries to interact while dark
  const handleLockedClick = () => {
    setIsShaking(true)
    setHintPulse(true)
    setTimeout(() => setIsShaking(false), 450)
    setTimeout(() => setHintPulse(false), 600)
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    if (!isLampOn) return
    setShowPassword(prev => !prev)
  }

  // Handle Form Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLampOn || authLoading) return

    setStatusMessage(null)

    if (!email.trim()) {
      setStatusMessage({ type: 'error', text: 'Email ID is required.' })
      return
    }
    if (!password) {
      setStatusMessage({ type: 'error', text: 'Password is required.' })
      return
    }

    const { error } = await signIn(email.trim(), password)
    if (error) {
      setStatusMessage({ type: 'error', text: error })
      toast.error(error)
    } else {
      setStatusMessage(null)
      sessionStorage.setItem('just_logged_in', 'true')
      navigate('/billing', { replace: true, state: { fromLogin: true, loggedIn: true } })
    }
  }

  // Canvas Fireflies Background Animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const fireflyCount = 28
    class Firefly {
      x = Math.random() * width
      y = Math.random() * height
      radius = Math.random() * 2 + 0.8
      baseAlpha = Math.random() * 0.5 + 0.2
      alpha = this.baseAlpha
      speedX = (Math.random() - 0.5) * 0.45
      speedY = (Math.random() - 0.5) * 0.45
      pulseSpeed = Math.random() * 0.025 + 0.01
      pulse = Math.random() * Math.PI

      update() {
        this.x += this.speedX
        this.y += this.speedY
        this.pulse += this.pulseSpeed

        // Twinkle
        this.alpha = this.baseAlpha + Math.sin(this.pulse) * 0.25
        if (this.alpha < 0.05) this.alpha = 0.05

        // Boundary wrap
        if (this.x < 0) this.x = width
        if (this.x > width) this.x = 0
        if (this.y < 0) this.y = height
        if (this.y > height) this.y = 0
      }

      draw() {
        if (!ctx) return
        ctx.save()
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(251, 191, 36, ${this.alpha})`
        ctx.shadowColor = '#FBBF24'
        ctx.shadowBlur = this.radius * 6
        ctx.fill()
        ctx.restore()
      }
    }

    const fireflies: Firefly[] = []
    for (let i = 0; i < fireflyCount; i++) {
      fireflies.push(new Firefly())
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      for (const f of fireflies) {
        f.update()
        f.draw()
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 relative antialiased selection:bg-amber-400 selection:text-black transition-colors duration-700 overflow-x-hidden select-none ${
        isLampOn ? 'bg-[#07090e]' : 'bg-[#05060a]'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. AMBIENT FLOATING FIREFLIES CANVAS
      ────────────────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 pointer-events-none z-[1] transition-opacity duration-800 ${
          isLampOn ? 'opacity-100' : 'opacity-15'
        }`}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN CONTAINER: LAMP (LEFT) + STREAMLINED LOGIN CARD (RIGHT)
      ────────────────────────────────────────────────────────────── */}
      <main className="w-full max-w-4xl relative z-10 my-auto flex flex-col md:flex-row items-center justify-center gap-4 lg:gap-8 min-h-[580px]">

        {/* ── LEFT: INTERACTIVE FLOOR / DESK LAMP ── */}
        <div className="relative w-[240px] md:w-[300px] h-[340px] md:h-[460px] flex items-center justify-center shrink-0">

          {/* Volumetric Light Beam Projection Layer (Desktop) */}
          <div
            className={`light-cone hidden md:block absolute pointer-events-none z-[5] transition-all duration-700 ${
              isLampOn ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.92]'
            }`}
            style={{
              top: '15px',
              left: '60px',
              width: '750px',
              height: '600px',
              background:
                'radial-gradient(ellipse 85% 75% at 5% 20%, rgba(251, 191, 36, 0.45) 0%, rgba(245, 158, 11, 0.22) 35%, rgba(245, 158, 11, 0.08) 60%, rgba(7, 9, 14, 0) 80%)',
              clipPath: 'polygon(4% 18%, 100% 0%, 100% 100%, 0% 88%)',
              filter: 'blur(12px)',
              transformOrigin: '5% 20%',
            }}
          />

          {/* Mobile circular light beam fallback */}
          <div
            className={`md:hidden absolute -bottom-10 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl pointer-events-none transition-opacity duration-700 ${
              isLampOn ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* SVG Vector Lamp */}
          <svg
            className="w-full h-full relative z-20 filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
            viewBox="0 0 200 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Desk/Floor Base plate */}
            <ellipse cx="70" cy="280" rx="42" ry="7" fill="#1E222D" stroke="#333A48" strokeWidth="1.5" />
            <ellipse cx="70" cy="278" rx="35" ry="5" fill="#2A303F" />

            {/* Lamp Stand / Stem */}
            <path d="M70 278 L70 95" stroke="#374151" strokeWidth="5" strokeLinecap="round" />
            <path d="M70 95 C 70 70, 92 65, 92 65" stroke="#4B5563" strokeWidth="4.5" strokeLinecap="round" fill="none" />

            {/* Lamp Fixture & Shade */}
            <path d="M 52 65 L 132 65 L 115 28 L 69 28 Z" fill="#171A21" stroke="#374151" strokeWidth="1.5" />
            <ellipse cx="92" cy="65" rx="40" ry="10" fill="#1F2430" stroke="#4B5563" strokeWidth="1.5" />

            {/* Bulb Glow */}
            <g
              className="transition-all duration-500"
              style={{
                opacity: isLampOn ? 1 : 0,
                filter: isLampOn ? 'drop-shadow(0 0 24px #fbbf24) drop-shadow(0 0 45px #f59e0b)' : 'none',
              }}
            >
              {/* Outer warm cone base inside fixture */}
              <ellipse cx="92" cy="65" rx="36" ry="8" fill="#FBBF24" opacity="0.95" />
              {/* Core bright incandescent bulb center */}
              <ellipse cx="92" cy="65" rx="20" ry="5" fill="#FFFBEB" />
              <circle cx="92" cy="66" r="14" fill="url(#bulbGrad)" />
            </g>

            {/* Interactive Hanging Pull String Cord */}
            <g
              onClick={toggleLamp}
              className={`cursor-pointer transition-transform ${isPullingCord ? 'animate-pull-cord' : ''}`}
              style={{ transformOrigin: '92px 64px' }}
            >
              {/* Invisible wider hit area for easy click/tap */}
              <rect x="75" y="65" width="34" height="90" fill="transparent" />
              {/* String line */}
              <line x1="92" y1="65" x2="92" y2="128" stroke="#FBBF24" strokeWidth="1.8" strokeDasharray="2 1.5" />
              {/* Golden pull bead / tassel with pulse glow */}
              <ellipse
                cx="92"
                cy="132"
                rx="5"
                ry="7.5"
                fill="#F59E0B"
                stroke="#FBBF24"
                strokeWidth="1.5"
                className="filter drop-shadow-[0_0_6px_#fbbf24]"
              />
              <circle cx="92" cy="130" r="2" fill="#FEF3C7" />
            </g>

            {/* Radial Gradient Definitions */}
            <defs>
              <radialGradient
                id="bulbGrad"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(92 66) rotate(90) scale(14)"
              >
                <stop stopColor="#FFFFFF" />
                <stop offset="0.4" stopColor="#FEF08A" />
                <stop offset="0.9" stopColor="#F59E0B" />
                <stop offset="1" stopColor="#B45309" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* Interactive Hint Prompt (Shows when lamp is off) */}
          <div
            onClick={toggleLamp}
            className={`absolute top-36 -right-4 sm:-right-8 bg-amber-400 text-neutral-950 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1.5 cursor-pointer pointer-events-auto transition-all duration-300 z-30 animate-bounce ${
              isLampOn ? 'opacity-0 pointer-events-none' : 'opacity-100'
            } ${hintPulse ? 'scale-110 ring-2 ring-amber-300' : ''}`}
          >
            <span>Pull cord to turn on light</span>
            <span className="text-sm">👇</span>
          </div>
        </div>

        {/* ── RIGHT: STREAMLINED LOGIN CARD ── */}
        <div
          onClick={() => {
            if (!isLampOn) handleLockedClick()
          }}
          className={`w-full max-w-[390px] px-2 sm:px-0 transition-all duration-700 relative z-10 ${
            isShaking ? 'animate-shake' : ''
          } ${
            isLampOn
              ? 'opacity-100 grayscale-0 brightness-100 contrast-100 translate-y-0 shadow-[0_25px_60px_-15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/25'
              : 'opacity-20 grayscale brightness-[0.28] contrast-[0.85] translate-y-1 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.95)]'
          }`}
        >
          <div className="relative backdrop-blur-xl bg-slate-900/60 border border-slate-700/60 rounded-3xl p-7 sm:p-9 shadow-2xl overflow-hidden transition-colors duration-500">

            {/* Overlay shield intercepting clicks when light is OFF */}
            {!isLampOn && (
              <div
                onClick={handleLockedClick}
                className="absolute inset-0 z-40 cursor-not-allowed bg-black/40 flex flex-col items-center justify-center p-4 backdrop-blur-[2px] transition-opacity duration-300"
              >
                <div className="bg-neutral-900/90 border border-amber-400/40 text-amber-300 px-4 py-2 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 pointer-events-none">
                  <AlertTriangle size={15} className="text-amber-400" />
                  <span>Turn on the lamp first! 💡</span>
                </div>
              </div>
            )}

            {/* Ambient Subtle Corner Light Accent inside card */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

            {/* Branding Header */}
            <div className="text-left mb-7">
              <div className="inline-flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Zap size={20} className="fill-amber-400" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Smart <span className="text-amber-400">Cashback</span>
                </h1>
              </div>
              <p className="text-xs text-neutral-400">Sign in to manage and claim your daily rewards</p>
            </div>

            {/* Login Form (Only Email, Password, Login Button) */}
            <form onSubmit={handleLogin} className="space-y-4">

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 ml-1"
                >
                  Email ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <Mail size={16} />
                  </div>
                  <input
                    ref={emailInputRef}
                    type="email"
                    id="email"
                    required
                    disabled={!isLampOn}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@smartcashback.com"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950/70 border border-neutral-700/80 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 ml-1"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    required
                    disabled={!isLampOn}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-neutral-950/70 border border-neutral-700/80 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  {/* Toggle Password Visibility */}
                  <button
                    type="button"
                    disabled={!isLampOn}
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit / Login Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isLampOn || authLoading}
                  className="w-full relative group overflow-hidden bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-neutral-950 font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-[0_0_25px_rgba(251,191,36,0.35)] hover:shadow-[0_0_35px_rgba(251,191,36,0.6)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                >
                  <span>{authLoading ? 'Verifying…' : 'Login'}</span>
                  {authLoading ? (
                    <Loader2 size={16} className="animate-spin text-neutral-950" />
                  ) : (
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </div>
            </form>

            {/* Feedback Message Notification Area */}
            {statusMessage && (
              <div
                className={`mt-4 p-3 rounded-xl text-center text-xs font-semibold border transition-all duration-300 ${
                  statusMessage.type === 'success'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {statusMessage.text}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM LIGHT SWITCH INDICATOR PILL
      ────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 backdrop-blur-md px-4 py-1.5 rounded-full text-xs text-neutral-400">
        <span
          className="w-2 h-2 rounded-full transition-all duration-500"
          style={{
            backgroundColor: isLampOn ? '#fbbf24' : '#4b5563',
            boxShadow: isLampOn ? '0 0 8px #fbbf24' : 'none',
          }}
        />
        <span>{isLampOn ? 'Lamp: Illuminated' : 'Lamp: Powered Off'}</span>
        <button onClick={toggleLamp} className="text-amber-400 hover:underline font-medium ml-1 cursor-pointer">
          Pull Cord
        </button>
      </div>

      {/* Keyframe animations for cord pull and shake */}
      <style>{`
        @keyframes pullStringAnim {
          0% { transform: translateY(0); }
          35% { transform: translateY(22px); }
          65% { transform: translateY(-6px); }
          85% { transform: translateY(3px); }
          100% { transform: translateY(0); }
        }
        .animate-pull-cord {
          animation: pullStringAnim 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes lockedShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: lockedShake 0.45s ease-in-out;
        }
      `}</style>
    </div>
  )
}
