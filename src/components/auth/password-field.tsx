import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  id?: string
  name?: string
  forgotHref?: string
  label?: string
}

export function PasswordField({
  id = 'password',
  name = 'password',
  label = 'Password',
  forgotHref,
}: Props) {
  const [shown, setShown] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {forgotHref && (
          <a href={forgotHref} className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </a>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          required
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}
