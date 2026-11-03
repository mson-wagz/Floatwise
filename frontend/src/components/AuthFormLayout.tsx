import React, { useState } from "react";
import { Link } from "react-router-dom";

export const inputClass =
  "w-full px-3 py-2.5 text-base border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

export const labelClass =
  "block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1";

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-6 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-105 transition-transform">
          FW
        </div>
        <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          FloatWise
        </span>
      </Link>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6">
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <p className="text-sm opacity-90 mt-1">{subtitle}</p>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showText,
  hideText,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  showText: string;
  hideText: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${inputClass} pr-16`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideText : showText}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          {visible ? hideText : showText}
        </button>
      </div>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}