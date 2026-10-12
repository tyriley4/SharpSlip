import { InputHTMLAttributes } from 'react'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-text placeholder:text-text/40 focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}
