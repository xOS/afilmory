import { requireNativeModule } from 'expo'
import { Platform } from 'react-native'

export type CommentsLabOutcome = 'failure' | 'success'

interface NativePagesCommentsLab {
  presentCommentsLab: (outcome: CommentsLabOutcome, latencyMs: number) => Promise<void>
}

const nativePages = Platform.OS === 'ios' ? (requireNativeModule('NativePages') as NativePagesCommentsLab) : null

export function presentCommentsLab(outcome: CommentsLabOutcome, latencyMs = 700): Promise<void> {
  return nativePages?.presentCommentsLab(outcome, latencyMs) ?? Promise.resolve()
}
