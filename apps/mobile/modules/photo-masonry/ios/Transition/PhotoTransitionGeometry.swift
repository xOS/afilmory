import CoreGraphics

struct PhotoTransitionTransform: Equatable, Sendable {
  let scale: CGFloat
  let translation: CGPoint

  var affineTransform: CGAffineTransform {
    CGAffineTransform(translationX: translation.x, y: translation.y)
      .scaledBy(x: scale, y: scale)
  }
}

struct PhotoDismissDragState: Equatable, Sendable {
  let progress: CGFloat
  let transform: PhotoTransitionTransform
}

enum PhotoTransitionGeometry {
  static func dismissalDragState(
    translation: CGPoint,
    origin: PhotoTransitionTransform = PhotoTransitionTransform(
      scale: 1,
      translation: .zero
    ),
    distance: CGFloat = 340,
    minimumScale: CGFloat = 0.68
  ) -> PhotoDismissDragState {
    let translationY = translation.y > 0 ? translation.y : translation.y / 3
    let resolvedTranslation = CGPoint(
      x: origin.translation.x + translation.x,
      y: origin.translation.y + translationY
    )
    let progress = min(max(resolvedTranslation.y / max(distance, 1), 0), 1)
    let scale = 1 - (1 - minimumScale) * progress
    return PhotoDismissDragState(
      progress: progress,
      transform: PhotoTransitionTransform(
        scale: scale,
        translation: resolvedTranslation
      )
    )
  }

  static func viewportTransform(
    imageFrame: CGRect,
    targetRect: CGRect,
    viewportBounds: CGRect,
    viewportCenter: CGPoint
  ) -> PhotoTransitionTransform? {
    guard imageFrame.width > 0,
          imageFrame.height > 0,
          targetRect.width > 0,
          targetRect.height > 0
    else { return nil }
    let scale = max(targetRect.width / imageFrame.width, targetRect.height / imageFrame.height)
    let boundsCenter = CGPoint(x: viewportBounds.midX, y: viewportBounds.midY)
    let imageOffset = CGPoint(
      x: imageFrame.midX - boundsCenter.x,
      y: imageFrame.midY - boundsCenter.y
    )
    let translation = CGPoint(
      x: targetRect.midX - viewportCenter.x - scale * imageOffset.x,
      y: targetRect.midY - viewportCenter.y - scale * imageOffset.y
    )
    return PhotoTransitionTransform(scale: scale, translation: translation)
  }

  static func aspectFitRect(aspectRatio: CGFloat, in bounds: CGRect) -> CGRect? {
    guard aspectRatio > 0, bounds.width > 0, bounds.height > 0 else { return nil }
    let width = min(bounds.width, bounds.height * aspectRatio)
    let height = width / aspectRatio
    return CGRect(
      x: bounds.midX - width / 2,
      y: bounds.midY - height / 2,
      width: width,
      height: height
    )
  }
}
