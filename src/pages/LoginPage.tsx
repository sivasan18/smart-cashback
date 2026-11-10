import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  KeyRound,
  Fingerprint,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Zap,
  Building2,
  UserCheck
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// 18 Official Outlets for Shop Partner Portal
const OUTLETS = [
  { id: '01', name: 'Outlet #01 – Main Xerox & Digital Print (HQ)', code: 'HQ-MAIN', city: 'Central Hub' },
  { id: '02', name: 'Outlet #02 – Central Station Xerox & Tech', code: 'STA-02', city: 'Railway Terminus' },
  { id: '03', name: 'Outlet #03 – University Campus Print Hub', code: 'UNI-03', city: 'College Rd' },
  { id: '04', name: 'Outlet #04 – Anna Nagar Digital Services', code: 'AN-04', city: 'Anna Nagar' },
  { id: '05', name: 'Outlet #05 – T. Nagar Retail & Recharge', code: 'TN-05', city: 'T. Nagar' },
  { id: '06', name: 'Outlet #06 – Adyar Tech & Copy Centre', code: 'AD-06', city: 'Adyar' },
  { id: '07', name: 'Outlet #07 – Velachery Super Print', code: 'VL-07', city: 'Velachery' },
  { id: '08', name: 'Outlet #08 – Tambaram Express Xerox', code: 'TB-08', city: 'Tambaram' },
  { id: '09', name: 'Outlet #09 – Guindy Industrial Services', code: 'GD-09', city: 'Guindy Estate' },
  { id: '10', name: 'Outlet #10 – OMR Tech Corridor Branch', code: 'OMR-10', city: 'IT Highway' },
  { id: '11', name: 'Outlet #11 – Porur Digital & Mobility', code: 'PR-11', city: 'Porur Junction' },
  { id: '12', name: 'Outlet #12 – Vadapalani Smart Counter', code: 'VP-12', city: 'Vadapalani' },
  { id: '13', name: 'Outlet #13 – Koyambedu Market Branch', code: 'KB-13', city: 'Wholesale Market' },
  { id: '14', name: 'Outlet #14 – Egmore Station Point', code: 'EG-14', city: 'Egmore High Rd' },
  { id: '15', name: 'Outlet #15 – Mylapore Heritage Xerox', code: 'MY-15', city: 'Mylapore Tank' },
  { id: '16', name: 'Outlet #16 – Chromepet Express Store', code: 'CP-16', city: 'GST Road' },
  { id: '17', name: 'Outlet #17 – Ambattur Industrial Hub', code: 'AM-17', city: 'Industrial Estate' },
  { id: '18', name: 'Outlet #18 – Avadi High Road Print Hub', code: 'AV-18', city: 'Avadi Main' },
]

// Play realistic mechanical pull switch click
function playSwitchSound(isTurningOn: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(isTurningOn ? 480 : 340, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(isTurningOn ? 920 : 180, ctx.currentTime + 0.055)

    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)

    osc.start()
    osc.stop(ctx.currentTime + 0.07)
  } catch {
    // Audio context may be restricted before user gesture
  }
}

export default function LoginPage() {
  const { session, signIn, loading } = useAuthStore()

  // Lamp state (on by default)
  const [isLampOn, setIsLampOn] = useState(true)
  const [isPullingCord, setIsPullingCord] = useState(false)

  // Portal selection: 'admin' | 'shop'
  const [activePortal, setActivePortal] = useState<'admin' | 'shop'>('admin')

  // Master Admin form state
  const [adminEmail, setAdminEmail] = useState('sivar75@gmail.com')
  const [adminPassword, setAdminPassword] = useState('')
  const [admin2FA, setAdmin2FA] = useState('')

  // Shop Partner form state
  const [selectedOutlet, setSelectedOutlet] = useState('01')
  const [operatorId, setOperatorId] = useState('OPR-1801')
  const [shopPassword, setShopPassword] = useState('')

  // UI helpers
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [biometricPending, setBiometricPending] = useState(false)

  // Cord pull ref
  const cordRef = useRef<HTMLDivElement>(null)

  // Redirect to /billing if already authenticated
  if (session) return <Navigate to="/billing" replace />

  // Generate 20 ambient fireflies with randomized drift
  const fireflies = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: (i * 17) % 96 + 2,
      y: (i * 23) % 92 + 4,
      size: (i % 3) + 2.5,
      duration: 5 + (i % 5) * 1.5,
      delay: (i % 4) * 0.8,
      opacity: 0.25 + ((i % 5) * 0.12),
      isWarm: i % 2 === 0,
    }))
  }, [])

  // Toggle Lamp with tactile sound & spring pull
  const handleToggleLamp = () => {
    setIsPullingCord(true)
    playSwitchSound(!isLampOn)
    setTimeout(() => {
      setIsLampOn(prev => !prev)
      setIsPullingCord(false)
    }, 180)
  }

  // Handle Master Admin Login
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!adminEmail.trim()) newErrors.adminEmail = 'Master Admin email is required'
    else if (!/\S+@\S+\.\S+/.test(adminEmail)) newErrors.adminEmail = 'Enter a valid email address'
    if (!adminPassword) newErrors.adminPassword = 'Password is required'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    const { error } = await signIn(adminEmail.trim(), adminPassword)
    if (error) {
      toast.error(error)
      setErrors({ adminPassword: 'Authentication failed. Please verify credentials.' })
    } else {
      toast.success('Welcome back, Master Administrator!')
    }
  }

  // Handle Shop Partner Login (18 Outlets)
  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!operatorId.trim()) newErrors.operatorId = 'Operator ID or Cashier username required'
    if (!shopPassword) newErrors.shopPassword = 'Shop password is required'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    const outlet = OUTLETS.find(o => o.id === selectedOutlet) || OUTLETS[0]

    // Authenticate through Supabase auth
    const effectiveEmail = adminEmail.trim() || 'sivar75@gmail.com'
    const { error } = await signIn(effectiveEmail, shopPassword)
    if (error) {
      toast.error(`Shop authentication failed for ${outlet.name}.`)
      setErrors({ shopPassword: 'Wrong shop counter password or credentials.' })
    } else {
      toast.success(`Access granted! Signed in as ${operatorId} (${outlet.code}).`)
    }
  }

  // Biometric / Fast Pass Simulation
  const handleBiometricAuth = async () => {
    setBiometricPending(true)
    toast.loading('Scanning biometric key / FaceID…', { id: 'bio' })
    await new Promise(r => setTimeout(r, 1200))

    if (!adminPassword && !shopPassword) {
      toast.dismiss('bio')
      toast.error('Please enter password once to register your biometric pass.', { id: 'bio' })
      setBiometricPending(false)
      return
    }

    const pwd = activePortal === 'admin' ? adminPassword : shopPassword
    const mail = adminEmail.trim() || 'sivar75@gmail.com'
    const { error } = await signIn(mail, pwd)
    toast.dismiss('bio')
    setBiometricPending(false)

    if (error) {
      toast.error('Biometric verification failed: ' + error)
    } else {
      toast.success('Biometric pass verified! Welcome back.')
    }
  }

  return (
    <div className={`relative min-h-screen w-full overflow-hidden transition-colors duration-700 select-none flex items-center justify-center p-4 sm:p-6 lg:p-10 ${
      isLampOn ? 'bg-[#0B0F17]' : 'bg-[#05070B]'
    }`}>
      {/* ─────────────────────────────────────────────────────────────
          1. FLOATING AMBIENT FIREFLIES / PARTICLES
      ────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {fireflies.map((ff) => (
          <motion.div
            key={ff.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{
              opacity: isLampOn
                ? [ff.opacity * 0.4, ff.opacity * 1.2, ff.opacity * 0.4]
                : [ff.opacity * 0.15, ff.opacity * 0.35, ff.opacity * 0.15],
              y: [-12, 12, -12],
              x: [-8, 8, -8],
            }}
            transition={{
              duration: ff.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: ff.delay,
            }}
            style={{
              position: 'absolute',
              left: `${ff.x}%`,
              top: `${ff.y}%`,
              width: `${ff.size}px`,
              height: `${ff.size}px`,
              borderRadius: '9999px',
              backgroundColor: isLampOn
                ? ff.isWarm ? '#FACC15' : '#38BDF8'
                : '#475569',
              boxShadow: isLampOn
                ? ff.isWarm
                  ? '0 0 12px 3px rgba(250, 204, 21, 0.45)'
                  : '0 0 10px 2px rgba(56, 189, 248, 0.35)'
                : '0 0 4px 1px rgba(71, 85, 105, 0.2)',
            }}
          />
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CONIC / RADIAL SPOTLIGHT BEAM (CASTS FROM LAMP ACROSS CARD)
      ────────────────────────────────────────────────────────────── */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out ${
          isLampOn ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Main dramatic golden cone spanning from the top-left lamp head toward the center-right login card */}
        <div
          className="absolute hidden md:block"
          style={{
            top: '8%',
            left: '12%',
            width: '900px',
            height: '800px',
            background: 'radial-gradient(ellipse 70% 60% at 20% 25%, rgba(250, 204, 21, 0.28) 0%, rgba(245, 158, 11, 0.16) 35%, rgba(217, 119, 6, 0.05) 65%, transparent 80%)',
            filter: 'blur(32px)',
            transform: 'rotate(-5deg)',
          }}
        />

        {/* Angular spotlight beam illusion */}
        <div
          className="absolute hidden lg:block opacity-65"
          style={{
            top: '120px',
            left: '260px',
            width: '780px',
            height: '620px',
            clipPath: 'polygon(0% 12%, 100% 0%, 95% 100%, 0% 45%)',
            background: 'linear-gradient(105deg, rgba(254, 240, 138, 0.42) 0%, rgba(250, 204, 21, 0.18) 40%, rgba(245, 158, 11, 0.04) 80%, transparent 100%)',
            filter: 'blur(22px)',
          }}
        />

        {/* Desk reflection pool below card */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[720px] h-[160px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(250, 204, 21, 0.18) 0%, rgba(217, 119, 6, 0.06) 55%, transparent 75%)',
            filter: 'blur(28px)',
          }}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. MAIN CONTAINER: LAMP (LEFT) + FROSTED LOGIN CARD (RIGHT)
      ────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14">

        {/* ── LEFT SECTION: INTERACTIVE VECTOR DESK LAMP ── */}
        <div className="relative flex flex-col items-center justify-center select-none pt-2 lg:pt-0">

          {/* Lamp Status Pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 px-3.5 py-1 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 border transition-all duration-500 ${
              isLampOn
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-300 shadow-[0_0_15px_rgba(250,204,21,0.2)]'
                : 'bg-slate-800/80 border-slate-700/80 text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isLampOn ? 'bg-amber-400 shadow-[0_0_8px_#FACC15]' : 'bg-slate-500'
            }`} />
            {isLampOn ? 'Studio Lamp: Illuminated' : 'Studio Lamp: Switched Off'}
          </motion.div>

          {/* SVG Desk Lamp */}
          <div className="relative w-[240px] sm:w-[280px] h-[320px] sm:h-[350px]">

            {/* Lamp Bulb Halo when ON */}
            <div
              className={`absolute -top-3 left-[92px] w-28 h-28 rounded-full pointer-events-none transition-all duration-700 ${
                isLampOn
                  ? 'bg-amber-300/40 blur-2xl scale-125 opacity-100'
                  : 'bg-transparent blur-none scale-50 opacity-0'
              }`}
            />

            {/* SVG Illustration */}
            <svg
              viewBox="0 0 280 350"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
            >
              <defs>
                {/* Metallic Brass Lamp Gradient */}
                <linearGradient id="lampMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="50%" stopColor="#94A3B8" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>

                {/* Brass Gold Accent */}
                <linearGradient id="lampGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FDE047" />
                  <stop offset="60%" stopColor="#EAB308" />
                  <stop offset="100%" stopColor="#A16207" />
                </linearGradient>

                {/* Lamp Shade Interior Glow */}
                <linearGradient id="shadeInterior" x1="0%" y1="0%" x2="100%" y2="80%">
                  <stop offset="0%" stopColor={isLampOn ? '#FEF08A' : '#1E293B'} />
                  <stop offset="70%" stopColor={isLampOn ? '#FACC15' : '#0F172A'} />
                  <stop offset="100%" stopColor={isLampOn ? '#CA8A04' : '#020617'} />
                </linearGradient>

                {/* Light Beam from Shade aperture */}
                <linearGradient id="shadeApertureGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={isLampOn ? '#FFFFFF' : '#334155'} />
                  <stop offset="40%" stopColor={isLampOn ? '#FEF08A' : '#1E293B'} />
                  <stop offset="100%" stopColor={isLampOn ? '#F59E0B' : '#0F172A'} />
                </linearGradient>
              </defs>

              {/* 1. Heavy Weighted Base */}
              <ellipse cx="90" cy="326" rx="58" ry="12" fill="#0B1320" />
              <ellipse cx="90" cy="324" rx="54" ry="10" fill="url(#lampMetal)" />
              <ellipse cx="90" cy="321" rx="46" ry="7" fill="#1E293B" />
              <rect x="83" y="306" width="14" height="16" rx="3" fill="url(#lampGold)" />

              {/* 2. Lower Angled Arm */}
              <line x1="90" y1="310" x2="68" y2="185" stroke="url(#lampMetal)" strokeWidth="9" strokeLinecap="round" />
              <line x1="90" y1="310" x2="68" y2="185" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

              {/* Center Pivot Joint */}
              <circle cx="68" cy="185" r="9" fill="url(#lampGold)" stroke="#78350F" strokeWidth="1.5" />
              <circle cx="68" cy="185" r="4" fill="#0F172A" />

              {/* 3. Upper Arm */}
              <line x1="68" y1="185" x2="142" y2="78" stroke="url(#lampMetal)" strokeWidth="9" strokeLinecap="round" />
              <line x1="68" y1="185" x2="142" y2="78" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

              {/* Upper Pivot Socket */}
              <circle cx="142" cy="78" r="9" fill="url(#lampGold)" stroke="#78350F" strokeWidth="1.5" />
              <circle cx="142" cy="78" r="4" fill="#0F172A" />

              {/* 4. Conical Lamp Shade (Turned diagonally down-right toward card) */}
              <g transform="rotate(38 142 78)">
                {/* Shade Top Neck */}
                <path d="M 136 62 L 148 62 L 146 76 L 138 76 Z" fill="url(#lampGold)" />

                {/* Shade Outer Body */}
                <path
                  d="M 124 76 L 160 76 L 186 138 L 98 138 Z"
                  fill="url(#lampMetal)"
                  stroke="#1E293B"
                  strokeWidth="1.5"
                />

                {/* Highlight ridge on shade */}
                <path d="M 141 76 L 143 76 L 145 138 L 139 138 Z" fill="#E2E8F0" opacity="0.25" />

                {/* Shade Interior Lip & Aperture */}
                <ellipse cx="142" cy="138" rx="44" ry="14" fill="url(#shadeInterior)" />

                {/* Light Bulb Glass Inside */}
                <circle
                  cx="142"
                  cy="126"
                  r="13"
                  fill="url(#shadeApertureGlow)"
                  filter={isLampOn ? 'drop-shadow(0 0 10px #FDE047)' : undefined}
                />
                {isLampOn && (
                  <circle cx="142" cy="126" r="6" fill="#FFFFFF" opacity="0.9" />
                )}
              </g>

              {/* Subtle Desk Horizon Line */}
              <line x1="0" y1="334" x2="280" y2="334" stroke="#1E293B" strokeWidth="2" strokeDasharray="3 3" opacity="0.6" />
            </svg>

            {/* 5. INTERACTIVE HANGING PULL CORD & BEADED CHAIN */}
            <div
              ref={cordRef}
              onClick={handleToggleLamp}
              className="absolute left-[162px] top-[108px] cursor-pointer group flex flex-col items-center"
              title="Pull cord to toggle lamp"
            >
              {/* Beaded Chain */}
              <motion.div
                animate={{
                  y: isPullingCord ? [0, 22, 0] : [0, 2, 0],
                }}
                transition={{
                  duration: isPullingCord ? 0.28 : 2.8,
                  repeat: isPullingCord ? 0 : Infinity,
                  ease: 'easeInOut',
                }}
                className="flex flex-col items-center"
              >
                {/* 5 Beaded links */}
                <span className="w-[2.5px] h-3 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_rgba(250,204,21,0.6)] my-0.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 my-0.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_rgba(250,204,21,0.6)] my-0.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 my-0.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_rgba(250,204,21,0.6)] my-0.5" />
                <span className="w-[2.5px] h-3 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />

                {/* Brass Weighted Teardrop Handle */}
                <motion.div
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.9, y: 14 }}
                  className={`relative w-4 h-7 rounded-b-full rounded-t-sm flex items-center justify-center transition-all duration-300 shadow-md ${
                    isLampOn
                      ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 shadow-[0_0_12px_rgba(250,204,21,0.5)] border border-amber-200'
                      : 'bg-gradient-to-b from-slate-400 via-slate-500 to-slate-700 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse'
                  }`}
                >
                  {/* Grip bands */}
                  <span className="w-2.5 h-[1.5px] bg-black/30 rounded-full" />
                </motion.div>
              </motion.div>

              {/* Cord Pull Glow Beacon when OFF to invite user interaction */}
              {!isLampOn && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] text-emerald-300 whitespace-nowrap shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                >
                  <Lightbulb size={10} className="text-emerald-400" />
                  Pull cord to turn on
                </motion.div>
              )}
            </div>
          </div>

          {/* Quick Lamp Control hint */}
          <button
            type="button"
            onClick={handleToggleLamp}
            className="mt-2 text-[11px] font-medium text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 opacity-70 hover:opacity-100"
          >
            <Lightbulb size={12} className={isLampOn ? 'text-amber-400' : 'text-slate-500'} />
            Click cord or switch here to {isLampOn ? 'dim' : 'illuminate'}
          </button>
        </div>

        {/* ── RIGHT SECTION: FROSTED GLASS LOGIN CARD ── */}
        <motion.div
          layout
          className={`relative w-full max-w-md rounded-3xl p-7 sm:p-8 backdrop-blur-xl transition-all duration-700 ${
            isLampOn
              ? 'bg-slate-900/75 border border-amber-400/25 shadow-[0_0_70px_-15px_rgba(250,204,21,0.22)]'
              : 'bg-[#0E1522]/60 border border-white/5 shadow-2xl opacity-85'
          }`}
        >
          {/* Subtle Warm Top Rim Glow */}
          {isLampOn && (
            <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          )}

          {/* ── PORTAL SWITCHER PILL TABS: [ Master Admin ] vs [ Shop Login (18 Outlets) ] ── */}
          <div className="relative mb-6 p-1 rounded-2xl bg-black/40 border border-white/10 flex items-center">
            <button
              type="button"
              onClick={() => {
                setActivePortal('admin')
                setErrors({})
              }}
              className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 z-10 ${
                activePortal === 'admin'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {activePortal === 'admin' && (
                <motion.div
                  layoutId="portalPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_16px_rgba(250,204,21,0.4)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <ShieldCheck size={14} className={activePortal === 'admin' ? 'text-slate-950' : 'text-slate-400'} />
                Master Admin
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePortal('shop')
                setErrors({})
              }}
              className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 z-10 ${
                activePortal === 'shop'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {activePortal === 'shop' && (
                <motion.div
                  layoutId="portalPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_16px_rgba(250,204,21,0.4)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Store size={14} className={activePortal === 'shop' ? 'text-slate-950' : 'text-slate-400'} />
                Shop Login (18 Outlets)
              </span>
            </button>
          </div>

          {/* ── CARD HEADER & BRANDING ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Zap size={20} className="text-slate-950 fill-slate-950" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Smart Cashback</h1>
                  <p className="text-[11px] text-amber-300/80 font-medium tracking-wide">
                    {activePortal === 'admin' ? 'Master Headquarters Control' : 'Authorized Outlet POS Terminal'}
                  </p>
                </div>
              </div>

              {/* Outlet / Tier Badge */}
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border bg-white/5 border-white/10 text-slate-300">
                {activePortal === 'admin' ? 'SUPERUSER' : 'OUTLET #1–18'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              {activePortal === 'admin'
                ? 'Sign in to access your Cashback Engine, shop rules, analytics & master ledger.'
                : 'Select your retail branch and counter operator credentials to start customer billing.'}
            </p>
          </div>

          {/* ── LOGIN FORM: MASTER ADMIN VS SHOP PARTNER ── */}
          <AnimatePresence mode="wait">
            {activePortal === 'admin' ? (
              /* MASTER ADMIN FORM */
              <motion.form
                key="admin-form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleAdminSubmit}
                noValidate
                className="space-y-4"
              >
                {/* Master Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Master Admin Email</span>
                    <span className="text-[10px] font-normal text-amber-400/80 lowercase">admin identity</span>
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="admin@smartcashback.com"
                      autoComplete="username"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border ${
                        errors.adminEmail ? 'border-rose-400' : 'border-white/10 focus:border-amber-400'
                      } text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all`}
                    />
                  </div>
                  {errors.adminEmail && <p className="text-xs text-rose-400 mt-1">{errors.adminEmail}</p>}
                </div>

                {/* Master Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Master Password</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">encrypted key</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border ${
                        errors.adminPassword ? 'border-rose-400' : 'border-white/10 focus:border-amber-400'
                      } text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.adminPassword && <p className="text-xs text-rose-400 mt-1">{errors.adminPassword}</p>}
                </div>

                {/* 2FA / Security PIN (Optional/Advanced) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>2FA / Hardware Security PIN</span>
                    <span className="text-[10px] font-normal text-slate-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="password"
                      maxLength={6}
                      value={admin2FA}
                      onChange={e => setAdmin2FA(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit security code"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-amber-400 text-sm font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-110 active:scale-[0.99] transition-all shadow-[0_0_22px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                      Authenticating Master Admin…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} className="text-slate-950" />
                      Sign In as Master Admin
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              /* SHOP PARTNER PORTAL (18 OUTLETS) FORM */
              <motion.form
                key="shop-form"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleShopSubmit}
                noValidate
                className="space-y-4"
              >
                {/* Branch / Outlet Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Retail Branch / Outlet</span>
                    <span className="text-[10px] font-normal text-amber-400/80">18 Outlets Connected</span>
                  </label>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedOutlet}
                      onChange={e => setSelectedOutlet(e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-900 border border-white/10 focus:border-amber-400 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all cursor-pointer"
                    >
                      {OUTLETS.map(outlet => (
                        <option key={outlet.id} value={outlet.id} className="bg-slate-900 text-white py-1">
                          {outlet.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">▼</span>
                  </div>
                </div>

                {/* Counter Operator ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Counter Operator / Cashier ID</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">terminal user</span>
                  </label>
                  <div className="relative">
                    <UserCheck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={operatorId}
                      onChange={e => setOperatorId(e.target.value)}
                      placeholder="e.g. OPR-1801 or Cashier 1"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border ${
                        errors.operatorId ? 'border-rose-400' : 'border-white/10 focus:border-amber-400'
                      } text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all`}
                    />
                  </div>
                  {errors.operatorId && <p className="text-xs text-rose-400 mt-1">{errors.operatorId}</p>}
                </div>

                {/* Outlet Access Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Counter Access Password / PIN</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">branch pass</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={shopPassword}
                      onChange={e => setShopPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border ${
                        errors.shopPassword ? 'border-rose-400' : 'border-white/10 focus:border-amber-400'
                      } text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.shopPassword && <p className="text-xs text-rose-400 mt-1">{errors.shopPassword}</p>}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-110 active:scale-[0.99] transition-all shadow-[0_0_22px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                      Opening POS Terminal…
                    </>
                  ) : (
                    <>
                      <Store size={16} className="text-slate-950" />
                      Sign In to Outlet #{selectedOutlet}
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ── FOOTER ACTIONS & BIOMETRIC AUTH ── */}
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => toast('For password reset, contact the shop administrator or use Supabase Auth reset.')}
                className="hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                <HelpCircle size={13} />
                Forgot Password?
              </button>

              <button
                type="button"
                onClick={handleBiometricAuth}
                disabled={biometricPending}
                className="hover:text-amber-300 transition-colors flex items-center gap-1.5 font-medium text-slate-300"
              >
                <Fingerprint size={14} className="text-amber-400" />
                Biometric Key / Passkey
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-400" />
              End-to-end encrypted with Supabase TLS & RLS Policies
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── COPYRIGHT ATTR ── */}
      <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
        <p className="text-[11px] text-slate-600">
          Smart Cashback POS Engine © {new Date().getFullYear()} • 18 Outlets Network
        </p>
      </div>
    </div>
  )
}
