import { History, Location } from 'history'

export function updateQueryParam(history: History, location: Location, param: string, value?: string) {
  const searchParams = new URLSearchParams(location.search)
  if (value) {
    searchParams.set(param, value)
  } else {
    searchParams.delete(param)
  }
  const search = searchParams.toString()
  history.replace({ pathname: location.pathname, search: search ? `?${search}` : '' })
}
