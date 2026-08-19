import webpush from "web-push";

// Các VAPID keys cần được thiết lập trong .env, nhưng ở đây có thể hardcode fallback
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || "BP6AAegTzTUBbISSb-6K3KA5NeAzkqDj15Bj8op1tCfDKehahvH9UzkPAau47bGNyqR52i1X8GgrLoJulwzAa-w";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "E3BXdPVe_kMT4Y9hR40IMrOGw7p2UQ3WHWSFE6ML45c";

webpush.setVapidDetails(
  "mailto:admin@tenwebsite.com",
  publicVapidKey,
  privateVapidKey
);

export default webpush;
