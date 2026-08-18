import Foundation

enum ExploreSegment: Int {
  case timeline
  case following
  case explore
}

func resolveExploreDefaultSegment(isSignedIn: Bool, cachedHasSubscriptions: Bool?) -> ExploreSegment {
  if !isSignedIn {
    return .explore
  }
  if cachedHasSubscriptions == true {
    return .timeline
  }
  return .explore
}

func resolveExploreSegmentAfterFetch(
  current: ExploreSegment,
  userHasChosen: Bool,
  hasSubscriptions: Bool
) -> ExploreSegment {
  if userHasChosen {
    return current
  }
  return hasSubscriptions ? .timeline : .explore
}
