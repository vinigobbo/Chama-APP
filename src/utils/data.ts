function pad(n: number) {
  return String(n).padStart(2, '0')
}

// YYYY-MM-DD pelo calendário local; toISOString() converteria pra UTC e, no Brasil,
// adiantaria a data entre 21h e 23h59
export function formatarISO(data: Date) {
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`
}

export function hojeISO() {
  return formatarISO(new Date())
}
