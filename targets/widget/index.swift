import WidgetKit
import SwiftUI

private let appGroup = "group.com.openseason.shared"

// Slate + Ember palette (matches the app). Used only for the home-screen sizes;
// Lock Screen (accessory) widgets are tinted monochrome by the system.
// Ember palette — warm charcoal + copper, matching the redesigned app.
private let slate = Color(red: 0.063, green: 0.055, blue: 0.047)     // #100e0c
private let ember = Color(red: 0.851, green: 0.620, blue: 0.498)     // #d99e7f copper
private let emberSoft = Color(red: 0.902, green: 0.718, blue: 0.608) // #e6b79b
private let mist = Color(red: 0.957, green: 0.945, blue: 0.918)      // #f4f1ea
private let muted = Color(red: 0.52, green: 0.50, blue: 0.47)        // warm muted

struct NextEntry: TimelineEntry {
  let date: Date
  let title: String
  let subtitle: String
  let kind: String
  let daysUntil: Int?
  let hasData: Bool
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> NextEntry {
    NextEntry(date: Date(), title: "Colorado Elk — Archery", subtitle: "Statewide",
              kind: "opener", daysUntil: 14, hasData: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (NextEntry) -> Void) {
    completion(readEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NextEntry>) -> Void) {
    let entry = readEntry()
    let cal = Calendar.current
    let tomorrow = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    let nextMidnight = cal.startOfDay(for: tomorrow)
    completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
  }

  private func readEntry() -> NextEntry {
    let d = UserDefaults(suiteName: appGroup)
    let title = d?.string(forKey: "widget_title") ?? ""
    let subtitle = d?.string(forKey: "widget_sub") ?? ""
    let kind = d?.string(forKey: "widget_kind") ?? "opener"
    let dateStr = d?.string(forKey: "widget_date") ?? ""

    var days: Int? = nil
    if !dateStr.isEmpty {
      let f = DateFormatter()
      f.dateFormat = "yyyy-MM-dd"
      f.timeZone = TimeZone.current
      f.locale = Locale(identifier: "en_US_POSIX")
      if let target = f.date(from: dateStr) {
        let cal = Calendar.current
        days = cal.dateComponents([.day],
                                  from: cal.startOfDay(for: Date()),
                                  to: cal.startOfDay(for: target)).day
      }
    }
    return NextEntry(date: Date(), title: title, subtitle: subtitle,
                     kind: kind, daysUntil: days, hasData: !title.isEmpty)
  }
}

struct WidgetView: View {
  var entry: NextEntry
  @Environment(\.widgetFamily) var family

  private var days: Int { max(entry.daysUntil ?? 0, 0) }
  private var kindLabel: String { entry.kind == "deadline" ? "TAG DEADLINE" : "OPENER" }

  var body: some View {
    contentView
      .containerBackground(for: .widget) {
        if family == .systemSmall || family == .systemMedium { slate } else { Color.clear }
      }
  }

  @ViewBuilder private var contentView: some View {
    switch family {
    case .accessoryInline:
      Text(entry.hasData ? "\(entry.title) · \(days)d" : "OpenSeason")
    case .accessoryCircular:
      circular
    case .accessoryRectangular:
      rectangular
    default:
      if entry.hasData { home } else { empty }
    }
  }

  // --- Lock Screen: circular badge ---
  private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: -2) {
        Text(entry.hasData ? "\(days)" : "—")
          .font(.system(size: 22, weight: .bold, design: .rounded))
        Text(entry.hasData ? (entry.kind == "deadline" ? "due" : "days") : "")
          .font(.system(size: 9, weight: .medium))
      }
    }
    .widgetAccentable()
  }

  // --- Lock Screen: rectangular ---
  private var rectangular: some View {
    VStack(alignment: .leading, spacing: 1) {
      if entry.hasData {
        Text(kindLabel).font(.system(size: 11, weight: .semibold)).widgetAccentable()
        Text(entry.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
        Text("\(days) \(days == 1 ? "day" : "days")").font(.system(size: 12))
      } else {
        Text("Open Season").font(.system(size: 13, weight: .semibold))
        Text("Open the app to pick hunts").font(.system(size: 11))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // --- Home screen: full countdown ---
  private var home: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(kindLabel)
        .font(.system(size: 10, weight: .semibold)).kerning(1.3)
        .foregroundColor(entry.kind == "deadline" ? emberSoft : muted)
      Spacer(minLength: 0)
      HStack(alignment: .lastTextBaseline, spacing: 6) {
        Text("\(days)")
          .font(.system(size: family == .systemSmall ? 46 : 56, weight: .bold, design: .serif))
          .foregroundColor(ember)
          .minimumScaleFactor(0.6).lineLimit(1)
        Text(days == 1 ? "day" : "days")
          .font(.system(size: 13, weight: .semibold)).foregroundColor(muted)
          .padding(.bottom, 9)
      }
      Text(entry.title)
        .font(.system(size: 13, weight: .semibold)).foregroundColor(mist)
        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(16)
  }

  private var empty: some View {
    VStack(spacing: 6) {
      Text("OpenSeason")
        .font(.system(size: 16, weight: .semibold, design: .serif)).foregroundColor(mist)
      Text("Open the app to pick your hunts")
        .font(.system(size: 12)).foregroundColor(muted).multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(16)
  }
}

// MARK: - Legal Light widget — countdown to first and last light.
// The app writes a week of legal-light windows (epoch ms) to the App Group;
// the timeline walks the phases and WidgetKit's date styles tick the
// countdown natively between entries. Text-only on the Lock Screen.

struct LightDay: Decodable {
  let s: Double
  let e: Double
}

struct LightEntry: TimelineEntry {
  let date: Date
  /// 0 = before first light, 1 = in legal light, 2 = after last light
  let phase: Int
  /// What the countdown runs toward (first light, or last light). For
  /// phase 2 it is tomorrow's first light.
  let target: Date
  let hasData: Bool
}

struct LightProvider: TimelineProvider {
  func placeholder(in context: Context) -> LightEntry {
    LightEntry(date: Date(), phase: 0, target: Date().addingTimeInterval(3180), hasData: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (LightEntry) -> Void) {
    completion(currentEntry() ?? placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<LightEntry>) -> Void) {
    let days = readDays()
    let now = Date()
    var entries: [LightEntry] = []

    for (i, day) in days.enumerated() {
      let start = Date(timeIntervalSince1970: day.s / 1000)
      let end = Date(timeIntervalSince1970: day.e / 1000)
      if end < now { continue }
      // Phase 0: counting down to first light (entry starts immediately or
      // at the previous day's last light — WidgetKit ignores past dates
      // beyond the first entry).
      entries.append(LightEntry(date: entries.isEmpty ? now : entries.last!.target,
                                phase: 0, target: start, hasData: true))
      // Phase 1: in the light, counting to last light.
      entries.append(LightEntry(date: start, phase: 1, target: end, hasData: true))
      // Phase 2: done for the day; show tomorrow's first light.
      if i + 1 < days.count {
        let nextStart = Date(timeIntervalSince1970: days[i + 1].s / 1000)
        entries.append(LightEntry(date: end, phase: 2, target: nextStart, hasData: true))
      }
    }

    if entries.isEmpty {
      entries = [LightEntry(date: now, phase: 0, target: now, hasData: false)]
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  private func currentEntry() -> LightEntry? {
    let days = readDays()
    let now = Date()
    for (i, day) in days.enumerated() {
      let start = Date(timeIntervalSince1970: day.s / 1000)
      let end = Date(timeIntervalSince1970: day.e / 1000)
      if now < start { return LightEntry(date: now, phase: 0, target: start, hasData: true) }
      if now <= end { return LightEntry(date: now, phase: 1, target: end, hasData: true) }
      if i + 1 < days.count {
        let nextStart = Date(timeIntervalSince1970: days[i + 1].s / 1000)
        if now < nextStart { return LightEntry(date: now, phase: 2, target: nextStart, hasData: true) }
      }
    }
    return nil
  }

  private func readDays() -> [LightDay] {
    guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "widget_light"),
          let data = raw.data(using: .utf8),
          let days = try? JSONDecoder().decode([LightDay].self, from: data)
    else { return [] }
    return days
  }
}

struct LightWidgetView: View {
  var entry: LightEntry
  @Environment(\.widgetFamily) var family

  private var label: String {
    switch entry.phase {
    case 0: return "FIRST LIGHT"
    case 1: return "LEGAL LIGHT"
    default: return "DONE FOR THE DAY"
    }
  }
  private var clock: String {
    let f = DateFormatter()
    f.timeStyle = .short
    return f.string(from: entry.target)
  }

  var body: some View {
    content
      .containerBackground(for: .widget) {
        if family == .systemSmall { slate } else { Color.clear }
      }
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryInline:
      if !entry.hasData {
        Text("Open Season")
      } else if entry.phase == 2 {
        Text("First light \(clock)")
      } else {
        Text("\(entry.phase == 0 ? "Light" : "Ends") \(clock)")
      }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        if entry.hasData {
          Text(label).font(.system(size: 11, weight: .semibold)).widgetAccentable()
          if entry.phase == 2 {
            Text("First light \(clock)").font(.system(size: 13, weight: .semibold))
          } else {
            Text(entry.target, style: .timer)
              .font(.system(size: 17, weight: .bold, design: .rounded))
            Text(entry.phase == 0 ? "until first light · \(clock)" : "until last light · \(clock)")
              .font(.system(size: 11))
          }
        } else {
          Text("Open Season").font(.system(size: 13, weight: .semibold))
          Text("Open the app once").font(.system(size: 11))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    default:
      VStack(alignment: .leading, spacing: 3) {
        if entry.hasData {
          Text(label)
            .font(.system(size: 10, weight: .semibold)).kerning(1.3)
            .foregroundColor(entry.phase == 0 ? ember : muted)
          Spacer(minLength: 0)
          if entry.phase == 2 {
            Text(clock)
              .font(.system(size: 34, weight: .bold, design: .serif))
              .foregroundColor(ember)
              .minimumScaleFactor(0.6).lineLimit(1)
            Text("first light tomorrow")
              .font(.system(size: 12, weight: .semibold)).foregroundColor(mist)
          } else {
            Text(entry.target, style: .timer)
              .font(.system(size: 34, weight: .bold, design: .serif))
              .foregroundColor(entry.phase == 0 ? ember : mist)
              .minimumScaleFactor(0.6).lineLimit(1)
            Text(entry.phase == 0 ? "until first light" : "until last light")
              .font(.system(size: 12, weight: .semibold)).foregroundColor(muted)
            Text(clock).font(.system(size: 12)).foregroundColor(muted)
          }
        } else {
          Text("Legal light")
            .font(.system(size: 16, weight: .semibold, design: .serif)).foregroundColor(mist)
          Text("Open the app once to set your state")
            .font(.system(size: 12)).foregroundColor(muted)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .padding(16)
    }
  }
}

struct LegalLightWidget: Widget {
  let kind = "OpenSeasonLightWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: LightProvider()) { entry in
      LightWidgetView(entry: entry)
    }
    .configurationDisplayName("Legal Light")
    .description("Counts down to first and last legal light.")
    .supportedFamilies([.systemSmall, .accessoryInline, .accessoryRectangular])
  }
}

struct OpenSeasonWidget: Widget {
  let kind = "OpenSeasonWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      WidgetView(entry: entry)
    }
    .configurationDisplayName("Next Up")
    .description("Your soonest opener or tag deadline.")
    .supportedFamilies([
      .systemSmall, .systemMedium,
      .accessoryInline, .accessoryCircular, .accessoryRectangular,
    ])
  }
}

@main
struct OpenSeasonWidgetBundle: WidgetBundle {
  var body: some Widget {
    OpenSeasonWidget()
    LegalLightWidget()
  }
}
