// PDFapp on the iPad: the native side of window.api (ios-web/ios-api.js).
//
// Files. A PDF picked in the Files sheet (or opened in PDFapp from another app) is kept as a bookmark, so
// it can be read and saved in place later, in iCloud Drive or anywhere else, as on the Mac. JavaScript
// refers to it as "ios://<id>/<name>".
//
// Zotero. The API key lives in the keychain; JavaScript never sees it. Requests are made here, and only to
// the user's own library and the groups the key gives access to, as in the desktop app's zotero-main.js.
import Foundation
import UIKit
import Capacitor
import CryptoKit
import Security
import UniformTypeIdentifiers

@objc(PDFappPlugin)
public class PDFappPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "PDFappPlugin"
    public let jsName = "PDFapp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "launchPath", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeRecent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "alert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copyText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "backgroundDone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFullScreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "zoteroConfig", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "zoteroConnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "zoteroDisconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "zoteroRequest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "zoteroDownload", returnType: CAPPluginReturnPromise),
    ]

    // MARK: - Lifecycle

    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    public override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(openURL(_:)), name: .capacitorOpenURL, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(didEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    // "Open in PDFapp" from Files or another app.
    @objc private func openURL(_ note: Notification) {
        guard let info = note.object as? [String: Any], let url = info["url"] as? URL, url.isFileURL else { return }
        DispatchQueue.main.async {
            if let entry = try? self.register(url, recent: true) {
                self.notifyListeners("openPath", data: ["path": entry.path], retainUntilConsumed: true)
            }
        }
    }

    // Gives the page up to 25 seconds to save open documents before iOS may suspend the app.
    @objc private func didEnterBackground() {
        endBackgroundTask()
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Save documents") { [weak self] in
            self?.endBackgroundTask()
        }
        notifyListeners("background", data: [:])
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in self?.endBackgroundTask() }
    }

    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }

    @objc func backgroundDone(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.endBackgroundTask() }
        call.resolve()
    }

    // Full screen in the page: hide the status bar and the home indicator as well.
    @objc func setFullScreen(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            (self.bridge?.viewController as? MainViewController)?.setFullScreen(on)
            call.resolve()
        }
    }

    @objc func info(_ call: CAPPluginCall) {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        DispatchQueue.main.async {
            call.resolve(["name": UIDevice.current.name, "version": version])
        }
    }

    @objc func launchPath(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = ApplicationDelegateProxy.shared.lastURL, url.isFileURL, let entry = try? self.register(url, recent: true) else {
                call.resolve([:])
                return
            }
            call.resolve(["path": entry.path])
        }
    }

    // MARK: - Remembered files

    private struct Entry: Codable {
        var id: String
        var name: String
        var folder: String
        var bookmark: Data
        var time: Double
        var recent: Bool
        var path: String { "ios://\(id)/\(name)" } // file names cannot contain "/"
    }

    private let entriesKey = "pdfapp.files"

    private func loadEntries() -> [Entry] {
        guard let data = UserDefaults.standard.data(forKey: entriesKey) else { return [] }
        return (try? JSONDecoder().decode([Entry].self, from: data)) ?? []
    }

    private func saveEntries(_ list: [Entry]) {
        // Keep the 150 most recently used.
        let kept = Array(list.sorted { $0.time > $1.time }.prefix(150))
        if let data = try? JSONEncoder().encode(kept) { UserDefaults.standard.set(data, forKey: entriesKey) }
    }

    private func idFor(_ url: URL) -> String {
        let digest = SHA256.hash(data: Data(url.standardizedFileURL.path.utf8))
        return digest.prefix(8).map { String(format: "%02x", $0) }.joined()
    }

    @discardableResult
    private func register(_ url: URL, recent: Bool) throws -> Entry {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
        var list = loadEntries()
        let id = idFor(url)
        let folder = url.deletingLastPathComponent().lastPathComponent
        var entry = Entry(id: id, name: url.lastPathComponent, folder: folder, bookmark: bookmark, time: Date().timeIntervalSince1970 * 1000, recent: recent)
        if let i = list.firstIndex(where: { $0.id == id }) {
            entry.recent = list[i].recent || recent
            list[i] = entry
        } else {
            list.append(entry)
        }
        saveEntries(list)
        return entry
    }

    private func entryId(from path: String) -> String? {
        guard path.hasPrefix("ios://") else { return nil }
        return path.dropFirst("ios://".count).split(separator: "/").first.map(String.init)
    }

    // The file behind a path, with a fresh bookmark if iOS says the old one is stale.
    private func resolve(_ path: String) throws -> (URL, Entry) {
        guard let id = entryId(from: path), var list = Optional(loadEntries()), let i = list.firstIndex(where: { $0.id == id }) else {
            throw err("PDFapp no longer knows where this file is. Open it again from Files.")
        }
        var stale = false
        let url = try URL(resolvingBookmarkData: list[i].bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
        if stale {
            let access = url.startAccessingSecurityScopedResource()
            if let fresh = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
                list[i].bookmark = fresh
                list[i].name = url.lastPathComponent
                saveEntries(list)
            }
            if access { url.stopAccessingSecurityScopedResource() }
        }
        return (url, list[i])
    }

    private func err(_ message: String) -> NSError {
        NSError(domain: "PDFapp", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    // MARK: - Reading and writing files

    private var pendingPick: CAPPluginCall?
    private var pendingExport: CAPPluginCall?
    private var exportTemp: URL?

    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.pdf], asCopy: false)
            picker.allowsMultipleSelection = call.getBool("multiple") ?? true
            picker.delegate = self
            self.pendingPick = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else { return call.reject("No path") }
        let remember = call.getBool("remember") ?? true
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let data: Data
                if path.hasPrefix("zotero://") {
                    data = try Data(contentsOf: self.zoteroCacheURL(for: path))
                } else {
                    let (url, _) = try self.resolve(path)
                    data = try self.coordinatedRead(url)
                    if remember { DispatchQueue.main.sync { _ = try? self.register(url, recent: true) } }
                }
                call.resolve(["data": data.base64EncodedString()])
            } catch {
                call.reject("Could not open the file: \(error.localizedDescription)")
            }
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else {
            return call.reject("Nothing to write")
        }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let (url, _) = try self.resolve(path)
                try self.coordinatedWrite(data, to: url)
                call.resolve(["path": path])
            } catch {
                call.reject("Could not save the file: \(error.localizedDescription)")
            }
        }
    }

    // Save somewhere new: write a temporary copy, then let the user choose where it goes in Files.
    @objc func exportFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else {
            return call.reject("Nothing to save")
        }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let tmp = dir.appendingPathComponent(name.isEmpty ? "Document.pdf" : name)
            try data.write(to: tmp, options: .atomic)
            exportTemp = tmp
        } catch {
            return call.reject("Could not prepare the file: \(error.localizedDescription)")
        }
        DispatchQueue.main.async {
            guard let tmp = self.exportTemp else { return }
            let picker = UIDocumentPickerViewController(forExporting: [tmp], asCopy: true)
            picker.delegate = self
            self.pendingExport = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let call = pendingPick {
            pendingPick = nil
            let paths = urls.compactMap { try? register($0, recent: true).path }
            call.resolve(["paths": paths])
        } else if let call = pendingExport {
            pendingExport = nil
            cleanExportTemp()
            guard let url = urls.first else { return call.resolve([:]) }
            let isPDF = url.pathExtension.lowercased() == "pdf"
            if let entry = try? register(url, recent: isPDF) {
                call.resolve(["path": entry.path])
            } else {
                call.resolve(["path": "saved://\(url.lastPathComponent)"])
            }
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if let call = pendingPick {
            pendingPick = nil
            call.resolve(["paths": []])
        }
        if let call = pendingExport {
            pendingExport = nil
            cleanExportTemp()
            call.resolve([:]) // no path: cancelled
        }
    }

    private func cleanExportTemp() {
        if let tmp = exportTemp { try? FileManager.default.removeItem(at: tmp.deletingLastPathComponent()) }
        exportTemp = nil
    }

    // Coordinated access, so iCloud Drive downloads the file first and other apps see a complete save.
    private func coordinatedRead(_ url: URL) throws -> Data {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        var coordError: NSError?
        var result: Result<Data, Error> = .failure(err("The file could not be read."))
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordError) { u in
            result = Result { try Data(contentsOf: u) }
        }
        if let coordError { throw coordError }
        return try result.get()
    }

    private func coordinatedWrite(_ data: Data, to url: URL) throws {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        var coordError: NSError?
        var result: Result<Void, Error> = .failure(err("The file could not be saved."))
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordError) { u in
            result = Result { try data.write(to: u, options: .atomic) }
        }
        if let coordError { throw coordError }
        try result.get()
    }

    @objc func recent(_ call: CAPPluginCall) {
        let items = loadEntries().filter { $0.recent }.sorted { $0.time > $1.time }.prefix(100).map {
            ["path": $0.path, "time": $0.time, "folder": $0.folder] as [String: Any]
        }
        call.resolve(["items": Array(items)])
    }

    @objc func removeRecent(_ call: CAPPluginCall) {
        if let path = call.getString("path"), let id = entryId(from: path) {
            var list = loadEntries()
            if let i = list.firstIndex(where: { $0.id == id }) {
                list[i].recent = false
                saveEntries(list)
            }
        }
        call.resolve()
    }

    // MARK: - Dialogs, clipboard, printing

    @objc func confirm(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? ""
        let buttons = call.getArray("buttons", String.self) ?? ["OK", "Cancel"]
        DispatchQueue.main.async {
            let alert = UIAlertController(title: "PDFapp", message: message, preferredStyle: .alert)
            for (i, title) in buttons.enumerated() {
                let last = i == buttons.count - 1 && buttons.count > 1
                let style: UIAlertAction.Style = last ? .cancel : (title.lowercased().hasPrefix("don") || title.lowercased().hasPrefix("disconnect") ? .destructive : .default)
                alert.addAction(UIAlertAction(title: title, style: style) { _ in call.resolve(["index": i]) })
            }
            self.bridge?.viewController?.present(alert, animated: true)
        }
    }

    @objc func alert(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? ""
        DispatchQueue.main.async {
            let alert = UIAlertController(title: "PDFapp", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in call.resolve() })
            self.bridge?.viewController?.present(alert, animated: true)
        }
    }

    @objc func copyText(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async {
            UIPasteboard.general.string = text
            call.resolve()
        }
    }

    @objc func print(_ call: CAPPluginCall) {
        guard let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else { return call.reject("Nothing to print") }
        let name = call.getString("name") ?? "PDF"
        DispatchQueue.main.async {
            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = name
            controller.printInfo = info
            controller.printingItem = data
            let done: UIPrintInteractionController.CompletionHandler = { _, completed, error in
                if let error { call.reject(error.localizedDescription) } else { call.resolve(["ok": completed]) }
            }
            if let view = self.bridge?.viewController?.view {
                let r = CGRect(x: view.bounds.midX, y: view.bounds.minY + 80, width: 1, height: 1)
                controller.present(from: r, in: view, animated: true, completionHandler: done)
            } else {
                controller.present(animated: true, completionHandler: done)
            }
        }
    }

    // MARK: - Zotero

    private let api = "https://api.zotero.org"
    private let zoteroKey = "pdfapp.zotero"
    private let keychainService = "com.bdstanley.pdfapp.zotero"

    private struct ZoteroConfig: Codable {
        var userID: Int?
        var username: String?
        var groups: [Group] = []
        struct Group: Codable { var id: Int; var name: String }
    }

    private func zcfg() -> ZoteroConfig {
        guard let d = UserDefaults.standard.data(forKey: zoteroKey), let c = try? JSONDecoder().decode(ZoteroConfig.self, from: d) else { return ZoteroConfig() }
        return c
    }

    private func saveZcfg(_ c: ZoteroConfig) {
        if let d = try? JSONEncoder().encode(c) { UserDefaults.standard.set(d, forKey: zoteroKey) }
    }

    private func publicZcfg() -> [String: Any] {
        let c = zcfg()
        return [
            "connected": c.userID != nil && keychainGet() != nil,
            "userID": c.userID.map { $0 as Any } ?? NSNull(),
            "username": c.username ?? "",
            "dataDir": "", "baseDir": "", "encrypted": true, "ios": true,
            "groups": c.groups.map { ["id": $0.id, "name": $0.name] },
        ]
    }

    private func keychainQuery() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: "apiKey"]
    }

    private func keychainGet() -> String? {
        var q = keychainQuery()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func keychainSet(_ key: String) -> Bool {
        SecItemDelete(keychainQuery() as CFDictionary)
        var q = keychainQuery()
        q[kSecValueData as String] = Data(key.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }

    // Only the user's own library and the groups the key reaches.
    private func allowed(_ path: String) -> Bool {
        let c = zcfg()
        if path.contains("..") { return false }
        if let id = c.userID, path.hasPrefix("/users/\(id)/") { return true }
        if path.hasPrefix("/groups/") {
            let parts = path.split(separator: "/")
            if parts.count > 1, let g = Int(parts[1]) { return c.groups.contains { $0.id == g } }
        }
        return false
    }

    private func zoteroCall(_ method: String, _ path: String, query: [String: Any] = [:], headers: [String: String] = [:], body: String? = nil, key: String? = nil,
                            done: @escaping (_ status: Int, _ text: String?, _ response: HTTPURLResponse?, _ error: Error?) -> Void) {
        guard let k = key ?? keychainGet() else { return done(0, nil, nil, err("PDFapp is not connected to Zotero.")) }
        guard var comps = URLComponents(string: api + path) else { return done(0, nil, nil, err("Bad address")) }
        let items = query.compactMap { (name, value) -> URLQueryItem? in
            let s = "\(value)"
            return s.isEmpty ? nil : URLQueryItem(name: name, value: s)
        }
        if !items.isEmpty { comps.queryItems = items }
        guard let url = comps.url else { return done(0, nil, nil, err("Bad address")) }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(k, forHTTPHeaderField: "Zotero-API-Key")
        req.setValue("3", forHTTPHeaderField: "Zotero-API-Version")
        for (h, v) in headers { req.setValue(v, forHTTPHeaderField: h) }
        if let body {
            req.httpBody = Data(body.utf8)
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        URLSession.shared.dataTask(with: req) { data, response, error in
            let http = response as? HTTPURLResponse
            done(http?.statusCode ?? 0, data.flatMap { String(data: $0, encoding: .utf8) }, http, error)
        }.resume()
    }

    @objc func zoteroConfig(_ call: CAPPluginCall) {
        call.resolve(publicZcfg())
    }

    @objc func zoteroConnect(_ call: CAPPluginCall) {
        let key = (call.getString("key") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard key.range(of: "^[A-Za-z0-9]{10,64}$", options: .regularExpression) != nil else {
            return call.reject("That does not look like a Zotero API key.")
        }
        zoteroCall("GET", "/keys/current", key: key) { status, text, _, error in
            if error != nil || status == 0 { return call.reject("Could not reach Zotero. Check the internet connection.") }
            if status == 403 || status == 404 { return call.reject("Zotero did not accept this key.") }
            guard status == 200, let text, let json = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
                  let userID = json["userID"] as? Int else { return call.reject("Zotero answered \(status).") }
            let access = (json["access"] as? [String: Any])?["user"] as? [String: Any] ?? [:]
            if access["library"] as? Bool != true { return call.reject("This key cannot read your library. Create a key with \"Allow library access\".") }
            if access["write"] as? Bool != true { return call.reject("This key cannot write to your library. Create a key with \"Allow write access\", so annotations can be saved.") }
            guard self.keychainSet(key) else { return call.reject("The key could not be stored in the keychain.") }
            var c = ZoteroConfig()
            c.userID = userID
            c.username = json["username"] as? String ?? ""
            self.zoteroCall("GET", "/users/\(userID)/groups", query: ["limit": 100], key: key) { gs, gtext, _, _ in
                if gs == 200, let gtext, let arr = try? JSONSerialization.jsonObject(with: Data(gtext.utf8)) as? [[String: Any]] {
                    c.groups = arr.compactMap { g in
                        guard let id = g["id"] as? Int else { return nil }
                        let name = (g["data"] as? [String: Any])?["name"] as? String ?? "Group \(id)"
                        return ZoteroConfig.Group(id: id, name: name)
                    }
                }
                self.saveZcfg(c)
                call.resolve(self.publicZcfg())
            }
        }
    }

    @objc func zoteroDisconnect(_ call: CAPPluginCall) {
        SecItemDelete(keychainQuery() as CFDictionary)
        UserDefaults.standard.removeObject(forKey: zoteroKey)
        call.resolve(publicZcfg())
    }

    @objc func zoteroRequest(_ call: CAPPluginCall) {
        let method = call.getString("method") ?? "GET"
        guard ["GET", "POST", "PATCH", "DELETE"].contains(method) else { return call.reject("Bad method") }
        guard let path = call.getString("path"), allowed(path) else { return call.reject("Not a library this key can reach.") }
        let query = call.getObject("query") ?? [:]
        var headers: [String: String] = [:]
        for (k, v) in call.getObject("headers") ?? [:] { headers[k] = "\(v)" }
        let body = call.getString("body")
        zoteroCall(method, path, query: query, headers: headers, body: body) { status, text, http, error in
            if status == 0 {
                return call.resolve(["status": 0, "offline": true, "error": error?.localizedDescription ?? "offline"])
            }
            let num = { (h: String) -> Any in Int(http?.value(forHTTPHeaderField: h) ?? "").map { $0 as Any } ?? NSNull() }
            call.resolve(["status": status, "text": text ?? "", "version": num("Last-Modified-Version"), "total": num("Total-Results")])
        }
    }

    // PDFs downloaded from Zotero's file storage go to the app's caches; the key is not sent on to the file host.
    private final class StripKeyOnRedirect: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
            var r = request
            r.setValue(nil, forHTTPHeaderField: "Zotero-API-Key")
            completionHandler(r)
        }
    }

    private func zoteroCacheURL(for path: String) throws -> URL {
        // zotero://<lib>/<key>/<name>, where <lib> is users/123 or groups/456
        let rest = path.dropFirst("zotero://".count).split(separator: "/").map(String.init)
        guard rest.count >= 4 else { throw err("Bad Zotero path") }
        return try zoteroCacheDir(lib: "/\(rest[0])/\(rest[1])").appendingPathComponent("\(rest[2]).pdf")
    }

    private func zoteroCacheDir(lib: String) throws -> URL {
        let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let dir = caches.appendingPathComponent("zotero").appendingPathComponent(lib.replacingOccurrences(of: "/", with: "_"))
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    @objc func zoteroDownload(_ call: CAPPluginCall) {
        guard let lib = call.getString("lib"), let key = call.getString("key"), allowed("\(lib)/"),
              key.range(of: "^[A-Z0-9]{8}$", options: .regularExpression) != nil else { return call.reject("Bad attachment") }
        guard let apiKey = keychainGet(), let url = URL(string: "\(api)\(lib)/items/\(key)/file") else { return call.reject("PDFapp is not connected to Zotero.") }
        let filename = (call.getString("filename") ?? "\(key).pdf").replacingOccurrences(of: "/", with: "-")
        var req = URLRequest(url: url)
        req.setValue(apiKey, forHTTPHeaderField: "Zotero-API-Key")
        req.setValue("3", forHTTPHeaderField: "Zotero-API-Version")
        let session = URLSession(configuration: .default, delegate: StripKeyOnRedirect(), delegateQueue: nil)
        session.downloadTask(with: req) { tmp, response, error in
            defer { session.finishTasksAndInvalidate() }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if error != nil || status == 0 { return call.reject("Could not download the PDF from Zotero. Check the internet connection.") }
            if status == 404 { return call.reject("Zotero has no copy of this PDF online. The iPad version opens PDFs from Zotero's own file storage (not WebDAV or linked files).") }
            guard status == 200, let tmp else { return call.reject("Zotero answered \(status) when asked for the PDF.") }
            do {
                let dir = try self.zoteroCacheDir(lib: lib)
                let dest = dir.appendingPathComponent("\(key).pdf")
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: tmp, to: dest)
                let libPart = lib.split(separator: "/").joined(separator: "/")
                call.resolve(["path": "zotero://\(libPart)/\(key)/\(filename)"])
            } catch {
                call.reject("Could not keep the downloaded PDF: \(error.localizedDescription)")
            }
        }.resume()
    }
}
