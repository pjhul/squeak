export default function dateToDays(date: string) {
    const today = new Date()
    const posted = new Date(date)
    const diff = today.getTime() - posted.getTime()
    const days = Math.round(diff / (1000 * 3600 * 24))
    return days
}
