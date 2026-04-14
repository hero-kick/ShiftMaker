import React, { lazy, Suspense, useState } from 'react'
import ReactDOM from 'react-dom/client'
import WorkspaceGate from './WorkspaceGate.jsx'
import { getCurrentWorkspaceId } from './workspace'
import './App.css'

// useStore は import 時にワークスペースIDを見て永続化キーを決めるため、
// ワークスペース選択後に初めて App を読み込む必要がある（動的 import）
const App = lazy(() => import('./App.jsx'))

function Root() {
  const [wsId, setWsId] = useState(() => getCurrentWorkspaceId())

  if (!wsId) {
    return <WorkspaceGate onEnter={setWsId} />
  }

  return (
    <Suspense fallback={<div className="ws-loading">読み込み中...</div>}>
      <App />
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
