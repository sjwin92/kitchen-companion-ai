import { ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL?.trim();

function PageShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:py-14">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-border/60 bg-card p-6 shadow-[0_18px_60px_rgba(29,52,43,0.08)] md:p-10">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-xs font-bold text-primary"><ArrowLeft className="h-4 w-4" /> Back to Kitchen Companion</Link>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary/70">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] md:text-5xl">{title}</h1>
        <p className="mt-3 text-xs text-muted-foreground">Beta notice · Last updated 26 August 2026</p>
        <div className="prose prose-sm mt-9 max-w-none prose-headings:font-semibold prose-headings:tracking-[-0.02em] prose-p:leading-7 prose-li:leading-7 prose-a:text-primary">
          {children}
        </div>
      </article>
    </main>
  );
}

function Privacy() {
  return (
    <PageShell eyebrow="Your data" title="Privacy notice">
      <p>Kitchen Companion is an early beta kitchen-management service. It uses the information you provide to track food, suggest suitable recipes, plan meals, prepare shopping lists and record nutrition or waste.</p>
      <h2>Information we process</h2>
      <ul>
        <li>Account details, household preferences, dietary requirements, allergies and disliked ingredients.</li>
        <li>Food inventory, expiry dates, meal plans, shopping items, consumption and waste records.</li>
        <li>Photos you deliberately submit for receipt, expiry, fridge or nutrition analysis.</li>
        <li>Technical security and error information needed to operate the beta.</li>
      </ul>
      <h2>How AI is used</h2>
      <p>Image and text analysis is optional. Submitted content may be sent to the configured AI provider solely to return the requested result. Scans return candidates for your confirmation and do not silently change inventory. Private recipes are not made public without a separate submission and editorial review.</p>
      <h2>Storage and sharing</h2>
      <p>Account and kitchen records are stored in Supabase. Service providers are used only where needed to host the app, analyse an optional submission, report redacted errors or send notifications. Kitchen Companion does not sell personal data.</p>
      <h2>Retention and control</h2>
      <p>You can change preferences, export account data or request account deletion from Settings. Meal-analysis photos have a limited retention period. Legal, fraud-prevention or security obligations may require limited records to be kept for longer.</p>
      <h2>Your choices</h2>
      <p>You can use manual entry and barcode lookup when you do not want to submit a photo. You may disable notifications and can withdraw from the beta at any time.</p>
      <p>This beta notice must be reviewed with the founder’s final business identity and contact details before public invitations open.</p>
    </PageShell>
  );
}

function Terms() {
  return (
    <PageShell eyebrow="Beta access" title="Terms of use">
      <p>Kitchen Companion is provided as an evolving beta. Features may change, experience interruptions or contain errors. Beta access is personal and may be paused to protect users, content rights or service budgets.</p>
      <h2>Food and nutrition</h2>
      <p>Expiry prompts, ingredient matching and nutrition estimates are organisational aids, not medical, allergy, food-safety or professional dietary advice. Check packaging, allergens, safe storage and food condition yourself. Do not consume food you believe is unsafe.</p>
      <h2>Your account and content</h2>
      <p>Keep account credentials secure and provide accurate dietary and allergy information. You retain ownership of private recipes and photos. Submitting a recipe for community review is a separate, explicit action and requires you to confirm that you have the necessary rights.</p>
      <h2>Creator content</h2>
      <p>Creator packs may be displayed only with recorded permission and attribution. Links to external video or creator services are governed by those services’ own terms.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse scans, attempt to access another user’s data, interfere with service limits, upload unlawful content or claim rights you do not hold.</p>
      <h2>Availability</h2>
      <p>No guarantee is made that retailer prices, product data or optional AI services will always be available or complete. Confirm prices and availability with the retailer before purchasing.</p>
      <p>These beta terms require final legal and founder review before the service is promoted publicly.</p>
    </PageShell>
  );
}

function Support() {
  return (
    <PageShell eyebrow="Help" title="Support">
      <p>For account access, incorrect dietary filtering, privacy requests, content rights or unexpected AI charges, contact Kitchen Companion support.</p>
      {SUPPORT_EMAIL ? (
        <p><a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" /> {SUPPORT_EMAIL}</a></p>
      ) : (
        <div className="not-prose rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The public support email is being configured. Do not open external beta invitations until it is displayed here.</div>
      )}
      <h2>When reporting a problem</h2>
      <p>Describe what you expected, what happened and which screen you were using. Do not email passwords, API keys, complete receipts or sensitive medical information.</p>
      <h2>Urgent stop conditions</h2>
      <p>Report cross-account data, unsafe allergy recommendations, unapproved creator content, inventory changes you did not confirm or unexpected paid AI usage immediately.</p>
      <p><a href="https://github.com/sjwin92/kitchen-companion-ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">Project status <ExternalLink className="h-3.5 w-3.5" /></a></p>
    </PageShell>
  );
}

export default function PublicInformation() {
  const { pathname } = useLocation();
  if (pathname.endsWith('/privacy')) return <Privacy />;
  if (pathname.endsWith('/terms')) return <Terms />;
  return <Support />;
}
