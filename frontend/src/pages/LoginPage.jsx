import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Form.jsx';
import { Alert } from '../components/ui/States.jsx';
import { Logo } from '../components/layout/Logo.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@opsdesk.local' },
  { label: 'IT Support', email: 'support@opsdesk.local' },
  { label: 'Employee', email: 'employee@opsdesk.local' },
];

export default function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setValue, setFocus, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '', password: '' } });

  useEffect(() => {
    document.title = 'Sign in · OpsDesk AI';
  }, []);

  if (status === 'authenticated') return <Navigate to={location.state?.from ?? '/'} replace />;

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setServerError(err.status === 422 ? 'Enter a valid email address and password.' : err.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-night">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="font-display mt-10 text-[28px] leading-tight font-semibold tracking-tight text-slate-900">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Use your company account to get IT help, track requests and find answers.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            {serverError && <Alert tone="error">{serverError}</Alert>}
            <Field label="Email address" error={errors.email?.message}>
              {(a) => (
                <Input
                  {...a}
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  invalid={!!errors.email}
                  {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' } })}
                />
              )}
            </Field>
            <Field label="Password" error={errors.password?.message}>
              {(a) => (
                <div className="relative">
                  <Input {...a} type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-10" invalid={!!errors.password} {...register('password', { required: 'Password is required' })} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={LockKeyhole}>
              Sign in
            </Button>
          </form>

          {/* Local development helper: fills the email only. The password comes from SEED_DEMO_PASSWORD. */}
          {import.meta.env.DEV && (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
              <p className="text-xs font-medium text-slate-500">Local demo accounts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setValue('email', a.email, { shouldValidate: true });
                      setFocus('password');
                    }}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-slate-900"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Password: the SEED_DEMO_PASSWORD value from your .env file.</p>
            </div>
          )}
        </div>
      </div>

      <section className="relative hidden flex-1 flex-col justify-center border-l border-slate-200 bg-white bg-[radial-gradient(120%_80%_at_80%_10%,rgb(45_212_191/0.08),transparent_60%)] px-16 lg:flex xl:px-24" aria-label="What OpsDesk does">
        <h2 className="font-display max-w-md text-2xl leading-snug font-semibold text-slate-900">Answers come from your company's own help articles.</h2>
        <p className="mt-2 max-w-lg text-slate-500">Ask about a problem in plain words. OpsDesk shows the steps and the article each one came from, and hands you to IT when the articles don't cover it.</p>
        {/* A static example of a cited answer (fictional demo content). */}
        <div className="mt-8 grid max-w-xl gap-4 rounded-xl border border-slate-200 bg-night p-6" aria-hidden="true">
          <p className="justify-self-end rounded-xl rounded-br-sm border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-900">The printer on 2nd floor east shows offline</p>
          <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-brand-300 bg-brand-50">
              <Sparkles className="size-3.5 text-brand-500" />
            </span>
            <div className="grid flex-1 gap-3">
              <ol className="border-l border-slate-300">
                {["Check the printer's display for an error and that it is powered on.", 'Make sure your laptop is on HV-Corp, not HV-Guest.', 'Open the print queue and cancel stuck documents.'].map((step, i) => (
                  <li key={step} className="relative py-1 pl-6 text-sm text-slate-900">
                    <span className="absolute top-1.5 -left-[10px] grid size-[19px] place-items-center rounded-full border border-slate-300 bg-night font-mono text-[10px] font-semibold text-slate-500">{i + 1}</span>
                    {step}
                    <span className="ml-1.5 inline-grid h-4 min-w-[18px] place-items-center rounded bg-brand-50 px-1 align-[2px] font-mono text-[10px] font-semibold text-brand-500">1</span>
                  </li>
                ))}
              </ol>
              <p className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                <span className="font-mono text-[11px] font-semibold text-brand-500">1</span>
                <BookOpen className="size-3.5 text-slate-500" />
                How to troubleshoot an office printer
              </p>
            </div>
          </div>
        </div>
        <ul className="mt-8 grid max-w-xl gap-2 text-sm text-slate-500">
          <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand-500" aria-hidden="true" />Private tickets and internal notes stay with the people who need them.</li>
        </ul>
      </section>
    </div>
  );
}
