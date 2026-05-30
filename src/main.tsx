import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { migrateBranchStorageKeys } from './lib/storageKeys'
import './index.css'
import App from './App.tsx'

migrateBranchStorageKeys()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
