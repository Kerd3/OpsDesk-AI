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
    <div className="flex min-h-screen bg-white">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">Sign in to your workspace</h1>
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
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Local demo accounts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setValue('email', a.email, { shouldValidate: true });
                      setFocus('password');
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
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

      <div className="relative hidden flex-1 overflow-hidden bg-brand-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(107,120,212,0.35),transparent_55%)]" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-center px-16 xl:px-24">
          <p className="text-sm font-semibold tracking-wide text-brand-300 uppercase">Internal IT & business support</p>
          <h2 className="mt-4 max-w-md text-3xl leading-tight font-semibold text-white">Help that answers from your own documentation.</h2>
          <ul className="mt-10 max-w-md space-y-6">
            {[
              [Sparkles, 'AI troubleshooting', 'Answers grounded in published company articles, with sources you can open.'],
              [BookOpen, 'One knowledge base', 'IT maintains approved procedures that employees and the assistant share.'],
              [ShieldCheck, 'Role-based access', 'Private tickets and internal notes stay with the people who need them.'],
            ].map(([Icon, title, text]) => (
              <li key={title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5 text-brand-200" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-1 text-sm text-brand-200/90">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
