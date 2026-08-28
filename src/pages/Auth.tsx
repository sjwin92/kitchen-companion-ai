import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ChefHat } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authRedirectUrl } from '@/lib/appUrls';
import { Turnstile } from '@marsidev/react-turnstile';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSentTo, setResetSentTo] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const resetCaptcha = () => {
    setCaptchaToken(undefined);
    setCaptchaError(null);
    setCaptchaKey(value => value + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password))) {
      toast.error('Use at least 10 characters, including a letter and a number');
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        if (error) throw error;
        toast.success('Welcome back!');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { invite_code: inviteCode.trim() },
            captchaToken,
            emailRedirectTo: authRedirectUrl(''),
          },
        });
        if (error) throw error;
        toast.success('Check your email to confirm your account!');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      if (TURNSTILE_SITE_KEY) resetCaptcha();
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      toast.error('Enter your email address first');
      document.getElementById('auth-email')?.focus();
      return;
    }
    setResetting(true);
    setResetSentTo('');
    try {
      const normalizedEmail = email.trim();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: authRedirectUrl('reset-password'),
        captchaToken,
      });
      if (error) throw error;
      setResetSentTo(normalizedEmail);
      toast.success('Password reset email sent');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'We could not send the reset email. Please try again.');
    } finally {
      if (TURNSTILE_SITE_KEY) resetCaptcha();
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Kitchen Companion</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? 'Sign in to your kitchen' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="text-sm font-medium text-foreground">Email</label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="text-sm font-medium text-foreground">Password</label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? undefined : 10}
            />
            {!isLogin && <p className="mt-1 text-xs text-muted-foreground">At least 10 characters, including a letter and a number.</p>}
          </div>
          {!isLogin && (
            <div>
              <label htmlFor="beta-invite-code" className="text-sm font-medium text-foreground">Beta invitation code</label>
              <Input
                id="beta-invite-code"
                value={inviteCode}
                onChange={event => setInviteCode(event.target.value)}
                placeholder="Your one-time invitation"
                required
                minLength={12}
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground mt-1">Invitation codes are tied to your email and work once.</p>
            </div>
          )}
          {TURNSTILE_SITE_KEY && (
            <div className="flex min-h-[70px] items-center justify-center rounded-xl border border-border/70 bg-card p-2" aria-label="Security verification">
              <Turnstile
                key={captchaKey}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={token => { setCaptchaToken(token); setCaptchaError(null); }}
                onExpire={() => { setCaptchaToken(undefined); setCaptchaError('Security verification expired. Please complete it again.'); }}
                onError={() => { setCaptchaToken(undefined); setCaptchaError('Security verification did not load. Check your connection and retry.'); }}
                options={{ theme: 'light', size: 'flexible' }}
              />
            </div>
          )}
          {captchaError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span>{captchaError}</span>
              <Button type="button" variant="outline" size="sm" onClick={resetCaptcha}>Retry</Button>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || Boolean(TURNSTILE_SITE_KEY && !captchaToken)}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        {isLogin && (
          <div className="space-y-3 text-center">
            <button
              type="button"
              onClick={() => void handlePasswordReset()}
              disabled={resetting || Boolean(TURNSTILE_SITE_KEY && !captchaToken)}
              className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-muted-foreground hover:text-primary disabled:cursor-wait disabled:opacity-60"
            >
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resetting ? 'Sending reset email…' : 'Forgot your password?'}
            </button>
            {resetSentTo && (
              <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left text-sm">
                <p className="font-medium text-foreground">Check your email</p>
                <p className="mt-1 text-muted-foreground">
                  We sent a one-time recovery link to {resetSentTo}. Check spam if it does not arrive.
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setIsLogin(!isLogin); if (TURNSTILE_SITE_KEY) resetCaptcha(); }}
            className="text-primary font-medium hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
        <nav aria-label="Legal and support" className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <Link to="/privacy" className="hover:text-primary">Privacy</Link>
          <Link to="/terms" className="hover:text-primary">Terms</Link>
          <Link to="/support" className="hover:text-primary">Support</Link>
        </nav>
      </div>
    </div>
  );
}
