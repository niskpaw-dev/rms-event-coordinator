const firebaseConfig = {
  apiKey: "AIzaSyBgJE0IG3IhyBoTz1-qX4ABoc7YMkmI0c",
  authDomain: "rms-event-coordinator.firebaseapp.com",
  projectId: "rms-event-coordinator",
  storageBucket: "rms-event-coordinator.firebasestorage.app",
  messagingSenderId: "456197661667",
  appId: "1:456197661667:web:015c26a884e115835d76d6"
};

  firebase.initializeApp(firebaseConfig);

  const db = firebase.firestore();