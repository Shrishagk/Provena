'use client'

import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import type { EncryptResponse } from '@/lib/api'

const encryptSessionKey = 'provena:encrypt-workflow'

type SourceFileDetails = {
  name: string
  size: number
}

type StoredEncryptWorkflow = {
  selected: string[]
  result: EncryptResponse | null
  sourceFile: SourceFileDetails | null
}

type EncryptWorkflowContextValue = StoredEncryptWorkflow & {
  file: File | null
  hydrated: boolean
  setFile: (file: File | null) => void
  setSelected: Dispatch<SetStateAction<string[]>>
  setResult: (result: EncryptResponse | null) => void
}

const EncryptWorkflowContext = createContext<EncryptWorkflowContextValue | null>(null)

export function WorkflowStateProvider({ children }: { children: React.ReactNode }) {
  const [file, setCurrentFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<EncryptResponse | null>(null)
  const [sourceFile, setSourceFile] = useState<SourceFileDetails | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(encryptSessionKey)
      if (saved) {
        const workflow = JSON.parse(saved) as StoredEncryptWorkflow
        setSelected(Array.isArray(workflow.selected) ? workflow.selected : [])
        setResult(workflow.result ?? null)
        setSourceFile(workflow.sourceFile ?? null)
      }
    } catch {
      // A malformed or unavailable session store should not block encryption.
      window.sessionStorage.removeItem(encryptSessionKey)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const workflow: StoredEncryptWorkflow = { selected, result, sourceFile }
    window.sessionStorage.setItem(encryptSessionKey, JSON.stringify(workflow))
  }, [hydrated, result, selected, sourceFile])

  const value = useMemo<EncryptWorkflowContextValue>(
    () => ({
      file,
      selected,
      result,
      sourceFile,
      hydrated,
      setFile(nextFile) {
        setCurrentFile(nextFile)
        setSourceFile(nextFile ? { name: nextFile.name, size: nextFile.size } : null)
      },
      setSelected,
      setResult,
    }),
    [file, hydrated, result, selected, sourceFile],
  )

  return <EncryptWorkflowContext.Provider value={value}>{children}</EncryptWorkflowContext.Provider>
}

export function useEncryptWorkflow() {
  const context = useContext(EncryptWorkflowContext)
  if (!context) throw new Error('useEncryptWorkflow must be used within WorkflowStateProvider.')
  return context
}
