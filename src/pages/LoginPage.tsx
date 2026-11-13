import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { session, signIn, loading } = useAuthStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [lampOn, setLampOn] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const successfulLoginRef = useRef(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  useEffect(() => {
    if (lampOn) emailInputRef.current?.focus()
  }, [lampOn])

  useEffect(() => {
    if (session && !isLeaving && !successfulLoginRef.current) {
      navigate('/billing', { replace: true })
    }
  }, [session, isLeaving, navigate])

  const validate = () => {
    const e: typeof errors = {}
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email address'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!lampOn || !validate()) return
    const { error } = await signIn(email.trim(), password)
    if (error) {
      toast.error(error)
      setErrors({ password: 'Invalid credentials. Please try again.' })
    } else {
      successfulLoginRef.current = true
      setIsLeaving(true)
      window.setTimeout(() => {
        navigate('/billing', { replace: true, state: { loginSuccess: true } })
      }, 180)
    }
  }

  return (
    <div className={`login-scene min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${lampOn ? 'is-lit' : ''}`}>
      <div className="relative z-10 w-full max-w-md">
        <div className="login-lamp" aria-label={`Sign-in lamp ${lampOn ? 'on' : 'off'}`}>
          <div className="login-lamp__shade" />
          <span className="login-lamp__cord" />
          <button
            type="button"
            className="login-lamp__pull"
            aria-label={lampOn ? 'Turn off sign-in lamp' : 'Pull cord to illuminate sign-in'}
            title={lampOn ? 'Turn lamp off' : 'Pull to turn lamp on'}
            onClick={() => setLampOn(value => !value)}
          />
        </div>

        <div className={`login-card rounded-3xl p-8 transition-colors duration-200 ${isLeaving ? 'is-exiting' : ''}`}>
          <div className="text-center mb-8">
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              className="inline-flex w-16 h-16 rounded-2xl shadow-lg shadow-amber-500/20 mb-4"
            />
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Smart Cashback</h1>
            <p className="text-xs text-slate-400 mt-1">Administrator Sign In</p>
            <p className="text-[11px] text-slate-500 mt-3">
              {lampOn ? 'Sign-in is illuminated' : 'Pull the cord to illuminate sign-in'}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="login-email" className="form-label">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={emailInputRef}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`form-input pl-10 disabled:opacity-45 ${errors.email ? 'border-amber-500' : ''}`}
                  placeholder="admin@yourshop.com"
                  disabled={!lampOn || loading}
                  tabIndex={lampOn ? 0 : -1}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="login-password" className="form-label">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`form-input pl-10 pr-10 disabled:opacity-45 ${errors.password ? 'border-amber-500' : ''}`}
                  placeholder="••••••••"
                  disabled={!lampOn || loading}
                  tabIndex={lampOn ? 0 : -1}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-40"
                  tabIndex={lampOn ? 0 : -1}
                  disabled={!lampOn || loading}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3 text-base mt-2"
              disabled={!lampOn || loading || isLeaving}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#08090D]/40 border-t-[#08090D] rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#1E2638] text-center">
            <p className="text-xs text-slate-400">
              Protected administrator access only
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Smart Cashback © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
