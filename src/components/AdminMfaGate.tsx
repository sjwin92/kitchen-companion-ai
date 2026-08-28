import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type MfaSetup = {
  factorId: string;
  qrCode?: string;
  secret?: string;
  isEnrollment: boolean;
};

export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    setError(null);
    const [{ data: aal, error: aalError }, { data: factors, error: factorError }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    if (aalError || factorError) {
      setError(aalError?.message ?? factorError?.message ?? 'MFA status could not be checked.');
      setChecking(false);
      return;
    }

    const factor = factors.totp.find(candidate => candidate.status === 'verified');
    setVerifiedFactorId(factor?.id ?? null);
    setVerified(aal.currentLevel === 'aal2');
    setChecking(false);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function beginEnrollment() {
    setSubmitting(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Kitchen Companion admin',
    });
    if (enrollError) {
      setError(enrollError.message);
    } else {
      setSetup({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        isEnrollment: true,
      });
    }
    setSubmitting(false);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const factorId = setup?.factorId ?? verifiedFactorId;
    if (!factorId || code.length !== 6) return;

    setSubmitting(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError(challengeError.message);
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    setCode('');
    setSetup(null);
    await refreshStatus();
    setSubmitting(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Checking administrator security" />
      </div>
    );
  }

  if (verified) return <>{children}</>;

  const activeFactorId = setup?.factorId ?? verifiedFactorId;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full border-primary/15 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle>Administrator verification</CardTitle>
          <CardDescription>
            Catalogue and creator controls require a six-digit code from an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!activeFactorId ? (
            <Button className="min-h-11 w-full" onClick={() => void beginEnrollment()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Set up authenticator
            </Button>
          ) : (
            <form className="space-y-5" onSubmit={verifyCode}>
              {setup?.qrCode && (
                <div className="space-y-3 rounded-2xl bg-muted/45 p-4 text-center">
                  <p className="text-sm font-medium">Scan this code with your authenticator app</p>
                  <img
                    src={setup.qrCode}
                    alt="Authenticator setup QR code"
                    width={200}
                    height={200}
                    className="mx-auto rounded-xl bg-white p-2"
                  />
                  {setup.secret && (
                    <details className="text-left text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">Enter a setup key instead</summary>
                      <code className="mt-2 block break-all rounded-lg bg-background p-3 text-foreground">{setup.secret}</code>
                    </details>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="admin-mfa-code" className="text-sm font-medium">Six-digit code</label>
                <Input
                  id="admin-mfa-code"
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="h-12 text-center text-lg tracking-[0.35em]"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="min-h-11 w-full" disabled={submitting || code.length !== 6}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify and continue
              </Button>
            </form>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
