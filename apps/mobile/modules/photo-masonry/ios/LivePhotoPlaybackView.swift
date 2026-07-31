import AVFoundation
import UIKit

/// Streams the paired MOV resource used by an Afilmory Live Photo.
///
/// Afilmory's manifest guarantees a logical image/video pair, but it does not
/// guarantee that the downloaded files retain the asset identifiers required
/// by `PHLivePhotoView`. Keeping playback in an `AVPlayerLayer` therefore gives
/// the native viewer deterministic behavior for remote and processed assets.
final class LivePhotoPlaybackView: UIView {
  override class var layerClass: AnyClass { AVPlayerLayer.self }

  var onPlaybackStateChange: ((Bool) -> Void)?

  private(set) var isPlaying = false

  private var isActive = false
  private var playbackGeneration = 0
  private var videoURL: URL?
  private var player: AVPlayer?
  private var playbackEndObserver: NSObjectProtocol?
  private var layerReadinessObservation: NSKeyValueObservation?
  private var itemStatusObservation: NSKeyValueObservation?

  private var playerLayer: AVPlayerLayer {
    layer as! AVPlayerLayer
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    alpha = 0
    backgroundColor = .clear
    isUserInteractionEnabled = false
    playerLayer.backgroundColor = UIColor.clear.cgColor
    playerLayer.videoGravity = .resizeAspectFill
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  deinit {
    tearDownPlayer()
  }

  func configure(videoURL: URL?) {
    guard self.videoURL != videoURL else { return }
    stopPlayback(animated: false)
    tearDownPlayer()
    self.videoURL = videoURL
    if isActive {
      preparePlayer()
    }
  }

  func setActive(_ active: Bool) {
    guard active != isActive else { return }
    isActive = active
    if active {
      preparePlayer()
    } else {
      stopPlayback(animated: false)
      tearDownPlayer()
    }
  }

  @discardableResult
  func startPlayback() -> Bool {
    guard isActive, videoURL != nil else { return false }
    preparePlayer()
    guard let player else { return false }

    playbackGeneration += 1
    let generation = playbackGeneration
    setPlaying(true)
    player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
      guard finished else { return }
      DispatchQueue.main.async {
        guard let self, self.playbackGeneration == generation, self.isPlaying,
          let player = self.player
        else {
          return
        }
        player.play()
        if self.playerLayer.isReadyForDisplay {
          self.revealVideo()
        }
      }
    }
    return true
  }

  func stopPlayback(animated: Bool = true) {
    playbackGeneration += 1
    player?.pause()
    player?.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
    setPlaying(false)
    hideVideo(animated: animated)
  }

  private func preparePlayer() {
    guard player == nil, let videoURL else { return }

    let item = AVPlayerItem(url: videoURL)
    item.preferredForwardBufferDuration = 3

    let player = AVPlayer(playerItem: item)
    player.automaticallyWaitsToMinimizeStalling = true
    player.actionAtItemEnd = .pause
    self.player = player
    playerLayer.player = player

    // AVPlayer performs its own preroll when playback starts. Calling
    // preroll/cancelPendingPrerolls while the remote item is still `.unknown`
    // raises NSInvalidArgumentException instead of reporting an async failure.

    layerReadinessObservation = playerLayer.observe(
      \.isReadyForDisplay,
      options: [.new]
    ) { [weak self] layer, _ in
      guard layer.isReadyForDisplay else { return }
      DispatchQueue.main.async {
        guard let self, self.isPlaying else { return }
        self.revealVideo()
      }
    }

    itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      guard item.status == .failed else { return }
      DispatchQueue.main.async {
        guard let self, self.player?.currentItem === item else { return }
        self.stopPlayback(animated: true)
      }
    }

    playbackEndObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      guard let self, self.player?.currentItem === item else { return }
      self.stopPlayback(animated: true)
    }
  }

  private func tearDownPlayer() {
    layerReadinessObservation?.invalidate()
    layerReadinessObservation = nil
    itemStatusObservation?.invalidate()
    itemStatusObservation = nil
    if let playbackEndObserver {
      NotificationCenter.default.removeObserver(playbackEndObserver)
    }
    playbackEndObserver = nil
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    playerLayer.player = nil
    player = nil
  }

  private func setPlaying(_ playing: Bool) {
    guard playing != isPlaying else { return }
    isPlaying = playing
    onPlaybackStateChange?(playing)
  }

  private func revealVideo() {
    guard alpha != 1 else { return }
    UIView.animate(
      withDuration: 0.12,
      delay: 0,
      options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut]
    ) {
      self.alpha = 1
    }
  }

  private func hideVideo(animated: Bool) {
    guard alpha != 0 else { return }
    let changes = { self.alpha = 0 }
    if animated {
      UIView.animate(
        withDuration: 0.12,
        delay: 0,
        options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut],
        animations: changes
      )
    } else {
      UIView.performWithoutAnimation(changes)
    }
  }
}
