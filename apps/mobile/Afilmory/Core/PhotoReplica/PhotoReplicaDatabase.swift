import Foundation
import GRDB

enum PhotoReplicaDatabase {
  static let shared = PhotoReplicaStore(queue: makeQueue(at: storeURL()))

  static func makeInMemory() -> PhotoReplicaStore {
    PhotoReplicaStore(queue: try! DatabaseQueue())
  }

  static func storeURL(
    in directory: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
  ) -> URL {
    let folder = directory.appending(path: "AfilmoryReplica", directoryHint: .isDirectory)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder.appending(path: "PhotoReplica.sqlite")
  }

  private static func makeQueue(at url: URL) -> DatabaseQueue {
    var configuration = Configuration()
    configuration.foreignKeysEnabled = true
    do {
      return try DatabaseQueue(path: url.path, configuration: configuration)
    } catch {
      NSLog("[PhotoReplica] Store failed to open, recreating: %@", url.path)
      removeStoreFiles(at: url)
      do {
        return try DatabaseQueue(path: url.path, configuration: configuration)
      } catch {
        NSLog("[PhotoReplica] Falling back to in-memory replica: %@", error.localizedDescription)
        return try! DatabaseQueue()
      }
    }
  }

  private static func removeStoreFiles(at url: URL) {
    let fileManager = FileManager.default
    for suffix in ["", "-wal", "-shm"] {
      try? fileManager.removeItem(atPath: url.path + suffix)
    }
  }
}

final class PhotoReplicaStore: Sendable {
  let queue: DatabaseQueue

  init(queue: DatabaseQueue) {
    self.queue = queue
    try? migrator.migrate(queue)
  }

  func wipeAll() throws {
    try queue.write { db in
      try db.execute(sql: "DELETE FROM photos")
      try db.execute(sql: "DELETE FROM studio_assets")
      try db.execute(sql: "DELETE FROM replica_state")
    }
  }

  func wipeTenant(_ slug: String) throws {
    try queue.write { db in
      try db.execute(sql: "DELETE FROM photos WHERE tenant_slug = ?", arguments: [slug])
      try db.execute(sql: "DELETE FROM studio_assets WHERE tenant_slug = ?", arguments: [slug])
      try db.execute(sql: "DELETE FROM replica_state WHERE tenant_slug = ?", arguments: [slug])
    }
  }

  private var migrator: DatabaseMigrator {
    var migrator = DatabaseMigrator()
    migrator.registerMigration("v1-replica") { db in
      try db.execute(sql: """
        CREATE TABLE replica_state (
          tenant_slug TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT,
          contiguous_revision INTEGER NOT NULL,
          needs_reconcile INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT
        )
        """)
      try db.execute(sql: """
        CREATE TABLE photos (
          tenant_slug TEXT NOT NULL,
          photo_id TEXT NOT NULL,
          asset_id TEXT,
          published INTEGER NOT NULL,
          date_taken TEXT,
          latitude REAL,
          longitude REAL,
          rating INTEGER,
          camera TEXT,
          lens TEXT,
          tags_json TEXT NOT NULL,
          payload BLOB NOT NULL,
          applied_revision INTEGER NOT NULL,
          PRIMARY KEY (tenant_slug, photo_id)
        )
        """)
      try db.execute(sql: """
        CREATE INDEX photos_published_date ON photos(tenant_slug, published, date_taken)
        """)
      try db.execute(sql: """
        CREATE INDEX photos_map ON photos(tenant_slug, latitude, longitude)
        """)
      try db.execute(sql: """
        CREATE TABLE studio_assets (
          tenant_slug TEXT NOT NULL,
          asset_id TEXT NOT NULL,
          photo_id TEXT NOT NULL,
          sync_status TEXT NOT NULL,
          storage_provider TEXT NOT NULL,
          storage_key TEXT NOT NULL,
          size REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT NOT NULL,
          public_url TEXT,
          payload BLOB NOT NULL,
          PRIMARY KEY (tenant_slug, asset_id)
        )
        """)
    }
    return migrator
  }
}
