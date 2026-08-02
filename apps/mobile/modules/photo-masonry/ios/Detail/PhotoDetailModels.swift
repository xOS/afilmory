import Foundation

struct PhotoDetailMetadata: Decodable {
  let id: String
  let title: String
  let subtitle: String
  let infoJSON: String
}

struct PhotoDetailStrings: Decodable {
  var close = ""
  var comments = ""
  var info = ""
  var next = ""
  var previous = ""
  var reaction = ""
  var share = ""
}

struct PhotoDetailReactionItem: Decodable {
  let accessibilityLabel: String
  let count: Int
  let reaction: String
}

enum PhotoDetailJSON {
  static func decodeMetadata(_ json: String) -> [PhotoDetailMetadata] {
    guard let data = json.data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([PhotoDetailMetadata].self, from: data)) ?? []
  }

  static func decodeReactionItems(_ json: String) -> [PhotoDetailReactionItem] {
    guard let data = json.data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([PhotoDetailReactionItem].self, from: data)) ?? []
  }

  static func decodeStrings(_ json: String) -> PhotoDetailStrings {
    guard let data = json.data(using: .utf8) else { return .init() }
    return (try? JSONDecoder().decode(PhotoDetailStrings.self, from: data)) ?? .init()
  }
}
