import WidgetKit
import SwiftUI

private let appGroup = "group.com.openseason.app"

// Slate + Ember palette (matches the app).
private let slate = Color(red: 0.051, green: 0.051, blue: 0.078)
private let ember = Color(red: 0.878, green: 0.475, blue: 0.290)
private let emberSoft = Color(red: 0.941, green: 0.690, blue: 0.541)
private let mist = Color(red: 0.929, green: 0.933, blue: 0.957)
private let muted = Color(red: 0.475, green: 0.494, blue: 0.549)

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
    // Recompute just after midnight so the day count ticks down on its own.
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

  var body: some View {
    Group {
      if entry.hasData {
        content
      } else {
        empty
      }
    }
    .containerBackground(for: .widget) { slate }
  }

  private var content: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(entry.kind == "deadline" ? "TAG DEADLINE" : "OPENER")
        .font(.system(size: 10, weight: .semibold)).kerning(1.3)
        .foregroundColor(entry.kind == "deadline" ? emberSoft : muted)
      Spacer(minLength: 0)
      HStack(alignment: .lastTextBaseline, spacing: 6) {
        Text(entry.daysUntil.map { "\(max($0, 0))" } ?? "—")
          .font(.system(size: family == .systemSmall ? 46 : 56, weight: .bold, design: .serif))
          .foregroundColor(ember)
          .minimumScaleFactor(0.6).lineLimit(1)
        Text((entry.daysUntil == 1 ? "day" : "days"))
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

struct OpenSeasonWidget: Widget {
  let kind = "OpenSeasonWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      WidgetView(entry: entry)
    }
    .configurationDisplayName("Next Up")
    .description("Your soonest opener or tag deadline.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct OpenSeasonWidgetBundle: WidgetBundle {
  var body: some Widget {
    OpenSeasonWidget()
  }
}
