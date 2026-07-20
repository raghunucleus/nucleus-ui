/**
 * How a student-facing message is delivered. Shared by every screen that sends
 * one — profile-update nudges, drive invites and reminders — so the sender's
 * choice means the same thing everywhere and the server sees one payload shape.
 */
export interface NotifyChannels {
  in_app: boolean
  push: boolean
  email: boolean
}

/** True when at least one channel is on — an all-off send is a silent no-op. */
export function hasChannel(channels: NotifyChannels): boolean {
  return channels.in_app || channels.push || channels.email
}
