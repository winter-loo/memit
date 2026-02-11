export function formatRelativeTime(timestampSecs) {
  if (!timestampSecs) return 'Just now';
  
  const now = Date.now();
  // Anki mod time is seconds, JS Date is ms
  const diffMs = now - (timestampSecs * 1000);
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return 'Just now';
  
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return new Date(timestampSecs * 1000).toLocaleDateString();
}
