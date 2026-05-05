import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Nucleus UI</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
        <section className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Design tokens</h2>
          <p className="text-muted-foreground">
            Brand colors are defined as CSS variables in{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">src/index.css</code>{' '}
            and consumed via Tailwind utilities. Toggle the theme to see them adapt.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <SwatchCard label="Primary" className="bg-primary text-primary-foreground" />
          <SwatchCard label="Secondary" className="bg-secondary text-secondary-foreground" />
          <SwatchCard label="Accent" className="bg-accent text-accent-foreground" />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setCount((c) => c + 1)}>Count: {count}</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
        </section>
      </main>
    </div>
  )
}

function SwatchCard({ label, className }: { label: string; className: string }) {
  return (
    <div className={`flex h-28 items-end rounded-lg p-4 shadow-sm ${className}`}>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export default App
