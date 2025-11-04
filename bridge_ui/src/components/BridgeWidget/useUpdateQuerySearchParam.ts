import { useCallback } from 'react'
import { useHistory, useLocation } from 'react-router'

const useUpdateQuerySearchParam = () => {
  const history = useHistory()
  const location = useLocation()

  const updateQueryParam = useCallback(
    (param: string, value: string | undefined) => {
      const searchParams = new URLSearchParams(location.search)
      if (value) {
        searchParams.set(param, value)
      } else {
        searchParams.delete(param)
      }

      const search = searchParams.toString()

      history.replace({ pathname: location.pathname, search: search ? `?${search}` : '' })
    },
    [history, location.pathname, location.search]
  )

  return updateQueryParam
}

export default useUpdateQuerySearchParam
