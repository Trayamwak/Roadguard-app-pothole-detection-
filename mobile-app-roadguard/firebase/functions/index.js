const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

initializeApp();
const db = getFirestore();

exports.notifyReporterWhenFixed = onDocumentUpdated(
  'reports/{reportId}',
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.status === 'fixed' || after.status !== 'fixed') return;
    if (!before.userId) return;

    const tokenDocs = await db
      .collection('users')
      .doc(before.userId)
      .collection('pushTokens')
      .where('enabled', '==', true)
      .get();
    const tokens = [...new Set(tokenDocs.docs.map((item) => item.data().expoPushToken).filter(Boolean))];
    if (!tokens.length) return;

    for (let start = 0; start < tokens.length; start += 100) {
      const messages = tokens.slice(start, start + 100).map((to) => ({
        to,
        sound: 'default',
        title: 'Road report updated',
        body: 'A city authority marked your pothole report as fixed.',
        data: { reportId: event.params.reportId, status: 'fixed' },
      }));
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (!response.ok) {
        throw new Error(`Expo Push API returned ${response.status}`);
      }
    }
  },
);
