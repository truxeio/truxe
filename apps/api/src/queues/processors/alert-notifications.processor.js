/**
 * Alert Notifications Queue Processor
 *
 * Executes multi-channel alert fan-out for queued notification jobs.
 */

import alertNotifier from '../../services/alert-notifier.js'

export async function alertNotificationsProcessor(job) {
  return await alertNotifier.processQueuedNotification(job.data || {})
}

export default alertNotificationsProcessor
