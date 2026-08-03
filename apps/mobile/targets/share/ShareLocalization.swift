import Foundation

struct ShareLocalization {
  let cancel: String
  let title: String
  let remove: String
  let uploadTemplate: String
  let summaryTemplate: String
  let tagsLabel: String
  let tagsPlaceholder: String
  let loading: String
  let loadingProgressTemplate: String
  let workspaceTemplate: String
  let unavailableTitle: String
  let unavailableDescription: String
  let noImagesTitle: String
  let noImagesDescription: String
  let failedTitle: String
  let preparing: String
  let handoffTimeout: String

  func upload(count: Int) -> String {
    uploadTemplate.replacingOccurrences(of: "{count}", with: String(count))
  }

  func summary(count: Int) -> String {
    summaryTemplate.replacingOccurrences(of: "{count}", with: String(count))
  }

  func loadingProgress(current: Int, total: Int) -> String {
    loadingProgressTemplate
      .replacingOccurrences(of: "{current}", with: String(current))
      .replacingOccurrences(of: "{total}", with: String(total))
  }

  func workspace(_ name: String) -> String {
    workspaceTemplate.replacingOccurrences(of: "{name}", with: name)
  }

  static let current: ShareLocalization = {
    let language = Locale.preferredLanguages.first?.lowercased() ?? "en"
    if language.hasPrefix("zh-hk") {
      return traditionalHongKong
    }
    if language.hasPrefix("zh-tw") || language.hasPrefix("zh-hant") {
      return traditionalTaiwan
    }
    if language.hasPrefix("zh") {
      return simplifiedChinese
    }
    if language.hasPrefix("ja") {
      return japanese
    }
    if language.hasPrefix("ko") {
      return korean
    }
    return english
  }()

  private static let english = ShareLocalization(
    cancel: "Cancel",
    title: "Review Upload",
    remove: "Remove",
    uploadTemplate: "Upload {count}",
    summaryTemplate: "{count} items",
    tagsLabel: "TAGS — THESE BECOME THE FOLDER",
    tagsPlaceholder: "Add a tag, comma separated",
    loading: "Loading shared photos",
    loadingProgressTemplate: "Preparing {current} of {total}",
    workspaceTemplate: "Upload to {name}",
    unavailableTitle: "Afilmory is not ready",
    unavailableDescription: "Open Afilmory, sign in, and select a workspace before sharing photos.",
    noImagesTitle: "No images to upload",
    noImagesDescription: "Share one or more supported images and try again.",
    failedTitle: "Upload could not start",
    preparing: "Adding to upload queue",
    handoffTimeout: "Afilmory did not confirm the upload queue. Please try again."
  )

  private static let simplifiedChinese = ShareLocalization(
    cancel: "取消",
    title: "确认上传",
    remove: "移除",
    uploadTemplate: "上传 {count} 张",
    summaryTemplate: "{count} 项",
    tagsLabel: "标签 —— 决定存放目录",
    tagsPlaceholder: "添加标签，逗号分隔",
    loading: "正在载入分享的照片",
    loadingProgressTemplate: "正在准备第 {current}/{total} 项",
    workspaceTemplate: "上传到 {name}",
    unavailableTitle: "Afilmory 尚未准备好",
    unavailableDescription: "请先打开 Afilmory、登录并选择工作区，然后再分享照片。",
    noImagesTitle: "没有可上传的图片",
    noImagesDescription: "请选择一张或多张受支持的图片后重试。",
    failedTitle: "无法开始上传",
    preparing: "正在加入上传队列",
    handoffTimeout: "Afilmory 未能确认上传队列，请重试。"
  )

  private static let traditionalHongKong = ShareLocalization(
    cancel: "取消",
    title: "確認上載",
    remove: "移除",
    uploadTemplate: "上載 {count} 張",
    summaryTemplate: "{count} 項",
    tagsLabel: "標籤 —— 決定存放目錄",
    tagsPlaceholder: "新增標籤，逗號分隔",
    loading: "正在載入分享的相片",
    loadingProgressTemplate: "正在準備第 {current}/{total} 項",
    workspaceTemplate: "上載到 {name}",
    unavailableTitle: "Afilmory 尚未準備好",
    unavailableDescription: "請先開啟 Afilmory、登入並選擇工作區，然後再分享相片。",
    noImagesTitle: "沒有可上載的圖片",
    noImagesDescription: "請選擇一張或多張支援的圖片後再試。",
    failedTitle: "無法開始上載",
    preparing: "正在加入上載佇列",
    handoffTimeout: "Afilmory 未能確認上載佇列，請再試。"
  )

  private static let traditionalTaiwan = ShareLocalization(
    cancel: "取消",
    title: "確認上傳",
    remove: "移除",
    uploadTemplate: "上傳 {count} 張",
    summaryTemplate: "{count} 項",
    tagsLabel: "標籤 —— 決定存放目錄",
    tagsPlaceholder: "新增標籤，逗號分隔",
    loading: "正在載入分享的照片",
    loadingProgressTemplate: "正在準備第 {current}/{total} 項",
    workspaceTemplate: "上傳到 {name}",
    unavailableTitle: "Afilmory 尚未準備好",
    unavailableDescription: "請先開啟 Afilmory、登入並選擇工作區，然後再分享照片。",
    noImagesTitle: "沒有可上傳的圖片",
    noImagesDescription: "請選擇一張或多張支援的圖片後再試。",
    failedTitle: "無法開始上傳",
    preparing: "正在加入上傳佇列",
    handoffTimeout: "Afilmory 未能確認上傳佇列，請再試。"
  )

  private static let japanese = ShareLocalization(
    cancel: "キャンセル",
    title: "アップロードの確認",
    remove: "削除",
    uploadTemplate: "{count} 件をアップロード",
    summaryTemplate: "{count} 件",
    tagsLabel: "タグ — 保存先フォルダになります",
    tagsPlaceholder: "タグを追加（カンマ区切り）",
    loading: "共有された写真を読み込んでいます",
    loadingProgressTemplate: "{current}/{total} 件を準備中",
    workspaceTemplate: "{name} にアップロード",
    unavailableTitle: "Afilmory の準備ができていません",
    unavailableDescription: "Afilmory を開いてサインインし、ワークスペースを選択してから共有してください。",
    noImagesTitle: "アップロードする画像がありません",
    noImagesDescription: "対応する画像を1枚以上共有して、もう一度お試しください。",
    failedTitle: "アップロードを開始できませんでした",
    preparing: "アップロードキューに追加中",
    handoffTimeout: "アップロードキューを確認できませんでした。もう一度お試しください。"
  )

  private static let korean = ShareLocalization(
    cancel: "취소",
    title: "업로드 확인",
    remove: "제거",
    uploadTemplate: "{count}개 업로드",
    summaryTemplate: "{count}개",
    tagsLabel: "태그 — 저장 폴더가 됩니다",
    tagsPlaceholder: "태그 추가, 쉼표로 구분",
    loading: "공유한 사진을 불러오는 중",
    loadingProgressTemplate: "{current}/{total} 준비 중",
    workspaceTemplate: "{name}에 업로드",
    unavailableTitle: "Afilmory가 준비되지 않았습니다",
    unavailableDescription: "Afilmory를 열어 로그인하고 워크스페이스를 선택한 후 사진을 공유하세요.",
    noImagesTitle: "업로드할 이미지가 없습니다",
    noImagesDescription: "지원되는 이미지를 하나 이상 공유한 후 다시 시도하세요.",
    failedTitle: "업로드를 시작할 수 없습니다",
    preparing: "업로드 대기열에 추가 중",
    handoffTimeout: "Afilmory가 업로드 대기열을 확인하지 못했습니다. 다시 시도하세요."
  )
}
