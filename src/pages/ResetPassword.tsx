import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const linkError = hash.get('error_description');
    if (linkError) {
      setRecoveryError(linkError);
      setRecoveryState('invalid');
      return undefined;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === 'PASSWORD_RECOVERY' && session) {
        setRecoveryState('ready');
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setRecoveryError(error?.message ?? 'This recovery link is missing, expired or has already been used.');
        setRecoveryState('invalid');
        return;
      }
      setRecoveryState('ready');
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
      toast.error('Use at least 10 characters, including a letter and a number');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password updated');
    navigate('/', { replace: true });
  };

  if (recoveryState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Checking your recovery link…
        </div>
      </div>
    );
  }

  if (recoveryState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ChefHat className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Request a new recovery link</h1>
          <p className="text-sm text-muted-foreground">{recoveryError}</p>
          <Button type="button" className="w-full" onClick={() => navigate('/', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ChefHat className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">This recovery link can only be used once.</p>
        </div>
        <form onSubmit={updatePassword} className="space-y-4">
          <div>
            <label className="text-sm font-medium">New password</label>
            <Input type="password" autoComplete="new-password" minLength={10} value={password} onChange={event => setPassword(event.target.value)} required />
            <p className="mt-1 text-xs text-muted-foreground">At least 10 characters, including a letter and a number.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <Input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
