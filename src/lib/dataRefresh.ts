export const DATA_REFRESH_EVENT = 'frotalog:data-refresh'

export function notifyDataRefresh() {
  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT))
}
