import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SyncData {
  projectId: string
  content: string
  lastModified: number
  deviceId: string
}

interface ConflictResolution {
  localData: SyncData
  remoteData: SyncData
  resolution: 'local' | 'remote' | 'merge'
}

export const useCrossDeviceSync = (projectId: string) => {
  const { user } = useAuth()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'conflict' | 'error'>('idle')
  const [conflictData, setConflictData] = useState<ConflictResolution | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<number>(0)

  // Generate unique device ID
  const getDeviceId = useCallback(() => {
    let deviceId = localStorage.getItem('deviceId')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('deviceId', deviceId)
    }
    return deviceId
  }, [])

  // Store data locally with timestamp
  const storeLocalData = useCallback((content: string) => {
    const syncData: SyncData = {
      projectId,
      content,
      lastModified: Date.now(),
      deviceId: getDeviceId()
    }
    localStorage.setItem(`sync_${projectId}`, JSON.stringify(syncData))
    return syncData
  }, [projectId, getDeviceId])

  // Get local data
  const getLocalData = useCallback((): SyncData | null => {
    const stored = localStorage.getItem(`sync_${projectId}`)
    return stored ? JSON.parse(stored) : null
  }, [projectId])

  // Sync with server
  const syncWithServer = useCallback(async (localData: SyncData) => {
    if (!user) return

    setSyncStatus('syncing')
    
    try {
      // Fetch remote data
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch remote data')
      }

      const remoteData: SyncData = await response.json()

      // Check for conflicts
      if (remoteData.lastModified > localData.lastModified && 
          remoteData.content !== localData.content) {
        // Conflict detected
        setConflictData({
          localData,
          remoteData,
          resolution: 'local' // Default to local
        })
        setSyncStatus('conflict')
        return
      }

      // No conflict, sync local changes to server
      if (localData.lastModified > remoteData.lastModified) {
        await fetch(`/api/projects/${projectId}/sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(localData)
        })
      }

      setLastSyncTime(Date.now())
      setSyncStatus('idle')
    } catch (error) {
      console.error('Sync error:', error)
      setSyncStatus('error')
    }
  }, [user, projectId])

  // Resolve conflict
  const resolveConflict = useCallback(async (resolution: 'local' | 'remote' | 'merge') => {
    if (!conflictData) return

    let resolvedContent = ''
    
    switch (resolution) {
      case 'local':
        resolvedContent = conflictData.localData.content
        break
      case 'remote':
        resolvedContent = conflictData.remoteData.content
        break
      case 'merge':
        // Simple merge strategy - could be enhanced with proper diff/merge
        resolvedContent = `${conflictData.localData.content}\n\n--- MERGED CONTENT ---\n\n${conflictData.remoteData.content}`
        break
    }

    const resolvedData: SyncData = {
      projectId,
      content: resolvedContent,
      lastModified: Date.now(),
      deviceId: getDeviceId()
    }

    // Store resolved data locally
    storeLocalData(resolvedContent)

    // Sync to server
    try {
      await fetch(`/api/projects/${projectId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resolvedData)
      })

      setConflictData(null)
      setSyncStatus('idle')
      setLastSyncTime(Date.now())
    } catch (error) {
      console.error('Conflict resolution error:', error)
      setSyncStatus('error')
    }
  }, [conflictData, projectId, getDeviceId, storeLocalData])

  // Auto-sync when content changes
  const syncContent = useCallback((content: string) => {
    const localData = storeLocalData(content)
    
    // Debounce sync to avoid too frequent requests
    const timeoutId = setTimeout(() => {
      syncWithServer(localData)
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [storeLocalData, syncWithServer])

  // Periodic sync check
  useEffect(() => {
    if (!user || !projectId) return

    const interval = setInterval(() => {
      const localData = getLocalData()
      if (localData && syncStatus === 'idle') {
        syncWithServer(localData)
      }
    }, 30000) // Sync every 30 seconds

    return () => clearInterval(interval)
  }, [user, projectId, getLocalData, syncWithServer, syncStatus])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      const localData = getLocalData()
      if (localData) {
        syncWithServer(localData)
      }
    }

    const handleOffline = () => {
      setSyncStatus('idle')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [getLocalData, syncWithServer])

  return {
    syncStatus,
    conflictData,
    lastSyncTime,
    syncContent,
    resolveConflict,
    isOnline: navigator.onLine
  }
}