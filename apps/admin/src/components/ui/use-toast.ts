// Minimal toast utility for admin app
// Uses a simple approach - can be replaced with a full toast library later

type ToastOptions = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function toast({ title, description, variant = 'default' }: ToastOptions) {
  // For now, use console + a brief visual indicator
  if (variant === 'destructive') {
    console.error(`[Toast] ${title}: ${description}`)
  } else {
    console.log(`[Toast] ${title}: ${description}`)
  }
}
