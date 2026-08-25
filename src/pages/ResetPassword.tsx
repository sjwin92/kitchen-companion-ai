import { useState } from 'react';
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

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error('Use at least 8 characters');
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
            <Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <Input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
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
