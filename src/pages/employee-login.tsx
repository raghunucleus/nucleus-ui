import { useEffect } from 'react'
import { ArrowRight, GraduationCap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandPanel } from '@/components/auth/brand-panel'
import { GoogleButton } from '@/components/auth/google-button'
import { PasswordField } from '@/components/auth/password-field'

export default function EmployeeLogin() {
  useEffect(() => {
    document.title = 'Employee sign in — Nucleus'
  }, [])

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <BrandPanel variant="employee" />

      <main className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:w-[28rem] lg:flex-none lg:px-12">
        <div className="flex items-center gap-2 lg:hidden">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">Nucleus</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-8">
            <header className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                Faculty &amp; staff
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground">
                Sign in with your employee credentials to continue.
              </p>
            </header>

            <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="empcode">Employee code</Label>
                <Input
                  id="empcode"
                  name="empcode"
                  placeholder="e.g. EMP1042"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>

              <PasswordField forgotHref="#" />

              <Button type="submit" size="lg" className="w-full">
                Sign in
                <ArrowRight />
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-background px-3 text-muted-foreground">or</span>
              </div>
            </div>

            <GoogleButton />

            <p className="text-center text-xs text-muted-foreground">
              Trouble signing in?{' '}
              <a href="#" className="font-medium text-foreground hover:underline">
                Contact IT support
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
