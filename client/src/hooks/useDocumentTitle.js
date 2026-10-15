import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Menuo` : 'Menuo — Digital menus & QR codes for restaurants'
  }, [title])
}
