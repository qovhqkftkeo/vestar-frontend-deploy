import { useCallback, useState } from 'react'
import type { CandidateDraft, CreateStep, SectionDraft, VoteCreateDraft } from '../../types/host'

let _counter = 3

function makeId(): string {
  return String(_counter++)
}

function makeBlankCandidate(): CandidateDraft {
  return {
    id: makeId(),
    name: '',
    image: '',
  }
}

const INITIAL_DRAFT: VoteCreateDraft = {
  title: '',
  group: '',
  bannerImage: '',
  category: '음악방송',
  candidates: [
    makeBlankCandidate(),
    makeBlankCandidate(),
  ],
  sections: [],
  startDate: '',
  endDate: '',
  revealDate: '',
  maxChoices: 1,
  resultReveal: 'after_end',
  votePolicy: 'ONE_TIME',
  resetIntervalValue: 1,
  resetIntervalUnit: 'days',
  paymentType: 'FREE',
  costPerBallot: 0,
}

function isStep1Valid(draft: VoteCreateDraft): boolean {
  return draft.title.trim().length > 0
}

function isStep2Valid(draft: VoteCreateDraft): boolean {
  if (draft.sections.length > 0) {
    return draft.sections.every(
      (s) =>
        s.name.trim().length > 0 &&
        s.candidates.length >= 2 &&
        s.candidates.every((c) => c.name.trim().length > 0),
    )
  }
  return draft.candidates.length >= 2 && draft.candidates.every((c) => c.name.trim().length > 0)
}

function isStep3Valid(draft: VoteCreateDraft): boolean {
  return (
    draft.startDate.trim().length > 0 &&
    draft.endDate.trim().length > 0 &&
    draft.revealDate.trim().length > 0 &&
    new Date(draft.endDate) > new Date(draft.startDate) &&
    new Date(draft.revealDate) >= new Date(draft.endDate)
  )
}

function isStep4Valid(draft: VoteCreateDraft): boolean {
  if (draft.paymentType === 'PAID') {
    if (draft.costPerBallot <= 0 || draft.costPerBallot > 100) return false
  }
  if (draft.votePolicy === 'PERIODIC') {
    if (draft.resetIntervalValue <= 0) return false
  }
  return true
}

function validateStep(step: CreateStep, draft: VoteCreateDraft): boolean {
  if (step === 1) return isStep1Valid(draft)
  if (step === 2) return isStep2Valid(draft)
  if (step === 3) return isStep3Valid(draft)
  return isStep4Valid(draft)
}

export interface UseCreateVoteDraftResult {
  draft: VoteCreateDraft
  step: CreateStep
  isCurrentStepValid: boolean
  updateField: <K extends keyof VoteCreateDraft>(key: K, value: VoteCreateDraft[K]) => void
  // Flat candidate actions
  addCandidate: () => void
  removeCandidate: (id: string) => void
  updateCandidate: (id: string, field: keyof Omit<CandidateDraft, 'id'>, value: string) => void
  // Section actions
  addSection: () => void
  removeSection: (sectionId: string) => void
  updateSectionName: (sectionId: string, name: string) => void
  addCandidateToSection: (sectionId: string) => void
  removeCandidateFromSection: (sectionId: string, candidateId: string) => void
  updateSectionCandidate: (
    sectionId: string,
    candidateId: string,
    field: keyof Omit<CandidateDraft, 'id'>,
    value: string,
  ) => void
  clearSections: () => void
  nextStep: () => void
  prevStep: () => void
  submit: () => Promise<void>
  isSubmitting: boolean
}

export function useCreateVoteDraft(): UseCreateVoteDraftResult {
  const [draft, setDraft] = useState<VoteCreateDraft>(INITIAL_DRAFT)
  const [step, setStep] = useState<CreateStep>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCurrentStepValid = validateStep(step, draft)

  const updateField = useCallback(
    <K extends keyof VoteCreateDraft>(key: K, value: VoteCreateDraft[K]) => {
      setDraft((prev) => {
        const newDraft = { ...prev, [key]: value } as VoteCreateDraft
        
        if (key === 'votePolicy' && value === 'UNLIMITED') {
          newDraft.paymentType = 'PAID'
          newDraft.costPerBallot = 100
        }
        if (key === 'maxChoices') {
           const maxAllowed = Math.max(1, newDraft.candidates.length - 1)
           if (typeof value === 'number' && value > maxAllowed) {
              newDraft.maxChoices = maxAllowed
           }
        }
        return newDraft
      })
    },
    [],
  )

  // ── Flat candidate actions ────────────────────────────────────────────────

  const addCandidate = useCallback(() => {
    setDraft((prev) => {
      return { ...prev, candidates: [...prev.candidates, makeBlankCandidate()] }
    })
  }, [])

  const removeCandidate = useCallback((id: string) => {
    setDraft((prev) => {
      const newCandidates = prev.candidates.filter((c) => c.id !== id)
      let newMaxChoices = prev.maxChoices
      const maxAllowed = Math.max(1, newCandidates.length - 1)
      if (newMaxChoices > maxAllowed) {
        newMaxChoices = maxAllowed
      }
      return {
        ...prev,
        candidates: newCandidates,
        maxChoices: newMaxChoices
      }
    })
  }, [])

  const updateCandidate = useCallback(
    (id: string, field: keyof Omit<CandidateDraft, 'id'>, value: string) => {
      setDraft((prev) => ({
        ...prev,
        candidates: prev.candidates.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
      }))
    },
    [],
  )

  // ── Section actions ───────────────────────────────────────────────────────

  const addSection = useCallback(() => {
    setDraft((prev) => {
      const newSection: SectionDraft = {
        id: makeId(),
        name: '',
        candidates: [makeBlankCandidate(), makeBlankCandidate()],
      }
      return { ...prev, sections: [...prev.sections, newSection] }
    })
  }, [])

  const removeSection = useCallback((sectionId: string) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }))
  }, [])

  const updateSectionName = useCallback((sectionId: string, name: string) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)),
    }))
  }, [])

  const addCandidateToSection = useCallback((sectionId: string) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, candidates: [...s.candidates, makeBlankCandidate()] }
      }),
    }))
  }, [])

  const removeCandidateFromSection = useCallback((sectionId: string, candidateId: string) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, candidates: s.candidates.filter((c) => c.id !== candidateId) }
      }),
    }))
  }, [])

  const updateSectionCandidate = useCallback(
    (
      sectionId: string,
      candidateId: string,
      field: keyof Omit<CandidateDraft, 'id'>,
      value: string,
    ) => {
      setDraft((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => {
          if (s.id !== sectionId) return s
          return {
            ...s,
            candidates: s.candidates.map((c) =>
              c.id === candidateId ? { ...c, [field]: value } : c,
            ),
          }
        }),
      }))
    },
    [],
  )

  const clearSections = useCallback(() => {
    setDraft((prev) => ({ ...prev, sections: [] }))
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────

  const nextStep = useCallback(() => {
    setStep((prev) => {
      if (!validateStep(prev, draft)) return prev
      return Math.min(prev + 1, 4) as CreateStep
    })
  }, [draft])

  const prevStep = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 1) as CreateStep)
  }, [])

  const submit = useCallback(async () => {
    setIsSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSubmitting(false)
  }, [])

  return {
    draft,
    step,
    isCurrentStepValid,
    updateField,
    addCandidate,
    removeCandidate,
    updateCandidate,
    addSection,
    removeSection,
    updateSectionName,
    addCandidateToSection,
    removeCandidateFromSection,
    updateSectionCandidate,
    clearSections,
    nextStep,
    prevStep,
    submit,
    isSubmitting,
  }
}
