// The fallback config for the flyer QR router and demo app. Used only when the Vercel
// Global Config store (env GLOBAL_CONFIG) cannot be read; see lib/config.js. Joe flips the
// live values in the Vercel dashboard (Storage -> arowise-flyer-go), never here.
// Spec: ~/AroWise/20-Internal-Projects/flyer-qr-demo/README.md section 4.2.
export default {
  mode: 'book',
  booking_url: 'https://cal.com/arowise/discovery',
  ping_on_scan: true,
  buttons: [
    { id: 'screenshot', enabled: true, order: 1 },
    { id: 'receptionist', enabled: true, order: 2 },
    { id: 'text', enabled: false, order: 3 },
  ],
  caps: {
    receptionist_call_minutes_per_day: 30,
    receptionist_calls_per_phone_per_day: 1,
    receptionist_runs_per_domain_per_day: 2,
    llm_runs_per_day: 200,
    llm_runs_per_visitor_per_day: 3,
  },
};
