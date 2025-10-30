export const secondsToTime = (seconds: number, onlyMinutes: boolean = false) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return onlyMinutes ? (mins > 0 ? `~ ${mins}min` : 'less than a minute') : `${mins}m ${String(secs).padStart(2, '0')}s`
}
