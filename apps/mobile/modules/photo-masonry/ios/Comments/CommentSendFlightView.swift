import SwiftUI

enum CommentFlightMath {
  static let duration: TimeInterval = 0.36
  static let lift: CGFloat = 8
  static let fallbackTimeout: TimeInterval = 0.9
  static let targetSettleDelay: TimeInterval = 0.05

  static func clampedProgress(_ progress: CGFloat) -> CGFloat {
    min(1, max(0, progress))
  }

  static func interpolate(from start: CGFloat, to end: CGFloat, progress: CGFloat) -> CGFloat {
    let progress = clampedProgress(progress)
    return start + (end - start) * progress
  }

  static func interpolatedRect(
    from source: CGRect,
    to target: CGRect,
    progress: CGFloat,
    lift: CGFloat = lift
  ) -> CGRect {
    let progress = clampedProgress(progress)
    return CGRect(
      x: interpolate(from: source.minX, to: target.minX, progress: progress),
      y: interpolate(from: source.minY, to: target.minY, progress: progress)
        + arcOffset(progress, lift: lift),
      width: interpolate(from: source.width, to: target.width, progress: progress),
      height: interpolate(from: source.height, to: target.height, progress: progress)
    )
  }

  static func arcOffset(_ progress: CGFloat, lift: CGFloat = lift) -> CGFloat {
    let progress = clampedProgress(progress)
    return -4 * lift * progress * (1 - progress)
  }

  static func shadowProgress(_ progress: CGFloat) -> CGFloat {
    let progress = clampedProgress(progress)
    return 4 * progress * (1 - progress)
  }

  static func isValidLandingTarget(from source: CGRect, to target: CGRect) -> Bool {
    guard source.width > 0,
          source.height > 0,
          target.width > 0,
          target.height > 0,
          target.minY >= 0
    else { return false }

    // A row measured before scroll-to-bottom settles can still be underneath the
    // composer. A real landing bubble is always fully above the composer chrome.
    return target.maxY <= source.minY
  }
}

private struct CommentFlightBubbleShape: InsettableShape {
  var progress: CGFloat
  var inset: CGFloat = 0

  var animatableData: AnimatablePair<CGFloat, CGFloat> {
    get { AnimatablePair(progress, inset) }
    set {
      progress = newValue.first
      inset = newValue.second
    }
  }

  func inset(by amount: CGFloat) -> CommentFlightBubbleShape {
    var next = self
    next.inset += amount
    return next
  }

  func path(in rect: CGRect) -> Path {
    let progress = CommentFlightMath.clampedProgress(progress)
    let regularRadius = max(
      0,
      CommentFlightMath.interpolate(
        from: CommentComposerMetrics.cornerRadius,
        to: CommentBubbleMetrics.cornerRadius,
        progress: progress
      ) - inset
    )
    let trailingRadius = max(
      0,
      CommentFlightMath.interpolate(
        from: CommentComposerMetrics.cornerRadius,
        to: CommentBubbleMetrics.tailRadius,
        progress: progress
      ) - inset
    )

    return UnevenRoundedRectangle(
      topLeadingRadius: regularRadius,
      bottomLeadingRadius: regularRadius,
      bottomTrailingRadius: trailingRadius,
      topTrailingRadius: regularRadius,
      style: .continuous
    )
    .path(in: rect.insetBy(dx: inset, dy: inset))
  }
}

private struct CommentFlightSurface: View, Animatable {
  let content: String
  let source: CGRect
  let target: CGRect
  var progress: CGFloat

  @Environment(\.displayScale) private var displayScale

  var animatableData: CGFloat {
    get { progress }
    set { progress = newValue }
  }

  var body: some View {
    let progress = CommentFlightMath.clampedProgress(progress)
    let rect = CommentFlightMath.interpolatedRect(
      from: source,
      to: target,
      progress: progress
    )
    let shape = CommentFlightBubbleShape(progress: progress)
    let leadingInset = CommentFlightMath.interpolate(
      from: CommentComposerMetrics.sourceLeadingInset,
      to: CommentBubbleMetrics.horizontalInset,
      progress: progress
    )
    let trailingInset = CommentFlightMath.interpolate(
      from: CommentComposerMetrics.sourceTrailingInset,
      to: CommentBubbleMetrics.horizontalInset,
      progress: progress
    )
    let verticalInset = CommentFlightMath.interpolate(
      from: CommentComposerMetrics.sourceVerticalInset,
      to: CommentBubbleMetrics.verticalInset,
      progress: progress
    )
    let contentWidth = max(1, rect.width - leadingInset - trailingInset)
    let contentHeight = max(1, rect.height - verticalInset * 2)
    let detachedProgress = min(1, progress * 4)
    let shadowProgress = CommentFlightMath.shadowProgress(progress)

    ZStack(alignment: .topLeading) {
      shape.fill(Color(.secondarySystemFill)).opacity(detachedProgress)
      shape.fill(Color.accentColor).opacity(progress)
      shape.strokeBorder(
        Color(.separator).opacity(detachedProgress * (1 - progress)),
        lineWidth: 1 / displayScale
      )

      ZStack(alignment: .topLeading) {
        Text(content)
          .font(.system(size: CommentComposerMetrics.textSize))
          .foregroundStyle(.primary)
          .lineLimit(5)
          .opacity(1 - progress)

        CommentBubbleText(content, own: true)
          .lineLimit(5)
          .opacity(progress)
      }
      .frame(width: contentWidth, height: contentHeight, alignment: .topLeading)
      .position(
        x: leadingInset + contentWidth / 2,
        y: verticalInset + contentHeight / 2
      )
      .clipped()

      ZStack {
        Circle().fill(Color.accentColor)
        Image(systemName: "arrow.up")
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(.white)
      }
      .frame(
        width: CommentComposerMetrics.sendButtonSize,
        height: CommentComposerMetrics.sendButtonSize
      )
      .position(
        x: rect.width - CommentComposerMetrics.chromeInset
          - CommentComposerMetrics.sendButtonSize / 2,
        y: rect.height - CommentComposerMetrics.chromeInset
          - CommentComposerMetrics.sendButtonSize / 2
      )
      .opacity(max(0, 1 - progress * 4))
    }
    .frame(width: rect.width, height: rect.height)
    .clipShape(shape)
    .shadow(
      color: Color.accentColor.opacity(0.22 * shadowProgress),
      radius: 16 * shadowProgress,
      x: 0,
      y: 7 * shadowProgress
    )
    .position(x: rect.midX, y: rect.midY)
  }
}

private struct CommentFlightStartTrigger: Equatable {
  let target: CGRect?
  let scrollPending: Bool
}

struct CommentSendFlightOverlay: View {
  let store: CommentsStore
  let clientId: String
  let content: String

  @State private var progress: CGFloat = 0
  @State private var started = false
  @State private var lockedTarget: CGRect?

  var body: some View {
    ZStack(alignment: .topLeading) {
      if let flight = activeFlight {
        CommentFlightSurface(
          content: content,
          source: flight.origin,
          target: lockedTarget ?? flight.target ?? flight.origin,
          progress: progress
        )
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .allowsHitTesting(false)
    .accessibilityHidden(true)
    .task(id: startTrigger) {
      await startWhenTargetSettles(startTrigger)
    }
    .task(id: clientId) {
      try? await Task.sleep(for: .seconds(CommentFlightMath.fallbackTimeout))
      guard store.flight?.clientId == clientId else { return }
      store.completeFlight(clientId)
    }
  }

  private var activeFlight: CommentFlight? {
    guard let flight = store.flight, flight.clientId == clientId else { return nil }
    return flight
  }

  private var startTrigger: CommentFlightStartTrigger {
    CommentFlightStartTrigger(
      target: activeFlight?.target,
      scrollPending: store.pendingScrollIdentity == clientId
    )
  }

  @MainActor
  private func startWhenTargetSettles(_ trigger: CommentFlightStartTrigger) async {
    guard !started,
          !trigger.scrollPending,
          let flight = activeFlight,
          let target = trigger.target,
          CommentFlightMath.isValidLandingTarget(from: flight.origin, to: target)
    else { return }

    do {
      try await Task.sleep(for: .seconds(CommentFlightMath.targetSettleDelay))
    } catch {
      return
    }

    guard !Task.isCancelled,
          !started,
          store.pendingScrollIdentity != clientId,
          let currentFlight = activeFlight,
          currentFlight.target == target,
          CommentFlightMath.isValidLandingTarget(from: currentFlight.origin, to: target)
    else { return }

    lockedTarget = target
    started = true
    store.lockFlight(clientId)
    withAnimation(
      .timingCurve(0.2, 0.78, 0.2, 1, duration: CommentFlightMath.duration),
      completionCriteria: .logicallyComplete
    ) {
      progress = 1
    } completion: {
      store.completeFlight(clientId)
    }
  }
}
