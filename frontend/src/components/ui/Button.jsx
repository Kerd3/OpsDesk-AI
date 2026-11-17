import { forwardRef } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300',
};
const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
  icon: 'size-9 justify-center',
};

export const buttonClass = (variant = 'primary', size = 'md', className = '') =>
  `inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', children, disabled, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ to, variant = 'primary', size = 'md', icon: Icon, className = '', children, ...props }) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)} {...props}>
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </Link>
  );
}
