import { useState } from 'react';
import type { JiraUser } from './types';

// Deterministic color palette for user initials fallback
const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-fuchsia-600',
  'bg-teal-600',
];

function hashDisplayName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getAvatarColor(displayName: string): string {
  return AVATAR_COLORS[hashDisplayName(displayName) % AVATAR_COLORS.length];
}

interface UserAvatarProps {
  user: JiraUser | null;
  size?: 'sm' | 'md';
}

export function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  const sizeClasses = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';

  const [imgError, setImgError] = useState(false);

  if (!user) {
    // Unassigned: gray circle with "?"
    return (
      <span
        className={`${sizeClasses} rounded-full bg-brand-muted/40 flex items-center justify-center font-semibold text-brand-muted shrink-0`}
        aria-hidden="true"
      >
        ?
      </span>
    );
  }

  const initial = user.displayName.charAt(0).toUpperCase();
  const colorClass = getAvatarColor(user.displayName);

  // Pick avatar URL based on size
  const avatarUrl =
    size === 'md'
      ? (user.avatarUrls?.['32x32'] ?? user.avatarUrls?.['24x24'])
      : user.avatarUrls?.['24x24'];

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className={`${sizeClasses} rounded-full object-cover shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: colored circle with initial
  return (
    <span
      className={`${sizeClasses} rounded-full ${colorClass} flex items-center justify-center font-semibold text-white shrink-0`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
