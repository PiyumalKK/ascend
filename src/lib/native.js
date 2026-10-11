// Android app (Capacitor) integration: status bar, back button, and on-device timetable alarms.
// Every function is a no-op in the browser, so web code can call them unconditionally.
import { Capacitor } from '@capacitor/core'
import { getSchedule, toMin } from '../data/schedule'

export const isNative = () => Capacitor.isNativePlatform()

const TIMETABLE_ID_MIN = 1000
const TIMETABLE_ID_MAX = 9999
const CHANNEL = 'timetable'

async function plugins() {
  const [{ LocalNotifications }, { App }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/local-notifications'),
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
  ])
  return { LocalNotifications, App, StatusBar, Style }
}

export async function initNative() {
  if (!isNative()) return
  document.documentElement.classList.add('native')
  const { App, StatusBar, Style, LocalNotifications } = await plugins()
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#04050d' }).catch(() => {})
  App.addListener('backButton', ({ canGoBack }) => (canGoBack ? window.history.back() : App.minimizeApp()))
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Timetable',
    description: 'Start of each block in your day',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#8F7BFF',
  }).catch(() => {})
  // Tapping a notification opens the timetable.
  LocalNotifications.addListener('localNotificationActionPerformed', () => {
    window.location.hash = '#timetable'
  })
}

export async function notificationStatus() {
  if (!isNative()) return { supported: false }
  const { LocalNotifications } = await plugins()
  const perm = await LocalNotifications.checkPermissions()
  let exact = 'granted'
  try {
    exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm
  } catch {
    /* Android < 12 always allows exact alarms */
  }
  const pending = await LocalNotifications.getPending()
  const scheduled = pending.notifications.filter((n) => n.id >= TIMETABLE_ID_MIN && n.id <= TIMETABLE_ID_MAX).length
  return { supported: true, permission: perm.display, exact, scheduled }
}

export async function requestNotificationAccess() {
  const { LocalNotifications } = await plugins()
  const perm = await LocalNotifications.requestPermissions()
  return perm.display === 'granted'
}

export async function openExactAlarmSettings() {
  const { LocalNotifications } = await plugins()
  await LocalNotifications.changeExactNotificationSetting().catch(() => {})
}

async function cancelTimetable(LocalNotifications) {
  const pending = await LocalNotifications.getPending()
  const ours = pending.notifications.filter((n) => n.id >= TIMETABLE_ID_MIN && n.id <= TIMETABLE_ID_MAX)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
}

/**
 * Schedule a weekly repeating alarm for the start of every block, for all 7 days.
 * `leadMinutes` fires that many minutes early ("in 5 min: Deep Work I").
 */
export async function scheduleTimetable(plan, { enabled = true, leadMinutes = 0 } = {}) {
  if (!isNative()) return 0
  const { LocalNotifications } = await plugins()
  await cancelTimetable(LocalNotifications)
  if (!enabled) return 0

  const notifications = []
  for (let day = 0; day < 7; day++) {
    getSchedule(plan, day).forEach((b, i) => {
      // Fire time, shifted back by the lead and wrapped across midnight into the previous day.
      let mins = toMin(b.start) - leadMinutes
      let weekday = day
      if (mins < 0) {
        mins += 1440
        weekday = (day + 6) % 7
      }
      const isSleep = b.pillar === 'sleep'
      notifications.push({
        id: TIMETABLE_ID_MIN + day * 100 + i,
        channelId: CHANNEL,
        title: isSleep ? '🌙 Lights out' : leadMinutes ? `In ${leadMinutes} min · ${b.title}` : `${b.start} · ${b.title}`,
        body: (isSleep ? 'Phone out of the bedroom. 04:00 depends on tonight.' : b.detail || '').slice(0, 220),
        smallIcon: 'ic_stat_ascend',
        iconColor: '#8F7BFF',
        schedule: {
          on: { weekday: weekday + 1, hour: Math.floor(mins / 60), minute: mins % 60 },
          allowWhileIdle: true,
        },
        extra: { kind: 'timetable', block: b.id },
      })
    })
  }
  await LocalNotifications.schedule({ notifications })
  return notifications.length
}

export async function sendTestNotification() {
  const { LocalNotifications } = await plugins()
  await LocalNotifications.schedule({
    notifications: [{
      id: 1,
      channelId: CHANNEL,
      title: 'ASCEND alerts are working ✓',
      body: 'You will get a notification at the start of every block in your day.',
      smallIcon: 'ic_stat_ascend',
      iconColor: '#8F7BFF',
      schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
    }],
  })
}
