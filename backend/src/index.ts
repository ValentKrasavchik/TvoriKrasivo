import { app } from './app';
import { startBookingReminderScheduler } from './lib/bookingReminderScheduler';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});

startBookingReminderScheduler();
