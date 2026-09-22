export const DATA_REFRESH_EVENT = 'frotamaq:data-refresh'

export function notifyDataRefresh() {
  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT))
}
