import { useState } from 'react'
import {
  CalendarDays,
  Heart,
  ImageIcon,
  Megaphone,
  MessageCircle,
  Radio,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { CAMPUS_FEED, type CampusPost, type FeedKind } from '@/lib/campus-mock'
import { MODULE_GRADIENT, MODULE_SOFT, type ModuleColor } from '@/lib/modules'

/** Visual treatment for each kind of post. */
const KIND: Record<
  FeedKind,
  { label: string; color: ModuleColor; icon: LucideIcon }
> = {
  announcement: { label: 'Announcement', color: 'amber', icon: Megaphone },
  event: { label: 'Event', color: 'blue', icon: CalendarDays },
  achievement: { label: 'Achievement', color: 'emerald', icon: Trophy },
  photo: { label: 'Photo', color: 'rose', icon: ImageIcon },
  update: { label: 'Update', color: 'cyan', icon: Radio },
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * The campus social feed — posts from students, faculty and official handles.
 * Likes toggle locally so the feed feels responsive without a backend.
 */
export function CampusFeed() {
  const [liked, setLiked] = useState(() => new Set<string>())

  function toggleLike(id: string) {
    setLiked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">
          Campus feed
        </h2>
        <p className="text-xs text-muted-foreground">
          What&rsquo;s happening around Raghu Engineering College.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {CAMPUS_FEED.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={liked.has(post.id)}
            onToggleLike={() => toggleLike(post.id)}
          />
        ))}
      </div>
    </section>
  )
}

function PostCard({
  post,
  liked,
  onToggleLike,
}: {
  post: CampusPost
  liked: boolean
  onToggleLike: () => void
}) {
  const kind = KIND[post.kind]
  const KindIcon = kind.icon
  const likeCount = post.likes + (liked ? 1 : 0)

  return (
    <article className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <header className="flex items-center gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold',
            MODULE_SOFT[post.avatarColor],
          )}
        >
          {initials(post.author)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{post.author}</p>
          <p className="truncate text-xs text-muted-foreground">
            {post.affiliation} · {post.time}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium',
            MODULE_SOFT[kind.color],
          )}
        >
          <KindIcon className="size-3" />
          <span className="hidden sm:inline">{kind.label}</span>
        </span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-foreground/90">
        {post.content}
      </p>

      {post.kind === 'photo' ? (
        <div
          className={cn(
            'mt-3 grid aspect-[16/7] place-items-center rounded-lg bg-gradient-to-br text-icon-on',
            MODULE_GRADIENT[post.avatarColor],
          )}
        >
          <ImageIcon className="size-8 opacity-80" />
        </div>
      ) : null}

      {post.tag ? (
        <span className="mt-3 inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          #{post.tag}
        </span>
      ) : null}

      <footer className="mt-3 flex items-center gap-1 border-t pt-3">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike this post' : 'Like this post'}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            liked
              ? 'text-icon-rose'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Heart className={cn('size-4', liked && 'fill-current')} />
          {likeCount}
        </button>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          <MessageCircle className="size-4" />
          {post.comments}
        </span>
      </footer>
    </article>
  )
}
