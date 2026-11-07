import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Coins, ShieldCheck, Zap, QrCode } from 'lucide-react'
import { formatCurrency } from '@/lib/cashback'

interface DigitalCashbackPassProps {
  customerName: string
  mobile: string
  balance: number
  shopName?: string
  lifetimeEarned?: number
  className?: string
}

export default function DigitalCashbackPass3D({
  customerName,
  mobile,
  balance,
  shopName = 'Smart Cashback POS',
  lifetimeEarned,
  className = '',
}: DigitalCashbackPassProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Max tilt angle: 14 degrees
    const rX = ((y - centerY) / centerY) * -12
    const rY = ((x - centerX) / centerX) * 12

    setRotateX(rX)
    setRotateY(rY)
    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    })
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
    setGlarePosition({ x: 50, y: 50 })
  }

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ perspective: 1200 }}
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
        animate={{
          rotateX,
          rotateY: isFlipped ? rotateY + 180 : rotateY,
        }}
        transition={{
          type: 'spring',
          stiffness: 280,
          damping: 24,
        }}
        style={{
          transformStyle: 'preserve-3d',
        }}
        className="w-full max-w-md mx-auto aspect-[1.62/1] rounded-3xl relative cursor-pointer group shadow-2xl transition-shadow duration-300"
      >
        {/* ── CARD FRONT ── */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
          className="absolute inset-0 w-full h-full rounded-3xl p-6 sm:p-7 overflow-hidden flex flex-col justify-between border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(91,61,245,0.35)] bg-gradient-to-br from-[#5B3DF5] via-[#4A2FE0] to-[#241280] text-white"
        >
          {/* Dynamic Glare / Holographic sheen overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(232, 222, 255, 0.15) 35%, transparent 70%)`,
            }}
          />

          {/* Background Decorative Guilloche Rings */}
          <div className="pointer-events-none absolute -right-12 -bottom-12 w-64 h-64 rounded-full border-[18px] border-white/5 blur-[1px]" />
          <div className="pointer-events-none absolute -right-4 -bottom-4 w-44 h-44 rounded-full border-[10px] border-white/10" />
          <div className="pointer-events-none absolute left-1/3 -top-16 w-48 h-48 rounded-full bg-cyan-400/15 blur-2xl" />

          {/* Top Bar: Shop Name + 3D Animated Gold Coin */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-inner">
                <Zap size={16} className="text-yellow-300 fill-yellow-300/60" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest leading-none">
                  {shopName}
                </p>
                <p className="text-xs font-bold text-white tracking-wide mt-0.5">
                  Smart VIP Pass
                </p>
              </div>
            </div>

            {/* 3D Animated Coin / Token */}
            <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 backdrop-blur-md border border-yellow-400/40 shadow-sm">
              <motion.div
                animate={{ rotateY: [0, 180, 360] }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: 'linear',
                }}
                className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 border border-yellow-100 flex items-center justify-center shadow-sm text-[10px] font-black text-amber-900"
              >
                ₹
              </motion.div>
              <span className="text-[11px] font-bold text-yellow-300 tracking-wider uppercase">
                Active
              </span>
            </div>
          </div>

          {/* Middle: Metallic EMV Smart Chip + Contactless Signal */}
          <div className="relative z-10 flex items-center justify-between my-1">
            <div className="flex items-center gap-3">
              {/* Metallic Smart Chip */}
              <div className="w-11 h-9 rounded-lg bg-gradient-to-tr from-amber-200 via-yellow-100 to-amber-300 border border-amber-400/80 shadow-md relative overflow-hidden flex flex-col justify-between p-1">
                <div className="w-full h-[1px] bg-amber-700/30" />
                <div className="flex justify-between items-center px-1">
                  <div className="w-2.5 h-3 border border-amber-700/40 rounded-sm" />
                  <div className="w-2.5 h-3 border border-amber-700/40 rounded-sm" />
                </div>
                <div className="w-full h-[1px] bg-amber-700/30" />
              </div>

              {/* NFC Contactless Wave icon */}
              <div className="flex items-center gap-0.5 text-white/50">
                <span className="text-sm font-light">)</span>
                <span className="text-base font-normal">)</span>
                <span className="text-lg font-semibold">)</span>
              </div>
            </div>

            {/* Balance Preview Indicator */}
            <div className="text-right">
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest block">
                Cashback Balance
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] tracking-tight">
                {formatCurrency(balance)}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Customer Details & Hologram Seal */}
          <div className="relative z-10 flex items-end justify-between border-t border-white/15 pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-medium">
                Pass Holder
              </p>
              <p className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-[200px]">
                {customerName}
              </p>
              <p className="text-[11px] font-mono text-white/70 tracking-widest mt-0.5">
                +91 {mobile}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[9px] text-white/60 uppercase tracking-wider block">
                Flip to Details
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-100 bg-white/10 px-2 py-0.5 rounded-md mt-0.5">
                <Sparkles size={11} className="text-yellow-300" /> 2% Instant
              </span>
            </div>
          </div>
        </div>

        {/* ── CARD BACK ── */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="absolute inset-0 w-full h-full rounded-3xl p-6 overflow-hidden flex flex-col justify-between border border-white/20 shadow-2xl bg-gradient-to-br from-[#241280] via-[#3217A6] to-[#120743] text-white"
        >
          {/* Black Magnetic Stripe */}
          <div className="absolute top-6 left-0 w-full h-11 bg-slate-950/90 shadow-inner flex items-center px-6">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest">
              SMART CASHBACK SECURE NETWORK
            </span>
          </div>

          {/* Back Details */}
          <div className="relative z-10 mt-14 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">Program:</span>
              <span className="font-semibold text-white">Smart Xerox & Recharge Cashback</span>
            </div>
            {lifetimeEarned !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Lifetime Cashback Earned:</span>
                <span className="font-bold text-emerald-400">{formatCurrency(lifetimeEarned)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">Redemption Rule:</span>
              <span className="font-medium text-amber-300">Up to ₹50 or 50% on ₹99+</span>
            </div>
          </div>

          {/* CVV / Security Seal */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              <span className="text-[11px] text-white/80">Authorized Customer Card</span>
            </div>
            <span className="text-[10px] text-white/60 hover:text-white">Click to flip front ↺</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
