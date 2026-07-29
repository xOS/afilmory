import UIKit

final class MasonryLayout: UICollectionViewLayout {
  var columnCount = 2
  var gap: CGFloat = 4
  var aspectRatios: [CGFloat] = []
  var anchorItem: Int?
  var anchorViewportOffset: CGFloat = 0

  private var attributesCache: [UICollectionViewLayoutAttributes] = []
  private var contentHeight: CGFloat = 0

  var itemWidth: CGFloat {
    guard let collectionView, columnCount > 0 else { return 0 }
    return (collectionView.bounds.width - gap * CGFloat(columnCount - 1)) / CGFloat(columnCount)
  }

  override func prepare() {
    super.prepare()
    attributesCache.removeAll(keepingCapacity: true)
    contentHeight = 0
    let columnWidth = itemWidth
    guard columnWidth > 0 else { return }

    var columnHeights = [CGFloat](repeating: 0, count: columnCount)
    attributesCache.reserveCapacity(aspectRatios.count)
    for (index, ratio) in aspectRatios.enumerated() {
      var shortest = 0
      for column in 1..<columnCount where columnHeights[column] < columnHeights[shortest] {
        shortest = column
      }
      let x = (columnWidth + gap) * CGFloat(shortest)
      let y = columnHeights[shortest] == 0 ? 0 : columnHeights[shortest] + gap
      let height = max(1, columnWidth / max(ratio, 0.01))
      let attributes = UICollectionViewLayoutAttributes(forCellWith: IndexPath(item: index, section: 0))
      attributes.frame = CGRect(x: x, y: y, width: columnWidth, height: height)
      attributesCache.append(attributes)
      columnHeights[shortest] = y + height
    }
    contentHeight = columnHeights.max() ?? 0
  }

  override var collectionViewContentSize: CGSize {
    CGSize(width: collectionView?.bounds.width ?? 0, height: contentHeight)
  }

  override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
    attributesCache.filter { $0.frame.intersects(rect) }
  }

  override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
    guard attributesCache.indices.contains(indexPath.item) else { return nil }
    return attributesCache[indexPath.item]
  }

  override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
    guard let collectionView else { return false }
    return newBounds.width != collectionView.bounds.width
  }

  override func targetContentOffset(forProposedContentOffset proposedContentOffset: CGPoint) -> CGPoint {
    guard let collectionView, let anchorItem, attributesCache.indices.contains(anchorItem) else {
      return proposedContentOffset
    }
    let frame = attributesCache[anchorItem].frame
    let topInset = collectionView.adjustedContentInset.top
    let bottomInset = collectionView.adjustedContentInset.bottom
    let minOffset = -topInset
    let maxOffset = max(minOffset, contentHeight + bottomInset - collectionView.bounds.height)
    let target = frame.midY - anchorViewportOffset
    return CGPoint(x: proposedContentOffset.x, y: min(max(target, minOffset), maxOffset))
  }
}
