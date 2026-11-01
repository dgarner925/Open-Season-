package __PACKAGE__

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The Legal Light widget — the Android half of targets/widget/index.swift.
 *
 * The app writes a week of legal-light windows (epoch ms) and this reads them,
 * so the widget stays right for seven days without the app ever opening. The
 * live countdown is a Chronometer in count-down mode: the system ticks it, not
 * us, so there is no wakeup per second and no battery cost. An alarm at each
 * boundary is only there to flip the LABEL from "first light" to "legal light".
 *
 * It always counts toward the next line that matters: at last light it turns
 * straight around and counts to tomorrow's first light rather than going dark
 * (David, 2026-09-15: "count down from non-legal to legal" too).
 */
class LegalLightWidget : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) render(context, manager, id)
    scheduleNextBoundary(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == ACTION_TICK) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, LegalLightWidget::class.java))
      if (ids.isNotEmpty()) onUpdate(context, manager, ids)
    }
  }

  override fun onDisabled(context: Context) {
    alarms(context).cancel(tickIntent(context))
  }

  // -------------------------------------------------------------------------

  /** 0 = waiting for first light, 1 = inside legal light. */
  private data class Phase(val inLight: Boolean, val target: Long)

  private fun render(context: Context, manager: AppWidgetManager, id: Int) {
    val views = RemoteViews(context.packageName, R.layout.legal_light_widget)
    val now = System.currentTimeMillis()
    val phase = currentPhase(readDays(context), now)

    if (phase == null) {
      views.setTextViewText(R.id.ll_label, "OPEN SEASON")
      views.setViewVisibility(R.id.ll_timer, View.GONE)
      views.setTextViewText(R.id.ll_caption, "Open the app once to set your state")
    } else {
      views.setTextViewText(R.id.ll_label, if (phase.inLight) "LEGAL LIGHT" else "FIRST LIGHT")
      views.setViewVisibility(R.id.ll_timer, View.VISIBLE)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        views.setChronometerCountDown(R.id.ll_timer, true)
      }
      // The base is on the elapsed-realtime clock, so the countdown survives
      // the launcher recycling the view without us touching it again.
      views.setChronometer(
        R.id.ll_timer,
        SystemClock.elapsedRealtime() + (phase.target - now),
        null,
        true,
      )
      val lead = if (phase.inLight) "until last light" else "until first light"
      views.setTextViewText(R.id.ll_caption, lead + " · " + clock(phase.target))
    }

    views.setOnClickPendingIntent(R.id.ll_root, launchIntent(context))
    manager.updateAppWidget(id, views)
  }

  private fun currentPhase(days: List<Pair<Long, Long>>, now: Long): Phase? {
    for ((i, day) in days.withIndex()) {
      val (start, end) = day
      if (now < start) return Phase(false, start)
      if (now <= end) return Phase(true, end)
      if (i + 1 < days.size) {
        val nextStart = days[i + 1].first
        if (now < nextStart) return Phase(false, nextStart)
      }
    }
    return null
  }

  /**
   * The week table, read out of the app's own AsyncStorage database.
   *
   * AsyncStorage keeps its rows in SQLite, so the widget needs no native bridge
   * and the app needs no extra dependency to hand data across — the widget runs
   * in the app's own process and UID, so this is our file, not someone else's.
   *
   * It ships TWO schemas: the long-standing one (RKStorage / catalystLocalStorage)
   * and the opt-in "next" Room store (AsyncStorage / Storage), which a gradle
   * flag can switch on and which migrates the old file in. Checking both means a
   * flipped flag can't quietly blank the widget. If neither answers, every
   * failure lands on an empty list and the widget shows its "open the app once"
   * face rather than throwing inside the launcher.
   */
  private fun readDays(context: Context): List<Pair<Long, Long>> {
    val raw = readValue(context, "AsyncStorage", "Storage")
      ?: readValue(context, "RKStorage", "catalystLocalStorage")
      ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { i ->
        val o = array.optJSONObject(i)
        val s = o?.optLong("s") ?: 0L
        val e = o?.optLong("e") ?: 0L
        if (s > 0L && e > s) Pair(s, e) else null
      }
    } catch (t: Throwable) {
      emptyList()
    }
  }

  /** One value by key, or null if that database/table isn't the live one. */
  private fun readValue(context: Context, dbName: String, table: String): String? {
    return try {
      val file = context.getDatabasePath(dbName)
      if (!file.exists()) return null
      SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
        // The key column is quoted: "key" is a reserved word in the Room schema.
        db.rawQuery("select value from " + table + " where `key` = ?", arrayOf(KEY)).use { c ->
          if (c.moveToFirst()) c.getString(0) else null
        }
      }
    } catch (t: Throwable) {
      null
    }
  }

  private fun scheduleNextBoundary(context: Context) {
    val target = currentPhase(readDays(context), System.currentTimeMillis())?.target ?: return
    // Inexact on purpose: an exact alarm would need SCHEDULE_EXACT_ALARM, and
    // all that waits on this is the label. The Chronometer keeps counting
    // correctly even if Doze slides the wakeup by a few minutes.
    alarms(context).set(AlarmManager.RTC, target + 1_000L, tickIntent(context))
  }

  private fun alarms(context: Context): AlarmManager =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun tickIntent(context: Context): PendingIntent {
    val intent = Intent(context, LegalLightWidget::class.java).setAction(ACTION_TICK)
    return PendingIntent.getBroadcast(context, 0, intent, flags())
  }

  private fun launchIntent(context: Context): PendingIntent {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    return PendingIntent.getActivity(context, 1, intent, flags())
  }

  private fun flags(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }

  private fun clock(epochMs: Long): String =
    SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(epochMs))

  companion object {
    private const val ACTION_TICK = "__PACKAGE__.LEGAL_LIGHT_TICK"
    private const val KEY = "widget_light"
  }
}
