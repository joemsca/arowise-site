/* Small Arms Pistol Academy - schedule-data.js
   Demo data for the embedded class signup. Class names, prices and durations are SAPA's own (from the
   website and the ClassLoaderPro setup). Dates are generated relative to today so the preview never
   looks stale; seat counts, discount codes and add-ons are examples. In production this comes from the
   class-scheduler API. Edit here to change what the demo shows. */
window.SAPA_SCHEDULE = (function () {
  'use strict';
  function at(minDaysOut, weekday) { // next <weekday> (0 Sun .. 6 Sat) at least minDaysOut days from today
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + minDaysOut);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    return d;
  }
  function plus(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  var club = { name: 'Carroll Rod & Gun Club', address: '1111 Frew Run Rd, Frewsburg, NY 14738', note: 'Classroom is in the main building. The range is behind the clubhouse; eye and ear protection past the gate.' };
  var mike = 'Michael D. Hanselman';

  var terms = {
    title: 'Range Safety Rules and Liability Waiver',
    body: '1. Treat every firearm as if it is loaded.\n2. Never point a firearm at anything you are not willing to destroy.\n3. Keep your finger off the trigger until your sights are on the target.\n4. Be sure of your target and what is beyond it.\n\nBy registering you acknowledge that live-fire training carries inherent risk, that you will follow every instruction given by the instructor, and that you release Small Arms Pistol Academy LLC and the host range from liability for injury arising from your own failure to follow the rules above.\n\nRefunds: full refund up to 7 days before class; after that, your payment can be moved to a future class.'
  };

  var addons = {
    rental: { id: 'rental', name: 'Gun Rental Package (includes ammunition)', description: 'A range pistol and 50 rounds for the live-fire portion.', price: 2000, tax: 0 },
    ppe: { id: 'ppe', name: 'Eye & ear protection', description: 'Safety glasses and foam earplugs to keep.', price: 1000, tax: 80 }
  };

  function opt(id, name, seats, price, deposit) { return { id: id, name: name, seats: seats, price: price, deposit: deposit === undefined ? null : deposit }; }

  var types = [
    {
      id: 'ccw', name: 'NYS Carry Concealed Class', subtitle: 'NYS Carry Concealed Pistol Permit',
      description: 'Carry Concealed Class. $250 per student. Two days at the club.',
      days: 2, capacity: 30, start: '08:00', end: '17:00', location: club, instructors: [mike], terms: true, addons: ['rental', 'ppe'],
      options: [opt('ccw1', '(1 seat) Carry Concealed Class', 1, 25000, 5000), opt('ccw2', '(2 seats) Carry Concealed Class', 2, 50000, 10000), opt('ccw3', '(3 seats) Carry Concealed Class', 3, 75000, 15000), opt('ccw4', '(4 seats) Carry Concealed Class', 4, 100000, 20000)],
      classes: [{ code: 'CCW-1', start: at(16, 6), available: 17 }, { code: 'CCW-2', start: at(44, 6), available: 29 }]
    },
    {
      id: 'women', name: 'Women Only (Basic)', subtitle: 'Group Training',
      description: '*This class is ~2 hours in length. If you already own a pistol you can bring that with or you can try out some of the most popular firearms from my personal collection. This is a very basic class, it allows someone with very little knowledge or confidence in their firearm ability to learn the proper way to handle a firearm.',
      days: 1, capacity: 10, start: '09:00', end: '11:00', location: club, instructors: [mike], terms: true, addons: ['rental', 'ppe'],
      options: [opt('w1', '(1 seat) Women Only (Basic)', 1, 7500), opt('w2', '(2 seats) Women Only (Basic)', 2, 15000)],
      classes: [{ code: 'WOM-1', start: at(23, 6), available: 6 }]
    },
    {
      id: 'rights', name: 'Your Rights', subtitle: 'Group Training',
      description: '*This class is ~5 hours in length. With topics covering from mindset, use of force, legal & what to do when police arrive. Local guest speakers include a licensed attorney and law enforcement officer. This is an informational class so bring your pen & notepad!',
      days: 1, capacity: 10, start: '17:00', end: '22:00', location: club, instructors: [mike], terms: false, addons: [],
      options: [opt('r1', '(1 seat) Your Rights', 1, 10000), opt('r2', '(2 seats) Your Rights', 2, 20000), opt('r3', '(3 seats) Your Rights', 3, 30000)],
      classes: [{ code: 'RTS-1', start: at(12, 4), available: 0 }]
    },
    {
      id: 'cont', name: 'Continuation of Training', subtitle: 'Group Training',
      description: '*This class is ~2 hours in length. Open to anyone and offered monthly. Each month the specific topic changes while still implimenting the perfect fundamentals for a safe range experience yet geared towards more realisitic situations.',
      days: 1, capacity: 15, start: '09:00', end: '11:00', location: club, instructors: [mike], terms: true, addons: ['rental', 'ppe'],
      options: [opt('c1', 'Group Training - 1 spot', 1, 7500), opt('c2', 'Group Training - 2 spots', 2, 15000)],
      classes: [{ code: 'COT-1', start: at(30, 6), available: 9 }]
    },
    {
      id: 'p1', name: 'Pistol Level 1', subtitle: 'Group Training',
      description: 'This 6 hour course lays the foundation for all future pistol training. Safety, range etiquette, loading, equipment, fundamentals of shooting, draw-stroke, clearing stoppages, common mistakes, and proper mindset.',
      days: 1, capacity: 12, start: '09:00', end: '15:00', location: club, instructors: [mike], terms: true, addons: ['rental', 'ppe'],
      options: [opt('p1', 'Pistol Level 1', 1, 20000)],
      classes: [{ code: 'PL1-1', start: at(37, 6), available: 3 }]
    },
    {
      id: 'p2', name: 'Pistol Level 2', subtitle: 'Group Training',
      description: 'This 1 day course begins with a review of safety protocols and an audit of each individual’s shooting fundamentals. Prior SAPA training is required: you must have completed SAPA Pistol Level 1.',
      days: 1, capacity: 12, start: '09:00', end: '16:00', location: club, instructors: [mike], terms: true, addons: ['rental', 'ppe'],
      options: [opt('p2', 'Pistol Level 2', 1, 25000)],
      classes: []
    }
  ];

  // expand each class into sessions (one per day)
  types.forEach(function (t) {
    t.classes.forEach(function (c) {
      c.typeId = t.id; c.name = t.name; c.capacity = t.capacity; c.days = t.days;
      c.sessions = [];
      for (var i = 0; i < t.days; i++) c.sessions.push({ date: plus(c.start, i), start: t.start, end: t.end });
    });
  });

  return {
    org: { name: 'Small Arms Pistol Academy', phone: '716-397-5769', phoneDigits: '7163975769', site: 'https://www.smallarmspistolacademy.com' },
    types: types,
    addons: addons,
    terms: terms,
    discounts: [
      { code: 'SAPA', name: 'Friends & Family', type: 'fixed', value: 2000 },
      { code: 'VET20', name: 'Veterans', type: 'fixed', value: 2000 },
      { code: 'EARLY10', name: 'Early bird 10%', type: 'percent', value: 10, typeId: 'ccw' }
    ],
    payments: {
      offlineInstructions: 'Your seats are reserved. Payment is collected by Mike before class: text 716-397-5769 to arrange it, or pay at the door on day one.'
    }
  };
})();
